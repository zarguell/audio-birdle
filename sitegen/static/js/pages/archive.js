import { initPage, resolveRegion } from "../app.js";
import { getAudioSrc } from "../core/audio.js";
import { loadHistory, loadRegionBirds, loadRegions } from "../core/data.js";
import { formatDateShort, getTodayString } from "../core/dates.js";
import { fromTemplate, qs, qsa, setText, show } from "../core/dom.js";
import { notify } from "../ui/toast.js";

const PAGE_SIZE = 20;

let regionBirds = [];
let entries = [];
let visibleCount = PAGE_SIZE;
let currentAudio = null;
let playingDate = null;

const listElement = () => qs("[data-archive-list]");
const moreButton = () => qs("[data-archive-more]");

const applyPlayingState = () => {
  qsa(".archive-entry").forEach((item) => {
    const isPlaying = item.dataset.archiveDate === playingDate;
    item.dataset.playing = String(isPlaying);
    const button = item.querySelector("[data-archive-play]");
    const name = item.querySelector("[data-archive-name]")?.textContent || "bird";
    if (button) {
      button.setAttribute(
        "aria-label",
        isPlaying ? `Pause ${name} recording` : `Play ${name} recording`,
      );
    }
  });
};

const stopPlayback = () => {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  playingDate = null;
  applyPlayingState();
};

const playEntry = (entry, item) => {
  if (playingDate === entry.date) {
    stopPlayback();
    return;
  }
  stopPlayback();

  const recordings = entry.bird?.audioUrl;
  if (!Array.isArray(recordings) || recordings.length === 0) {
    notify("No recording is available for this bird.", { type: "error" });
    return;
  }

  const index = Math.floor(Math.random() * recordings.length);
  const url = getAudioSrc(recordings, index);
  if (!url) {
    notify("No playable recording is available for this bird.", {
      type: "error",
    });
    return;
  }

  const audio = new Audio(url);
  currentAudio = audio;
  playingDate = entry.date;
  applyPlayingState();

  const cleanup = () => {
    if (currentAudio === audio) {
      stopPlayback();
    }
  };
  audio.addEventListener("ended", cleanup);
  audio.addEventListener("error", () => {
    cleanup();
    notify("That recording could not be played.", { type: "error" });
  });
  audio.play().catch((error) => {
    console.error("Archive playback failed:", error);
    cleanup();
    notify("That recording could not be played.", { type: "error" });
  });

  item.dataset.playing = "true";
};

const render = () => {
  const list = listElement();
  list.replaceChildren();
  const fragment = document.createDocumentFragment();

  entries.slice(0, visibleCount).forEach((entry) => {
    const item = fromTemplate("tpl-archive-entry");
    const name = entry.name || entry.bird?.name || entry.id || "Unknown bird";
    item.dataset.archiveDate = entry.date;
    item.querySelector("[data-archive-name]").textContent = name;
    item.querySelector("[data-archive-date]").textContent = formatDateShort(
      entry.date,
    );

    const subregion = item.querySelector("[data-archive-subregion]");
    if (entry.subregion) {
      subregion.hidden = false;
      subregion.querySelector("[data-archive-subregion-name]").textContent =
        entry.subregion;
    }

    const button = item.querySelector("[data-archive-play]");
    const hasAudio =
      Array.isArray(entry.bird?.audioUrl) && entry.bird.audioUrl.length > 0;
    button.disabled = !hasAudio;
    button.setAttribute(
      "aria-label",
      hasAudio ? `Play ${name} recording` : `No recording for ${name}`,
    );
    if (hasAudio) {
      button.addEventListener("click", () => playEntry(entry, item));
    }

    fragment.appendChild(item);
  });

  list.appendChild(fragment);
  applyPlayingState();

  const more = moreButton();
  if (more) {
    const remaining = entries.length - visibleCount;
    more.hidden = remaining <= 0;
    more.textContent = remaining > 0 ? `Show more (${remaining} remaining)` : "";
  }
};

const setState = ({ loading = false, error = false, empty = false }) => {
  show(qs("[data-archive-loading]"), loading);
  show(qs("[data-archive-error]"), error);
  show(qs("[data-archive-empty]"), empty);
  if (loading || error || empty) {
    listElement().replaceChildren();
  }
  if (error || empty) {
    show(moreButton(), false);
  }
};

const loadData = async ({ force = false } = {}) => {
  stopPlayback();
  setState({ loading: true });
  try {
    const regions = await loadRegions({ force });
    const region = resolveRegion(regions);
    if (!region) {
      return;
    }

    const [regionBirdsResult, history] = await Promise.all([
      loadRegionBirds(region.id, regions, { force }),
      loadHistory({ force }),
    ]);
    regionBirds = regionBirdsResult;

    const byId = new Map(regionBirds.map((bird) => [bird.id, bird]));
    const today = getTodayString();
    entries = (history[region.id] || [])
      .filter(
        (entry) =>
          entry &&
          typeof entry.date === "string" &&
          /^\d{4}-\d{2}-\d{2}$/u.test(entry.date) &&
          entry.date < today,
      )
      .sort((left, right) => (left.date < right.date ? 1 : left.date > right.date ? -1 : 0))
      .map((entry) => ({ ...entry, bird: byId.get(entry.id) || null }));

    visibleCount = PAGE_SIZE;
    setText(qs("[data-archive-count]"), `${entries.length} days`);

    if (entries.length === 0) {
      setState({ empty: true });
      return;
    }
    setState({});
    render();
  } catch (error) {
    console.error("Could not load the archive:", error);
    setState({ error: true });
  }
};

await initPage();
stopPlayback();

qs("[data-archive-more]")?.addEventListener("click", () => {
  visibleCount += PAGE_SIZE;
  render();
});

qs("[data-archive-retry]")?.addEventListener("click", () => {
  loadData({ force: true });
});

window.addEventListener("pagehide", stopPlayback);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopPlayback();
  }
});

loadData();
