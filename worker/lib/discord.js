// Discord REST helpers for the Activity API.
// Every helper takes an injected fetch implementation so tests never hit the
// network. Nothing here logs request headers or bodies: the authorization
// header always carries a secret (user OAuth token or bot token).

const DISCORD_API_BASE = "https://discord.com/api/v10";

/**
 * @typedef {(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>} FetchLike
 */

/**
 * Perform a Discord API request.
 *
 * The caller decides the credential: `bot: true` sends `Bot <token>`, anything
 * else sends the user OAuth token as-is. The response body is parsed as JSON
 * and returned; any non-2xx response throws an Error carrying `status`.
 *
 * @param {FetchLike} [fetchImpl]
 * @param {{ token?: string, bot?: boolean }} auth
 * @param {string} path
 * @param {{ method?: string, body?: unknown }} [options]
 * @returns {Promise<any>}
 */
export async function discordFetch(fetchImpl = globalThis.fetch, auth = {}, path, options = {}) {
  if (typeof fetchImpl !== "function") throw new Error("fetch_unavailable");

  const { method = "GET", body } = options;
  /** @type {Record<string, string>} */
  const headers = { accept: "application/json" };
  if (typeof auth.token === "string" && auth.token.length > 0) {
    headers.authorization = auth.bot ? `Bot ${auth.token}` : auth.token;
  }
  if (body !== undefined) headers["content-type"] = "application/json";

  const response = await fetchImpl(`${DISCORD_API_BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    const error = new Error(`discord_api_error_${response.status}`);
    /** @type {any} */ (error).status = response.status;
    throw error;
  }

  if (response.status === 204) return null;

  try {
    return await response.json();
  } catch {
    throw new Error("discord_api_invalid_response");
  }
}

/**
 * Fetch the OAuth user behind an access token.
 *
 * @param {FetchLike} [fetchImpl]
 * @param {string} userToken
 * @returns {Promise<{ id: string, username: string, avatar: string | null }>}
 */
export async function getMe(fetchImpl = globalThis.fetch, userToken) {
  const user = await discordFetch(fetchImpl, { token: userToken }, "/users/@me");
  if (!user || typeof user.id !== "string" || typeof user.username !== "string") {
    throw new Error("discord_api_invalid_response");
  }
  return {
    id: user.id,
    username: user.username,
    avatar: typeof user.avatar === "string" ? user.avatar : null,
  };
}

/**
 * Fetch a channel with the bot token so its owning guild can be verified.
 *
 * @param {FetchLike} [fetchImpl]
 * @param {string} botToken
 * @param {string} channelId
 * @returns {Promise<any>}
 */
export async function getChannel(fetchImpl = globalThis.fetch, botToken, channelId) {
  return discordFetch(
    fetchImpl,
    { token: botToken, bot: true },
    `/channels/${encodeURIComponent(channelId)}`,
  );
}

/**
 * Post a bot message.
 *
 * @param {FetchLike} [fetchImpl]
 * @param {string} botToken
 * @param {string} channelId
 * @param {unknown} payload
 * @returns {Promise<any>}
 */
export async function createMessage(fetchImpl = globalThis.fetch, botToken, channelId, payload) {
  return discordFetch(
    fetchImpl,
    { token: botToken, bot: true },
    `/channels/${encodeURIComponent(channelId)}/messages`,
    { method: "POST", body: payload },
  );
}

/**
 * Edit a bot-owned message.
 *
 * @param {FetchLike} [fetchImpl]
 * @param {string} botToken
 * @param {string} channelId
 * @param {string} messageId
 * @param {unknown} payload
 * @returns {Promise<any>}
 */
export async function editMessage(
  fetchImpl = globalThis.fetch,
  botToken,
  channelId,
  messageId,
  payload,
) {
  return discordFetch(
    fetchImpl,
    { token: botToken, bot: true },
    `/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(messageId)}`,
    { method: "PATCH", body: payload },
  );
}
