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
const SESSION_URL = "/api/session";
const RESULT_URL = "/api/result";
const AUTHORIZE_SCOPE = ["identify", "guilds"];
const PLACEHOLDER_ORIGIN = "https://activity.invalid";

/**
 * Authenticated Activity state. Deliberately module memory only: the access
 * token, guild/channel ids, and the board message id never touch
 * localStorage or sessionStorage.
 */
let activityContext = null;
let boardMessageId = null;

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

const AUTH_CACHE_KEY = "audio-birdle-activity-auth";
const AUTH_CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * The Activity is a multi-page site, so a full navigation would otherwise
 * repeat the SDK handshake on every page. Cache the authenticated context for
 * this tab (sessionStorage, never localStorage); the access token stays out of
 * the web origin and disappears when the Activity tab closes.
 */
export function readActivityCache() {
  try {
    const raw = globalThis.sessionStorage?.getItem(AUTH_CACHE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed.accessToken !== "string" ||
      typeof parsed.user?.id !== "string" ||
      typeof parsed.at !== "number" ||
      Date.now() - parsed.at > AUTH_CACHE_TTL_MS
    ) {
      return null;
    }
    return {
      user: parsed.user,
      accessToken: parsed.accessToken,
      guildId: typeof parsed.guildId === "string" ? parsed.guildId : null,
      channelId: typeof parsed.channelId === "string" ? parsed.channelId : null,
    };
  } catch {
    return null;
  }
}

export function writeActivityCache(context) {
  try {
    globalThis.sessionStorage?.setItem(
      AUTH_CACHE_KEY,
      JSON.stringify({ ...context, at: Date.now() }),
    );
  } catch {
    // Cache is an optimization; in-memory context still works for this page.
  }
}

/**
 * The arguments for `commands.authorize`.
 *
 * `prompt: "none"` is what stops the OAuth consent modal appearing on every
 * launch: without it Discord treats each authorize as a fresh request and asks
 * a returning player to re-approve scopes they already granted. `response_type`
 * and `state` are part of the documented flow; `state` is empty because this is
 * an in-client postMessage exchange, not a browser redirect.
 */
export function authorizeRequest(clientId) {
  return {
    client_id: clientId,
    response_type: "code",
    state: "",
    prompt: "none",
    scope: AUTHORIZE_SCOPE,
  };
}

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

    const authorizeResult = await sdk.commands.authorize(
      authorizeRequest(clientId),
    );
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
    activityContext = {
      user,
      accessToken,
      guildId: typeof sdk.guildId === "string" ? sdk.guildId : null,
      channelId: typeof sdk.channelId === "string" ? sdk.channelId : null,
    };
    console.info("activity: ready", {
      guild: Boolean(activityContext.guildId),
      channel: Boolean(activityContext.channelId),
    });
    writeActivityCache(activityContext);
    return { user };
  } catch (error) {
    console.warn("Discord Activity initialisation failed:", error);
    // The proxy origin still shares this storage. If the handshake failed the
    // user is not authenticated, so never read or write the web game keys.
    setStorageNamespace("activity-unauthenticated");
    return null;
  }
}

function withTimeout(promise, ms) {
  let timer = null;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => {
      activityTimedOut = true;
      console.warn("Discord Activity handshake timed out");
      setStorageNamespace("activity-unauthenticated");
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
    const cached = readActivityCache();
    if (cached) {
      activityContext = cached;
      setStorageNamespace(`discord-${cached.user.id}`);
      document?.documentElement?.classList.add("is-activity");
      activityReady = Promise.resolve(cached);
    } else {
      activityReady = withTimeout(
        bootstrapActivity(options),
        ACTIVITY_READY_TIMEOUT_MS,
      );
    }
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

/**
 * The authenticated Activity context, or `null` on the web / before the
 * handshake completes. Contains the OAuth token, so it stays in memory.
 */
export function getActivityContext() {
  return activityContext;
}

export function buildSessionBody({ guildId, channelId, date, mode, region }) {
  return { guildId, channelId, date, mode, region };
}

export function buildResultBody(game, { guildId, channelId } = {}) {
  return {
    guildId,
    channelId,
    date: game?.date,
    mode: game?.mode,
    region: game?.region,
    won: Boolean(game?.won),
    maxGuesses: game?.maxGuesses,
    guesses: Array.isArray(game?.guesses)
      ? game.guesses.map((guess) => ({
          correct: Boolean(guess?.correct),
          taxonomicScore: {
            order: Boolean(guess?.taxonomicScore?.order),
            family: Boolean(guess?.taxonomicScore?.family),
            genus: Boolean(guess?.taxonomicScore?.genus),
          },
        }))
      : [],
  };
}

function postJson(url, body, accessToken) {
  const fetchImpl = globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error("fetch is unavailable");
  }
  return fetchImpl(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });
}

/**
 * Tell the Worker to open (or reuse) the public board for this daily game.
 * A no-op on the web and before Discord supplies a guild and channel.
 * Resolves the server payload on success and `null` otherwise; never throws.
 */
export async function startBoardSession({ date, mode, region } = {}) {
  const context = activityContext;
  if (!context?.guildId || !context?.channelId) {
    return null;
  }

  try {
    const response = await postJson(
      SESSION_URL,
      buildSessionBody({
        guildId: context.guildId,
        channelId: context.channelId,
        date,
        mode,
        region,
      }),
      context.accessToken,
    );
    if (!response || response.ok === false) {
      throw new Error(`Session request failed with status ${response?.status ?? "unknown"}`);
    }
    const payload = await response.json();
    if (typeof payload?.messageId === "string" && payload.messageId) {
      boardMessageId = payload.messageId;
    }
    return payload;
  } catch (error) {
    console.warn("Discord board session failed:", error);
    return null;
  }
}

/**
 * Post the finished daily result to the board opened by `startBoardSession`.
 * A no-op on the web or when no board message exists for this page; never
 * throws. Only the grid inputs are sent: no text input, no bird ids.
 */
export async function postBoardResult(game) {
  const context = activityContext;
  if (!context?.guildId || !context?.channelId || !boardMessageId) {
    return null;
  }

  try {
    const response = await postJson(
      RESULT_URL,
      buildResultBody(game, {
        guildId: context.guildId,
        channelId: context.channelId,
      }),
      context.accessToken,
    );
    if (!response || response.ok === false) {
      throw new Error(`Result request failed with status ${response?.status ?? "unknown"}`);
    }
    return await response.json();
  } catch (error) {
    console.warn("Discord board result failed:", error);
    return null;
  }
}
