import { compareTaxonomy, extractGenus } from "../core/taxonomy.js";
import { fromTemplate } from "../core/dom.js";

const findBird = (birds, birdId) =>
  birdId ? birds.find((bird) => bird.id === birdId) || null : null;

const addBadge = (container, label, correct, value) => {
  const badge = fromTemplate("tpl-taxonomic-badge");
  badge.dataset.correct = String(Boolean(correct));
  const mark = correct ? "✓" : "✗";
  badge.querySelector("[data-label]").textContent = value
    ? `${label}: ${value} ${mark}`
    : `${label} ${mark}`;
  container.appendChild(badge);
};

export function renderGuessList(
  listElement,
  {
    guesses = [],
    isHard = false,
    regionBirds = [],
    answerOptions = [],
    correctBird = null,
  } = {},
) {
  listElement.replaceChildren();
  const fragment = document.createDocumentFragment();

  guesses.forEach((guess) => {
    const guessedBird =
      findBird(answerOptions, guess.birdId) || findBird(regionBirds, guess.birdId);

    if (isHard) {
      const item = fromTemplate("tpl-hard-guess");
      item.dataset.correct = String(Boolean(guess.correct));
      const name = guess.textInput || guessedBird?.name || guess.birdId || "Unknown bird";
      item.querySelector("[data-name]").textContent = name;
      item.querySelector("[data-scientific]").textContent =
        guessedBird?.scientificName || "";
      item.querySelector("[data-status]").textContent = guess.correct ? "✅" : "❌";

      const score =
        guess.taxonomicScore ||
        (guessedBird && correctBird
          ? compareTaxonomy(guessedBird, correctBird)
          : null);
      if (score) {
        const badges = item.querySelector("[data-badges]");
        addBadge(badges, "Order", score.order, guessedBird?.order);
        addBadge(badges, "Family", score.family, guessedBird?.family);
        addBadge(
          badges,
          "Genus",
          score.genus,
          guessedBird ? extractGenus(guessedBird.scientificName) : null,
        );
        addBadge(badges, "Species", score.species);
      } else {
        item.querySelector("[data-badges]").remove();
      }

      fragment.appendChild(item);
      return;
    }

    const item = fromTemplate("tpl-normal-guess");
    item.dataset.correct = String(Boolean(guess.correct));
    item.querySelector("[data-name]").textContent =
      guessedBird?.name || guess.birdId || "Unknown bird";
    item.querySelector("[data-status]").textContent = guess.correct ? "✅" : "❌";
    fragment.appendChild(item);
  });

  listElement.appendChild(fragment);
}
