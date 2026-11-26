import {
  initPage,
  resolveRegion,
  setLastPlayedMode,
} from "../app.js";
import { GAME_CONFIG } from "../core/constants.js";
import { generateAnswerOptions } from "../core/answers.js";
import { compareTaxonomy } from "../core/taxonomy.js";
import { loadRegionBirds, loadRegions } from "../core/data.js";
import { getTodaysBird } from "../core/daily.js";
import { getTodayString } from "../core/dates.js";
import {
  ensureDailyGame,
  gameKey,
  getDailyGame,
  processGuess,
} from "../core/gameState.js";
import {
  createPracticeSession,
  processHardPracticeGuess,
  processPracticeGuess,
  retryPracticeRound,
  startNextPracticeRound,
  togglePracticeMode,
} from "../core/practice.js";
import { GameView } from "../ui/gameView.js";
import { notify } from "../ui/toast.js";

const root = document.querySelector("[data-game-root]");
const mode = root?.dataset.mode || "normal";
const isPractice = mode === "practice";
const today = getTodayString();

const view = new GameView({ root, isPractice });

let handlers = {};

const showFatalError = (message) => {
  view.setLoading(false);
  view.showAlert("error", message, {
    actionLabel: "Reload",
    onAction: () => window.location.reload(),
  });
  notify(message, { type: "error" });
};

const renderPractice = (session) => {
  view.render({
    mode: "practice",
    isPractice: true,
    isHardMode: session.isHardMode,
    bird: session.currentBird,
    game: {
      date: today,
      guesses: session.guesses,
      completed: session.completed,
      won: session.won,
      maxGuesses: session.maxGuesses,
    },
    answerOptions: session.answerOptions,
    regionBirds: session.regionBirds,
    practiceIndex: session.practiceIndex,
    handlers,
  });
};

const startPractice = (region, regionBirds) => {
  let session = createPracticeSession(region.id, regionBirds);
  if (!session) {
    showFatalError("No birds are available for practice in this region.");
    return;
  }
  session.regionBirds = regionBirds;

  handlers = {
    onNormalGuess: (birdId) => {
      if (session.isHardMode || session.completed) {
        return;
      }
      session = processPracticeGuess(session, birdId);
      renderPractice(session);
    },
    onHardGuess: (bird) => {
      if (!session.isHardMode || session.completed) {
        return;
      }
      session = processHardPracticeGuess(session, bird);
      renderPractice(session);
    },
    onRetry: () => {
      session = retryPracticeRound(session, regionBirds);
      view.hideAlert();
      renderPractice(session);
    },
    onNext: () => {
      session = startNextPracticeRound(session, regionBirds);
      view.hideAlert();
      renderPractice(session);
    },
    onToggleMode: () => {
      session = togglePracticeMode(session, regionBirds);
      view.hideAlert();
      renderPractice(session);
    },
  };

  view.setHandlers(handlers);
  view.setLoading(false);
  renderPractice(session);
};

const startDaily = async (region, regionBirds) => {
  const key = gameKey(region.id, today, mode);
  const result = await getTodaysBird(region.id, regionBirds, today);
  if (!result.bird) {
    showFatalError(result.message || "The daily bird could not be loaded.");
    return;
  }

  let game = ensureDailyGame(region.id, today, mode);
  const answerOptions =
    mode === "normal"
      ? generateAnswerOptions(
          region.id,
          regionBirds,
          today,
          result.bird,
          GAME_CONFIG.ANSWER_OPTIONS_COUNT,
        )
      : [];

  const render = () => {
    view.render({
      mode,
      isPractice: false,
      isHardMode: mode === "hard",
      bird: result.bird,
      game,
      answerOptions,
      regionBirds,
      dailyEntry: result.entry,
      handlers,
    });
  };

  handlers = {
    onNormalGuess: (birdId) => {
      if (mode !== "normal" || game.completed) {
        return;
      }
      processGuess(key, {
        birdId,
        correct: birdId === result.bird.id,
        timestamp: Date.now(),
      });
      game = getDailyGame(key);
      render();
    },
    onHardGuess: (bird) => {
      if (mode !== "hard" || game.completed) {
        return;
      }
      processGuess(key, {
        birdId: bird.id,
        textInput: bird.name,
        correct: bird.id === result.bird.id,
        taxonomicScore: compareTaxonomy(bird, result.bird),
        timestamp: Date.now(),
      });
      game = getDailyGame(key);
      render();
    },
  };

  view.setHandlers(handlers);
  view.hideAlert();
  if (result.usedFallback) {
    view.showAlert("info", result.message);
  }

  const otherMode = mode === "normal" ? "hard" : "normal";
  const otherGame = getDailyGame(gameKey(region.id, today, otherMode));
  if (otherGame?.completed && !game.completed) {
    notify(
      `You completed ${otherMode} mode today, so ${mode} mode is normally closed.`,
      { type: "error" },
    );
  }

  view.setLoading(false);
  render();
};

const init = async () => {
  await initPage();
  view.setLoading(true);

  try {
    const regions = await loadRegions();
    const region = resolveRegion(regions);
    if (!region) {
      return;
    }

    view.setRegionName(region.name);
    view.setBackLink(region.id);
    setLastPlayedMode(mode);

    const regionBirds = await loadRegionBirds(region.id, regions);
    if (regionBirds.length === 0) {
      showFatalError("No birds are available for this region.");
      return;
    }

    if (isPractice) {
      startPractice(region, regionBirds);
    } else {
      await startDaily(region, regionBirds);
    }
  } catch (error) {
    console.error("Could not start the game:", error);
    showFatalError("Could not load game data. Check your connection and reload.");
  }
};

init();
