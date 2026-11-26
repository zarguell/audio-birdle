import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";

import {
  isActivity,
  whenActivityReady,
} from "../../sitegen/static/js/core/activity.js";
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
