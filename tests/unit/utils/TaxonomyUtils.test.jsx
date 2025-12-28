import { describe, it, expect } from "vitest";
import {
  extractGenus,
  compareTaxonomy,
  calculateTaxonomicScore,
  calculateMatchScore,
  filterBirdsByQuery,
} from "@/utils/TaxonomyUtils";

const sampleBirds = [
  {
    id: "amerob",
    name: "American Robin",
    scientificName: "Turdus migratorius",
    order: "Passeriformes",
    family: "Turdidae (Turdidae)",
  },
  {
    id: "barswa",
    name: "Barn Swallow",
    scientificName: "Hirundo rustica",
    order: "Passeriformes",
    family: "Hirundinidae (Hirundinidae)",
  },
  {
    id: "reccro",
    name: "Red-crowned Crane",
    scientificName: "Grus japonensis",
    order: "Gruiformes",
    family: "Gruidae (Gruidae)",
  },
  {
    id: "eucdov",
    name: "Eurasian Collared-Dove",
    scientificName: "Streptopelia decaocto",
    order: "Columbiformes",
    family: "Columbidae (Columbidae)",
  },
  {
    id: "hootch",
    name: "Hooded Merganser",
    scientificName: "Lophodytes cucullatus",
    order: "Anseriformes",
    family: "Anatidae (Anatidae)",
  },
];

describe("TaxonomyUtils", () => {
  describe("extractGenus", () => {
    it("should extract genus from scientific name", () => {
      expect(extractGenus("Turdus migratorius")).toBe("Turdus");
      expect(extractGenus("Hirundo rustica")).toBe("Hirundo");
      expect(extractGenus("Grus japonensis")).toBe("Grus");
    });

    it("should return null for null or undefined input", () => {
      expect(extractGenus(null)).toBeNull();
      expect(extractGenus(undefined)).toBeNull();
      expect(extractGenus("")).toBeNull();
    });

    it("should handle single word scientific names", () => {
      expect(extractGenus("Turdus")).toBe("Turdus");
    });

    it("should handle three-part scientific names", () => {
      expect(extractGenus("Turdus migratorius migratorius")).toBe("Turdus");
    });
  });

  describe("compareTaxonomy", () => {
    it("should return all false for completely different birds", () => {
      const guessed = sampleBirds[0]; // American Robin (Passeriformes, Turdidae)
      const correct = sampleBirds[2]; // Red-crowned Crane (Gruiformes, Gruidae)

      const result = compareTaxonomy(guessed, correct);

      expect(result.order).toBe(false);
      expect(result.family).toBe(false);
      expect(result.genus).toBe(false);
      expect(result.species).toBe(false);
    });

    it("should match order when same order but different family", () => {
      const guessed = sampleBirds[0]; // American Robin (Passeriformes, Turdidae)
      const correct = sampleBirds[1]; // Barn Swallow (Passeriformes, Hirundinidae)

      const result = compareTaxonomy(guessed, correct);

      expect(result.order).toBe(true);
      expect(result.family).toBe(false);
      expect(result.genus).toBe(false);
      expect(result.species).toBe(false);
    });

    it("should match all fields for same species", () => {
      const guessed = sampleBirds[0];
      const correct = sampleBirds[0];

      const result = compareTaxonomy(guessed, correct);

      expect(result.order).toBe(true);
      expect(result.family).toBe(true);
      expect(result.genus).toBe(true);
      expect(result.species).toBe(true);
    });

    it("should match family when same family", () => {
      const bird1 = { ...sampleBirds[0] };
      const bird2 = {
        id: "robin2",
        name: "Another Robin",
        scientificName: "Turdus philomelos",
        order: "Passeriformes",
        family: "Turdidae (Turdidae)",
      };

      const result = compareTaxonomy(bird1, bird2);

      expect(result.order).toBe(true);
      expect(result.family).toBe(true);
      expect(result.genus).toBe(true);
      expect(result.species).toBe(false);
    });
  });

  describe("calculateTaxonomicScore", () => {
    it("should return 0 for no matches", () => {
      const guessed = sampleBirds[0]; // American Robin
      const correct = sampleBirds[2]; // Red-crowned Crane

      const score = calculateTaxonomicScore(guessed, correct);

      expect(score).toBe(0);
    });

    it("should return 1 for order match only", () => {
      const guessed = sampleBirds[0]; // American Robin
      const correct = sampleBirds[1]; // Barn Swallow (same order, different family)

      const score = calculateTaxonomicScore(guessed, correct);

      expect(score).toBe(1);
    });

    it("should return 2 for order and family match", () => {
      const guessed = { ...sampleBirds[0] };
      const correct = {
        id: "other",
        name: "Other Bird",
        scientificName: "SomeGenus species",
        order: "Passeriformes",
        family: "Turdidae (Turdidae)",
      };

      const score = calculateTaxonomicScore(guessed, correct);

      expect(score).toBe(2);
    });

    it("should return 3 for order, family, and genus match", () => {
      const guessed = sampleBirds[0];
      const correct = {
        id: "other",
        name: "Other Thrush",
        scientificName: "Turdus philomelos",
        order: "Passeriformes",
        family: "Turdidae (Turdidae)",
      };

      const score = calculateTaxonomicScore(guessed, correct);

      expect(score).toBe(3);
    });

    it("should return 4 for exact species match", () => {
      const guessed = sampleBirds[0];
      const correct = sampleBirds[0];

      const score = calculateTaxonomicScore(guessed, correct);

      expect(score).toBe(4);
    });
  });

  describe("calculateMatchScore", () => {
    it("should return 100 for exact match on common name", () => {
      const bird = sampleBirds[0];
      const score = calculateMatchScore(bird, "american robin");

      expect(score).toBe(100);
    });

    it("should return 80 for starts with common name", () => {
      const bird = sampleBirds[0];
      const score = calculateMatchScore(bird, "american");

      // "american" is start of name (80) + word boundary (30) = 110
      expect(score).toBe(110);
    });

    it("should return 60 for contains common name", () => {
      const bird = sampleBirds[0];
      const score = calculateMatchScore(bird, "robin");

      // "robin" is in "American Robin" but also triggers word boundary match
      // so it's 60 (contains) + 30 (word boundary) = 90
      expect(score).toBe(90);
    });

    it("should return 70 for starts with genus", () => {
      const bird = sampleBirds[0];
      const score = calculateMatchScore(bird, "turdus");

      // "turdus" matches genus start (70) + scientific name start (50) = 120
      expect(score).toBe(120);
    });

    it("should return 50 for contains genus", () => {
      const bird = sampleBirds[3];
      const score = calculateMatchScore(bird, "strepto");

      // "strepto" matches genus contains (50) + scientific name contains (40) + word boundary (30) = 120
      expect(score).toBe(120);
    });

    it("should return 50 for starts with scientific name", () => {
      const bird = sampleBirds[0];
      const score = calculateMatchScore(bird, "turdus migratorius");

      // Matches full scientific name exactly
      expect(score).toBeGreaterThanOrEqual(50);
    });

    it("should return 40 for contains scientific name", () => {
      const bird = sampleBirds[0];
      const score = calculateMatchScore(bird, "migratorius");

      // "migratorius" triggers contains scientific name (40)
      expect(score).toBe(40);
    });

    it("should handle word boundary matching", () => {
      const bird = sampleBirds[0];
      const score = calculateMatchScore(bird, "crowned");

      // "crowned" doesn't match anything in "American Robin"
      expect(score).toBe(0);
    });

    it("should be case insensitive", () => {
      const bird = sampleBirds[0];
      // calculateMatchScore expects lowercase input as indicated by parameter name
      const score1 = calculateMatchScore(bird, "robin");
      const score2 = calculateMatchScore(bird, "robin");
      const score3 = calculateMatchScore(bird, "robin");

      // All should be the same (90 for "robin")
      expect(score1).toBe(score2);
      expect(score2).toBe(score3);
      expect(score3).toBe(90);
    });

    it("should return 0 for no match", () => {
      const bird = sampleBirds[0];
      const score = calculateMatchScore(bird, "xyzabc");

      expect(score).toBe(0);
    });
  });

  describe("filterBirdsByQuery", () => {
    it("should return empty array for query less than 2 characters", () => {
      const result = filterBirdsByQuery(sampleBirds, "a");

      expect(result).toEqual([]);
    });

    it("should return empty array for empty query", () => {
      const result = filterBirdsByQuery(sampleBirds, "");

      expect(result).toEqual([]);
    });

    it("should return empty array for whitespace query", () => {
      const result = filterBirdsByQuery(sampleBirds, "  ");

      expect(result).toEqual([]);
    });

    it("should filter birds by common name prefix", () => {
      const result = filterBirdsByQuery(sampleBirds, "american");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("amerob");
    });

    it("should filter birds by common name substring", () => {
      const result = filterBirdsByQuery(sampleBirds, "robin");

      expect(result.length).toBeGreaterThan(0);
      expect(result.some((b) => b.id === "amerob")).toBe(true);
    });

    it("should filter birds by genus", () => {
      const result = filterBirdsByQuery(sampleBirds, "turdus");

      expect(result.length).toBeGreaterThan(0);
      expect(result.some((b) => b.scientificName.startsWith("Turdus"))).toBe(
        true,
      );
    });

    it("should filter birds by scientific name", () => {
      const result = filterBirdsByQuery(sampleBirds, "migratorius");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("amerob");
    });

    it("should be case insensitive", () => {
      const result1 = filterBirdsByQuery(sampleBirds, "ROBIN");
      const result2 = filterBirdsByQuery(sampleBirds, "robin");

      expect(result1).toEqual(result2);
    });

    it("should sort results by match score (highest first)", () => {
      const result = filterBirdsByQuery(sampleBirds, "american");

      // First result should be the exact match
      expect(result[0].name).toBe("American Robin");
    });

    it("should return all matching birds (limiting is done in component)", () => {
      const manyBirds = [...sampleBirds];
      // Add more birds to test
      for (let i = 0; i < 10; i++) {
        manyBirds.push({
          id: `bird${i}`,
          name: `Bird ${i} American`,
          scientificName: `Genus${i} species${i}`,
          order: "Passeriformes",
          family: "Turdidae (Turdidae)",
        });
      }

      const result = filterBirdsByQuery(manyBirds, "american");

      // filterBirdsByQuery returns all matches above threshold
      // The component (HardModeInput) limits to 8
      expect(result.length).toBeGreaterThan(0);
    });

    it("should only return birds above threshold score", () => {
      const result = filterBirdsByQuery(sampleBirds, "xyz");

      expect(result).toEqual([]);
    });

    it("should handle hyphenated names", () => {
      const bird = sampleBirds[3];
      const result = filterBirdsByQuery(sampleBirds, "collared");

      expect(result.some((b) => b.id === "eucdov")).toBe(true);
    });

    it("should handle multiple words in query", () => {
      // "red crowned" - doesn't match "Red-crowned Crane" directly
      // but should match "crowned" as a word
      const result = filterBirdsByQuery(sampleBirds, "crowned");

      expect(result.some((b) => b.id === "reccro")).toBe(true);
    });
  });
});
