import test from "node:test";
import assert from "node:assert/strict";

import {
  createPracticeSession,
  processHardPracticeGuess,
  processPracticeGuess,
  retryPracticeRound,
  startNextPracticeRound,
  togglePracticeMode,
} from "../../sitegen/static/js/core/practice.js";

const birds = [
  { id: "a", name: "A", scientificName: "Alpha one", order: "O1", family: "F1" },
  { id: "b", name: "B", scientificName: "Beta two", order: "O1", family: "F1" },
  { id: "c", name: "C", scientificName: "Gamma three", order: "O2", family: "F2" },
  { id: "d", name: "D", scientificName: "Delta four", order: "O2", family: "F2" },
];

test("practice sessions provide options and complete after a correct guess", () => {
  const session = createPracticeSession("us", birds);
  assert.ok(session.currentBird);
  assert.equal(session.answerOptions.length, 4);
  const completed = processPracticeGuess(session, session.currentBird.id);
  assert.equal(completed.completed, true);
  assert.equal(completed.won, true);
});

test("practice hard guesses carry taxonomic scores", () => {
  const session = createPracticeSession("us", birds, { isHardMode: true });
  const guessed = birds.find((bird) => bird.id !== session.currentBird.id);
  const next = processHardPracticeGuess(session, guessed);
  assert.equal(next.guesses.length, 1);
  assert.ok(next.guesses[0].taxonomicScore);
});

test("practice rounds advance without repeating the current bird", () => {
  const session = createPracticeSession("us", birds);
  const next = startNextPracticeRound(session, birds);
  assert.equal(next.practiceIndex, 1);
  assert.notEqual(next.currentBird.id, session.currentBird.id);
  assert.equal(next.guesses.length, 0);
});

test("retry keeps the bird and clears guesses", () => {
  const session = createPracticeSession("us", birds);
  const guessed = processPracticeGuess(session, session.currentBird.id);
  const retried = retryPracticeRound(guessed, birds);
  assert.equal(retried.currentBird.id, session.currentBird.id);
  assert.equal(retried.guesses.length, 0);
  assert.equal(retried.completed, false);
});

test("toggling mode changes allowances without changing the bird", () => {
  const session = createPracticeSession("us", birds);
  const hard = togglePracticeMode(session, birds);
  assert.equal(hard.isHardMode, true);
  assert.equal(hard.maxGuesses, 6);
  assert.equal(hard.currentBird.id, session.currentBird.id);
  assert.equal(hard.answerOptions.length, 0);
});
