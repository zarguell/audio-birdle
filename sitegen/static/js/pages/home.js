import { initPage } from "../app.js";
import { STORAGE_KEYS } from "../core/constants.js";
import { readString } from "../core/storage.js";

const showContinueCard = () => {
  const regionId = readString(STORAGE_KEYS.REGION, null);
  if (!regionId) {
    return;
  }
  const regionName = readString(STORAGE_KEYS.REGION_NAME, null) || regionId;
  const card = document.querySelector("[data-continue]");
  const name = document.querySelector("[data-continue-name]");
  const link = document.querySelector("[data-continue-link]");
  if (!card || !name || !link) {
    return;
  }
  name.textContent = regionName;
  link.href = `/play/?region=${encodeURIComponent(regionId)}`;
  card.hidden = false;
};

await initPage();
showContinueCard();
