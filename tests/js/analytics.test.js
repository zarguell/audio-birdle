import test from "node:test";
import assert from "node:assert/strict";

class MemoryStorage {
  #data = new Map();

  getItem(key) {
    return this.#data.has(key) ? this.#data.get(key) : null;
  }

  setItem(key, value) {
    this.#data.set(key, String(value));
  }

  removeItem(key) {
    this.#data.delete(key);
  }
}

globalThis.window = { localStorage: new MemoryStorage() };

const {
  ANALYTICS_POLICY_VERSION,
  BEACON_SCRIPT_ID,
  BEACON_SRC,
  clearConsent,
  getAnalyticsToken,
  initAnalytics,
  normalizeConsent,
  readConsent,
  readPrivacySignals,
  removeAnalytics,
  shouldTrack,
  writeConsent,
} = await import("../../sitegen/static/js/core/analytics.js");

const grantedConsent = {
  granted: true,
  policyVersion: ANALYTICS_POLICY_VERSION,
  at: "2026-11-26T12:00:00.000Z",
};

const makeDocument = () => {
  const appended = [];
  const documentImpl = {
    head: {
      appendChild(element) {
        appended.push(element);
        return element;
      },
    },
    createElement(tagName) {
      return {
        tagName: tagName.toUpperCase(),
        id: "",
        src: "",
        attributes: {},
        setAttribute(name, value) {
          this.attributes[name] = value;
        },
        getAttribute(name) {
          return Object.hasOwn(this.attributes, name)
            ? this.attributes[name]
            : null;
        },
        remove() {
          const index = appended.indexOf(this);
          if (index >= 0) {
            appended.splice(index, 1);
          }
        },
      };
    },
    getElementById(id) {
      return appended.find((element) => element.id === id) ?? null;
    },
    querySelector(selector) {
      if (selector === `#${BEACON_SCRIPT_ID}`) {
        return this.getElementById(BEACON_SCRIPT_ID);
      }
      return null;
    },
  };
  return { appended, documentImpl };
};

test("consent is unreadable by default", () => {
  clearConsent();
  assert.equal(readConsent(), null);
  assert.equal(normalizeConsent(null), null);
  assert.equal(normalizeConsent({ granted: false }), null);
  clearConsent();
});

test("consent records grant, timestamp, and withdrawal", () => {
  clearConsent();
  const written = writeConsent(true, new Date("2026-11-26T12:00:00Z"));
  assert.deepEqual(written, grantedConsent);
  assert.deepEqual(readConsent(), grantedConsent);

  writeConsent(false, new Date("2026-11-26T13:00:00Z"));
  assert.equal(readConsent(), null);
  clearConsent();
});

test("a stale policy version does not count as consent", () => {
  assert.equal(
    normalizeConsent({ ...grantedConsent, policyVersion: "2025-01-01" }),
    null,
  );
});

test("Do Not Track and Global Privacy Control both veto tracking", () => {
  assert.equal(shouldTrack({}), true);
  assert.equal(shouldTrack({ doNotTrack: true }), false);
  assert.equal(shouldTrack({ doNotTrack: "1" }), false);
  assert.equal(shouldTrack({ globalPrivacyControl: true }), false);
  assert.equal(
    readPrivacySignals({ navigator: { globalPrivacyControl: true } })
      .globalPrivacyControl,
    true,
  );
  assert.equal(readPrivacySignals({}).doNotTrack, false);
});

test("no beacon without consent", () => {
  const { appended, documentImpl } = makeDocument();
  assert.equal(
    initAnalytics({
      documentImpl,
      windowImpl: {},
      token: "test-token",
      consent: null,
    }),
    false,
  );
  assert.equal(appended.length, 0);
});

test("no beacon without a token", () => {
  const { appended, documentImpl } = makeDocument();
  assert.equal(
    initAnalytics({
      documentImpl,
      windowImpl: {},
      token: "",
      consent: grantedConsent,
    }),
    false,
  );
  assert.equal(appended.length, 0);
});

test("privacy signals block an otherwise valid consent", () => {
  for (const windowImpl of [
    { doNotTrack: "1" },
    { navigator: { globalPrivacyControl: true } },
  ]) {
    const { appended, documentImpl } = makeDocument();
    assert.equal(
      initAnalytics({
        documentImpl,
        windowImpl,
        token: "test-token",
        consent: grantedConsent,
      }),
      false,
    );
    assert.equal(appended.length, 0);
  }
});

test("beacon injection is idempotent and removable", () => {
  const { appended, documentImpl } = makeDocument();
  const options = {
    documentImpl,
    windowImpl: {},
    token: "test-token",
    consent: grantedConsent,
  };

  assert.equal(initAnalytics(options), true);
  assert.equal(appended.length, 1);
  assert.equal(appended[0].id, BEACON_SCRIPT_ID);
  assert.equal(appended[0].src, BEACON_SRC);
  assert.deepEqual(
    JSON.parse(appended[0].getAttribute("data-cf-beacon")),
    { token: "test-token" },
  );

  assert.equal(initAnalytics(options), false);
  assert.equal(appended.length, 1);

  assert.equal(removeAnalytics({ documentImpl }), true);
  assert.equal(appended.length, 0);
  assert.equal(removeAnalytics({ documentImpl }), false);

  assert.equal(initAnalytics(options), true);
  assert.equal(appended.length, 1);
});

test("token comes from an optional meta element", () => {
  const meta = { getAttribute: () => "  meta-token  " };
  assert.equal(
    getAnalyticsToken({ querySelector: () => meta }),
    "meta-token",
  );
  assert.equal(getAnalyticsToken({ querySelector: () => null }), "");
  assert.equal(getAnalyticsToken(null), "");
});
