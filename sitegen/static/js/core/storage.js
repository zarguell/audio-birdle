/**
 * Safe localStorage access.
 *
 * A private in-memory fallback keeps the current session playable when storage
 * is unavailable (private mode, quota exhaustion, embedded webviews).
 */
const memory = new Map();

export function readString(key, fallback = null) {
  try {
    const value = window.localStorage.getItem(key);
    if (value !== null) {
      return value;
    }
  } catch {
    // Fall through to the in-memory copy.
  }
  return memory.has(key) ? memory.get(key) : fallback;
}

export function writeString(key, value) {
  try {
    window.localStorage.setItem(key, value);
    memory.delete(key);
    return true;
  } catch (error) {
    if (error?.name !== "QuotaExceededError") {
      console.warn(`Could not write ${key}:`, error);
    }
    memory.set(key, value);
    return false;
  }
}

export function removeKey(key) {
  memory.delete(key);
  try {
    window.localStorage.removeItem(key);
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

