// Phase 4 worker tests: result persistence, subcommands, and the daily cron.
// Everything here is deterministic and network-free: fake Discord fetch, fake D1.

import test from "node:test";
import assert from "node:assert/strict";

import worker, { handleResult } from "../../worker/index.js";
import { computeStreak, previousDate } from "../../worker/lib/streaks.js";

const encoder = new TextEncoder();
const ORIGIN = "https://audio-birdle.example";

const GUILD_ID = "123456789012345678";
const CHANNEL_ID = "234567890123456789";
const MESSAGE_ID = "345678901234567890";
const USER_ID = "567890123456789012";
const USER_TOKEN = "user-oauth-token";
const BOT_TOKEN = "bot-token";
const CLIENT_ID = "111222333444555666";
const USER = { id: USER_ID, username: "birder", avatar: "abc123" };

const MANAGE_GUILD = String(0x20);

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function toHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

const keyPair = await globalThis.crypto.subtle.generateKey({ name: "Ed25519" }, true, [
  "sign",
  "verify",
]);
const publicKeyHex = toHex(
  new Uint8Array(await globalThis.crypto.subtle.exportKey("raw", keyPair.publicKey)),
);

async function signedRequest(payload) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify(payload);
  const signature = await globalThis.crypto.subtle.sign(
    { name: "Ed25519" },
    keyPair.privateKey,
    encoder.encode(timestamp + body),
  );

  return new Request(`${ORIGIN}/api/interactions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-signature-ed25519": toHex(new Uint8Array(signature)),
      "x-signature-timestamp": timestamp,
    },
    body,
  });
}

function commandPayload(subcommand, options = [], { permissions = MANAGE_GUILD } = {}) {
  return {
    type: 2,
    guild_id: GUILD_ID,
    channel_id: CHANNEL_ID,
    member: { user: { id: USER_ID }, permissions },
    data: {
      name: subcommand ? `audiobirdle-${subcommand}` : "audiobirdle",
      options: subcommand ? options : undefined,
    },
  };
}

function makeDb(handlers = []) {
  const calls = [];
  function findHandler(sql, kind) {
    const match = handlers.find((handler) => handler.kind === kind && handler.match.test(sql));
    return match ? match.handler : null;
  }

  return {
    calls,
    prepare(sql) {
      const statement = {
        sql,
        args: [],
        bind(...args) {
          this.args = args;
          return this;
        },
        async first() {
          const handler = findHandler(sql, "first");
          if (handler) return handler(this.args);
          if (sql.includes("FROM launches")) return { created_at: Date.now() };
          if (sql.startsWith("INSERT INTO rate_limits")) return { count: 1 };
          return null;
        },
        async all() {
          const handler = findHandler(sql, "all");
          const value = handler ? handler(this.args) : [];
          return Array.isArray(value) ? { results: value } : value;
        },
        async run() {
          const handler = findHandler(sql, "run");
          return handler ? handler(this.args) : { success: true };
        },
      };
      calls.push(statement);
      return statement;
    },
  };
}

function makeBoardFetch() {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const { pathname } = new URL(url);
    const call = {
      url,
      pathname,
      method: init.method || "GET",
      headers: init.headers || {},
      body: init.body ? JSON.parse(init.body) : undefined,
    };
    calls.push(call);

    if (pathname === "/api/v10/oauth2/@me") {
      return jsonResponse({ application: { id: CLIENT_ID }, user: USER });
    }
    if (pathname === `/api/v10/guilds/${GUILD_ID}/members/${USER_ID}`) {
      return jsonResponse({ user: { id: USER_ID } });
    }
    if (pathname === `/api/v10/channels/${CHANNEL_ID}`) {
      return jsonResponse({ id: CHANNEL_ID, guild_id: GUILD_ID });
    }
    if (pathname === `/api/v10/channels/${CHANNEL_ID}/messages/${MESSAGE_ID}`) {
      return jsonResponse({ id: MESSAGE_ID, channel_id: CHANNEL_ID });
    }
    return jsonResponse({ error: "not_found" }, 404);
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

function resultRequest() {
  const body = {
    guildId: GUILD_ID,
    channelId: CHANNEL_ID,
    date: "2026-11-26",
    mode: "normal",
    region: "us",
    won: true,
    maxGuesses: 4,
    guesses: [{ correct: true }],
  };
  return new Request(`${ORIGIN}/api/result`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${USER_TOKEN}` },
    body: JSON.stringify(body),
  });
}

test("result persists the player and outcome without guesses", async () => {
  const fetchImpl = makeBoardFetch();
  const db = makeDb([
    { kind: "first", match: /FROM boards WHERE/, handler: () => ({ message_id: MESSAGE_ID }) },
  ]);

  const response = await handleResult(
    resultRequest(),
    { DISCORD_BOT_TOKEN: BOT_TOKEN, DISCORD_CLIENT_ID: CLIENT_ID, DB: db },
    { fetchImpl },
  );

  assert.equal(response.status, 200);

  const player = db.calls.find((statement) => statement.sql.startsWith("INSERT INTO players"));
  assert.ok(player, "player upsert runs");
  assert.deepEqual(player.args.slice(0, 4), [USER_ID, "birder", "abc123", "us"]);
  assert.equal(typeof player.args[4], "string");

  const result = db.calls.find((statement) => statement.sql.startsWith("INSERT INTO results"));
  assert.ok(result, "result upsert runs");
  assert.deepEqual(result.args.slice(0, 8), [
    GUILD_ID,
    CHANNEL_ID,
    USER_ID,
    "2026-11-26",
    "normal",
    "us",
    1,
    1,
  ]);
  assert.equal(typeof result.args[8], "string");
  assert.equal(JSON.stringify(result.args).includes("guess"), false, "guess payload not stored");

  const patch = fetchImpl.calls.find((call) => call.method === "PATCH");
  assert.deepEqual(patch.body.allowed_mentions, { parse: [] });
});

test("setup without MANAGE_GUILD is ephemeral and writes nothing", async () => {
  const db = makeDb();
  const response = await worker.fetch(
    await signedRequest(
      commandPayload("setup", [], { permissions: "0" }),
    ),
    { DISCORD_PUBLIC_KEY: publicKeyHex, DB: db },
    {},
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.type, 4);
  assert.equal(body.data.flags, 64);
  assert.match(body.data.content, /Manage Server/);
  assert.deepEqual(body.data.allowed_mentions, { parse: [] });
  assert.equal(db.calls.length, 0);
});

test("setup with MANAGE_GUILD opts the current channel in", async () => {
  const db = makeDb();
  const response = await worker.fetch(
    await signedRequest(commandPayload("setup")),
    { DISCORD_PUBLIC_KEY: publicKeyHex, DB: db },
    {},
  );

  const body = await response.json();
  assert.equal(body.type, 4);
  assert.equal(body.data.flags, 64);
  assert.equal(body.data.content, "Daily summaries will post in this channel.");

  const upsert = db.calls.find((statement) => statement.sql.startsWith("INSERT INTO channels"));
  assert.ok(upsert, "channel upsert runs");
  assert.deepEqual(upsert.args.slice(0, 2), [CHANNEL_ID, GUILD_ID]);
  assert.equal(typeof upsert.args[2], "string");
});

test("forget deletes the caller's player, boards, and results", async () => {
  const db = makeDb();
  const response = await worker.fetch(
    await signedRequest(commandPayload("forget")),
    { DISCORD_PUBLIC_KEY: publicKeyHex, DB: db },
    {},
  );

  const body = await response.json();
  assert.equal(body.data.flags, 64);
  assert.match(body.data.content, /48 hours/);

  const deletes = db.calls.filter((statement) => statement.sql.startsWith("DELETE FROM"));
  assert.equal(deletes.length, 3);
  assert.deepEqual(
    deletes.map((statement) => statement.sql.split(" ")[2]),
    ["players", "boards", "results"],
  );
  for (const statement of deletes) {
    assert.deepEqual(statement.args, [USER_ID]);
  }
});

test("stats formats a non-empty record with a streak", async () => {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = previousDate(today);
  const db = makeDb([
    { kind: "first", match: /FROM results WHERE discord_id = \?$/, handler: () => ({ played: 5, wins: 3, best: 2 }) },
    {
      kind: "all",
      match: /SELECT date FROM results/,
      handler: () => [{ date: today }, { date: yesterday }],
    },
  ]);

  const response = await worker.fetch(
    await signedRequest(commandPayload("stats")),
    { DISCORD_PUBLIC_KEY: publicKeyHex, DB: db },
    {},
  );

  const body = await response.json();
  assert.equal(body.data.flags, 64);
  assert.deepEqual(body.data.allowed_mentions, { parse: [] });
  const description = body.data.embeds[0].description;
  assert.match(description, /Played: 5/);
  assert.match(description, /Wins: 3/);
  assert.match(description, /Best win: 2 guesses/);
  assert.match(description, /Current streak: 2 days/);
});

test("stats handles a player with no results", async () => {
  const db = makeDb([
    { kind: "first", match: /FROM results WHERE discord_id = \?$/, handler: () => ({ played: 0, wins: 0, best: null }) },
    { kind: "all", match: /SELECT date FROM results/, handler: () => [] },
  ]);

  const response = await worker.fetch(
    await signedRequest(commandPayload("stats")),
    { DISCORD_PUBLIC_KEY: publicKeyHex, DB: db },
    {},
  );

  const body = await response.json();
  assert.equal(body.data.flags, 64);
  assert.match(body.data.embeds[0].description, /No results yet/);
});

test("bare /audiobirdle still launches the activity", async () => {
  const response = await worker.fetch(
    await signedRequest(commandPayload(null)),
    { DISCORD_PUBLIC_KEY: publicKeyHex, DB: makeDb() },
    {},
  );
  assert.deepEqual(await response.json(), { type: 12 });
});

test("unknown command is rejected with 400", async () => {
  const response = await worker.fetch(
    await signedRequest(commandPayload("nope")),
    { DISCORD_PUBLIC_KEY: publicKeyHex, DB: makeDb() },
    {},
  );
  assert.equal(response.status, 400);
});

test("previousDate handles month, year, and leap-day boundaries", () => {
  assert.equal(previousDate("2026-03-01"), "2026-02-28");
  assert.equal(previousDate("2024-03-01"), "2024-02-29");
  assert.equal(previousDate("2025-01-01"), "2024-12-31");
  assert.equal(previousDate("not-a-date"), null);
});

test("computeStreak counts consecutive dates ending at endDate", () => {
  assert.equal(
    computeStreak(["2026-11-26", "2026-11-25", "2026-11-24", "2026-11-25"], "2026-11-26"),
    3,
  );
  assert.equal(computeStreak(["2026-11-26", "2026-11-24"], "2026-11-26"), 1);
  assert.equal(computeStreak(["2026-11-24"], "2026-11-26"), 0);
  assert.equal(computeStreak([], "2026-11-26"), 0);
  assert.equal(
    computeStreak(["2026-01-01", "2025-12-31", "2025-12-30"], "2026-01-01"),
    3,
  );
});
