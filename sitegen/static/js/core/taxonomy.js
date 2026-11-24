import { GAME_CONFIG } from "./constants.js";

export const extractGenus = (scientificName) => {
  if (typeof scientificName !== "string") {
    return null;
  }
  return scientificName.split(" ")[0] || null;
};

export const compareTaxonomy = (guessedBird, correctBird) => {
  const guessedGenus = extractGenus(guessedBird?.scientificName);
  const correctGenus = extractGenus(correctBird?.scientificName);
  return {
    order: guessedBird?.order === correctBird?.order,
    family: guessedBird?.family === correctBird?.family,
    genus: guessedGenus === correctGenus,
    species: guessedBird?.id === correctBird?.id,
  };
};

export const calculateMatchScore = (bird, queryLower) => {
  let score = 0;
  const nameLower = bird.name.toLowerCase();
  const scientificLower = bird.scientificName.toLowerCase();
  const genusLower = (extractGenus(bird.scientificName) || "").toLowerCase();

  if (nameLower === queryLower) {
    return 100;
  }
  if (nameLower.startsWith(queryLower)) {
    score += 80;
  } else if (nameLower.includes(queryLower)) {
    score += 60;
  }

  if (genusLower.startsWith(queryLower)) {
    score += 70;
  } else if (genusLower.includes(queryLower)) {
    score += 50;
  }

  if (scientificLower.startsWith(queryLower)) {
    score += 50;
  } else if (scientificLower.includes(queryLower)) {
    score += 40;
  }

  const words = nameLower.split(/[\s-]+/u);
  if (words.some((word) => word.startsWith(queryLower))) {
    score += 30;
  }
  return score;
};

export const filterBirdsByQuery = (birds, query) => {
  const queryLower = query.toLowerCase().trim();
  if (queryLower.length < 2) {
    return [];
  }
  return birds
    .map((bird) => ({ bird, score: calculateMatchScore(bird, queryLower) }))
    .filter(
      (entry) =>
        entry.score > 0 && entry.score >= GAME_CONFIG.FUZZY_MATCH_THRESHOLD,
    )
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.bird);
};
