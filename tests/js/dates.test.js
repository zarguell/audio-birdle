import test from "node:test";
import assert from "node:assert/strict";

import {
  formatCountdown,
  formatDateShort,
  getTodayString,
  millisecondsUntilMidnight,
  parseLocalDate,
} from "../../sitegen/static/js/core/dates.js";

test("getTodayString uses local calendar fields", () => {
  assert.equal(getTodayString(new Date(2026, 10, 24, 23, 59)), "2026-11-24");
  assert.equal(getTodayString(new Date(2026, 0, 2, 0, 0)), "2026-01-02");
});

test("parseLocalDate rejects impossible and malformed dates", () => {
  assert.ok(parseLocalDate("2026-11-24"));
  assert.equal(parseLocalDate("2026-02-30"), null);
  assert.equal(parseLocalDate("24-11-2026"), null);
  assert.equal(parseLocalDate(""), null);
});

test("formatDateShort is stable for a local date", () => {
  assert.match(formatDateShort("2026-11-24"), /2026/u);
});

test("countdown formatting is zero-padded", () => {
  assert.equal(formatCountdown(0), "00:00:00");
  assert.equal(formatCountdown(3661_000), "01:01:01");
  assert.equal(formatCountdown(86_400_000), "24:00:00");
});

test("midnight countdown is between zero and one day", () => {
  const remaining = millisecondsUntilMidnight(new Date(2026, 10, 24, 23, 59));
  assert.ok(remaining > 0);
  assert.ok(remaining <= 60_000);
});
