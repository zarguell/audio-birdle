import { initPage } from "../app.js";
import { loadRegions } from "../core/data.js";
import { getStats } from "../core/gameState.js";
import { fromTemplate, show } from "../core/dom.js";
import { notify } from "../ui/toast.js";

const renderStatCard = (container, { label, value, tone }) => {
  const card = fromTemplate("tpl-stat-card");
  card.dataset.tone = tone;
  card.querySelector("[data-stat-value]").textContent = value;
  card.querySelector("[data-stat-label]").textContent = label;
  container.appendChild(card);
};

const renderRegionStat = (container, regionStat) => {
  const row = fromTemplate("tpl-region-stat");
  row.querySelector("[data-region-name]").textContent = regionStat.name;
  row.querySelector("[data-region-games]").textContent =
    `${regionStat.games} ${regionStat.games === 1 ? "game" : "games"}`;
  row.querySelector("[data-region-winrate]").textContent = `${regionStat.winRate}%`;
  row.querySelector("[data-region-average]").textContent = regionStat.average;
  container.appendChild(row);
};

const init = async () => {
  await initPage();
  const stats = getStats();
  const totalGames = stats.totalGamesPlayed || 0;
  const totalWins = stats.totalGamesWon || 0;
  const winRate = totalGames > 0 ? ((totalWins / totalGames) * 100).toFixed(1) : "0.0";

  const regionEntries = Object.entries(stats.regionStats || {});
  const totalGuesses = regionEntries.reduce(
    (sum, [, value]) => sum + (value?.totalGuesses || 0),
    0,
  );
  const regionGames = regionEntries.reduce(
    (sum, [, value]) => sum + (value?.gamesPlayed || 0),
    0,
  );
  const average = regionGames > 0 ? (totalGuesses / regionGames).toFixed(1) : "0.0";

  const summary = document.querySelector("[data-stats-summary]");
  renderStatCard(summary, {
    label: "Games played",
    value: String(totalGames),
    tone: "blue",
  });
  renderStatCard(summary, {
    label: "Win rate",
    value: `${winRate}%`,
    tone: "green",
  });
  renderStatCard(summary, {
    label: "Avg guesses",
    value: average,
    tone: "purple",
  });
  renderStatCard(summary, {
    label: "Best streak",
    value: String(stats.maxStreak || 0),
    tone: "orange",
  });

  let regions = [];
  try {
    regions = await loadRegions();
  } catch (error) {
    console.error(error);
    notify("Region names could not be loaded.", { type: "error" });
  }

  if (regionEntries.length > 0) {
    const breakdown = document.querySelector("[data-region-breakdown]");
    const list = document.querySelector("[data-region-stats]");
    regionEntries
      .map(([regionId, value]) => ({
        name: regions.find((region) => region.id === regionId)?.name || regionId,
        games: value?.gamesPlayed || 0,
        winRate:
          (value?.gamesPlayed || 0) > 0
            ? (((value?.gamesWon || 0) / value.gamesPlayed) * 100).toFixed(1)
            : "0.0",
        average: (value?.averageGuesses || 0).toFixed(1),
      }))
      .sort((left, right) => right.games - left.games)
      .forEach((regionStat) => renderRegionStat(list, regionStat));
    show(breakdown, true);
  }

  show(document.querySelector("[data-stats-empty]"), totalGames === 0);
};

init();
