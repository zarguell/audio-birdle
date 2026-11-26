// Board endpoint tests: fake Discord fetch and fake D1, no network.

import test from "node:test";
import assert from "node:assert/strict";

import { handleResult, handleSession } from "../../worker/index.js";

const ORIGIN = "https://audio-birdle.example";
const GUILD_ID = "123456789012345678";
const CHANNEL_ID = "234567890123456789";
const MESSAGE_ID = "345678901234567890";
const OTHER_GUILD_ID = "456789012345678901";
const USER_TOKEN = "user-oauth-token";
const BOT_TOKEN = "bot-token";

const USER = { id: "567890123456789012", username: "birder", avatar: "abc123" };

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeFetch({ guildId = GUILD_ID, messageId = MESSAGE_ID } = {}) {
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

    if (pathname === "/api/v10/users/@me") return jsonResponse(USER);
    if (pathname === `/api/v10/channels/${CHANNEL_ID}`) {
      return jsonResponse({ id: CHANNEL_ID, guild_id: guildId });
    }
    if (pathname === `/api/v10/channels/${CHANNEL_ID}/messages` && call.method === "POST") {
      return jsonResponse({ id: messageId, channel_id: CHANNEL_ID });
    }
    if (
      pathname === `/api/v10/channels/${CHANNEL_ID}/messages/${messageId}` &&
      call.method === "PATCH"
    ) {
      return jsonResponse({ id: messageId, channel_id: CHANNEL_ID });
    }
    return jsonResponse({ error: "not_found" }, 404);
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

function makeDb({ existing = null } = {}) {
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
          return existing;
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

function boardRequest(path, body, { token = USER_TOKEN } = {}) {
  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request(`${ORIGIN}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

const SESSION_BODY = {
  guildId: GUILD_ID,
  channelId: CHANNEL_ID,
  date: "2026-11-26",
  mode: "normal",
  region: "us",
};

function resultBody(overrides = {}) {
  return {
    ...SESSION_BODY,
    won: true,
    maxGuesses: 4,
    guesses: [{ correct: true }],
    ...overrides,
  };
}

function pageCalls(fetchImpl, method, suffix = "") {
  return fetchImpl.calls.filter(
    (call) => call.method === method && call.pathname.endsWith(suffix),
  );
}

test("session without a bearer token returns 401 and makes no Discord call", async () => {
  const fetchImpl = makeFetch();
  const response = await handleSession(
    boardRequest("/api/session", SESSION_BODY, { token: null }),
    { DISCORD_BOT_TOKEN: BOT_TOKEN, DB: makeDb() },
    { fetchImpl },
  );

  assert.equal(response.status, 401);
  assert.equal(fetchImpl.calls.length, 0);
});

test("session with an invalid body returns 400", async () => {
  const fetchImpl = makeFetch();
  const response = await handleSession(
    boardRequest("/api/session", { ...SESSION_BODY, date: "26-11-2026" }),
    { DISCORD_BOT_TOKEN: BOT_TOKEN, DB: makeDb() },
    { fetchImpl },
  );

  assert.equal(response.status, 400);
  assert.equal(fetchImpl.calls.length, 0);
});

test("session rejects a channel outside the claimed guild with 403", async () => {
  const fetchImpl = makeFetch({ guildId: OTHER_GUILD_ID });
  const response = await handleSession(
    boardRequest("/api/session", SESSION_BODY),
    { DISCORD_BOT_TOKEN: BOT_TOKEN, DB: makeDb() },
    { fetchImpl },
  );

  assert.equal(response.status, 403);
  assert.equal(pageCalls(fetchImpl, "POST").length, 0);
});

test("session posts once with allowed_mentions and stores the message id", async () => {
  const fetchImpl = makeFetch();
  const db = makeDb();
  const response = await handleSession(
    boardRequest("/api/session", SESSION_BODY),
    { DISCORD_BOT_TOKEN: BOT_TOKEN, DB: db },
    { fetchImpl },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { messageId: MESSAGE_ID, user: USER });

  const [me] = fetchImpl.calls;
  assert.equal(me.headers.authorization, USER_TOKEN, "user calls use the OAuth token");

  const [post] = pageCalls(fetchImpl, "POST");
  assert.equal(post.headers.authorization, `Bot ${BOT_TOKEN}`);
  assert.equal(post.body.content, "birder is playing");
  assert.deepEqual(post.body.allowed_mentions, { parse: [] });
  assert.equal(post.body.embeds.length, 1);
  assert.equal(post.body.embeds[0].title, "Audio-Birdle 2026-11-26");
  assert.equal(post.body.embeds[0].description, "Region: US · Normal");

  const insert = db.calls.find((statement) => statement.sql.startsWith("INSERT INTO boards"));
  assert.deepEqual(insert.args, [GUILD_ID, CHANNEL_ID, USER.id, "2026-11-26", MESSAGE_ID]);
});

test("session returns the existing board without posting again", async () => {
  const fetchImpl = makeFetch();
  const db = makeDb({ existing: { message_id: MESSAGE_ID } });
  const response = await handleSession(
    boardRequest("/api/session", SESSION_BODY),
    { DISCORD_BOT_TOKEN: BOT_TOKEN, DB: db },
    { fetchImpl },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { messageId: MESSAGE_ID, user: USER });
  assert.equal(pageCalls(fetchImpl, "POST").length, 0);
  assert.equal(db.calls.some((statement) => statement.sql.startsWith("INSERT")), false);
});

test("hard result builds the taxonomic grid and patches the stored message", async () => {
  const fetchImpl = makeFetch();
  const db = makeDb({ existing: { message_id: MESSAGE_ID } });
  const response = await handleResult(
    boardRequest(
      "/api/result",
      resultBody({
        mode: "hard",
        maxGuesses: 6,
        won: false,
        guesses: [
          { correct: true },
          { correct: false, taxonomicScore: { order: true, family: true, genus: true } },
          { correct: false, taxonomicScore: { order: true, family: true, genus: false } },
          { correct: false, taxonomicScore: { order: true, family: false, genus: false } },
        ],
      }),
    ),
    { DISCORD_BOT_TOKEN: BOT_TOKEN, DB: db },
    { fetchImpl },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });

  const [patch] = pageCalls(fetchImpl, "PATCH", `/messages/${MESSAGE_ID}`);
  assert.equal(patch.headers.authorization, `Bot ${BOT_TOKEN}`);
  assert.deepEqual(patch.body.allowed_mentions, { parse: [] });
  assert.match(patch.body.embeds[0].description, /🟩🟨🟧🟥$/u);
  assert.match(patch.body.embeds[0].description, /X\/6/u);
  assert.equal(db.calls.some((statement) => statement.sql.startsWith("INSERT")), false);
});

test("normal result uses green/red cells only", async () => {
  const fetchImpl = makeFetch();
  const response = await handleResult(
    boardRequest(
      "/api/result",
      resultBody({ won: false, guesses: [{ correct: false }, { correct: true }] }),
    ),
    { DISCORD_BOT_TOKEN: BOT_TOKEN, DB: makeDb({ existing: { message_id: MESSAGE_ID } }) },
    { fetchImpl },
  );

  assert.equal(response.status, 200);
  const [patch] = pageCalls(fetchImpl, "PATCH");
  assert.match(patch.body.embeds[0].description, /🟥🟩$/u);
});

test("result without a board row returns 409 and does not patch", async () => {
  const fetchImpl = makeFetch();
  const response = await handleResult(
    boardRequest("/api/result", resultBody()),
    { DISCORD_BOT_TOKEN: BOT_TOKEN, DB: makeDb() },
    { fetchImpl },
  );

  assert.equal(response.status, 409);
  assert.equal(pageCalls(fetchImpl, "PATCH").length, 0);
});
