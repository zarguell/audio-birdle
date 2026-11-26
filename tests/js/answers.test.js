import test from "node:test";
import assert from "node:assert/strict";

import {
  generateAnswerOptions,
  generatePracticeAnswerOptions,
  getDailyBirdFallback,
} from "../../sitegen/static/js/core/answers.js";

const birds = [
  { id: "a", name: "A", family: "F1" },
  { id: "b", name: "B", family: "F1" },
  { id: "c", name: "C", family: "F1" },
  { id: "d", name: "D", family: "F1" },
  { id: "e", name: "E", family: "F2" },
  { id: "f", name: "F", family: "F2" },
];

test("daily options are deterministic, unique, and include the answer", () => {
  const correct = birds[0];
  const first = generateAnswerOptions("us", birds, "2026-11-24", correct, 4);
  const second = generateAnswerOptions("us", birds, "2026-11-24", correct, 4);
  assert.deepEqual(
    first.map((bird) => bird.id),
    second.map((bird) => bird.id),
  );
  assert.equal(first.length, 4);
  assert.equal(new Set(first.map((bird) => bird.id)).size, 4);
  assert.ok(first.some((bird) => bird.id === correct.id));
});

test("daily options prefer the correct bird's family when possible", () => {
  const correct = birds[0];
  const options = generateAnswerOptions("us", birds, "2026-11-24", correct, 4);
  assert.ok(options.filter((bird) => bird.family === "F1").length >= 3);
});

test("practice options use the practice index in their seed", () => {
  const correct = birds[0];
  const first = generatePracticeAnswerOptions("us", birds, 1, correct, 4);
  const second = generatePracticeAnswerOptions("us", birds, 2, correct, 4);
  assert.equal(first.length, 4);
  assert.equal(second.length, 4);
  assert.ok(first.some((bird) => bird.id === correct.id));
  assert.ok(second.some((bird) => bird.id === correct.id));
});

test("hash fallback is stable and selects from the pool", () => {
  const first = getDailyBirdFallback("us", birds, "2026-11-24");
  const second = getDailyBirdFallback("us", birds, "2026-11-24");
  assert.equal(first.id, second.id);
  assert.ok(birds.some((bird) => bird.id === first.id));
  assert.equal(getDailyBirdFallback("us", [], "2026-11-24"), null);
});

test("the correct option is not positionally biased across dates", () => {
  const correct = birds[0];
  const counts = [0, 0, 0, 0];
  for (let day = 1; day <= 28; day += 1) {
    for (let month = 1; month <= 12; month += 1) {
      const date = `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const options = generateAnswerOptions("us", birds, date, correct, 4);
      counts[options.findIndex((bird) => bird.id === correct.id)] += 1;
    }
  }
  assert.equal(
    counts.reduce((sum, count) => sum + count, 0),
    336,
    "every date produced an option list",
  );
  for (const count of counts) {
    assert.ok(count > 40, `position counts: ${counts.join(",")}`);
  }
});
