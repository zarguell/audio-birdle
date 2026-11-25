import {
  getStoredRegionId,
  initPage,
  setRegion,
} from "../app.js";
import { STORAGE_KEYS } from "../core/constants.js";
import { getTodayString } from "../core/dates.js";
import { qs, qsa, setText, show } from "../core/dom.js";
import { gameKey, getDailyGame } from "../core/gameState.js";
import { readJSON, writeJSON } from "../core/storage.js";

const searchInput = () => qs("[data-region-search]");
const countElement = () => qs("[data-region-count]");
const emptyElement = () => qs("[data-region-empty]");
const recentSection = () => qs("[data-region-recent]");
const recentList = () => qs("[data-region-recent-list]");
const favoritesSection = () => qs("[data-region-favorites]");
const favoritesList = () => qs("[data-region-favorites-list]");
const suggestedSection = () => qs("[data-region-suggested]");

const rows = () => qsa("[data-region-row]");
const rowById = (id) =>
  rows().find((row) => row.dataset.regionId === id) || null;

const readFavorites = () => {
  const stored = readJSON(STORAGE_KEYS.FAVORITE_REGIONS, []);
  return new Set(
    Array.isArray(stored)
      ? stored.filter((item) => typeof item === "string")
      : [],
  );
};

const readRecent = () => {
  const stored = readJSON(STORAGE_KEYS.RECENT_REGIONS, []);
  return Array.isArray(stored)
    ? stored.filter((item) => typeof item === "string")
    : [];
};

const wasPlayedToday = (regionId) => {
  const today = getTodayString();
  return Boolean(
    (getDailyGame(gameKey(regionId, today, "normal"))?.guesses.length || 0) >
      0 ||
      (getDailyGame(gameKey(regionId, today, "hard"))?.guesses.length || 0) > 0,
  );
};

const updateRowStates = () => {
  const currentId = getStoredRegionId();
  rows().forEach((row) => {
    const regionId = row.dataset.regionId;
    const isCurrent = regionId === currentId;
    row.classList.toggle("is-current", isCurrent);
    const status = row.querySelector(`[data-region-status="${regionId}"]`);
    if (status) {
      status.textContent = isCurrent
        ? "Current"
        : wasPlayedToday(regionId)
          ? "Played today"
          : "";
    }
  });
};

const makeShortcut = (regionId) => {
  const row = rowById(regionId);
  if (!row) {
    return null;
  }
  const link = document.createElement("a");
  link.className = "region-shortcut";
  link.href = `/play/?region=${encodeURIComponent(regionId)}`;
  link.dataset.regionLink = regionId;
  link.dataset.regionName = row.dataset.regionName || regionId;
  const name = document.createElement("span");
  name.textContent = row.dataset.regionName || regionId;
  link.append(name);
  if (row.classList.contains("is-current")) {
    const badge = document.createElement("span");
    badge.className = "region-shortcut__badge";
    badge.textContent = "Current";
    link.append(badge);
  }
  return link;
};

const renderShortcuts = (section, container, ids) => {
  if (!section || !container) {
    return;
  }
  container.replaceChildren();
  ids.forEach((id) => {
    const shortcut = makeShortcut(id);
    if (shortcut) {
      container.append(shortcut);
    }
  });
  show(section, container.childElementCount > 0);
};

const updateFavoriteButtons = (favorites) => {
  qsa("[data-region-favorite]").forEach((button) => {
    const active = favorites.has(button.dataset.regionFavorite);
    button.setAttribute("aria-pressed", String(active));
    button.setAttribute(
      "aria-label",
      `${active ? "Unpin" : "Pin"} ${button.closest("[data-region-row]")?.dataset.regionName || "region"}`,
    );
  });
};

const renderFavorites = (favorites) => {
  updateFavoriteButtons(favorites);
  renderShortcuts(favoritesSection(), favoritesList(), [...favorites]);
};

const bindFavorites = (favorites) => {
  qsa("[data-region-favorite]").forEach((button) => {
    button.addEventListener("click", () => {
      const regionId = button.dataset.regionFavorite;
      if (favorites.has(regionId)) {
        favorites.delete(regionId);
      } else {
        favorites.add(regionId);
      }
      writeJSON(STORAGE_KEYS.FAVORITE_REGIONS, [...favorites]);
      renderFavorites(favorites);
      applyFilters();
    });
  });
};

const bindRegionLinks = () => {
  document.addEventListener("click", (event) => {
    const link = event.target.closest("[data-region-link]");
    if (!link) {
      return;
    }
    setRegion({
      id: link.dataset.regionLink,
      name: link.dataset.regionName || link.dataset.regionLink,
    });
  });
};

const searchText = (row) => row.dataset.regionText || "";

const applyFilters = () => {
  const query = (searchInput()?.value || "").trim().toLowerCase();
  const activeContinent =
    qs("[data-continent-filter].is-active")?.dataset.continentFilter || "all";
  let visible = 0;

  rows().forEach((row) => {
    const matchesQuery = !query || searchText(row).includes(query);
    const matchesContinent =
      activeContinent === "all" ||
      row.dataset.regionContinent === activeContinent;
    const matches = matchesQuery && matchesContinent;
    row.hidden = !matches;
    if (matches) {
      visible += 1;
    }
  });

  qsa("[data-region-group]").forEach((group) => {
    const hasVisibleRow = Boolean(
      group.querySelector("[data-region-row]:not([hidden])"),
    );
    group.hidden = !hasVisibleRow;
  });

  setText(
    countElement(),
    `${visible} region${visible === 1 ? "" : "s"} shown`,
  );
  show(emptyElement(), visible === 0);
  const showExtras = !query && activeContinent === "all";
  show(
    recentSection(),
    showExtras && Boolean(recentList()?.childElementCount),
  );
  show(
    favoritesSection(),
    showExtras && Boolean(favoritesList()?.childElementCount),
  );
  if (!showExtras) {
    show(suggestedSection(), false);
  }
};

const bindFilters = () => {
  qsa("[data-continent-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      qsa("[data-continent-filter]").forEach((item) => {
        const active = item === button;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-pressed", String(active));
      });
      applyFilters();
    });
  });
  searchInput()?.addEventListener("input", applyFilters);
};

const suggestedRegionId = () => {
  const locale = (navigator.language || "").toLowerCase();
  const localeMap = {
    "en-au": "au",
    "en-ca": "ca",
    "en-gb": "gb",
    "en-us": "us",
  };
  if (localeMap[locale]) {
    return localeMap[locale];
  }
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  if (timeZone.startsWith("Australia/")) {
    return "au";
  }
  if (timeZone === "Europe/London") {
    return "gb";
  }
  return null;
};

const showSuggestion = () => {
  const section = suggestedSection();
  if (!section || getStoredRegionId()) {
    return;
  }
  if (readJSON(STORAGE_KEYS.SUGGESTION_DISMISSED, false)) {
    return;
  }
  const regionId = suggestedRegionId();
  const row = regionId ? rowById(regionId) : null;
  if (!row) {
    return;
  }
  const link = qs("[data-region-suggested-link]", section);
  const name = qs("[data-region-suggested-name]", section);
  if (link) {
    link.href = `/play/?region=${encodeURIComponent(regionId)}`;
    link.dataset.regionLink = regionId;
    link.dataset.regionName = row.dataset.regionName || regionId;
  }
  setText(name, row.dataset.regionName || regionId);
  show(section, true);

  qs("[data-region-suggested-dismiss]", section)?.addEventListener(
    "click",
    () => {
      writeJSON(STORAGE_KEYS.SUGGESTION_DISMISSED, true);
      show(section, false);
    },
    { once: true },
  );
};

const init = () => {
  initPage();
  const favorites = readFavorites();
  updateRowStates();
  bindFavorites(favorites);
  bindRegionLinks();
  bindFilters();
  renderFavorites(favorites);
  renderShortcuts(recentSection(), recentList(), readRecent());
  applyFilters();
  showSuggestion();
};

init();
