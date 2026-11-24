import test from "node:test";
import assert from "node:assert/strict";

import {
  deterministicShuffle,
  hashString,
  randomShuffle,
} from "../../sitegen/static/js/core/hash.js";

test("hashString matches the canonical Python DJB2 vectors", () => {
  assert.equal(hashString("amerob-birdle-salt-2025"), "104c723e");
  assert.equal(hashString("rebwoo-birdle-salt-2025"), "25309582");
  assert.equal(hashString(""), "00000000");
  assert.match(hashString("anything"), /^[0-9a-f]{8}$/u);
});

test("hashString is deterministic and zero-padded", () => {
  assert.equal(hashString("repeatable"), hashString("repeatable"));
  assert.match(hashString("a"), /^[0-9a-f]{8}$/u);
});

test("deterministicShuffle is stable for a seed", () => {
  const values = [1, 2, 3, 4, 5, 6];
  const first = deterministicShuffle(values, 42);
  const second = deterministicShuffle(values, 42);
  assert.deepEqual(first, second);
  assert.deepEqual([...first].sort(), [...values].sort());
});

test("randomShuffle keeps every element", () => {
  const values = ["a", "b", "c", "d"];
  assert.deepEqual([...randomShuffle(values)].sort(), values);
});
