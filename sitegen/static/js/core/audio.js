import { isActivity } from "./activity.js";
import { STORAGE_KEYS } from "./constants.js";
import { isHttpsUrl } from "./data.js";
import { readJSON, writeJSON } from "./storage.js";

const ACTIVITY_MEDIA_MAPPINGS = [
  ["cdn.download.ams.birds.cornell.edu", "/cornell"],
  ["xeno-canto.org", "/xc"],
  ["cdn.jsdelivr.net", "/stickers"],
];

/**
 * Discord Activities are sandboxed: external media is blocked unless it is
 * requested through a URL mapping on the app's proxy origin. Rewrite the two
 * audio hosts and the sticker CDN to their mapped prefixes; everything else is
 * unchanged.
 *
 * `/stickers` maps to the whole jsDelivr host, because Discord appends the
 * remainder of the path rather than serving a single file. The game only ever
 * requests one repository's sticker paths through it.
 */
export const mapActivityMediaUrl = (url, { inActivity = isActivity() } = {}) => {
  if (!inActivity || typeof url !== "string" || url.length === 0) {
    return url;
  }
  try {
    const parsed = new URL(url);
    const mapping = ACTIVITY_MEDIA_MAPPINGS.find(
      ([host]) => parsed.hostname === host,
    );
    if (!mapping) {
      return url;
    }
    return `${mapping[1]}${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
};

const deadAudioUrls = new Set();

const loadDeadAudioUrls = () => {
  if (deadAudioUrls.size > 0) {
    return deadAudioUrls;
  }
  const cached = readJSON(STORAGE_KEYS.DEAD_AUDIO_URLS, []);
  if (Array.isArray(cached)) {
    cached.forEach((url) => {
      if (typeof url === "string") {
        deadAudioUrls.add(url);
      }
    });
  }
  return deadAudioUrls;
};

const saveDeadAudioUrls = () => {
  writeJSON(STORAGE_KEYS.DEAD_AUDIO_URLS, Array.from(deadAudioUrls));
};

export const getAudioSrc = (audioUrlData, index = 0) => {
  if (!audioUrlData) {
    return "";
  }
  if (!Array.isArray(audioUrlData)) {
    return isHttpsUrl(audioUrlData) ? audioUrlData : "";
  }
  const item = audioUrlData[index];
  if (!item) {
    return "";
  }
  if (typeof item === "object" && item.url) {
    return isHttpsUrl(item.url) ? item.url : "";
  }
  return isHttpsUrl(item) ? item : "";
};

export const getAudioAttribution = (recordings, index) => {
  const item = Array.isArray(recordings) ? recordings[index] : null;
  return item && typeof item === "object" && item.attribution
    ? item.attribution
    : {};
};

export const clearDeadAudioUrls = () => {
  deadAudioUrls.clear();
  saveDeadAudioUrls();
};

export function createAudioPlayer({
  audioEl,
  playButton,
  playLabel,
  equalizer,
  selectEl,
  pickerEl,
  errorEl,
  optionTemplateId = "tpl-recording-option",
  onRecordingChange = null,
  onPlayStateChange = null,
}) {
  let recordings = [];
  let selectedIndex = 0;
  let wasPlaying = false;
  let lastPlaying = null;
  let failedThisAttempt = new Set();

  const currentUrl = (index = selectedIndex) => getAudioSrc(recordings, index);

  const setError = (message = "") => {
    if (!errorEl) {
      return;
    }
    errorEl.textContent = message;
    errorEl.hidden = message.length === 0;
  };

  const setPlaying = (playing) => {
    equalizer?.classList.toggle("is-playing", playing);
    if (playLabel) {
      playLabel.textContent = playing ? "Pause bird call" : "Play bird call";
    }
    playButton?.setAttribute(
      "aria-label",
      playing ? "Pause bird call" : "Play bird call",
    );
    if (playing !== lastPlaying) {
      lastPlaying = playing;
      onPlayStateChange?.(playing);
    }
  };

  const syncSelect = () => {
    if (!selectEl) {
      return;
    }
    selectEl.replaceChildren();
    const template = document.getElementById(optionTemplateId);
    recordings.forEach((recording, index) => {
      const option = template
        ? template.content.firstElementChild.cloneNode(true)
        : document.createElement("option");
      option.value = String(index);
      option.textContent =
        recordings.length > 1 ? `Recording ${index + 1}` : "Recording 1";
      option.selected = index === selectedIndex;
      selectEl.appendChild(option);
    });
    if (pickerEl) {
      pickerEl.hidden = recordings.length <= 1;
    }
  };

  const load = () => {
    failedThisAttempt = new Set();
    const url = currentUrl();
    if (!url) {
      audioEl.removeAttribute("src");
      if (playButton) {
        playButton.disabled = recordings.length === 0;
      }
      return;
    }
    audioEl.src = mapActivityMediaUrl(url);
    if (playButton) {
      playButton.disabled = false;
    }
  };

  const markDead = (url) => {
    if (!url) {
      return;
    }
    deadAudioUrls.add(url);
    saveDeadAudioUrls();
  };

  const nextPlayableIndex = () => {
    for (let offset = 1; offset <= recordings.length; offset += 1) {
      const index = (selectedIndex + offset) % recordings.length;
      const url = currentUrl(index);
      if (url && !deadAudioUrls.has(url) && !failedThisAttempt.has(index)) {
        return index;
      }
    }
    return -1;
  };

  function handleAudioError() {
    if (recordings.length === 0) {
      return;
    }
    const failedUrl = currentUrl();
    markDead(failedUrl);
    failedThisAttempt.add(selectedIndex);
    const nextIndex = nextPlayableIndex();
    if (nextIndex >= 0) {
      selectedIndex = nextIndex;
      syncSelect();
      load();
      setError("That recording failed to load. Trying another recording…");
      if (wasPlaying) {
        play();
      }
      return;
    }
    setError(
      "Audio did not load. Try another recording or reload the page.",
    );
    setPlaying(false);
    wasPlaying = false;
  }

  async function play() {
    const url = currentUrl();
    if (!url) {
      setError("No playable recording is available for this bird.");
      return false;
    }
    setError("");
    try {
      await audioEl.play();
      wasPlaying = true;
      return true;
    } catch (error) {
      if (error?.name === "NotAllowedError") {
        setError("Tap play again to start the audio.");
      } else {
        handleAudioError();
      }
      return false;
    }
  }

  async function toggle() {
    if (audioEl.paused) {
      await play();
    } else {
      audioEl.pause();
      wasPlaying = false;
    }
  }

  const setRecordings = (nextRecordings) => {
    recordings = Array.isArray(nextRecordings) ? nextRecordings : [];
    loadDeadAudioUrls();
    const firstPlayable = recordings.findIndex((_, index) => {
      const url = currentUrl(index);
      return url && !deadAudioUrls.has(url);
    });
    selectedIndex = firstPlayable >= 0 ? firstPlayable : 0;
    syncSelect();
    load();
    setError("");
    setPlaying(false);
    wasPlaying = false;
    onRecordingChange?.(selectedIndex);
  };

  audioEl.addEventListener("play", () => setPlaying(true));
  audioEl.addEventListener("pause", () => setPlaying(false));
  audioEl.addEventListener("ended", () => {
    setPlaying(false);
    wasPlaying = false;
  });
  audioEl.addEventListener("error", handleAudioError);

  playButton?.addEventListener("click", () => {
    toggle();
  });

  selectEl?.addEventListener("change", () => {
    selectedIndex = Number(selectEl.value) || 0;
    const shouldResume = !audioEl.paused;
    wasPlaying = shouldResume;
    setError("");
    load();
    onRecordingChange?.(selectedIndex);
    if (shouldResume) {
      play();
    }
  });

  setPlaying(false);

  return {
    setRecordings,
    toggle,
    play,
    getSelectedIndex: () => selectedIndex,
  };
}
