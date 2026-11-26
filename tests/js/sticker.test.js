import { test } from "node:test";
import assert from "node:assert/strict";

import {
  binomial,
  scientificFamily,
  stickerUrl,
} from "../../sitegen/static/js/core/sticker.js";
import { mapActivityMediaUrl } from "../../sitegen/static/js/core/audio.js";

test("scientificFamily takes the Latin name out of eBird's display string", () => {
  // Game data stores family as "Alcedinidae (Kingfishers)"; the sticker path
  // needs just the Latin half.
  assert.equal(scientificFamily("Alcedinidae (Kingfishers)"), "Alcedinidae");
  assert.equal(
    scientificFamily("Anatidae (Ducks, Geese, and Waterfowl)"),
    "Anatidae",
  );
  // Plain names, and names with no parenthetical, pass through.
  assert.equal(scientificFamily("Turdidae"), "Turdidae");
  assert.equal(scientificFamily(""), "");
  assert.equal(scientificFamily(null), "");
});

test("binomial keeps two words so subspecies fold into their parent species", () => {
  assert.equal(binomial("Chloroceryle amazona"), "Chloroceryle_amazona");
  // eBird writes some taxa with a third word; the sticker set is keyed to two.
  assert.equal(binomial("Motacilla alba yarrellii"), "Motacilla_alba");
  assert.equal(binomial("  Turdus migratorius  "), "Turdus_migratorius");
  assert.equal(binomial(""), "");
});

test("stickerUrl addresses the set by order, family and species", () => {
  const url = stickerUrl({
    order: "Coraciiformes",
    family: "Alcedinidae (Kingfishers)",
    scientificName: "Chloroceryle amazona",
  });
  assert.equal(
    url,
    "https://cdn.jsdelivr.net/gh/alchaincyf/huashu-bird-sticker@main/stickers/Coraciiformes/Alcedinidae/Chloroceryle_amazona.webp",
  );
});

test("stickerUrl returns empty when the taxonomy cannot address a sticker", () => {
  // A broken image in the reveal is worse than no sticker, so an incomplete
  // record yields nothing and the card falls back to the photo.
  assert.equal(stickerUrl(null), "");
  assert.equal(stickerUrl({}), "");
  assert.equal(
    stickerUrl({ order: "Passeriformes", family: "", scientificName: "Turdus migratorius" }),
    "",
  );
  assert.equal(
    stickerUrl({ order: "", family: "Turdidae", scientificName: "Turdus migratorius" }),
    "",
  );
  assert.equal(
    stickerUrl({ order: "Passeriformes", family: "Turdidae", scientificName: "" }),
    "",
  );
});

test("stickerUrl escapes path segments", () => {
  const url = stickerUrl({
    order: "Passeriformes",
    family: "Turdidae",
    scientificName: "Turdus migratorius",
  });
  assert.ok(!url.split("/").some((part) => part.includes(" ")));
});

test("the sticker URL is proxied inside Discord, like audio", () => {
  // Discord Activities block external media; every remote host the app shows
  // must go through a URL mapping on the app's proxy origin.
  const url = stickerUrl({
    order: "Strigiformes",
    family: "Strigidae (Owls)",
    scientificName: "Bubo scandiacus",
  });

  // Outside Discord the CDN is used directly.
  assert.equal(mapActivityMediaUrl(url, { inActivity: false }), url);

  // Inside it, the host becomes the `/stickers` mapping and the path survives.
  const proxied = mapActivityMediaUrl(url, { inActivity: true });
  assert.ok(!proxied.includes("cdn.jsdelivr.net"), "host must be replaced");
  assert.ok(proxied.startsWith("/stickers/"), "mapping path must lead");
  assert.ok(
    proxied.endsWith("/stickers/Strigiformes/Strigidae/Bubo_scandiacus.webp"),
    "repository path must survive the rewrite",
  );
});
