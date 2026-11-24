import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateMatchScore,
  compareTaxonomy,
  extractGenus,
  filterBirdsByQuery,
} from "../../sitegen/static/js/core/taxonomy.js";

const birds = [
  {
    id: "amerob",
    name: "American Robin",
    scientificName: "Turdus migratorius",
    order: "Passeriformes",
    family: "Turdidae",
  },
  {
    id: "barswa",
    name: "Barn Swallow",
    scientificName: "Hirundo rustica",
    order: "Passeriformes",
    family: "Hirundinidae",
  },
];

test("extractGenus reads the first binomial word", () => {
  assert.equal(extractGenus("Turdus migratorius"), "Turdus");
  assert.equal(extractGenus(""), null);
  assert.equal(extractGenus(null), null);
});

test("compareTaxonomy scores every taxonomic level", () => {
  assert.deepEqual(compareTaxonomy(birds[0], birds[0]), {
    order: true,
    family: true,
    genus: true,
    species: true,
  });
  assert.deepEqual(compareTaxonomy(birds[0], birds[1]), {
    order: true,
    family: false,
    genus: false,
    species: false,
  });
});

test("autocomplete scoring favours exact and prefix names", () => {
  assert.equal(calculateMatchScore(birds[0], "american robin"), 100);
  assert.ok(calculateMatchScore(birds[0], "american") >= 80);
  assert.ok(calculateMatchScore(birds[0], "turdus") >= 70);
  assert.equal(filterBirdsByQuery(birds, "a").length, 0);
  assert.deepEqual(
    filterBirdsByQuery(birds, "american").map((bird) => bird.id),
    ["amerob"],
  );
});
