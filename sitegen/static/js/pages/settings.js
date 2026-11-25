import { initPage, resolveRegion } from "../app.js";
import { clearDeadAudioUrls } from "../core/audio.js";
import { loadRegions } from "../core/data.js";
import { getTodayString } from "../core/dates.js";
import { qs, setText, show } from "../core/dom.js";
import { resetAll, resetToday } from "../core/gameState.js";
import { notify } from "../ui/toast.js";
import { refreshSiteData } from "../ui/refresh.js";

const openResetDialog = (dialog) => {
  if (dialog?.open) {
    return;
  }
  if (typeof dialog?.showModal === "function") {
    dialog.showModal();
  }
};

const init = async () => {
  initPage();

  let region = null;
  try {
    const regions = await loadRegions();
    region = resolveRegion(regions);
    if (!region) {
      return;
    }
    setText(qs("[data-region-label]"), region.name);
  } catch (error) {
    console.error(error);
    notify("Could not load your region settings.", { type: "error" });
    return;
  }

  qs("[data-change-region]")?.addEventListener("click", () => {
    window.location.href = "/regions/";
  });

  qs("[data-reset-today]")?.addEventListener("click", () => {
    resetToday(region.id, getTodayString());
    notify("Today's games were reset. Recorded stats are kept.", {
      type: "success",
    });
  });

  const dialog = qs("[data-confirm-dialog]");
  qs("[data-reset-all]")?.addEventListener("click", () => {
    openResetDialog(dialog);
  });
  dialog?.addEventListener("close", () => {
    if (dialog.returnValue === "confirm") {
      resetAll();
      notify("All game data has been reset.", { type: "success" });
    }
  });

  const refreshButton = qs("[data-refresh-data]");
  refreshButton?.addEventListener("click", async () => {
    refreshButton.disabled = true;
    clearDeadAudioUrls();
    try {
      await refreshSiteData();
    } catch (error) {
      console.error(error);
      notify("Could not refresh game data. Please reload the page.", {
        type: "error",
      });
      refreshButton.disabled = false;
    }
  });

  show(qs("[data-refresh-data]"), true);
};

init();
