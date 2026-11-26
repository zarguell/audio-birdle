import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";

import {
  authorizeRequest,
  buildResultBody,
  buildSessionBody,
  isActivity,
  postBoardResult,
  startBoardSession,
  readActivityCache,
  whenActivityReady,
  writeActivityCache,
} from "../../sitegen/static/js/core/activity.js";
import { mapActivityMediaUrl } from "../../sitegen/static/js/core/audio.js";
import {
  getStorageNamespace,
  readJSON,
  readString,
  removeKey,
  setStorageNamespace,
  writeJSON,
  writeString,
} from "../../sitegen/static/js/core/storage.js";

const backing = new Map();

globalThis.window = {
  localStorage: {
    getItem(key) {
      return backing.has(key) ? backing.get(key) : null;
    },
    setItem(key, value) {
      backing.set(key, String(value));
    },
    removeItem(key) {
      backing.delete(key);
    },
  },
};

beforeEach(() => {
  backing.clear();
  setStorageNamespace(null);
});

afterEach(() => {
  setStorageNamespace(null);
});

test("isActivity recognizes the Discord proxy host", () => {
  assert.equal(isActivity("https://1234.discordsays.com/"), true);
  assert.equal(isActivity(new URL("https://1234.discordsays.com/normal/")), true);
  assert.equal(
    isActivity({ hostname: "1234.discordsays.com", search: "" }),
    true,
  );
});

test("isActivity recognizes the activity query flag", () => {
  assert.equal(isActivity("https://audio-birdle.sechostlab.com/?activity=1"), true);
  assert.equal(
    isActivity("https://audio-birdle.sechostlab.com/play/?region=us&activity=1"),
    true,
  );
  assert.equal(
    isActivity({ hostname: "audio-birdle.sechostlab.com", search: "?activity=1" }),
    true,
  );
});

test("isActivity rejects normal hosts and non-flags", () => {
  assert.equal(isActivity("https://audio-birdle.sechostlab.com/"), false);
  assert.equal(isActivity("https://audio-birdle.sechostlab.com/?activity=0"), false);
  assert.equal(isActivity("https://audio-birdle.sechostlab.com/?activity=10"), false);
  assert.equal(isActivity("https://discordsays.com/"), false);
  assert.equal(isActivity("https://notdiscordsays.com/"), false);
  assert.equal(isActivity(undefined), false);
});

test("web storage keys are unchanged without a namespace", () => {
  assert.equal(getStorageNamespace(), null);

  writeString("audio-birdle-game", "web");
  assert.equal(backing.get("audio-birdle-game"), "web");
  assert.equal(readString("audio-birdle-game"), "web");
  assert.equal(readString("missing-key", "fallback"), "fallback");
  assert.equal(backing.has("null:audio-birdle-game"), false);
});

test("namespace prefixes every exported storage helper", () => {
  setStorageNamespace("discord-42");
  assert.equal(getStorageNamespace(), "discord-42");

  writeString("audio-birdle-game", "scoped");
  assert.equal(backing.get("discord-42:audio-birdle-game"), "scoped");
  assert.equal(backing.has("audio-birdle-game"), false);

  writeJSON("audio-birdle-analytics-consent", { granted: true });
  assert.deepEqual(readJSON("audio-birdle-analytics-consent"), { granted: true });
  assert.deepEqual(
    JSON.parse(backing.get("discord-42:audio-birdle-analytics-consent")),
    { granted: true },
  );

  removeKey("audio-birdle-game");
  assert.equal(backing.has("discord-42:audio-birdle-game"), false);
  assert.equal(readString("audio-birdle-game"), null);
});

test("namespaced helpers leave unscoped keys alone", () => {
  backing.set("audio-birdle-game", "web");

  setStorageNamespace("discord-99");
  writeString("audio-birdle-region", "gb");
  removeKey("audio-birdle-game");

  assert.equal(backing.get("audio-birdle-game"), "web");
  assert.equal(backing.has("discord-99:audio-birdle-game"), false);
  assert.equal(backing.get("discord-99:audio-birdle-region"), "gb");

  setStorageNamespace(null);
  assert.equal(getStorageNamespace(), null);
  assert.equal(readString("audio-birdle-game"), "web");
});

test("whenActivityReady resolves immediately outside an Activity", async () => {
  assert.equal(await whenActivityReady(), null);
});

test("whenActivityReady resolves null when initialisation fails", async () => {
  const originalWarn = console.warn;
  const hadLocation = Object.hasOwn(globalThis, "location");
  const hadDocument = Object.hasOwn(globalThis, "document");
  const previousLocation = globalThis.location;
  const previousDocument = globalThis.document;

  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: { href: "https://1234.discordsays.com/" },
    writable: true,
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { querySelector: () => null },
    writable: true,
  });
  console.warn = () => {};

  try {
    assert.equal(await whenActivityReady(), null);
  } finally {
    console.warn = originalWarn;
    if (hadLocation) {
      globalThis.location = previousLocation;
    } else {
      delete globalThis.location;
    }
    if (hadDocument) {
      globalThis.document = previousDocument;
    } else {
      delete globalThis.document;
    }
  }
});

test("buildSessionBody matches the session contract", () => {
  assert.deepEqual(
    buildSessionBody({
      guildId: "guild-1",
      channelId: "channel-1",
      date: "2026-11-26",
      mode: "hard",
      region: "us",
    }),
    {
      guildId: "guild-1",
      channelId: "channel-1",
      date: "2026-11-26",
      mode: "hard",
      region: "us",
    },
  );
});

test("buildResultBody sends only grid inputs", () => {
  const body = buildResultBody(
    {
      date: "2026-11-26",
      mode: "hard",
      region: "us",
      won: true,
      maxGuesses: 6,
      guesses: [
        {
          birdId: "amerob",
          textInput: "American Robin",
          correct: false,
          taxonomicScore: {
            order: true,
            family: false,
            genus: true,
            species: false,
          },
          timestamp: 1700000000000,
        },
        {
          birdId: "norcar",
          textInput: "Northern Cardinal",
          correct: true,
          taxonomicScore: {
            order: true,
            family: true,
            genus: true,
            species: true,
          },
        },
      ],
    },
    { guildId: "guild-1", channelId: "channel-1" },
  );

  assert.deepEqual(body, {
    guildId: "guild-1",
    channelId: "channel-1",
    date: "2026-11-26",
    mode: "hard",
    region: "us",
    won: true,
    maxGuesses: 6,
    guesses: [
      {
        correct: false,
        taxonomicScore: { order: true, family: false, genus: true },
      },
      {
        correct: true,
        taxonomicScore: { order: true, family: true, genus: true },
      },
    ],
  });

  const serialized = JSON.stringify(body);
  assert.equal(serialized.includes("textInput"), false);
  assert.equal(serialized.includes("birdId"), false);
  assert.equal(serialized.includes("amerob"), false);
  assert.equal(serialized.includes("species"), false);
  assert.equal(serialized.includes("timestamp"), false);
});

test("buildResultBody tolerates a missing game and empty guesses", () => {
  const body = buildResultBody(undefined, {
    guildId: "guild-1",
    channelId: "channel-1",
  });
  assert.deepEqual(body.guesses, []);
  assert.equal(body.won, false);
  assert.equal(body.date, undefined);
});

test("startBoardSession resolves null outside an Activity", async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = () => {
    called = true;
    throw new Error("network must not be touched");
  };

  try {
    assert.equal(
      await startBoardSession({
        date: "2026-11-26",
        mode: "normal",
        region: "us",
      }),
      null,
    );
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("postBoardResult resolves null outside an Activity", async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = () => {
    called = true;
    throw new Error("network must not be touched");
  };

  try {
    assert.equal(
      await postBoardResult({
        date: "2026-11-26",
        mode: "normal",
        region: "us",
        won: false,
        maxGuesses: 4,
        guesses: [
          {
            birdId: "amerob",
            textInput: "American Robin",
            correct: false,
            taxonomicScore: { order: true, family: false, genus: false },
          },
        ],
      }),
      null,
    );
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Activity media mapping rewrites only the known audio hosts", () => {
  assert.equal(
    mapActivityMediaUrl("https://xeno-canto.org/321256/download", {
      inActivity: true,
    }),
    "/xc/321256/download",
  );
  assert.equal(
    mapActivityMediaUrl(
      "https://cdn.download.ams.birds.cornell.edu/api/v2/asset/1/mp3",
      { inActivity: true },
    ),
    "/cornell/api/v2/asset/1/mp3",
  );
  assert.equal(
    mapActivityMediaUrl("https://xeno-canto.org/321256/download", {
      inActivity: false,
    }),
    "https://xeno-canto.org/321256/download",
  );
  assert.equal(
    mapActivityMediaUrl("https://example.com/a.mp3", { inActivity: true }),
    "https://example.com/a.mp3",
  );
});

test("activity auth cache round-trips and rejects stale records", () => {
  const store = new Map();
  const original = globalThis.sessionStorage;
  globalThis.sessionStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.delete(key),
  };
  try {
    writeActivityCache({
      user: { id: "1", username: "birder" },
      accessToken: "token",
      guildId: "g",
      channelId: "c",
    });
    const cached = readActivityCache();
    assert.equal(cached.user.id, "1");
    assert.equal(cached.accessToken, "token");
    assert.equal(cached.guildId, "g");

    store.set(
      "audio-birdle-activity-auth",
      JSON.stringify({
        user: { id: "1" },
        accessToken: "token",
        guildId: "g",
        channelId: "c",
        at: 0,
      }),
    );
    assert.equal(readActivityCache(), null);
  } finally {
    globalThis.sessionStorage = original;
  }
});

test("authorize asks Discord not to re-prompt for consent", () => {
  // Without prompt: "none" the consent modal appears on every launch, so a
  // returning player is asked to re-approve the same scopes each time.
  const request = authorizeRequest("123456789");

  assert.equal(request.prompt, "none");
  assert.equal(request.client_id, "123456789");
  assert.equal(request.response_type, "code");
  assert.deepEqual(request.scope, ["identify", "guilds"]);
});
