import test from "node:test";
import assert from "node:assert/strict";

import {
  generateHardModeShareText,
  generateShareText,
} from "../../sitegen/static/js/core/share.js";

const game = {
  completed: true,
  won: true,
  date: "2026-11-24",
  region: "us",
  maxGuesses: 4,
  guesses: [
    { correct: false },
    { correct: true },
  ],
};

test("normal share text includes the result grid", () => {
  const text = generateShareText(game, "https://example.test/normal/");
  assert.match(text, /Audio-Birdle 2026-11-24/u);
  assert.match(text, /Region: US/u);
  assert.match(text, /2\/4/u);
  assert.match(text, /🟥🟩/u);
  assert.match(text, /https:\/\/example\.test\/normal\//u);
});

test("share text is empty for unfinished games", () => {
  assert.equal(generateShareText({ ...game, completed: false }, "url"), "");
  assert.equal(generateHardModeShareText({ ...game, completed: false }, "url"), "");
});

test("hard mode share text grades taxonomic closeness", () => {
  const text = generateHardModeShareText(
    {
      ...game,
      maxGuesses: 6,
      won: false,
      guesses: [
        { correct: false, taxonomicScore: { order: false, family: false, genus: false, species: false } },
        { correct: false, taxonomicScore: { order: true, family: true, genus: false, species: false } },
        { correct: false, taxonomicScore: { order: true, family: true, genus: true, species: false } },
        { correct: false, taxonomicScore: { order: false, family: false, genus: false, species: false } },
      ],
    },
    "url",
  );
  assert.match(text, /X\/6/u);
  assert.match(text, /🟥🟧🟨🟥/u);
});
