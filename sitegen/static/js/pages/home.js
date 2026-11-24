import { initPage, setRegion } from "../app.js";
import { STORAGE_KEYS } from "../core/constants.js";
import { getTodayString } from "../core/dates.js";
import { gameKey, getDailyGame } from "../core/gameState.js";
import { readString } from "../core/storage.js";

const markPlayedRegions = () => {
  const today = getTodayString();
  document.querySelectorAll("[data-region-link]").forEach((link) => {
    const regionId = link.dataset.regionLink;
    const played =
      (getDailyGame(gameKey(regionId, today, "normal"))?.guesses.length || 0) > 0 ||
      (getDailyGame(gameKey(regionId, today, "hard"))?.guesses.length || 0) > 0;
    if (played) {
      const status = link.querySelector(`[data-region-status="${regionId}"]`);
      if (status) {
        status.textContent = "Played today";
      }
    }
  });
};

const showContinueCard = () => {
  const regionId = readString(STORAGE_KEYS.REGION, null);
  if (!regionId) {
    return;
  }
  const regionName =
    readString(STORAGE_KEYS.REGION_NAME, null) || regionId;
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

const bindRegionLinks = () => {
  document.querySelectorAll("[data-region-link]").forEach((link) => {
    link.addEventListener("click", () => {
      const regionId = link.dataset.regionLink;
      const name = link.querySelector(".region-option__name")?.textContent?.trim();
      setRegion({ id: regionId, name: name || regionId });
    });
  });
};

initPage();
markPlayedRegions();
showContinueCard();
bindRegionLinks();
