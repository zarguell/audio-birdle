/**
 * TaxonomyUtils - Utility functions for taxonomic comparison and scoring
 * Used for hard mode to determine how close a guess is to the correct answer
 */

/**
 * Extract genus from scientific name
 * @param {string} scientificName - Scientific name in binomial format (e.g., "Turdus migratorius")
 * @returns {string|null} - Genus name (e.g., "Turdus") or null if invalid
 */
export const extractGenus = (scientificName) => {
  if (!scientificName) return null;
  const parts = scientificName.split(' ');
  return parts[0] || null;
};

/**
 * Compare two birds taxonomically and return scoring breakdown
 * @param {Object} guessedBird - Bird data for guessed species
 * @param {Object} correctBird - Bird data for correct species
 * @returns {Object} - Taxonomic comparison result with boolean fields
 */
export const compareTaxonomy = (guessedBird, correctBird) => {
  const guessedGenus = extractGenus(guessedBird.scientificName);
  const correctGenus = extractGenus(correctBird.scientificName);

  return {
    order: guessedBird.order === correctBird.order,
    family: guessedBird.family === correctBird.family,
    genus: guessedGenus === correctGenus,
    species: guessedBird.id === correctBird.id
  };
};

/**
 * Calculate taxonomic similarity score (0-4)
 * @param {Object} guessedBird - Bird data for guessed species
 * @param {Object} correctBird - Bird data for correct species
 * @returns {number} - Score from 0 (no taxonomic match) to 4 (exact species match)
 */
export const calculateTaxonomicScore = (guessedBird, correctBird) => {
  const comparison = compareTaxonomy(guessedBird, correctBird);
  let score = 0;

  if (comparison.order) score++;
  if (comparison.family) score++;
  if (comparison.genus) score++;
  if (comparison.species) score++;

  return score;
};

/**
 * Calculate match score for autocomplete search (higher = better match)
 * @param {Object} bird - Bird object to score
 * @param {string} queryLower - Lowercase search query
 * @returns {number} - Match score (0-100)
 */
export const calculateMatchScore = (bird, queryLower) => {
  let score = 0;
  const nameLower = bird.name.toLowerCase();
  const scientificLower = bird.scientificName.toLowerCase();
  const genusLower = extractGenus(bird.scientificName)?.toLowerCase() || '';

  // Exact match on common name (highest priority)
  if (nameLower === queryLower) return 100;

  // Starts with common name
  if (nameLower.startsWith(queryLower)) score += 80;

  // Contains common name
  else if (nameLower.includes(queryLower)) score += 60;

  // Starts with genus (scientific name genus)
  if (genusLower.startsWith(queryLower)) score += 70;

  // Contains genus
  else if (genusLower.includes(queryLower)) score += 50;

  // Starts with scientific name
  if (scientificLower.startsWith(queryLower)) score += 50;

  // Contains scientific name
  else if (scientificLower.includes(queryLower)) score += 40;

  // Word boundary matching in common name
  const words = nameLower.split(/[\s-]+/);
  if (words.some(word => word.startsWith(queryLower))) score += 30;

  return score;
};

/**
 * Filter birds with fuzzy matching based on query
 * @param {Array} birds - Array of bird objects
 * @param {string} query - Search query
 * @returns {Array} - Filtered and sorted birds
 */
export const filterBirdsByQuery = (birds, query) => {
  const queryLower = query.toLowerCase().trim();

  if (queryLower.length < 2) return [];

  const THRESHOLD = 30;

  return birds
    .map(bird => ({
      bird,
      score: calculateMatchScore(bird, queryLower)
    }))
    .filter(item => item.score > 0 && item.score >= THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .map(item => item.bird);
};
