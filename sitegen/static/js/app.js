import { STORAGE_KEYS } from "./core/constants.js";
import { qsa } from "./core/dom.js";
import { ensureSceneBird } from "./ui/sceneBird.js";
import {
  readJSON,
  readString,
  removeKey,
  writeJSON,
  writeString,
} from "./core/storage.js";

let jellyInitialized = false;

const initJellyButtons = () => {
  if (jellyInitialized) {
    return;
  }
  jellyInitialized = true;
  document.addEventListener("pointerdown", (event) => {
    const button = event.target.closest(".button--jelly");
    if (!button || button.disabled) {
      return;
    }
    button.classList.remove("is-squish");
    button.getBoundingClientRect();
    button.classList.add("is-squish");
    button.addEventListener(
      "animationend",
      () => button.classList.remove("is-squish"),
      { once: true },
    );
  });
};

export const getRegionIdFromUrl = () =>
  new URLSearchParams(window.location.search).get("region");

export const getStoredRegionId = () => readString(STORAGE_KEYS.REGION, null);

export const setRegionLabel = (text) => {
  qsa("[data-region-label]").forEach((element) => {
    element.textContent = text;
  });
};

export const recordRecentRegion = ({ id }) => {
  if (!id) {
    return;
  }
  const recent = readJSON(STORAGE_KEYS.RECENT_REGIONS, []);
  const ids = Array.isArray(recent) ? recent.filter((item) => typeof item === "string") : [];
  writeJSON(
    STORAGE_KEYS.RECENT_REGIONS,
    [id, ...ids.filter((item) => item !== id)].slice(0, 4),
  );
};

export const updateRegionChrome = ({ id, name }) => {
  const chip = document.querySelector("[data-region-chip]");
  if (!chip) {
    return;
  }
  if (!id) {
    chip.hidden = true;
    return;
  }
  chip.hidden = false;
  chip.href = "/regions/";
  const nameElement = chip.querySelector("[data-region-name]");
  if (nameElement) {
    nameElement.textContent = name || id;
  }
};

export const setRegion = (region) => {
  if (!region?.id) {
    return;
  }
  writeString(STORAGE_KEYS.REGION, region.id);
  writeString(STORAGE_KEYS.REGION_NAME, region.name || region.id);
  recordRecentRegion(region);
  updateRegionChrome(region);
};

export const clearRegion = () => {
  removeKey(STORAGE_KEYS.REGION);
  removeKey(STORAGE_KEYS.REGION_NAME);
  updateRegionChrome({ id: null });
};

export const redirectHome = () => {
  window.location.replace("/regions/");
};

export const resolveRegion = (regions, { redirect = true } = {}) => {
  const fromUrl = getRegionIdFromUrl();
  const stored = getStoredRegionId();
  const region =
    regions.find((entry) => entry.id === fromUrl) ||
    regions.find((entry) => entry.id === stored) ||
    null;

  if (!region) {
    if (redirect) {
      redirectHome();
    }
    return null;
  }

  setRegion(region);
  setRegionLabel(region.name);
  return region;
};

export const setLastPlayedMode = (mode) => {
  writeString(STORAGE_KEYS.LAST_PLAYED_MODE, mode);
};

export const getLastPlayedMode = () =>
  readString(STORAGE_KEYS.LAST_PLAYED_MODE, null);

export function initPage() {
  initJellyButtons();
  ensureSceneBird();

  const storedId = getStoredRegionId();
  const storedName = readString(STORAGE_KEYS.REGION_NAME, null);
  if (storedId) {
    updateRegionChrome({ id: storedId, name: storedName || storedId });
  }

  const main = document.getElementById("main");
  if (main && !main.hasAttribute("tabindex")) {
    main.setAttribute("tabindex", "-1");
  }

  return {
    regionId: storedId,
    regionName: storedName || storedId,
  };
}
