// Release-blocking hardening tests: fake Discord fetch, fake D1, no network.

import test from "node:test";
import assert from "node:assert/strict";

import worker, { handleSession, scheduled } from "../../worker/index.js";

const encoder = new TextEncoder();
const ORIGIN = "https://audio-birdle.example";

const GUILD_ID = "123456789012345678";
const OTHER_GUILD_ID = "456789012345678901";
const CHANNEL_ID = "234567890123456789";
const MESSAGE_ID = "345678901234567890";
const USER_ID = "567890123456789012";
const USER_TOKEN = "user-oauth-token";
const BOT_TOKEN = "bot-token";
const CLIENT_ID = "111222333444555666";
const USER = { id: USER_ID, username: "birder", avatar: "abc123" };

const NOW = Date.now();
const TODAY = new Date(NOW).toISOString().slice(0, 10);

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

async function signedRequest(
  payload,
  { timestamp = String(Math.floor(Date.now() / 1000)), bodyOverride } = {},
) {
  const body = bodyOverride ?? JSON.stringify(payload);
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

function commandPayload({ subcommand = null, options = [] } = {}) {
  return {
    type: 2,
    guild_id: GUILD_ID,
    channel_id: CHANNEL_ID,
    member: { user: { id: USER_ID }, permissions: String(0x20) },
    data: {
      name: "audiobirdle",
      options: subcommand ? [{ type: 1, name: subcommand, options }] : undefined,
    },
  };
}

function makeDb({ launch = { created_at: NOW }, rateCount = 1, board = null, guilds = [] } = {}) {
  const calls = [];
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
          if (sql.includes("FROM launches")) return launch;
          if (sql.includes("INSERT INTO rate_limits")) return { count: rateCount };
          if (sql.includes("FROM boards")) return board;
          return null;
        },
        async all() {
          if (sql.includes("FROM guilds")) return { results: guilds };
          return { results: [] };
        },
        async run() {
          return { success: true };
        },
      };
      calls.push(statement);
      return statement;
    },
  };
}

function makeFetch({ memberStatus = 200, audience = CLIENT_ID, channelGuild = GUILD_ID } = {}) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const { pathname } = new URL(url);
    calls.push({
      pathname,
      method: init.method || "GET",
      headers: init.headers || {},
      body: init.body ? JSON.parse(init.body) : undefined,
    });

    if (pathname === "/api/v10/oauth2/@me") {
      return jsonResponse({ application: { id: audience }, user: USER });
    }
    if (pathname === `/api/v10/guilds/${GUILD_ID}/members/${USER_ID}`) {
      if (memberStatus !== 200) return jsonResponse({ error: "not_found" }, memberStatus);
      return jsonResponse({ user: { id: USER_ID } });
    }
    if (pathname === `/api/v10/channels/${CHANNEL_ID}`) {
      return jsonResponse({ id: CHANNEL_ID, guild_id: channelGuild });
    }
    if (pathname === `/api/v10/channels/${CHANNEL_ID}/messages`) {
      return jsonResponse({ id: MESSAGE_ID, channel_id: CHANNEL_ID });
    }
    return jsonResponse({ error: "not_found" }, 404);
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

function makeEnv(db = makeDb(), extra = {}) {
  return {
    DISCORD_BOT_TOKEN: BOT_TOKEN,
    DISCORD_CLIENT_ID: CLIENT_ID,
    DB: db,
    ...extra,
  };
}

function sessionBody(overrides = {}) {
  return {
    guildId: GUILD_ID,
    channelId: CHANNEL_ID,
    date: TODAY,
    mode: "normal",
    region: "us",
    ...overrides,
  };
}

function sessionRequest(body = sessionBody(), { token = USER_TOKEN } = {}) {
  return new Request(`${ORIGIN}/api/session`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

function postedMessages(fetchImpl) {
  return fetchImpl.calls.filter(
    (call) => call.method === "POST" && call.pathname.endsWith("/messages"),
  );
}

test("session without a launch row is forbidden", async () => {
  const fetchImpl = makeFetch();
  const response = await handleSession(sessionRequest(), makeEnv(makeDb({ launch: null })), {
    fetchImpl,
  });

  assert.equal(response.status, 403);
  assert.equal(postedMessages(fetchImpl).length, 0);
});

test("session with a stale launch row is forbidden", async () => {
  const fetchImpl = makeFetch();
  const response = await handleSession(
    sessionRequest(),
    makeEnv(makeDb({ launch: { created_at: NOW - 16 * 60 * 1000 } })),
    { fetchImpl },
  );

  assert.equal(response.status, 403);
  assert.equal(postedMessages(fetchImpl).length, 0);
});

test("session with a valid launch and guild member opens the board", async () => {
  const fetchImpl = makeFetch();
  const response = await handleSession(sessionRequest(), makeEnv(), { fetchImpl });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { messageId: MESSAGE_ID, user: USER });
});

test("a type-2 launch inserts the signed ids into launches", async () => {
  const db = makeDb();
  const before = Date.now();
  const response = await worker.fetch(
    await signedRequest(commandPayload()),
    { DISCORD_PUBLIC_KEY: publicKeyHex, DB: db },
    {},
  );

  assert.deepEqual(await response.json(), { type: 12 });
  const insert = db.calls.find((statement) => statement.sql.startsWith("INSERT INTO launches"));
  assert.ok(insert, "launch row inserted");
  assert.equal(insert.args[0], USER_ID);
  assert.equal(insert.args[1], GUILD_ID);
  assert.equal(insert.args[2], CHANNEL_ID);
  assert.equal(typeof insert.args[3], "number");
  assert.ok(insert.args[3] >= before && insert.args[3] <= Date.now());
});

test("session maps a missing guild member to 403", async () => {
  const fetchImpl = makeFetch({ memberStatus: 404 });
  const response = await handleSession(sessionRequest(), makeEnv(), { fetchImpl });

  assert.equal(response.status, 403);
  assert.equal(postedMessages(fetchImpl).length, 0);
});

test("setup rejects a channel from another guild", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = makeFetch({ channelGuild: OTHER_GUILD_ID });
  try {
    const db = makeDb();
    const response = await worker.fetch(
      await signedRequest(
        commandPayload({
          subcommand: "setup",
          options: [{ type: 7, name: "channel", value: CHANNEL_ID }],
        }),
      ),
      { DISCORD_PUBLIC_KEY: publicKeyHex, DISCORD_BOT_TOKEN: BOT_TOKEN, DB: db },
      {},
    );

    const body = await response.json();
    assert.equal(body.data.flags, 64);
    assert.match(body.data.content, /not in this server/);
    assert.equal(
      db.calls.some((statement) => statement.sql.startsWith("INSERT INTO guilds")),
      false,
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("a token minted for another application is rejected with 401", async () => {
  const fetchImpl = makeFetch({ audience: "999999999999999999" });
  const response = await handleSession(sessionRequest(), makeEnv(), { fetchImpl });

  assert.equal(response.status, 401);
});

test("user tokens are sent as Bearer", async () => {
  const fetchImpl = makeFetch();
  await handleSession(sessionRequest(), makeEnv(), { fetchImpl });

  const identity = fetchImpl.calls.find((call) => call.pathname === "/api/v10/oauth2/@me");
  assert.equal(identity.headers.authorization, `Bearer ${USER_TOKEN}`);
});

test("session rejects a body over 8 KiB with 413", async () => {
  const body = JSON.stringify({ ...sessionBody(), padding: "x".repeat(9000) });
  const request = new Request(`${ORIGIN}/api/session`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${USER_TOKEN}`,
    },
    body,
  });
  const response = await handleSession(request, makeEnv());

  assert.equal(response.status, 413);
});

test("interactions reject a body over 32 KiB with 413", async () => {
  const body = JSON.stringify({ type: 1, padding: "x".repeat(33 * 1024) });
  const request = new Request(`${ORIGIN}/api/interactions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-signature-ed25519": "00",
      "x-signature-timestamp": String(Math.floor(Date.now() / 1000)),
    },
    body,
  });
  const response = await worker.fetch(request, { DISCORD_PUBLIC_KEY: publicKeyHex }, {});

  assert.equal(response.status, 413);
});

test("session returns 429 with Retry-After after the user limit", async () => {
  const fetchImpl = makeFetch();
  const response = await handleSession(sessionRequest(), makeEnv(makeDb({ rateCount: 31 })), {
    fetchImpl,
  });

  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "60");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(postedMessages(fetchImpl).length, 0);
});

test("the kill switch returns 503 for activity endpoints but PING still works", async () => {
  const env = makeEnv(makeDb(), { ACTIVITY_DISABLED: "1" });

  const session = await handleSession(sessionRequest(), env);
  assert.equal(session.status, 503);
  assert.equal(session.headers.get("cache-control"), "no-store");

  const token = await worker.fetch(
    new Request(`${ORIGIN}/api/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "code=abc",
    }),
    env,
    {},
  );
  assert.equal(token.status, 503);

  const ping = await worker.fetch(
    await signedRequest({ type: 1 }),
    { DISCORD_PUBLIC_KEY: publicKeyHex, ACTIVITY_DISABLED: "1" },
    {},
  );
  assert.equal(ping.status, 200);
  assert.deepEqual(await ping.json(), { type: 1 });
});

test("an interaction timestamp outside the skew window is rejected", async () => {
  const response = await worker.fetch(
    await signedRequest(
      { type: 1 },
      { timestamp: String(Math.floor(Date.now() / 1000) - 400) },
    ),
    { DISCORD_PUBLIC_KEY: publicKeyHex },
    {},
  );

  assert.equal(response.status, 401);
});

test("dates more than one day from today are rejected", async () => {
  const twoDays = 2 * 24 * 60 * 60 * 1000;
  for (const date of [
    new Date(NOW - twoDays).toISOString().slice(0, 10),
    new Date(NOW + twoDays).toISOString().slice(0, 10),
  ]) {
    const response = await handleSession(sessionRequest(sessionBody({ date })), makeEnv());
    assert.equal(response.status, 400, `date ${date}`);
  }
});

test("normal and hard games use separate board rows", async () => {
  const fetchImpl = makeFetch();
  const db = makeDb();
  await handleSession(sessionRequest(sessionBody({ mode: "normal" })), makeEnv(db), { fetchImpl });
  await handleSession(sessionRequest(sessionBody({ mode: "hard" })), makeEnv(db), { fetchImpl });

  const selects = db.calls.filter((statement) => statement.sql.includes("FROM boards"));
  assert.deepEqual(
    selects.map((statement) => statement.args[4]),
    ["normal", "hard"],
  );

  const inserts = db.calls.filter((statement) => statement.sql.startsWith("INSERT INTO boards"));
  assert.deepEqual(
    inserts.map((statement) => statement.args[4]),
    ["normal", "hard"],
  );
  assert.equal(postedMessages(fetchImpl).length, 2);
});

test("cron retention deletes expired rows with the documented cutoffs", async () => {
  const db = makeDb();
  const cronNow = new Date("2026-11-26T05:10:00Z");
  const nowMs = cronNow.getTime();

  await scheduled({}, { DB: db, DISCORD_BOT_TOKEN: BOT_TOKEN }, {}, { now: cronNow });

  const deletes = db.calls.filter((statement) => statement.sql.startsWith("DELETE FROM"));
  const byTable = Object.fromEntries(
    deletes.map((statement) => [statement.sql.split(" ")[2], statement.args[0]]),
  );

  assert.equal(byTable.results, new Date(nowMs - 90 * 86400000).toISOString());
  assert.equal(byTable.boards, new Date(nowMs - 30 * 86400000).toISOString());
  assert.equal(byTable.launches, nowMs - 60 * 60 * 1000);
  assert.equal(byTable.rate_limits, nowMs - 86400000);
  assert.equal(byTable.analytics_daily, new Date(nowMs - 2 * 86400000).toISOString());
});
