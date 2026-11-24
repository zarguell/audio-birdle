import { GAME_CONFIG } from "../core/constants.js";
import { formatDateForDisplay } from "../core/dates.js";
import { extractGenus } from "../core/taxonomy.js";
import {
  generateHardModeShareText,
  generateShareText,
  shareResult,
} from "../core/share.js";
import { createAudioPlayer } from "../core/audio.js";
import { fromTemplate, qs, qsa, setText, show } from "../core/dom.js";
import { createAutocomplete } from "./autocomplete.js";
import { createCompletionView } from "./completion.js";
import { startCountdown } from "./countdown.js";
import { renderGuessList } from "./guessList.js";
import { notify } from "./toast.js";

async function shareGame(game, mode) {
  const text =
    mode === "hard"
      ? generateHardModeShareText(game, window.location.href)
      : generateShareText(game, window.location.href);
  if (!text) {
    return;
  }
  await shareResult(text, notify);
}

export class GameView {
  constructor({ root, isPractice = false }) {
    this.root = root;
    this.isPractice = isPractice;
    this.handlers = {};
    this.currentBirdId = null;
    this.countdownStarted = false;

    this.elements = {
      alert: qs("[data-alert]", root),
      alertText: qs("[data-alert-text]", root),
      alertAction: qs("[data-alert-action]", root),
      dateLabel: qs("[data-date-label]", root),
      audioError: qs("[data-audio-error]", root),
      observation: qs("[data-observation]", root),
      subregion: qs("[data-subregion]", root),
      guessesSection: qs("[data-guesses-section]", root),
      guessList: qs("[data-guess-list]", root),
      remaining: qs("[data-remaining]", root),
      hints: qs("[data-hints]", root),
      hintOrder: qs("[data-hint-order]", root),
      hintOrderValue: qs("[data-hint-order-value]", root),
      hintFamily: qs("[data-hint-family]", root),
      hintFamilyValue: qs("[data-hint-family-value]", root),
      hintGenus: qs("[data-hint-genus]", root),
      hintGenusValue: qs("[data-hint-genus-value]", root),
      optionsSection: qs("[data-options-section]", root),
      optionsTitle: qs("[data-options-title]", root),
      answerOptions: qs("[data-answer-options]", root),
      hardSection: qs("[data-hard-section]", root),
      hardInput: qs("[data-hard-input]", root),
      hardEmpty: qs("[data-hard-empty]", root),
      hardClear: qs("[data-hard-clear]", root),
      completion: qs("[data-completion]", root),
      countdown: qs("[data-countdown]", root),
      countdownValue: qs("[data-countdown-value]", root),
      loading: qs("[data-game-loading]", root),
      practiceToggle: qs("[data-practice-toggle]"),
      backLink: qs("[data-back-link]"),
    };

    this.completion = createCompletionView(this.elements.completion);

    this.audio = createAudioPlayer({
      audioEl: qs("[data-audio]", root),
      playButton: qs("[data-play-button]", root),
      playLabel: qs("[data-play-label]", root),
      equalizer: qs("[data-equalizer]", root),
      selectEl: qs("[data-recording-select]", root),
      pickerEl: qs("[data-recording-picker]", root),
      errorEl: this.elements.audioError,
      onRecordingChange: (index) => this.completion.setAudioIndex(index),
    });

    this.autocomplete = createAutocomplete({
      input: this.elements.hardInput,
      list: qs("[data-hard-suggestions]", root),
      empty: this.elements.hardEmpty,
      birds: [],
      onSelect: (bird) => this.handlers.onHardGuess?.(bird),
    });

    this.elements.hardClear?.addEventListener("click", () => {
      this.autocomplete.clear();
      this.elements.hardInput.focus();
    });

    this.elements.practiceToggle?.addEventListener("click", () => {
      this.handlers.onToggleMode?.();
    });

    show(this.completionRoot(), false);
  }

  completionRoot() {
    return this.elements.completion;
  }

  setHandlers(handlers) {
    this.handlers = handlers;
  }

  setRegionName(name) {
    qsa("[data-region-label]", this.root).forEach((element) => {
      element.textContent = name;
    });
  }

  setDateLabel(text) {
    setText(this.elements.dateLabel, text);
  }

  setBackLink(regionId) {
    if (this.elements.backLink) {
      this.elements.backLink.href = regionId
        ? `/play/?region=${encodeURIComponent(regionId)}`
        : "/play/";
    }
  }

  setPracticeToggle(isHardMode) {
    const button = this.elements.practiceToggle;
    if (!button) {
      return;
    }
    show(button, this.isPractice);
    if (this.isPractice) {
      button.textContent = isHardMode ? "Normal" : "Hard";
      button.setAttribute(
        "aria-label",
        isHardMode ? "Switch to normal practice" : "Switch to hard practice",
      );
    }
  }

  showAlert(type, message, { actionLabel = "", onAction = null } = {}) {
    const alert = this.elements.alert;
    if (!alert) {
      return;
    }
    alert.dataset.type = type;
    setText(this.elements.alertText, message);
    const action = this.elements.alertAction;
    if (action) {
      if (actionLabel && onAction) {
        action.textContent = actionLabel;
        action.onclick = onAction;
        show(action, true);
      } else {
        action.onclick = null;
        show(action, false);
      }
    }
    show(alert, true);
  }

  hideAlert() {
    show(this.elements.alert, false);
  }

  setObservation(entry) {
    const subregion = entry?.subregion;
    if (subregion) {
      setText(this.elements.subregion, subregion);
      show(this.elements.observation, true);
    } else {
      show(this.elements.observation, false);
    }
  }

  setLoading(loading) {
    this.root.setAttribute("aria-busy", loading ? "true" : "false");
    show(this.elements.loading, loading);
  }

  startCountdown() {
    if (this.countdownStarted || !this.elements.countdown) {
      return;
    }
    this.countdownStarted = true;
    show(this.elements.countdown, true);
    startCountdown(this.elements.countdownValue, {
      onComplete: () => window.location.reload(),
    });
  }

  render(state) {
    const {
      mode,
      isPractice,
      isHardMode,
      bird,
      game,
      answerOptions = [],
      regionBirds = [],
      practiceIndex = 0,
      dailyEntry = null,
      handlers = this.handlers,
    } = state;

    this.handlers = handlers;
    this.isPractice = isPractice;

    if (bird && bird.id !== this.currentBirdId) {
      this.currentBirdId = bird.id;
      this.audio.setRecordings(bird.audioUrl);
      if (!Array.isArray(bird.audioUrl) || bird.audioUrl.length === 0) {
        this.elements.audioError.textContent =
          "No recording is available for this bird.";
        show(this.elements.audioError, true);
      }
    }

    this.setObservation(dailyEntry);
    this.setPracticeToggle(isHardMode);

    if (isPractice) {
      this.setDateLabel(`Practice round #${practiceIndex + 1}`);
      show(this.elements.countdown, false);
    } else {
      this.setDateLabel(formatDateForDisplay(game.date));
      this.startCountdown();
    }

    const guesses = game.guesses || [];
    this.autocomplete.setBirds(regionBirds);

    renderGuessList(this.elements.guessList, {
      guesses,
      isHard: isHardMode,
      regionBirds,
      answerOptions,
      correctBird: bird,
    });
    show(this.elements.guessesSection, guesses.length > 0);

    const completed = Boolean(game.completed);
    const remaining = game.maxGuesses - guesses.length;

    if (isHardMode && !completed) {
      this.elements.remaining.textContent = `${remaining} ${
        remaining === 1 ? "guess" : "guesses"
      } remaining`;
      show(this.elements.remaining, true);
    } else {
      show(this.elements.remaining, false);
    }

    const showHints = isHardMode && !completed && guesses.length >= 1;
    show(this.elements.hints, showHints);
    if (showHints) {
      const timings = GAME_CONFIG.HARD_MODE_HINT_TIMING;
      show(this.elements.hintOrder, guesses.length >= timings.ORDER);
      setText(this.elements.hintOrderValue, bird?.order || "—");
      show(this.elements.hintFamily, guesses.length >= timings.FAMILY);
      setText(this.elements.hintFamilyValue, bird?.family || "—");
      show(this.elements.hintGenus, guesses.length >= timings.GENUS);
      setText(
        this.elements.hintGenusValue,
        bird ? extractGenus(bird.scientificName) : "—",
      );
    }

    const showOptions = !isHardMode && !completed;
    show(this.elements.optionsSection, showOptions);
    if (showOptions) {
      this.elements.answerOptions.replaceChildren();
      const fragment = document.createDocumentFragment();
      answerOptions.forEach((option) => {
        const button = fromTemplate("tpl-answer-option");
        button.dataset.birdId = option.id;
        button.querySelector("[data-name]").textContent = option.name;
        button.querySelector("[data-scientific]").textContent =
          option.scientificName;
        button.addEventListener("click", () => {
          this.handlers.onNormalGuess?.(option.id);
        });
        fragment.appendChild(button);
      });
      this.elements.answerOptions.appendChild(fragment);
      setText(
        this.elements.optionsTitle,
        `Choose the bird (${guesses.length + 1}/${game.maxGuesses})`,
      );
    }

    const showHardInput = isHardMode && !completed;
    show(this.elements.hardSection, showHardInput);
    if (this.elements.hardInput) {
      this.elements.hardInput.disabled = !showHardInput;
      if (!showHardInput) {
        this.autocomplete.close();
      }
    }

    if (completed) {
      this.completion.render({
        bird,
        game,
        mode,
        isPractice,
        audioIndex: this.audio.getSelectedIndex(),
        onShare: isPractice ? null : () => shareGame(game, mode),
        onRetry: handlers.onRetry,
        onNext: handlers.onNext,
      });
    } else {
      this.completion.hide();
    }
  }
}
