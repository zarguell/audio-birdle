import { GAME_CONFIG } from "./constants.js";
import { deterministicShuffle, hashString, randomShuffle } from "./hash.js";

const uniqueById = (birds) => {
  const seen = new Set();
  return birds.filter((bird) => {
    if (seen.has(bird.id)) {
      return false;
    }
    seen.add(bird.id);
    return true;
  });
};

const chooseWrongBirds = (
  availableBirds,
  correctBird,
  optionCount,
  sameFamilySeed,
  remainingSeed,
) => {
  const sameFamilyBirds = availableBirds.filter(
    (bird) => bird.family === correctBird.family,
  );
  const shuffledSameFamily = deterministicShuffle(
    sameFamilyBirds,
    sameFamilySeed,
  );
  if (sameFamilyBirds.length >= optionCount - 1) {
    return shuffledSameFamily.slice(0, optionCount - 1);
  }

  const remainingBirds = availableBirds.filter(
    (bird) => bird.family !== correctBird.family,
  );
  const shuffledRemaining = deterministicShuffle(remainingBirds, remainingSeed);
  const stillNeeded = optionCount - 1 - shuffledSameFamily.length;
  return [
    ...shuffledSameFamily,
    ...shuffledRemaining.slice(0, Math.max(0, stillNeeded)),
  ];
};

export function generateAnswerOptions(
  region,
  regionBirds,
  date,
  correctBird,
  optionCount = GAME_CONFIG.ANSWER_OPTIONS_COUNT,
) {
  if (!Array.isArray(regionBirds) || !correctBird) {
    return [];
  }

  const availableBirds = uniqueById(
    regionBirds.filter((bird) => bird.id !== correctBird.id),
  );
  const optionSeed = hashString(
    `${region}-${date}-${correctBird.id}-options`,
  );
  const selectedWrongBirds = chooseWrongBirds(
    availableBirds,
    correctBird,
    optionCount,
    optionSeed,
    optionSeed,
  );
  const finalSeed = hashString(
    `${region}-${date}-${correctBird.id}-final`,
  );
  return deterministicShuffle(
    [correctBird, ...selectedWrongBirds],
    finalSeed,
  );
}

export function generatePracticeAnswerOptions(
  region,
  regionBirds,
  practiceIndex,
  correctBird,
  optionCount = GAME_CONFIG.ANSWER_OPTIONS_COUNT,
) {
  if (!Array.isArray(regionBirds) || !correctBird) {
    return [];
  }

  const availableBirds = uniqueById(
    regionBirds.filter((bird) => bird.id !== correctBird.id),
  );
  const sameFamilySeed = hashString(
    `practice-options-${region}-${practiceIndex}-${correctBird.id}-same-family`,
  );
  const remainingSeed = hashString(
    `practice-options-${region}-${practiceIndex}-${correctBird.id}-remaining`,
  );
  const selectedWrongBirds = chooseWrongBirds(
    availableBirds,
    correctBird,
    optionCount,
    sameFamilySeed,
    remainingSeed,
  );
  const finalSeed = hashString(
    `practice-final-${region}-${practiceIndex}-${correctBird.id}`,
  );
  return deterministicShuffle(
    [correctBird, ...selectedWrongBirds],
    finalSeed,
  );
}

export function getDailyBirdFallback(region, regionBirds, date) {
  if (!Array.isArray(regionBirds) || regionBirds.length === 0) {
    return null;
  }
  const hash = hashString(`${region}-${date}`);
  const index = Math.abs(parseInt(hash, 16)) % regionBirds.length;
  return regionBirds[index];
}

export function shuffledBirdDeck(regionBirds) {
  return randomShuffle(regionBirds);
}
