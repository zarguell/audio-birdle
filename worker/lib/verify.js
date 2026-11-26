// Discord request signature verification.
// Pure WebCrypto: no Node built-ins, no I/O, never throws.

const ED25519_KEY_BYTES = 32;
const ED25519_SIGNATURE_BYTES = 64;

/**
 * Decode a hex string into bytes.
 * @param {unknown} hex
 * @returns {Uint8Array | null} null when the input is not an even-length hex string
 */
export function hexToBytes(hex) {
  if (typeof hex !== "string") return null;
  if (hex.length % 2 !== 0) return null;
  if (!/^[0-9a-fA-F]*$/.test(hex)) return null;

  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Verify a Discord interaction signature (Ed25519 over `timestamp + body`).
 * @param {{ publicKeyHex?: unknown, signatureHex?: unknown, timestamp?: unknown, body?: unknown }} params
 * @returns {Promise<boolean>} false for any malformed input or verification failure
 */
export async function verifyDiscordRequest({ publicKeyHex, signatureHex, timestamp, body }) {
  try {
    if (typeof timestamp !== "string" || timestamp.length === 0) return false;
    if (typeof body !== "string") return false;

    const publicKey = hexToBytes(publicKeyHex);
    if (!publicKey || publicKey.length !== ED25519_KEY_BYTES) return false;

    const signature = hexToBytes(signatureHex);
    if (!signature || signature.length !== ED25519_SIGNATURE_BYTES) return false;

    const subtle = globalThis.crypto?.subtle;
    if (!subtle) return false;

    const key = await subtle.importKey("raw", publicKey, { name: "Ed25519" }, false, ["verify"]);
    const message = new TextEncoder().encode(timestamp + body);
    return await subtle.verify({ name: "Ed25519" }, key, signature, message);
  } catch {
    return false;
  }
}
