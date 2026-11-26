// Discord polish tests: play button, player avatar, daily leaderboard.
// Fake Discord fetch and fake D1, no network.

import test from "node:test";
import assert from "node:assert/strict";

import worker, { handleResult, handleSession } from "../../worker/index.js";

const encoder = new TextEncoder();
const ORIGIN = "https://audio-birdle.example";

const GUILD_ID = "123456789012345678";
const CHANNEL_ID = "234567890123456789";
const MESSAGE_ID = "345678901234567890";
const USER_ID = "567890123456789012";
const USER_TOKEN = "user-oauth-token";
const BOT_TOKEN = "bot-token";
const CLIENT_ID = "111222333444555666";
const AVATAR = "abc123";
const PLAY_CUSTOM_ID = "audiobirdle:play";

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

function makeBoardFetch({ avatar = AVATAR } = {}) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const { pathname } = new URL(url);
    calls.push({
      url,
      pathname,
      method: init.method || "GET",
      body: init.body ? JSON.parse(init.body) : undefined,
    });

    if (pathname === "/api/v10/oauth2/@me") {
      return jsonResponse({
        application: { id: CLIENT_ID },
        user: { id: USER_ID, username: "birder", avatar },
      });
    }
    if (pathname === `/api/v10/guilds/${GUILD_ID}/members/${USER_ID}`) {
      return jsonResponse({ user: { id: USER_ID } });
    }
    if (pathname === `/api/v10/channels/${CHANNEL_ID}`) {
      return jsonResponse({ id: CHANNEL_ID, guild_id: GUILD_ID });
    }
    if (pathname === `/api/v10/channels/${CHANNEL_ID}/messages`) {
      return jsonResponse({ id: MESSAGE_ID, channel_id: CHANNEL_ID });
    }
    if (pathname === `/api/v10/channels/${CHANNEL_ID}/messages/${MESSAGE_ID}`) {
      return jsonResponse({ id: MESSAGE_ID, channel_id: CHANNEL_ID });
    }
    return jsonResponse({ error: "not_found" }, 404);
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

function boardRequest(path, body) {
  return new Request(`${ORIGIN}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${USER_TOKEN}` },
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

function componentPayload(customId) {
  return {
    type: 3,
    guild_id: GUILD_ID,
    channel_id: CHANNEL_ID,
    member: { user: { id: USER_ID } },
    data: { custom_id: customId, component_type: 2 },
  };
}

test("session message carries the Play now button and mention guard", async () => {
  const fetchImpl = makeBoardFetch();
  const db = makeDb([{ kind: "first", match: /FROM boards WHERE/, handler: () => null }]);

  const response = await handleSession(
    boardRequest("/api/session", SESSION_BODY),
    { DISCORD_BOT_TOKEN: BOT_TOKEN, DISCORD_CLIENT_ID: CLIENT_ID, DB: db },
    { fetchImpl },
  );

  assert.equal(response.status, 200);
  const post = fetchImpl.calls.find((call) => call.method === "POST");
  assert.deepEqual(post.body.components, [
    {
      type: 1,
      components: [
        { type: 2, style: 1, label: "Play now!", custom_id: PLAY_CUSTOM_ID },
      ],
    },
  ]);
  assert.deepEqual(post.body.allowed_mentions, { parse: [] });
});

test("result message carries the Play now button", async () => {
  const fetchImpl = makeBoardFetch();
  const db = makeDb([{ kind: "first", match: /FROM boards WHERE/, handler: () => ({ message_id: MESSAGE_ID }) }]);

  const response = await handleResult(
    boardRequest("/api/result", {
      ...SESSION_BODY,
      won: true,
      maxGuesses: 4,
      guesses: [{ correct: true }],
    }),
    { DISCORD_BOT_TOKEN: BOT_TOKEN, DISCORD_CLIENT_ID: CLIENT_ID, DB: db },
    { fetchImpl },
  );

  assert.equal(response.status, 200);
  const patch = fetchImpl.calls.find((call) => call.method === "PATCH");
  assert.equal(patch.body.components[0].components[0].custom_id, PLAY_CUSTOM_ID);
  assert.deepEqual(patch.body.allowed_mentions, { parse: [] });
});

test("Play now component interaction launches and records the launch", async () => {
  const db = makeDb();
  const response = await worker.fetch(
    await signedRequest(componentPayload(PLAY_CUSTOM_ID)),
    { DISCORD_PUBLIC_KEY: publicKeyHex, DB: db },
    {},
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { type: 12 });

  const launch = db.calls.find((statement) => statement.sql.startsWith("INSERT INTO launches"));
  assert.ok(launch, "launch upsert runs");
  assert.deepEqual(launch.args.slice(0, 3), [USER_ID, GUILD_ID, CHANNEL_ID]);
  assert.equal(typeof launch.args[3], "number");
});

test("unknown component custom id is rejected with 400", async () => {
  const db = makeDb();
  const response = await worker.fetch(
    await signedRequest(componentPayload("audiobirdle:other")),
    { DISCORD_PUBLIC_KEY: publicKeyHex, DB: db },
    {},
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "unknown_component" });
  assert.equal(
    db.calls.some((statement) => statement.sql.startsWith("INSERT INTO launches")),
    false,
  );
});

test("session author shows the avatar only when one exists", async () => {
  const withAvatar = makeBoardFetch({ avatar: AVATAR });
  const db = makeDb([{ kind: "first", match: /FROM boards WHERE/, handler: () => null }]);
  await handleSession(
    boardRequest("/api/session", SESSION_BODY),
    { DISCORD_BOT_TOKEN: BOT_TOKEN, DISCORD_CLIENT_ID: CLIENT_ID, DB: db },
    { fetchImpl: withAvatar },
  );

  const author = withAvatar.calls.find((call) => call.method === "POST").body.embeds[0].author;
  assert.deepEqual(author, {
    name: "birder",
    icon_url: `https://cdn.discordapp.com/avatars/${USER_ID}/${AVATAR}.png?size=64`,
  });

  const noAvatar = makeBoardFetch({ avatar: null });
  const emptyDb = makeDb([{ kind: "first", match: /FROM boards WHERE/, handler: () => null }]);
  await handleSession(
    boardRequest("/api/session", SESSION_BODY),
    { DISCORD_BOT_TOKEN: BOT_TOKEN, DISCORD_CLIENT_ID: CLIENT_ID, DB: emptyDb },
    { fetchImpl: noAvatar },
  );

  const bareAuthor = noAvatar.calls.find((call) => call.method === "POST").body.embeds[0].author;
  assert.deepEqual(bareAuthor, { name: "birder" });
});
