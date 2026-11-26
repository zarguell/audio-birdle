// Cloudflare Worker surface for the Audio-Birdle Discord Activity.
// Only /api/* is routed here; static pages, /assets/*, and /data/* are served
// directly by the assets binding unless /api/* is requested.

import { verifyDiscordRequest } from "./lib/verify.js";
import { createMessage, editMessage, getChannel, getMe } from "./lib/discord.js";

const INTERACTION_PING = 1;
const INTERACTION_APPLICATION_COMMAND = 2;

const RESPONSE_PONG = 1;
const RESPONSE_LAUNCH_ACTIVITY = 12;

const ACTIVITY_COMMAND_NAME = "audiobirdle";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

const SNOWFLAKE_PATTERN = /^\d{17,20}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const REGION_PATTERN = /^[a-z0-9-]{2,16}$/;
const MODE_MAX_GUESSES = { normal: 4, hard: 6 };

const SESSION_SELECT_SQL =
  "SELECT message_id FROM boards WHERE guild_id = ? AND channel_id = ? AND discord_id = ? AND date = ?";
const SESSION_INSERT_SQL =
  "INSERT INTO boards (guild_id, channel_id, discord_id, date, message_id) VALUES (?, ?, ?, ?, ?)";

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

/** @param {Request} request @returns {string | null} */
function bearerToken(request) {
  const header = request.headers.get("authorization");
  if (typeof header !== "string") return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

/** @param {Request} request @returns {Promise<Record<string, unknown> | null>} */
async function readJsonObject(request) {
  let value;
  try {
    value = await request.json();
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return /** @type {Record<string, unknown>} */ (value);
}

/**
 * Validate the fields shared by /api/session and /api/result.
 * @param {Record<string, unknown> | null} body
 */
function validateBoardRequest(body) {
  if (!body) return null;
  const { guildId, channelId, date, mode, region } = body;
  if (typeof guildId !== "string" || !SNOWFLAKE_PATTERN.test(guildId)) return null;
  if (typeof channelId !== "string" || !SNOWFLAKE_PATTERN.test(channelId)) return null;
  if (typeof date !== "string" || !DATE_PATTERN.test(date)) return null;
  if (mode !== "normal" && mode !== "hard") return null;
  if (typeof region !== "string" || !REGION_PATTERN.test(region)) return null;
  return { guildId, channelId, date, mode, region };
}

/** @param {string} mode */
function modeLabel(mode) {
  return mode === "hard" ? "Hard" : "Normal";
}

/**
 * @param {unknown} guesses
 * @param {"normal" | "hard"} mode
 */
function validateGuesses(guesses, mode) {
  const maxGuesses = MODE_MAX_GUESSES[mode];
  if (!Array.isArray(guesses) || guesses.length < 1 || guesses.length > maxGuesses) return false;

  return guesses.every((guess) => {
    if (!guess || typeof guess !== "object" || Array.isArray(guess)) return false;
    if (typeof guess.correct !== "boolean") return false;
    if (guess.taxonomicScore === undefined) return true;
    const score = guess.taxonomicScore;
    if (!score || typeof score !== "object" || Array.isArray(score)) return false;
    return ["order", "family", "genus"].every(
      (key) => score[key] === undefined || typeof score[key] === "boolean",
    );
  });
}

/**
 * @param {{ correct: boolean, taxonomicScore?: Record<string, unknown> }} guess
 * @param {"normal" | "hard"} mode
 */
function guessCell(guess, mode) {
  if (guess.correct) return "🟩";
  if (mode === "normal") return "🟥";

  const score = guess.taxonomicScore || {};
  const flags = ["order", "family", "genus"].filter((key) => score[key] === true).length;
  if (flags >= 3) return "🟨";
  if (flags >= 2) return "🟧";
  return "🟥";
}

/**
 * @param {Request} request
 * @param {{ DISCORD_BOT_TOKEN?: string, DB?: any }} env
 * @param {{ fetchImpl?: typeof fetch }} [options]
 */
export async function handleSession(request, env, { fetchImpl } = {}) {
  const token = bearerToken(request);
  if (!token) return json({ error: "unauthorized" }, 401);

  const input = validateBoardRequest(await readJsonObject(request));
  if (!input) return badRequest();

  const botToken = env?.DISCORD_BOT_TOKEN;
  const db = env?.DB;
  if (!botToken || !db) return json({ error: "not_configured" }, 501);

  let user;
  try {
    user = await getMe(fetchImpl, token);
  } catch {
    return json({ error: "unauthorized" }, 401);
  }

  let channel;
  try {
    channel = await getChannel(fetchImpl, botToken, input.channelId);
  } catch {
    return json({ error: "discord_unavailable" }, 502);
  }
  if (!channel || String(channel.guild_id) !== input.guildId) {
    return json({ error: "forbidden" }, 403);
  }

  let existing;
  try {
    existing = await db
      .prepare(SESSION_SELECT_SQL)
      .bind(input.guildId, input.channelId, user.id, input.date)
      .first();
  } catch {
    return json({ error: "storage_unavailable" }, 500);
  }
  if (existing?.message_id) {
    return json({ messageId: String(existing.message_id), user });
  }

  let message;
  try {
    message = await createMessage(fetchImpl, botToken, input.channelId, {
      content: `${user.username} is playing`,
      embeds: [
        {
          title: `Audio-Birdle ${input.date}`,
          description: `Region: ${input.region.toUpperCase()} · ${modeLabel(input.mode)}`,
        },
      ],
      allowed_mentions: { parse: [] },
    });
  } catch {
    return json({ error: "discord_unavailable" }, 502);
  }

  if (!message || typeof message.id !== "string") {
    return json({ error: "discord_unavailable" }, 502);
  }

  try {
    await db
      .prepare(SESSION_INSERT_SQL)
      .bind(input.guildId, input.channelId, user.id, input.date, message.id)
      .run();
  } catch {
    return json({ error: "storage_unavailable" }, 500);
  }

  return json({ messageId: message.id, user });
}

/**
 * @param {Request} request
 * @param {{ DISCORD_BOT_TOKEN?: string, DB?: any }} env
 * @param {{ fetchImpl?: typeof fetch }} [options]
 */
export async function handleResult(request, env, { fetchImpl } = {}) {
  const token = bearerToken(request);
  if (!token) return json({ error: "unauthorized" }, 401);

  const body = await readJsonObject(request);
  const input = validateBoardRequest(body);
  if (!input) return badRequest();

  const { won, maxGuesses, guesses } = /** @type {any} */ (body);
  if (
    typeof won !== "boolean" ||
    maxGuesses !== MODE_MAX_GUESSES[input.mode] ||
    !validateGuesses(guesses, input.mode)
  ) {
    return badRequest();
  }

  const botToken = env?.DISCORD_BOT_TOKEN;
  const db = env?.DB;
  if (!botToken || !db) return json({ error: "not_configured" }, 501);

  let user;
  try {
    user = await getMe(fetchImpl, token);
  } catch {
    return json({ error: "unauthorized" }, 401);
  }

  let channel;
  try {
    channel = await getChannel(fetchImpl, botToken, input.channelId);
  } catch {
    return json({ error: "discord_unavailable" }, 502);
  }
  if (!channel || String(channel.guild_id) !== input.guildId) {
    return json({ error: "forbidden" }, 403);
  }

  let existing;
  try {
    existing = await db
      .prepare(SESSION_SELECT_SQL)
      .bind(input.guildId, input.channelId, user.id, input.date)
      .first();
  } catch {
    return json({ error: "storage_unavailable" }, 500);
  }
  if (!existing?.message_id) {
    return json({ error: "board_not_found" }, 409);
  }

  const grid = guesses.map((guess) => guessCell(guess, input.mode)).join("");
  const score = won ? `${guesses.length}/${maxGuesses}` : `X/${maxGuesses}`;

  try {
    await editMessage(fetchImpl, botToken, input.channelId, String(existing.message_id), {
      content: `${user.username} finished`,
      embeds: [
        {
          title: `Audio-Birdle ${input.date}`,
          description: `Region: ${input.region.toUpperCase()} · ${modeLabel(input.mode)}\n${score}\n\n${grid}`,
        },
      ],
      allowed_mentions: { parse: [] },
    });
  } catch {
    return json({ error: "discord_unavailable" }, 502);
  }

  return json({ ok: true });
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

    if (pathname === "/api/session") {
      if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
      return handleSession(request, env);
    }

    if (pathname === "/api/result") {
      if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
      return handleResult(request, env);
    }

    return notFound();
  },
};
