/**
 * Sticker lookup for the reveal card.
 *
 * The sticker set is huashu-bird-sticker (CC BY 4.0), the same art the
 * critically-listed eBird tool uses. It is addressed by taxonomy, not by eBird
 * species code:
 *
 *   stickers/<Order>/<FamilySciName>/<Genus_species>.webp
 *
 * Every part comes from data the game already loads except the scientific
 * family name. `family` arrives as eBird's display string, "Alcedinidae
 * (Kingfishers)", so the parenthesised colloquial name is stripped rather than
 * looked up in a table of 250 families.
 */

const STICKER_CDN = "https://cdn.jsdelivr.net/gh/alchaincyf/huashu-bird-sticker@main";

/** `Alcedinidae (Kingfishers)` -> `Alcedinidae`. */
export function scientificFamily(family) {
  if (typeof family !== "string") {
    return "";
  }
  // Some sources keep the Latin name after the colloquial one; take the first
  // word either way, and drop the trailing parenthetical.
  const withoutParens = family.split("(")[0].trim();
  return withoutParens.split(/\s+/)[0] || "";
}

/** `Chloroceryle amazona` -> `Chloroceryle_amazona`; the set is keyed to the binomial. */
export function binomial(scientificName) {
  if (typeof scientificName !== "string") {
    return "";
  }
  return scientificName.trim().split(/\s+/).slice(0, 2).join("_");
}

/**
 * Sticker URL for a bird, or "" when the taxonomy cannot address one.
 *
 * Returns "" rather than a guess: the CDN answers 404 for species outside the
 * set (extinct and very rare birds), and a broken image in the reveal is worse
 * than no sticker at all.
 */
export function stickerUrl(bird) {
  if (!bird) {
    return "";
  }
  const order = typeof bird.order === "string" ? bird.order.trim() : "";
  const family = scientificFamily(bird.family);
  const name = binomial(bird.scientificName);
  if (!order || !family || !name) {
    return "";
  }
  return `${STICKER_CDN}/stickers/${encodeURIComponent(order)}/${encodeURIComponent(family)}/${encodeURIComponent(name)}.webp`;
}
