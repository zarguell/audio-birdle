// Per-channel groups: `/audiobirdle-setup` and the daily summary cron.
// Fake D1 and a fetch double that records posts; nothing touches the network.

import test from "node:test";
import assert from "node:assert/strict";

import worker, { scheduled } from "../../worker/index.js";

const encoder = new TextEncoder();
const ORIGIN = "https://audio-birdle.example";

const GUILD_ID = "123456789012345678";
const CHANNEL_ID = "234567890123456789";
const OTHER_CHANNEL_ID = "234567890123456780";
const MESSAGE_ID = "345678901234567890";
const USER_ID = "567890123456789012";
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

/** A `/audiobirdle-setup` command with no options, run in CHANNEL_ID. */
function setupPayload({ permissions = MANAGE_GUILD } = {}) {
  return {
    type: 2,
    guild_id: GUILD_ID,
    channel_id: CHANNEL_ID,
    member: { user: { id: USER_ID }, permissions },
    data: { name: "audiobirdle-setup" },
  };
}

/**
 * Fake D1. Handlers receive `{ sql, args }` and return rows (or an array of
 * post objects keyed by channel/region/mode).
 *
 * @param {{
 *   channels?: { channel_id: string, guild_id: string }[],
 *   results?: { channel_id: string, date: string, region: string, mode: string, discord_id: string, won: number, guess_count: number, username: string | null }[],
 *   dates?: { channel_id: string, region: string, date: string }[],
 *   leaderboard?: { channel_id: string, region: string, mode: string, username: string, games: number, wins: number }[],
 * }} data
 */
function makeDb({ channels = [], results = [], dates = [], leaderboard = [] } = {}) {
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
          return null;
        },
        async all() {
          if (sql.includes("FROM channels")) {
            return { results: channels.slice(0, Number(this.args[0])) };
          }
          if (sql.includes("SELECT r.region, r.mode")) {
            const [channelId, date] = this.args;
            return {
              results: results.filter(
                (row) => row.channel_id === channelId && row.date === date,
              ),
            };
          }
          if (sql.includes("SELECT DISTINCT date FROM results")) {
            const [channelId, region] = this.args;
            return {
              results: dates
                .filter((row) => row.channel_id === channelId && row.region === region)
                .map((row) => ({ date: row.date })),
            };
          }
          if (sql.includes("GROUP BY r.discord_id")) {
            const [channelId, region, mode] = this.args;
            return {
              results: leaderboard.filter(
                (row) =>
                  row.channel_id === channelId &&
                  row.region === region &&
                  row.mode === mode,
              ),
            };
          }
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

/** Fetch double: every call is recorded, and posting always succeeds. */
function makeFetch() {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const { pathname } = new URL(url);
    calls.push({
      url,
      pathname,
      method: init.method || "GET",
      body: init.body ? JSON.parse(init.body) : undefined,
    });
    return jsonResponse({ id: MESSAGE_ID, channel_id: pathname.split("/")[4] });
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

function summaryPosts(fetchImpl) {
  return fetchImpl.calls.filter((call) => call.method === "POST");
}

// 05:10 UTC is 00:10 EST on 2026-11-26, so the cron reports 2026-11-25.
const CRON_NOW = new Date("2026-11-26T05:10:00Z");
const SUMMARY_DATE = "2026-11-25";

test("setup stores the invoking channel and requires MANAGE_GUILD", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("setup must not call Discord");
  };

  try {
    const deniedDb = makeDb();
    const denied = await worker.fetch(
      await signedRequest(setupPayload({ permissions: "0" })),
      { DISCORD_PUBLIC_KEY: publicKeyHex, DB: deniedDb },
      {},
    );
    const deniedBody = await denied.json();
    assert.equal(deniedBody.type, 4);
    assert.equal(deniedBody.data.flags, 64);
    assert.match(deniedBody.data.content, /Manage Server/);
    assert.equal(deniedDb.calls.length, 0, "no write without permission");

    const db = makeDb();
    const response = await worker.fetch(
      await signedRequest(setupPayload()),
      { DISCORD_PUBLIC_KEY: publicKeyHex, DB: db },
      {},
    );
    const body = await response.json();
    assert.equal(body.type, 4);
    assert.equal(body.data.flags, 64);
    assert.equal(body.data.content, "Daily summaries will post in this channel.");
    assert.deepEqual(body.data.allowed_mentions, { parse: [] });

    const upsert = db.calls.find((statement) => statement.sql.startsWith("INSERT INTO channels"));
    assert.ok(upsert, "channel upsert runs");
    assert.deepEqual(upsert.args.slice(0, 2), [CHANNEL_ID, GUILD_ID]);
    assert.equal(typeof upsert.args[2], "string");
    assert.equal(
      db.calls.some((statement) => statement.sql.includes("guilds")),
      false,
      "guilds table is not touched",
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("cron posts one message per channel with every region and mode", async () => {
  const db = makeDb({
    channels: [{ channel_id: CHANNEL_ID, guild_id: GUILD_ID }],
    results: [
      {
        channel_id: CHANNEL_ID,
        date: SUMMARY_DATE,
        region: "us",
        mode: "normal",
        discord_id: "567890123456789012",
        won: 1,
        guess_count: 3,
        username: "birder",
      },
      {
        channel_id: CHANNEL_ID,
        date: SUMMARY_DATE,
        region: "us",
        mode: "hard",
        discord_id: "567890123456789013",
        won: 0,
        guess_count: 6,
        username: "wren",
      },
      {
        channel_id: CHANNEL_ID,
        date: SUMMARY_DATE,
        region: "ca",
        mode: "normal",
        discord_id: "567890123456789014",
        won: 1,
        guess_count: 4,
        username: "loon",
      },
    ],
    dates: [
      { channel_id: CHANNEL_ID, region: "us", date: SUMMARY_DATE },
      { channel_id: CHANNEL_ID, region: "us", date: "2026-11-24" },
      { channel_id: CHANNEL_ID, region: "ca", date: SUMMARY_DATE },
    ],
    leaderboard: [
      {
        channel_id: CHANNEL_ID,
        region: "us",
        mode: "normal",
        username: "birder",
        games: 7,
        wins: 5,
      },
      {
        channel_id: CHANNEL_ID,
        region: "us",
        mode: "hard",
        username: "wren",
        games: 4,
        wins: 1,
      },
      {
        channel_id: CHANNEL_ID,
        region: "ca",
        mode: "normal",
        username: "loon",
        games: 2,
        wins: 2,
      },
    ],
  });
  const fetchImpl = makeFetch();

  await scheduled({}, { DB: db, DISCORD_BOT_TOKEN: "bot-token" }, {}, {
    fetchImpl,
    now: CRON_NOW,
  });

  const posts = summaryPosts(fetchImpl);
  assert.equal(posts.length, 1);
  const [post] = posts;
  assert.equal(post.pathname, `/api/v10/channels/${CHANNEL_ID}/messages`);
  assert.deepEqual(post.body.allowed_mentions, { parse: [] });
  assert.equal(post.body.embeds[0].title, `Audio-Birdle — ${SUMMARY_DATE}`);

  const description = post.body.embeds[0].description;
  assert.match(description, /\*\*US · Normal — group streak 2 day\(s\)\*\*/);
  assert.match(description, /\*\*US · Hard — group streak 2 day\(s\)\*\*/);
  assert.match(description, /\*\*CA · Normal — group streak 1 day\(s\)\*\*/);
  assert.match(description, /birder — 3\/4/);
  assert.match(description, /wren — X\/6/);
  assert.match(description, /loon — 4\/4/);
  assert.match(description, /Leaderboard: 1\. birder — 5W\/7G/);
  assert.match(description, /Leaderboard: 1\. wren — 1W\/4G/);
  assert.match(description, /Leaderboard: 1\. loon — 2W\/2G/);

  // Regions render in sorted order and hard follows normal within a region.
  const usNormal = description.indexOf("**US · Normal");
  const usHard = description.indexOf("**US · Hard");
  const caNormal = description.indexOf("**CA · Normal");
  assert.ok(caNormal < usNormal, "regions sorted");
  assert.ok(usNormal < usHard, "normal before hard");

  // Never leak Discord ids.
  assert.equal(description.includes("567890123456789012"), false);
  assert.equal(description.includes("567890123456789013"), false);
});

test("cron skips a channel with no results yesterday", async () => {
  const db = makeDb({
    channels: [
      { channel_id: CHANNEL_ID, guild_id: GUILD_ID },
      { channel_id: OTHER_CHANNEL_ID, guild_id: GUILD_ID },
    ],
    results: [
      {
        channel_id: CHANNEL_ID,
        date: SUMMARY_DATE,
        region: "us",
        mode: "normal",
        discord_id: "567890123456789012",
        won: 1,
        guess_count: 2,
        username: "birder",
      },
    ],
    dates: [{ channel_id: CHANNEL_ID, region: "us", date: SUMMARY_DATE }],
  });
  const fetchImpl = makeFetch();

  await scheduled({}, { DB: db, DISCORD_BOT_TOKEN: "bot-token" }, {}, { fetchImpl, now: CRON_NOW });

  const posts = summaryPosts(fetchImpl);
  assert.equal(posts.length, 1);
  assert.equal(posts[0].pathname, `/api/v10/channels/${CHANNEL_ID}/messages`);
});

test("cron scopes the leaderboard to one region and mode, top five", async () => {
  const players = ["a", "b", "c", "d", "e", "f"];
  const db = makeDb({
    channels: [{ channel_id: CHANNEL_ID, guild_id: GUILD_ID }],
    results: [
      {
        channel_id: CHANNEL_ID,
        date: SUMMARY_DATE,
        region: "us",
        mode: "normal",
        discord_id: "567890123456789012",
        won: 1,
        guess_count: 3,
        username: "a",
      },
      {
        channel_id: CHANNEL_ID,
        date: SUMMARY_DATE,
        region: "ca",
        mode: "normal",
        discord_id: "567890123456789013",
        won: 1,
        guess_count: 2,
        username: "canada-only",
      },
    ],
    dates: [
      { channel_id: CHANNEL_ID, region: "us", date: SUMMARY_DATE },
      { channel_id: CHANNEL_ID, region: "ca", date: SUMMARY_DATE },
    ],
    leaderboard: [
      ...players.map((name, index) => ({
        channel_id: CHANNEL_ID,
        region: "us",
        mode: "normal",
        username: name,
        games: 10 - index,
        wins: 6 - index,
      })),
      {
        channel_id: CHANNEL_ID,
        region: "ca",
        mode: "normal",
        username: "canada-only",
        games: 1,
        wins: 1,
      },
    ],
  });
  const fetchImpl = makeFetch();

  await scheduled({}, { DB: db, DISCORD_BOT_TOKEN: "bot-token" }, {}, { fetchImpl, now: CRON_NOW });

  const description = summaryPosts(fetchImpl)[0].body.embeds[0].description;
  const lines = description.split("\n");
  const leaderboardLines = lines.filter((line) => line.startsWith("Leaderboard:"));

  assert.equal(leaderboardLines.length, 2, "one leaderboard per region");
  // Regions render sorted, so CA comes before US.
  const [caLine, usLine] = leaderboardLines;
  assert.match(usLine, /1\. a — 6W\/10G, 2\. b — 5W\/9G, 3\. c — 4W\/8G, 4\. d — 3W\/7G, 5\. e — 2W\/6G/);
  assert.equal(usLine.includes("f —"), false, "top five only");
  assert.equal(usLine.includes("canada-only"), false, "no cross-region rows");
  assert.match(caLine, /1\. canada-only — 1W\/1G/);
  assert.equal(caLine.includes("a —"), false, "no cross-region rows");

  // The leaderboard query is bound per channel, region, and mode.
  const leaderboardStatements = db.calls.filter(
    (statement) => statement.sql.includes("GROUP BY r.discord_id"),
  );
  assert.equal(leaderboardStatements.length, 2);
  assert.deepEqual(leaderboardStatements[0].args, [CHANNEL_ID, "ca", "normal"]);
  assert.deepEqual(leaderboardStatements[1].args, [CHANNEL_ID, "us", "normal"]);
});

test("cron caps the run at 40 channels", async () => {
  const channels = Array.from({ length: 45 }, (_, index) => ({
    channel_id: String(200000000000000000n + BigInt(index)),
    guild_id: GUILD_ID,
  }));
  const db = makeDb({
    channels,
    results: channels.map((channel, index) => ({
      channel_id: channel.channel_id,
      date: SUMMARY_DATE,
      region: "us",
      mode: "normal",
      discord_id: String(300000000000000000n + BigInt(index)),
      won: 1,
      guess_count: 3,
      username: `player${index}`,
    })),
    dates: channels.map((channel) => ({
      channel_id: channel.channel_id,
      region: "us",
      date: SUMMARY_DATE,
    })),
  });
  const fetchImpl = makeFetch();

  await scheduled({}, { DB: db, DISCORD_BOT_TOKEN: "bot-token" }, {}, { fetchImpl, now: CRON_NOW });

  const posts = summaryPosts(fetchImpl);
  assert.equal(posts.length, 40);
  for (const post of posts) {
    assert.deepEqual(post.body.allowed_mentions, { parse: [] });
  }

  const channelQuery = db.calls.find((statement) => statement.sql.includes("FROM channels"));
  assert.deepEqual(channelQuery.args, [40]);
});
