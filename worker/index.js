// Cloudflare Worker surface for the Audio-Birdle Discord Activity.
// Only /api/* is routed here; static pages, /assets/*, and /data/* are served
// directly by the assets binding unless /api/* is requested.

import { verifyDiscordRequest } from "./lib/verify.js";

const INTERACTION_PING = 1;
const INTERACTION_APPLICATION_COMMAND = 2;

const RESPONSE_PONG = 1;
const RESPONSE_LAUNCH_ACTIVITY = 12;

const ACTIVITY_COMMAND_NAME = "audiobirdle";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

/** @param {unknown} body @param {number} [status] */
function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

/** @param {string} name */
function notFound() {
  return json({ error: "not_found" }, 404);
}

/** @param {string} error */
function badRequest(error = "invalid_request") {
  return json({ error }, 400);
}

/**
 * Verify the Discord signature and dispatch the interaction.
 * @param {Request} request
 * @param {{ DISCORD_PUBLIC_KEY?: string }} env
 */
async function handleInteractions(request, env) {
  const publicKeyHex = env?.DISCORD_PUBLIC_KEY;
  if (!publicKeyHex) return json({ error: "not_configured" }, 501);

  const signatureHex = request.headers.get("x-signature-ed25519");
  const timestamp = request.headers.get("x-signature-timestamp");
  const body = await request.text();

  const valid = await verifyDiscordRequest({ publicKeyHex, signatureHex, timestamp, body });
  if (!valid) return json({ error: "invalid_signature" }, 401);

  let interaction;
  try {
    interaction = JSON.parse(body);
  } catch {
    return badRequest();
  }
  if (!interaction || typeof interaction !== "object") return badRequest();

  if (interaction.type === INTERACTION_PING) {
    return json({ type: RESPONSE_PONG });
  }

  if (interaction.type === INTERACTION_APPLICATION_COMMAND) {
    const name = interaction.data?.name;
    if (name === ACTIVITY_COMMAND_NAME) {
      return json({ type: RESPONSE_LAUNCH_ACTIVITY });
    }
  }

  return badRequest("unsupported_interaction");
}

/**
 * Exchange an OAuth2 authorization code for an access token.
 * @param {Request} request
 * @param {{ DISCORD_CLIENT_ID?: string, DISCORD_CLIENT_SECRET?: string }} env
 */
async function handleToken(request, env) {
  const clientId = env?.DISCORD_CLIENT_ID;
  const clientSecret = env?.DISCORD_CLIENT_SECRET;
  if (!clientId || !clientSecret) return json({ error: "not_configured" }, 501);

  let form;
  try {
    form = await request.formData();
  } catch {
    return badRequest();
  }

  const code = form.get("code");
  if (typeof code !== "string" || code.length === 0) return badRequest();

  const redirectUri = form.get("redirect_uri");
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
  });
  if (typeof redirectUri === "string" && redirectUri.length > 0) {
    params.set("redirect_uri", redirectUri);
  }

  let upstream;
  try {
    upstream = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
  } catch {
    return json({ error: "token_exchange_failed" }, 502);
  }

  if (!upstream.ok) return json({ error: "token_exchange_failed" }, 502);

  let data;
  try {
    data = await upstream.json();
  } catch {
    return json({ error: "token_exchange_failed" }, 502);
  }

  if (!data || typeof data.access_token !== "string") {
    return json({ error: "token_exchange_failed" }, 502);
  }

  return json({ access_token: data.access_token });
}

/** @param {string} error */
function notImplemented() {
  return json({ error: "not_implemented" }, 501);
}

/**
 * @param {Request} request
 * @param {Record<string, unknown>} env
 */
export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    // Defensive: the assets layer is expected to keep non-/api traffic out.
    if (pathname !== "/api" && !pathname.startsWith("/api/")) return notFound();

    if (pathname === "/api/health") {
      if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
      return json({ ok: true });
    }

    if (pathname === "/api/interactions") {
      if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
      return handleInteractions(request, env);
    }

    if (pathname === "/api/token") {
      if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
      return handleToken(request, env);
    }

    if (pathname === "/api/session" || pathname === "/api/result") {
      if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
      return notImplemented();
    }

    return notFound();
  },
};
