import { initPage, resolveRegion } from "../app.js";
import {
  getAnalyticsToken,
  initAnalytics,
  readConsent,
  readPrivacySignals,
  removeAnalytics,
  shouldTrack,
  writeConsent,
} from "../core/analytics.js";
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

const initAnalyticsSettings = () => {
  const toggle = qs("[data-analytics-consent]");
  if (!toggle) {
    return;
  }

  const note = qs("[data-analytics-consent-note]");
  toggle.checked = Boolean(readConsent());

  if (!shouldTrack(readPrivacySignals(window))) {
    toggle.checked = false;
    toggle.disabled = true;
    setText(
      note,
      "Your browser's Do Not Track or Global Privacy Control setting keeps analytics off. Nothing is loaded.",
    );
    return;
  }

  toggle.addEventListener("change", () => {
    if (toggle.checked) {
      writeConsent(true);
      const loaded = initAnalytics({
        documentImpl: document,
        windowImpl: window,
        token: getAnalyticsToken(document),
      });
      if (loaded) {
        setText(
          note,
          "Anonymous usage analytics is on for this browser. You can turn it off at any time.",
        );
        notify("Anonymous usage analytics enabled.", { type: "success" });
      } else {
        setText(
          note,
          "Your choice is saved, but the analytics beacon could not be loaded on this page, so nothing is sent.",
        );
        notify("Analytics is not active on this page.", {
          type: "info",
        });
      }
      return;
    }
    writeConsent(false);
    removeAnalytics();
    setText(note, "Anonymous usage analytics is off. Nothing is sent.");
    notify("Anonymous usage analytics disabled.", { type: "success" });
  });
};

const init = async () => {
  initPage();
  initAnalyticsSettings();

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
