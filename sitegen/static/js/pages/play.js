import {
  initPage,
  getLastPlayedMode,
  resolveRegion,
  setLastPlayedMode,
} from "../app.js";
import { getTodayString } from "../core/dates.js";
import { gameKey, getDailyGame } from "../core/gameState.js";
import { loadRegions } from "../core/data.js";
import { notify } from "../ui/toast.js";

const MODE_LINKS = {
  normal: "/normal/",
  hard: "/hard/",
  practice: "/practice/",
};

const bindModeCard = (card, region, completed) => {
  const mode = card.dataset.modeCard;
  const query = `?region=${encodeURIComponent(region.id)}`;
  card.href = `${MODE_LINKS[mode]}${query}`;

  const normalCompleted = completed.normal;
  const hardCompleted = completed.hard;
  const disabled =
    (mode === "hard" && normalCompleted) || (mode === "normal" && hardCompleted);

  const status = card.querySelector(`[data-mode-status="${mode}"]`);
  if (status) {
    if (mode === "normal" && normalCompleted) {
      status.textContent = "Completed today";
    } else if (mode === "hard" && hardCompleted) {
      status.textContent = "Completed today";
    } else if (mode === "practice") {
      status.textContent = "Always open";
    } else if (disabled) {
      status.textContent = "Other mode played";
    } else if (getLastPlayedMode() === mode) {
      status.textContent = "Last played";
    }
  }

  if (disabled) {
    card.setAttribute("aria-disabled", "true");
    card.removeAttribute("href");
    card.addEventListener("click", (event) => {
      event.preventDefault();
      notify(
        mode === "hard"
          ? "Normal mode is done for today. Hard mode is closed."
          : "Hard mode is done for today. Normal mode is closed.",
        { type: "error" },
      );
    });
    return;
  }

  card.addEventListener("click", () => {
    setLastPlayedMode(mode);
  });
};

const init = async () => {
  initPage();
  const today = getTodayString();

  try {
    const regions = await loadRegions();
    const region = resolveRegion(regions);
    if (!region) {
      return;
    }

    const completed = {
      normal: getDailyGame(gameKey(region.id, today, "normal"))?.completed === true,
      hard: getDailyGame(gameKey(region.id, today, "hard"))?.completed === true,
    };

    document.querySelectorAll("[data-mode-card]").forEach((card) => {
      bindModeCard(card, region, completed);
    });

    if (completed.normal || completed.hard) {
      const note = document.querySelector("[data-mode-note]");
      if (note) {
        note.textContent =
          "You've completed today's daily challenge. Practice is still open.";
        note.hidden = false;
      }
    }
  } catch (error) {
    console.error(error);
    notify("Could not load the game modes. Check your connection.", {
      type: "error",
    });
  }
};

init();
