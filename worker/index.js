// Cloudflare Worker surface for the Audio-Birdle Discord Activity.
// Only /api/* is routed here; static pages, /assets/*, and /data/* are served
// directly by the assets binding unless /api/* is requested.

import { verifyDiscordRequest } from "./lib/verify.js";
import {
  createMessage,
  editMessage,
  getChannel,
  getGuildMember,
  getOauthUser,
} from "./lib/discord.js";
import { computeStreak, previousDate } from "./lib/streaks.js";

const INTERACTION_PING = 1;
const INTERACTION_APPLICATION_COMMAND = 2;

const RESPONSE_PONG = 1;
const RESPONSE_CHANNEL_MESSAGE = 4;
const RESPONSE_DEFERRED = 5;
const RESPONSE_LAUNCH_ACTIVITY = 12;

const EPHEMERAL_FLAG = 64;
const CHANNEL_OPTION = 7;
const PERMISSION_MANAGE_GUILD = 0x20n;

const ACTIVITY_COMMAND_NAME = "audiobirdle";
const SETUP_COMMAND_NAME = "audiobirdle-setup";
const STATS_COMMAND_NAME = "audiobirdle-stats";
const FORGET_COMMAND_NAME = "audiobirdle-forget";

const SUMMARY_GUILD_LIMIT = 40;

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

const MAX_JSON_BODY_BYTES = 8 * 1024;
const MAX_INTERACTION_BYTES = 32 * 1024;
const MAX_TIMESTAMP_SKEW_SECONDS = 300;
const LAUNCH_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const USER_RATE_LIMIT = 30;
const TOKEN_RATE_LIMIT = 20;

const DAY_MS = 24 * 60 * 60 * 1000;
const RESULTS_RETENTION_DAYS = 90;
const BOARDS_RETENTION_DAYS = 30;
const LAUNCH_RETENTION_MS = 60 * 60 * 1000;
const RATE_LIMIT_RETENTION_MS = DAY_MS;
const ANALYTICS_RETENTION_DAYS = 2;

const SNOWFLAKE_PATTERN = /^\d{17,20}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const REGION_PATTERN = /^[a-z0-9-]{2,16}$/;
const MODE_MAX_GUESSES = { normal: 4, hard: 6 };

const SESSION_SELECT_SQL =
  "SELECT message_id FROM boards WHERE guild_id = ? AND channel_id = ? AND discord_id = ? AND date = ? AND mode = ?";
const SESSION_INSERT_SQL =
  "INSERT INTO boards (guild_id, channel_id, discord_id, date, mode, message_id) VALUES (?, ?, ?, ?, ?, ?)";

const LAUNCH_SELECT_SQL =
  "SELECT created_at FROM launches WHERE discord_id = ? AND guild_id = ? AND channel_id = ?";
const LAUNCH_UPSERT_SQL =
  "INSERT INTO launches (discord_id, guild_id, channel_id, created_at) VALUES (?, ?, ?, ?) " +
  "ON CONFLICT(discord_id, guild_id, channel_id) DO UPDATE SET created_at = excluded.created_at";

const RATE_LIMIT_SQL =
  "INSERT INTO rate_limits (subject, window_start, count) VALUES (?, ?, 1) " +
  "ON CONFLICT(subject, window_start) DO UPDATE SET count = count + 1 RETURNING count";

const CLEANUP_RESULTS_SQL = "DELETE FROM results WHERE created_at < ?";
const CLEANUP_BOARDS_SQL = "DELETE FROM boards WHERE updated_at < ?";
const CLEANUP_LAUNCHES_SQL = "DELETE FROM launches WHERE created_at < ?";
const CLEANUP_RATE_LIMITS_SQL = "DELETE FROM rate_limits WHERE window_start < ?";
const CLEANUP_ANALYTICS_SQL = "DELETE FROM analytics_daily WHERE created_at < ?";

const PLAYER_UPSERT_SQL =
  "INSERT INTO players (discord_id, username, avatar, region, created_at) VALUES (?, ?, ?, ?, ?) " +
  "ON CONFLICT(discord_id) DO UPDATE SET username = excluded.username, avatar = excluded.avatar, region = excluded.region";
const RESULT_UPSERT_SQL =
  "INSERT INTO results (guild_id, channel_id, discord_id, date, mode, region, won, guess_count, created_at) " +
  "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) " +
  "ON CONFLICT(guild_id, date, mode, discord_id) DO UPDATE SET won = excluded.won, guess_count = excluded.guess_count, region = excluded.region, created_at = excluded.created_at";

const GUILD_UPSERT_SQL =
  "INSERT INTO guilds (guild_id, summary_channel_id, created_at) VALUES (?, ?, ?) " +
  "ON CONFLICT(guild_id) DO UPDATE SET summary_channel_id = excluded.summary_channel_id";

const DELETE_PLAYER_SQL = "DELETE FROM players WHERE discord_id = ?";
const DELETE_BOARDS_SQL = "DELETE FROM boards WHERE discord_id = ?";
const DELETE_RESULTS_SQL = "DELETE FROM results WHERE discord_id = ?";

const STATS_SELECT_SQL =
  "SELECT COUNT(*) AS played, COALESCE(SUM(won), 0) AS wins, " +
  "MIN(CASE WHEN won = 1 THEN guess_count END) AS best FROM results WHERE discord_id = ?";
const RESULT_DATES_SQL =
  "SELECT date FROM results WHERE discord_id = ? ORDER BY date DESC LIMIT 400";

const SUMMARY_GUILDS_SQL =
  "SELECT guild_id, summary_channel_id FROM guilds WHERE summary_channel_id IS NOT NULL " +
  "AND summary_channel_id != '' LIMIT ?";
const SUMMARY_RESULTS_SQL =
  "SELECT p.username AS username, r.won AS won, r.guess_count AS guess_count, r.mode AS mode " +
  "FROM results r JOIN players p ON p.discord_id = r.discord_id " +
  "WHERE r.guild_id = ? AND r.date = ? ORDER BY r.won DESC, r.guess_count ASC";
const SUMMARY_DATES_SQL =
  "SELECT DISTINCT date FROM results WHERE guild_id = ? ORDER BY date DESC LIMIT 400";

/** @param {unknown} body @param {number} [status] @param {Record<string, string>} [extraHeaders] */
function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

/** @param {string} name */
function notFound() {
  return json({ error: "not_found" }, 404);
}

/** @param {string} error */
function badRequest(error = "invalid_request") {
  return json({ error }, 400);
}

function payloadTooLarge() {
  return json({ error: "payload_too_large" }, 413);
}

function rateLimited() {
  return json({ error: "rate_limited" }, 429, { "retry-after": "60" });
}

function unavailable() {
  return json({ error: "unavailable" }, 503);
}

/**
 * Read a request body with a hard byte cap. The declared content length is
 * checked first so an oversized body never reaches the parser; the decoded
 * length is checked again because the header can lie.
 * @param {Request} request
 * @param {number} maxBytes
 * @returns {Promise<{ text: string | null, tooLarge: boolean }>}
 */
async function readLimitedText(request, maxBytes) {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { text: null, tooLarge: true };
  }

  let text;
  try {
    text = await request.text();
  } catch {
    return { text: null, tooLarge: false };
  }
  if (new TextEncoder().encode(text).length > maxBytes) {
    return { text: null, tooLarge: true };
  }
  return { text, tooLarge: false };
}

/** @param {string} date @param {number} nowMs */
function dateWithinOneDay(date, nowMs) {
  const [year, month, day] = date.split("-").map(Number);
  const dayNumber = Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
  const todayNumber = Math.floor(nowMs / DAY_MS);
  return Math.abs(dayNumber - todayNumber) <= 1;
}

/** @param {number} nowMs @param {string} subject @param {number} limit */
async function overRateLimit(db, nowMs, subject, limit) {
  const windowStart = Math.floor(nowMs / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_WINDOW_MS;
  try {
    const row = await db.prepare(RATE_LIMIT_SQL).bind(subject, windowStart).first();
    return Number(row?.count ?? 0) > limit;
  } catch {
    return false;
  }
}

/** @param {any} interaction @param {number} nowMs */
async function recordLaunch(db, interaction, nowMs) {
  const discordId = interactionUserId(interaction);
  const guildId = interaction.guild_id;
  const channelId = interaction.channel_id;
  if (
    !discordId ||
    typeof guildId !== "string" ||
    !SNOWFLAKE_PATTERN.test(guildId) ||
    typeof channelId !== "string" ||
    !SNOWFLAKE_PATTERN.test(channelId)
  ) {
    return false;
  }
  await db
    .prepare(LAUNCH_UPSERT_SQL)
    .bind(discordId, guildId, channelId, nowMs)
    .run();
  return true;
}

/** @param {any} db @param {string} discordId @param {string} guildId @param {string} channelId @param {number} nowMs */
async function hasRecentLaunch(db, discordId, guildId, channelId, nowMs) {
  const row = await db
    .prepare(LAUNCH_SELECT_SQL)
    .bind(discordId, guildId, channelId)
    .first();
  const createdAt = Number(row?.created_at);
  return Number.isFinite(createdAt) && createdAt > nowMs - LAUNCH_WINDOW_MS;
}

function nowIso() {
  return new Date().toISOString();
}

/**
 * Ephemeral interaction reply in Discord's callback shape. allowed_mentions is
 * always empty so a stored username can never ping a role or @everyone.
 * @param {Record<string, unknown>} payload
 */
function ephemeral(payload) {
  return json({
    type: RESPONSE_CHANNEL_MESSAGE,
    data: {
      ...payload,
      flags: EPHEMERAL_FLAG,
      allowed_mentions: { parse: [] },
    },
  });
}

/** Acknowledge an admin command before doing slow work. */
function deferred() {
  return json({ type: RESPONSE_DEFERRED, data: { flags: EPHEMERAL_FLAG } });
}

/**
 * Answer an admin command within Discord's three-second window, run the work
 * in the background, and edit the deferred ephemeral response.
 *
 * Without an execution context (unit tests) the work runs inline and its
 * response is returned directly.
 */
async function deferCommand(interaction, env, ctx, work, fetchImpl) {
  if (!ctx?.waitUntil) {
    return work();
  }

  const appId = interaction.application_id || env?.DISCORD_CLIENT_ID;
  const interactionToken = interaction.token;
  const job = (async () => {
    let data;
    try {
      const response = await work();
      const payload = await response.json();
      data = payload?.data ?? { content: STORAGE_ERROR };
    } catch {
      data = { content: STORAGE_ERROR };
    }
    if (!appId || !interactionToken) return;

    console.info(
      "deferred",
      typeof data?.content === "string" ? data.content : "embed",
    );

    const rest = { ...data };
    delete rest.flags;
    const impl = fetchImpl ?? fetch;
    try {
      await impl(
        `https://discord.com/api/v10/webhooks/${appId}/${interactionToken}/messages/@original`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...rest, allowed_mentions: { parse: [] } }),
        },
      );
    } catch {
      console.error("interaction: deferred update failed");
    }
  })();

  ctx.waitUntil(job);
  return deferred();
}

/** @param {any} member */
function hasManageGuild(member) {
  const raw = member?.permissions;
  if (typeof raw !== "string" || !/^\d+$/.test(raw)) return false;
  try {
    return (BigInt(raw) & PERMISSION_MANAGE_GUILD) === PERMISSION_MANAGE_GUILD;
  } catch {
    return false;
  }
}

/** @param {any} interaction @returns {string | null} */
function interactionUserId(interaction) {
  const id = interaction?.member?.user?.id ?? interaction?.user?.id;
  return typeof id === "string" && SNOWFLAKE_PATTERN.test(id) ? id : null;
}

/** @param {any} subcommand @param {string} name @param {number} type */
function findOptionValue(subcommand, name, type) {
  const options = Array.isArray(subcommand?.options) ? subcommand.options : [];
  const option = options.find((entry) => entry?.name === name && entry?.type === type);
  return typeof option?.value === "string" ? option.value : null;
}

/** @param {any} value */
function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

const STORAGE_ERROR = "Could not save right now. Try again later.";

/**
 * @param {any} interaction
 * @param {{ DB?: any, DISCORD_BOT_TOKEN?: string }} env
 * @param {any} subcommand
 * @param {{ fetchImpl?: typeof fetch }} [options]
 */
async function handleSetup(interaction, env, subcommand, { fetchImpl } = {}) {
  if (!hasManageGuild(interaction.member)) {
    return ephemeral({ content: "You need Manage Server to use this." });
  }

  const guildId = interaction.guild_id;
  const channelId = findOptionValue(subcommand, "channel", CHANNEL_OPTION);
  if (
    typeof guildId !== "string" ||
    !SNOWFLAKE_PATTERN.test(guildId) ||
    channelId === null ||
    !SNOWFLAKE_PATTERN.test(channelId)
  ) {
    return ephemeral({ content: "Pick a text channel in this server." });
  }

  const db = env?.DB;
  const botToken = env?.DISCORD_BOT_TOKEN;
  if (!db || !botToken) {
    return ephemeral({ content: "Summaries are not configured on this deployment." });
  }

  let channel;
  try {
    channel = await getChannel(fetchImpl, botToken, channelId);
  } catch {
    return ephemeral({
      content:
        "I can't read that channel. Give me View Channel, or pick a public channel.",
    });
  }
  if (!channel || String(channel.guild_id) !== guildId) {
    return ephemeral({ content: "That channel is not in this server." });
  }

  try {
    await db.prepare(GUILD_UPSERT_SQL).bind(guildId, channelId, nowIso()).run();
  } catch {
    return ephemeral({ content: STORAGE_ERROR });
  }

  return ephemeral({ content: `Daily summaries will post in <#${channelId}>.` });
}

/**
 * @param {any} interaction
 * @param {{ DB?: any }} env
 */
async function handleForget(interaction, env) {
  const discordId = interactionUserId(interaction);
  if (!discordId) return badRequest();

  const db = env?.DB;
  if (!db) return json({ error: "not_configured" }, 501);

  try {
    for (const sql of [DELETE_PLAYER_SQL, DELETE_BOARDS_SQL, DELETE_RESULTS_SQL]) {
      await db.prepare(sql).bind(discordId).run();
    }
  } catch {
    return ephemeral({ content: STORAGE_ERROR });
  }

  return ephemeral({
    content:
      "Your stored Audio-Birdle data was deleted. Pseudonymous analytics rows " +
      "carry no identity and expire within 48 hours.",
  });
}

/**
 * @param {any} interaction
 * @param {{ DB?: any }} env
 */
async function handleStats(interaction, env) {
  const discordId = interactionUserId(interaction);
  if (!discordId) return badRequest();

  const db = env?.DB;
  if (!db) return json({ error: "not_configured" }, 501);

  let summary;
  let dateRows;
  try {
    summary = await db.prepare(STATS_SELECT_SQL).bind(discordId).first();
    dateRows = await db.prepare(RESULT_DATES_SQL).bind(discordId).all();
  } catch {
    return ephemeral({ content: STORAGE_ERROR });
  }

  const played = asNumber(summary?.played);
  if (played === 0) {
    return ephemeral({
      embeds: [
        {
          title: "Audio-Birdle — your stats",
          description: "No results yet. Play a daily challenge to start your streak.",
        },
      ],
    });
  }

  const wins = asNumber(summary?.wins);
  const best = summary?.best === null || summary?.best === undefined ? null : asNumber(summary.best);
  const dates = Array.isArray(dateRows?.results)
    ? dateRows.results.map((row) => String(row?.date))
    : [];

  const today = new Date().toISOString().slice(0, 10);
  let streak = computeStreak(dates, today);
  if (streak === 0) {
    const yesterday = previousDate(today);
    if (yesterday) streak = computeStreak(dates, yesterday);
  }

  const lines = [
    `Played: ${played}`,
    `Wins: ${wins}`,
    `Best win: ${best === null ? "—" : `${best} guess${best === 1 ? "" : "es"}`}`,
    `Current streak: ${streak} day${streak === 1 ? "" : "s"}`,
  ];

  return ephemeral({
    embeds: [{ title: "Audio-Birdle — your stats", description: lines.join("\n") }],
  });
}

/**
 * Verify the Discord signature and dispatch the interaction.
 * @param {Request} request
 * @param {{ DISCORD_PUBLIC_KEY?: string, DB?: any, DISCORD_BOT_TOKEN?: string, ACTIVITY_DISABLED?: string }} env
 * @param {{ now?: number, fetchImpl?: typeof fetch }} [options]
 */
async function handleInteractions(request, env, { now = Date.now(), fetchImpl, ctx } = {}) {
  const publicKeyHex = env?.DISCORD_PUBLIC_KEY;
  if (!publicKeyHex) return json({ error: "not_configured" }, 501);

  const limited = await readLimitedText(request, MAX_INTERACTION_BYTES);
  if (limited.tooLarge) return payloadTooLarge();
  const body = limited.text;
  if (typeof body !== "string") return badRequest();

  const signatureHex = request.headers.get("x-signature-ed25519");
  const timestamp = request.headers.get("x-signature-timestamp");

  const timestampSeconds = Number(timestamp);
  if (
    !Number.isFinite(timestampSeconds) ||
    Math.abs(Math.floor(now / 1000) - timestampSeconds) > MAX_TIMESTAMP_SKEW_SECONDS
  ) {
    return json({ error: "invalid_signature" }, 401);
  }

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
    if (env?.ACTIVITY_DISABLED === "1") {
      return ephemeral({ content: "Audio-Birdle is temporarily unavailable." });
    }

    const name = interaction.data?.name;
    console.info(
      "interaction",
      interaction.type,
      name ?? "",
      interaction.data?.type ?? "",
    );

    if (name === ACTIVITY_COMMAND_NAME) {
      const db = env?.DB;
      if (db) {
        const work = recordLaunch(db, interaction, now);
        if (ctx?.waitUntil) {
          ctx.waitUntil(
            work.catch((error) => console.error("launch: record failed", error?.message)),
          );
        } else {
          try {
            await work;
          } catch {
            return ephemeral({ content: STORAGE_ERROR });
          }
        }
      }
      return json({ type: RESPONSE_LAUNCH_ACTIVITY });
    }

    if (name === SETUP_COMMAND_NAME) {
      return deferCommand(interaction, env, ctx, () => handleSetup(interaction, env, interaction.data, { fetchImpl }), fetchImpl);
    }
    if (name === STATS_COMMAND_NAME) {
      return deferCommand(interaction, env, ctx, () => handleStats(interaction, env), fetchImpl);
    }
    if (name === FORGET_COMMAND_NAME) {
      return deferCommand(interaction, env, ctx, () => handleForget(interaction, env), fetchImpl);
    }
    return badRequest("unknown_command");
  }

  return badRequest("unsupported_interaction");
}

/**
 * Exchange an OAuth2 authorization code for an access token.
 * @param {Request} request
 * @param {{ DISCORD_CLIENT_ID?: string, DISCORD_CLIENT_SECRET?: string, DB?: any, ACTIVITY_DISABLED?: string }} env
 * @param {{ now?: number }} [options]
 */
async function handleToken(request, env, { now = Date.now() } = {}) {
  if (env?.ACTIVITY_DISABLED === "1") return unavailable();

  const limited = await readLimitedText(request, MAX_JSON_BODY_BYTES);
  if (limited.tooLarge) return payloadTooLarge();
  if (typeof limited.text !== "string") return badRequest();

  const clientId = env?.DISCORD_CLIENT_ID;
  const clientSecret = env?.DISCORD_CLIENT_SECRET;
  if (!clientId || !clientSecret) return json({ error: "not_configured" }, 501);

  const db = env?.DB;
  if (db) {
    const ip = request.headers.get("cf-connecting-ip") || "unknown";
    if (await overRateLimit(db, now, `token:${ip}`, TOKEN_RATE_LIMIT)) {
      return rateLimited();
    }
  }

  const form = new URLSearchParams(limited.text);
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

/**
 * Read a JSON object body under the 8 KiB cap.
 * @param {Request} request
 * @returns {Promise<{ body: Record<string, unknown> | null, tooLarge: boolean }>}
 */
async function readJsonObject(request) {
  const limited = await readLimitedText(request, MAX_JSON_BODY_BYTES);
  if (limited.tooLarge) return { body: null, tooLarge: true };
  if (typeof limited.text !== "string") return { body: null, tooLarge: false };

  let value;
  try {
    value = JSON.parse(limited.text);
  } catch {
    return { body: null, tooLarge: false };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { body: null, tooLarge: false };
  }
  return { body: /** @type {Record<string, unknown>} */ (value), tooLarge: false };
}

/**
 * Validate the fields shared by /api/session and /api/result. Unknown fields
 * are ignored; only the values returned here reach Discord or D1.
 * @param {Record<string, unknown> | null} body
 * @param {number} nowMs
 */
function validateBoardRequest(body, nowMs) {
  if (!body) return null;
  const { guildId, channelId, date, mode, region } = body;
  if (typeof guildId !== "string" || !SNOWFLAKE_PATTERN.test(guildId)) return null;
  if (typeof channelId !== "string" || !SNOWFLAKE_PATTERN.test(channelId)) return null;
  if (typeof date !== "string" || !DATE_PATTERN.test(date)) return null;
  if (!dateWithinOneDay(date, nowMs)) return null;
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
 * @param {number} maxGuesses
 */
function validateGuesses(guesses, maxGuesses) {
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
 * @param {{ DISCORD_BOT_TOKEN?: string, DISCORD_CLIENT_ID?: string, DB?: any, ACTIVITY_DISABLED?: string }} env
 * @param {{ fetchImpl?: typeof fetch, now?: number }} [options]
 */
export async function handleSession(request, env, { fetchImpl, now = Date.now() } = {}) {
  if (env?.ACTIVITY_DISABLED === "1") return unavailable();

  const token = bearerToken(request);
  if (!token) return json({ error: "unauthorized" }, 401);

  const parsed = await readJsonObject(request);
  if (parsed.tooLarge) return payloadTooLarge();
  const input = validateBoardRequest(parsed.body, now);
  if (!input) return badRequest();

  const botToken = env?.DISCORD_BOT_TOKEN;
  const clientId = env?.DISCORD_CLIENT_ID;
  const db = env?.DB;
  if (!botToken || !clientId || !db) return json({ error: "not_configured" }, 501);

  let user;
  try {
    user = await getOauthUser(fetchImpl, token, clientId);
  } catch {
    return json({ error: "unauthorized" }, 401);
  }

  if (await overRateLimit(db, now, `user:${user.id}`, USER_RATE_LIMIT)) {
    return rateLimited();
  }

  try {
    await getGuildMember(fetchImpl, botToken, input.guildId, user.id);
  } catch (error) {
    if (error?.status === 404 || error?.status === 403) {
      return json({ error: "forbidden" }, 403);
    }
    return json({ error: "discord_unavailable" }, 502);
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

  let launched;
  try {
    launched = await hasRecentLaunch(db, user.id, input.guildId, input.channelId, now);
  } catch {
    return json({ error: "storage_unavailable" }, 500);
  }
  if (!launched) {
    return json({ error: "forbidden" }, 403);
  }

  let existing;
  try {
    existing = await db
      .prepare(SESSION_SELECT_SQL)
      .bind(input.guildId, input.channelId, user.id, input.date, input.mode)
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
      .bind(input.guildId, input.channelId, user.id, input.date, input.mode, message.id)
      .run();
  } catch {
    return json({ error: "storage_unavailable" }, 500);
  }

  return json({ messageId: message.id, user });
}

/**
 * @param {Request} request
 * @param {{ DISCORD_BOT_TOKEN?: string, DISCORD_CLIENT_ID?: string, DB?: any, ACTIVITY_DISABLED?: string }} env
 * @param {{ fetchImpl?: typeof fetch, now?: number }} [options]
 */
export async function handleResult(request, env, { fetchImpl, now = Date.now() } = {}) {
  if (env?.ACTIVITY_DISABLED === "1") return unavailable();

  const token = bearerToken(request);
  if (!token) return json({ error: "unauthorized" }, 401);

  const parsed = await readJsonObject(request);
  if (parsed.tooLarge) return payloadTooLarge();
  const body = parsed.body;
  const input = validateBoardRequest(body, now);
  if (!input) return badRequest();

  const { won, maxGuesses, guesses } = /** @type {any} */ (body);
  if (
    typeof won !== "boolean" ||
    !Number.isInteger(maxGuesses) ||
    (maxGuesses !== 4 && maxGuesses !== 6) ||
    maxGuesses !== MODE_MAX_GUESSES[input.mode] ||
    !validateGuesses(guesses, maxGuesses)
  ) {
    return badRequest();
  }

  const botToken = env?.DISCORD_BOT_TOKEN;
  const clientId = env?.DISCORD_CLIENT_ID;
  const db = env?.DB;
  if (!botToken || !clientId || !db) return json({ error: "not_configured" }, 501);

  let user;
  try {
    user = await getOauthUser(fetchImpl, token, clientId);
  } catch {
    return json({ error: "unauthorized" }, 401);
  }

  if (await overRateLimit(db, now, `user:${user.id}`, USER_RATE_LIMIT)) {
    return rateLimited();
  }

  try {
    const launched = await hasRecentLaunch(db, user.id, input.guildId, input.channelId, now);
    if (!launched) return json({ error: "forbidden" }, 403);
  } catch {
    return json({ error: "storage_unavailable" }, 500);
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
      .bind(input.guildId, input.channelId, user.id, input.date, input.mode)
      .first();
  } catch {
    return json({ error: "storage_unavailable" }, 500);
  }
  if (!existing?.message_id) {
    return json({ error: "board_not_found" }, 409);
  }

  const createdAt = nowIso();
  try {
    await db
      .prepare(PLAYER_UPSERT_SQL)
      .bind(user.id, user.username, user.avatar, input.region, createdAt)
      .run();
    await db
      .prepare(RESULT_UPSERT_SQL)
      .bind(
        input.guildId,
        input.channelId,
        user.id,
        input.date,
        input.mode,
        input.region,
        won ? 1 : 0,
        guesses.length,
        createdAt,
      )
      .run();
  } catch {
    return json({ error: "storage_unavailable" }, 500);
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
 * Format an instant as an ISO date in the given IANA time zone.
 * @param {Date} date
 * @param {string} timeZone
 */
function isoDateInTimeZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

/**
 * Post one guild's summary. Returns without posting when nobody played.
 * @param {{ db: any, botToken: string, fetchImpl?: typeof fetch, guildId: string, channelId: string, date: string }} options
 */
async function postGuildSummary({ db, botToken, fetchImpl, guildId, channelId, date }) {
  const resultRows = await db.prepare(SUMMARY_RESULTS_SQL).bind(guildId, date).all();
  const results = Array.isArray(resultRows?.results) ? resultRows.results : [];
  if (results.length === 0) return;

  const dateRows = await db.prepare(SUMMARY_DATES_SQL).bind(guildId).all();
  const dates = Array.isArray(dateRows?.results)
    ? dateRows.results.map((row) => String(row?.date))
    : [];
  const streak = computeStreak(dates, date);

  const lines = results.map((row) => {
    const maxGuesses = MODE_MAX_GUESSES[row.mode] ?? 4;
    const score =
      Number(row.won) === 1
        ? `${asNumber(row.guess_count)}/${maxGuesses}`
        : `X/${maxGuesses}`;
    return `${String(row.username ?? "Player")} — ${score}`;
  });

  const description = [`Group streak: ${streak} day(s)`, "", ...lines].join("\n");

  await createMessage(fetchImpl, botToken, channelId, {
    embeds: [{ title: `Audio-Birdle — ${date}`, description }],
    allowed_mentions: { parse: [] },
  });
}

/**
 * Daily summary cron. Runs at 00:10 America/New_York and reports the previous
 * day; failures are logged by guild id only, never usernames or tokens.
 *
 * @param {{ scheduledTime?: number }} controller
 * @param {{ DB?: any, DISCORD_BOT_TOKEN?: string }} env
 * @param {any} ctx
 * @param {{ fetchImpl?: typeof fetch, now?: Date }} [options]
 */
export async function scheduled(controller, env, ctx, { fetchImpl, now = new Date() } = {}) {
  const db = env?.DB;
  const botToken = env?.DISCORD_BOT_TOKEN;
  if (!db || !botToken) return;

  const date = previousDate(isoDateInTimeZone(now, "America/New_York"));
  if (!date) return;

  let guildRows;
  try {
    guildRows = await db.prepare(SUMMARY_GUILDS_SQL).bind(SUMMARY_GUILD_LIMIT).all();
  } catch {
    console.error("daily summary: guild query failed");
    return;
  }

  const guilds = (Array.isArray(guildRows?.results) ? guildRows.results : []).slice(
    0,
    SUMMARY_GUILD_LIMIT,
  );

  const tasks = guilds.map((guild) =>
    postGuildSummary({
      db,
      botToken,
      fetchImpl,
      guildId: String(guild.guild_id),
      channelId: String(guild.summary_channel_id),
      date,
    }),
  );

  const settled = await Promise.allSettled(tasks);
  settled.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(`daily summary failed for guild ${guilds[index].guild_id}`);
    }
  });

  await pruneExpiredRows(db, now);
}

/**
 * Enforce the documented retention windows. Stored formats differ: results,
 * boards, and analytics use ISO strings; launches and rate_limits use epoch ms.
 * Cleanup failures are logged without payloads and never fail the cron.
 * @param {any} db
 * @param {Date} now
 */
async function pruneExpiredRows(db, now) {
  const nowMs = now.getTime();
  const isoCutoff = (days) => new Date(nowMs - days * DAY_MS).toISOString();

  const statements = [
    [CLEANUP_RESULTS_SQL, isoCutoff(RESULTS_RETENTION_DAYS)],
    [CLEANUP_BOARDS_SQL, isoCutoff(BOARDS_RETENTION_DAYS)],
    [CLEANUP_LAUNCHES_SQL, nowMs - LAUNCH_RETENTION_MS],
    [CLEANUP_RATE_LIMITS_SQL, nowMs - RATE_LIMIT_RETENTION_MS],
    [CLEANUP_ANALYTICS_SQL, isoCutoff(ANALYTICS_RETENTION_DAYS)],
  ];

  try {
    await Promise.all(statements.map(([sql, cutoff]) => db.prepare(sql).bind(cutoff).run()));
  } catch {
    console.error("retention: cleanup failed");
  }
}

/**
 * @param {Request} request
 * @param {Record<string, unknown>} env
 */
export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);

    // Defensive: the assets layer is expected to keep non-/api traffic out.
    if (pathname !== "/api" && !pathname.startsWith("/api/")) return notFound();

    if (pathname === "/api/health") {
      if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
      return json({ ok: true });
    }

    if (pathname === "/api/interactions") {
      if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
      return handleInteractions(request, env, { ctx });
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

  scheduled,
};
