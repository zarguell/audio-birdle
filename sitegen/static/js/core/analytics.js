/**
 * Consent-gated Cloudflare Web Analytics.
 *
 * Nothing in the rendered HTML loads the beacon. A player must opt in from
 * Settings, which stores a consent record outside the `audio-birdle-game`
 * envelope. Only then, and only when the browser is not sending Do Not Track
 * or Global Privacy Control, does this module inject the Cloudflare script.
 *
 * Pure helpers stay free of top-level DOM access so Node tests can exercise
 * them without a browser.
 */
import { STORAGE_KEYS } from "./constants.js";
import { readJSON, removeKey, writeJSON } from "./storage.js";

export const ANALYTICS_POLICY_VERSION = "2026-11-26";
export const BEACON_SCRIPT_ID = "cf-web-analytics-beacon";
export const BEACON_SRC = "https://static.cloudflareinsights.com/beacon.min.js";

/**
 * Return the usable consent record, or null when analytics must stay off.
 *
 * A record from an older policy version does not count: the player has to
 * make a fresh choice after a material policy change.
 */
export const normalizeConsent = (record) => {
  if (!record || typeof record !== "object") {
    return null;
  }
  if (record.granted !== true) {
    return null;
  }
  if (record.policyVersion !== ANALYTICS_POLICY_VERSION) {
    return null;
  }
  return {
    granted: true,
    policyVersion: record.policyVersion,
    at: typeof record.at === "string" ? record.at : "",
  };
};

export const readConsent = () =>
  normalizeConsent(readJSON(STORAGE_KEYS.ANALYTICS_CONSENT, null));

export const writeConsent = (granted, now = new Date()) => {
  const record = {
    granted: Boolean(granted),
    policyVersion: ANALYTICS_POLICY_VERSION,
    at: now.toISOString(),
  };
  writeJSON(STORAGE_KEYS.ANALYTICS_CONSENT, record);
  return record;
};

export const clearConsent = () => removeKey(STORAGE_KEYS.ANALYTICS_CONSENT);

/** Read the browser privacy signals without assuming a navigator exists. */
export const readPrivacySignals = (windowImpl) => ({
  doNotTrack:
    windowImpl?.doNotTrack ?? windowImpl?.navigator?.doNotTrack ?? false,
  globalPrivacyControl: windowImpl?.navigator?.globalPrivacyControl === true,
});

export const shouldTrack = ({
  doNotTrack = false,
  globalPrivacyControl = false,
} = {}) => !doNotTrack && !globalPrivacyControl;

/** Read the optional build-time token from a meta element. */
export const getAnalyticsToken = (documentImpl) => {
  try {
    const meta = documentImpl?.querySelector?.('meta[name="cf-analytics-token"]');
    const content = meta?.getAttribute?.("content") ?? "";
    return String(content).trim();
  } catch (error) {
    console.warn("Could not read the analytics token:", error);
    return "";
  }
};

const injectedBeacons = new WeakMap();

const findBeacon = (documentImpl) => {
  if (!documentImpl) {
    return null;
  }
  try {
    if (typeof documentImpl.getElementById === "function") {
      const existing = documentImpl.getElementById(BEACON_SCRIPT_ID);
      if (existing) {
        return existing;
      }
    }
    return (
      documentImpl.querySelector?.(`#${BEACON_SCRIPT_ID}`) ??
      injectedBeacons.get(documentImpl) ??
      null
    );
  } catch (error) {
    console.warn("Could not inspect analytics markup:", error);
    return injectedBeacons.get(documentImpl) ?? null;
  }
};

/**
 * Add the beacon script exactly once. Returns true only when this call added
 * it; an existing script or missing document/token leaves the DOM untouched.
 */
export const injectBeacon = ({ documentImpl, token }) => {
  try {
    const trimmed = String(token ?? "").trim();
    if (!documentImpl || !trimmed) {
      return false;
    }
    if (injectedBeacons.has(documentImpl) || findBeacon(documentImpl)) {
      return false;
    }
    const script = documentImpl.createElement("script");
    script.id = BEACON_SCRIPT_ID;
    script.src = BEACON_SRC;
    script.async = true;
    script.setAttribute("data-cf-beacon", JSON.stringify({ token: trimmed }));
    const parent = documentImpl.head || documentImpl.body;
    if (!parent || typeof parent.appendChild !== "function") {
      return false;
    }
    parent.appendChild(script);
    injectedBeacons.set(documentImpl, script);
    return true;
  } catch (error) {
    console.warn("Could not load the analytics beacon:", error);
    return false;
  }
};

/**
 * Load analytics only with a current consent grant, no privacy signal, and a
 * non-empty token. Never throws; returns whether the beacon was added.
 */
export const initAnalytics = ({
  documentImpl = typeof document === "undefined" ? null : document,
  windowImpl = typeof window === "undefined" ? null : window,
  token = "",
  consent,
} = {}) => {
  try {
    const record =
      consent === undefined ? readConsent() : normalizeConsent(consent);
    if (!record) {
      return false;
    }
    if (!shouldTrack(readPrivacySignals(windowImpl))) {
      return false;
    }
    return injectBeacon({ documentImpl, token });
  } catch (error) {
    console.warn("Analytics initialization skipped:", error);
    return false;
  }
};

/** Remove the beacon script, restoring the pre-consent state. */
export const removeAnalytics = ({
  documentImpl = typeof document === "undefined" ? null : document,
} = {}) => {
  const beacon = findBeacon(documentImpl);
  if (!beacon) {
    return false;
  }
  try {
    if (typeof beacon.remove === "function") {
      beacon.remove();
    } else {
      beacon.parentNode?.removeChild?.(beacon);
    }
    if (documentImpl) {
      injectedBeacons.delete(documentImpl);
    }
    return true;
  } catch (error) {
    console.warn("Could not remove the analytics beacon:", error);
    return false;
  }
};
