/**
 * Safe localStorage access.
 *
 * A private in-memory fallback keeps the current session playable when storage
 * is unavailable (private mode, quota exhaustion, embedded webviews).
 *
 * Discord Activities run in a per-install webview, so two Discord accounts can
 * share one `localStorage`. `setStorageNamespace()` scopes every helper below
 * to a per-user prefix; `null` (the web default) leaves key names untouched.
 */
const memory = new Map();
let namespace = null;

export function setStorageNamespace(prefix) {
  namespace = typeof prefix === "string" && prefix.trim() ? prefix.trim() : null;
}

export function getStorageNamespace() {
  return namespace;
}

function storageKey(key) {
  return namespace === null ? key : `${namespace}:${key}`;
}

export function readString(key, fallback = null) {
  const scopedKey = storageKey(key);
  try {
    const value = window.localStorage.getItem(scopedKey);
    if (value !== null) {
      return value;
    }
  } catch {
    // Fall through to the in-memory copy.
  }
  return memory.has(scopedKey) ? memory.get(scopedKey) : fallback;
}

export function writeString(key, value) {
  const scopedKey = storageKey(key);
  try {
    window.localStorage.setItem(scopedKey, value);
    memory.delete(scopedKey);
    return true;
  } catch (error) {
    if (error?.name !== "QuotaExceededError") {
      console.warn(`Could not write ${key}:`, error);
    }
    memory.set(scopedKey, value);
    return false;
  }
}

export function removeKey(key) {
  const scopedKey = storageKey(key);
  memory.delete(scopedKey);
  try {
    window.localStorage.removeItem(scopedKey);
  } catch (error) {
    console.warn(`Could not remove ${key}:`, error);
  }
}

export function readJSON(key, fallback = null) {
  const raw = readString(key, null);
  if (raw === null) {
    return fallback;
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`Could not parse ${key}:`, error);
    return fallback;
  }
}

export function writeJSON(key, value) {
  try {
    return writeString(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Could not serialize ${key}:`, error);
    return false;
  }
}
