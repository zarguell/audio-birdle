// Worker interaction tests: real WebCrypto signatures, no network, no Miniflare.

import test from "node:test";
import assert from "node:assert/strict";

import worker from "../../worker/index.js";

const encoder = new TextEncoder();
const ORIGIN = "https://audio-birdle.example";

function toHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

const keyPair = await globalThis.crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
const publicKeyHex = toHex(new Uint8Array(await globalThis.crypto.subtle.exportKey("raw", keyPair.publicKey)));
const env = { DISCORD_PUBLIC_KEY: publicKeyHex };

async function signedRequest(payload, { timestamp = "1700000000", tamperBody = false } = {}) {
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
    // Mutate the payload after signing so the transmitted body never matches the signature.
    body: tamperBody ? `${body} ` : body,
  });
}

test("PING interaction returns a PONG", async () => {
  const response = await worker.fetch(await signedRequest({ type: 1 }), env, {});
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { type: 1 });
});

test("tampered body is rejected with 401", async () => {
  const request = await signedRequest({ type: 1 }, { tamperBody: true });
  const response = await worker.fetch(request, env, {});
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "invalid_signature" });
});

test("unknown command is rejected with 400", async () => {
  const request = await signedRequest({ type: 2, data: { name: "not-audiobirdle" } });
  const response = await worker.fetch(request, env, {});
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "unsupported_interaction" });
});

test("health endpoint reports ok", async () => {
  const request = new Request(`${ORIGIN}/api/health`, { method: "GET" });
  const response = await worker.fetch(request, env, {});
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});
