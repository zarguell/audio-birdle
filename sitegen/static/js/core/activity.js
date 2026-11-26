/**
 * Discord Activity bootstrap.
 *
 * The web build never touches this code path: `isActivity()` is false outside
 * Discord's proxy, so `initActivity()` resolves `null` without importing the
 * vendored SDK. Inside an Activity the SDK performs the Discord handshake, the
 * one-time code is exchanged for an access token by the Worker, and local
 * storage is scoped to the authenticated Discord user.
 */
import { setStorageNamespace } from "./storage.js";

const DISCORD_HOST_SUFFIX = ".discordsays.com";
const SDK_URL = "../../vendor/embedded-app-sdk.js";
const TOKEN_URL = "/api/token";
const AUTHORIZE_SCOPE = ["identify"];
const PLACEHOLDER_ORIGIN = "https://activity.invalid";

function normalizeLocation(locationLike) {
  if (typeof locationLike === "string") {
    try {
      return new URL(locationLike, PLACEHOLDER_ORIGIN);
    } catch {
      return null;
    }
  }
  if (!locationLike || typeof locationLike !== "object") {
    return null;
  }
  if (typeof locationLike.href === "string") {
    try {
      return new URL(locationLike.href);
    } catch {
      return null;
    }
  }
  return {
    hostname:
      typeof locationLike.hostname === "string" ? locationLike.hostname : "",
    search: typeof locationLike.search === "string" ? locationLike.search : "",
  };
}

export function isActivity(locationLike = globalThis.location) {
  const location = normalizeLocation(locationLike);
  if (location === null) {
    return false;
  }
  if (location.hostname.toLowerCase().endsWith(DISCORD_HOST_SUFFIX)) {
    return true;
  }
  return new URLSearchParams(location.search).get("activity") === "1";
}

function clientIdFromDocument() {
  const meta = document.querySelector('meta[name="discord-client-id"]');
  return meta?.getAttribute("content")?.trim() ?? "";
}

function redirectUriFrom(authorizeResult, sdk) {
  const value =
    authorizeResult?.redirect_uri ??
    authorizeResult?.redirectUri ??
    sdk.configuration?.redirectUri;
  return typeof value === "string" && value ? value : null;
}

async function exchangeCode(code, redirectUri, fetchImpl) {
  const body = new URLSearchParams({ code });
  if (redirectUri !== null) {
    body.set("redirect_uri", redirectUri);
  }
  const response = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response || response.ok === false) {
    throw new Error(`Token exchange failed with status ${response?.status ?? "unknown"}`);
  }
  const payload = await response.json();
  const accessToken = payload?.access_token;
  if (typeof accessToken !== "string" || !accessToken) {
    throw new Error("Token exchange returned no access token");
  }
  return accessToken;
}

let activityReady = null;
let activityTimedOut = false;
const ACTIVITY_READY_TIMEOUT_MS = 8000;

async function bootstrapActivity(options) {
  const fetchImpl = options?.fetchImpl ?? globalThis.fetch;

  try {
    const clientId = clientIdFromDocument();
    if (!clientId) {
      throw new Error("Missing discord-client-id meta tag");
    }

    const { DiscordSDK } = await import(SDK_URL);
    const sdk = new DiscordSDK(clientId);
    await sdk.ready();

    const authorizeResult = await sdk.commands.authorize({
      client_id: clientId,
      scope: AUTHORIZE_SCOPE,
    });
    const code = authorizeResult?.code;
    if (typeof code !== "string" || !code) {
      throw new Error("Discord authorization returned no code");
    }

    if (typeof fetchImpl !== "function") {
      throw new Error("fetch is unavailable");
    }
    const accessToken = await exchangeCode(
      code,
      redirectUriFrom(authorizeResult, sdk),
      fetchImpl,
    );

    const authentication = await sdk.commands.authenticate({
      access_token: accessToken,
    });
    const user = authentication?.user;
    if (!user || typeof user.id !== "string" || !user.id) {
      throw new Error("Discord authentication returned no user");
    }

    if (activityTimedOut) {
      return null;
    }
    document.documentElement.classList.add("is-activity");
    setStorageNamespace(`discord-${user.id}`);
    return { user };
  } catch (error) {
    console.warn("Discord Activity initialisation failed:", error);
    return null;
  }
}

function withTimeout(promise, ms) {
  let timer = null;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => {
      activityTimedOut = true;
      console.warn("Discord Activity handshake timed out");
      resolve(null);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Start (or join) the Activity handshake. Page modules can call this directly;
 * `whenActivityReady()` joins the same promise.
 */
export function initActivity(options = {}) {
  if (!isActivity()) {
    return Promise.resolve(null);
  }
  if (activityReady === null) {
    activityReady = withTimeout(
      bootstrapActivity(options),
      ACTIVITY_READY_TIMEOUT_MS,
    );
  }
  return activityReady;
}

/**
 * Resolve before reading localStorage: page modules await this at startup.
 * Outside Discord it resolves immediately; inside an Activity it resolves only
 * after the user is authenticated and the storage namespace is set.
 */
export function whenActivityReady() {
  if (!isActivity()) {
    return Promise.resolve(null);
  }
  return initActivity().catch(() => null);
}
