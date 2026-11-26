const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const ACTOR_WIDTH = 52;
const ACTOR_HEIGHT = 41;
const FLIGHT_STEP = 340;
const DEFAULT_HOLD = 1700;
const TOAST_COOLDOWN = 3500;

const prefersReducedMotion = () =>
  window.matchMedia(REDUCED_MOTION).matches;

const STATE_FOR_TYPE = {
  correct: "flying",
  wrong: "startled",
  win: "celebrating",
  lose: "flying",
  play: "flying",
  hint: "flying",
  round: "flying",
  mode: "flying",
};

const ANIMATION_TYPES = new Set([
  "correct",
  "wrong",
  "win",
  "lose",
  "play",
  "hint",
  "round",
  "mode",
]);

function createBirdDirector(scene) {
  const motion = scene.querySelector("[data-bird-motion]");
  const template = document.getElementById("tpl-bird-actor");
  let actor = null;
  let actorVisible = false;
  let isFlying = false;
  let lastToastAt = 0;
  let scrollGuardUntil = 0;
  const timers = new Set();

  const setTimer = (callback, delay) => {
    const timer = window.setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delay);
    timers.add(timer);
    return timer;
  };

  const clearTimers = () => {
    timers.forEach((timer) => window.clearTimeout(timer));
    timers.clear();
  };

  const ensureActor = () => {
    if (actor) {
      return actor;
    }
    if (!template) {
      return null;
    }
    actor = template.content.firstElementChild.cloneNode(true);
    document.body.appendChild(actor);
    return actor;
  };

  const setActorPosition = (x, y, scale) => {
    if (!actor) {
      return;
    }
    actor.style.setProperty("--actor-x", `${x}px`);
    actor.style.setProperty("--actor-y", `${y}px`);
    actor.style.setProperty("--actor-scale", String(scale));
  };

  const hideActor = () => {
    if (!actor) {
      return;
    }
    actor.classList.remove("is-visible", "is-landed", "is-dropping");
    actorVisible = false;
  };

  const showSceneBird = () => {
    scene.classList.remove("is-away");
  };

  const hideSceneBird = () => {
    scene.classList.add("is-away");
  };

  const abortFlight = () => {
    clearTimers();
    hideActor();
    showSceneBird();
    isFlying = false;
  };

  const settleScene = () => {
    scene.dataset.state = "perched";
    delete scene.dataset.animation;
    scene.classList.remove("is-animating");
  };

  const perch = () => {
    abortFlight();
    settleScene();
  };

  const react = (type) => {
    if (!motion || prefersReducedMotion() || document.hidden || isFlying) {
      return false;
    }

    const animation = ANIMATION_TYPES.has(type) ? type : "play";
    scene.dataset.state = STATE_FOR_TYPE[animation] || "flying";
    scene.dataset.animation = animation;
    scene.dataset.lastReaction = animation;

    scene.classList.remove("is-animating");
    void scene.getBoundingClientRect();
    scene.classList.add("is-animating");
    return true;
  };

  const flyTo = (
    target,
    { featherDrop = false, hold = DEFAULT_HOLD, offsetX = 0, offsetY = 0 } = {},
  ) => {
    if (prefersReducedMotion() || document.hidden || isFlying) {
      return false;
    }

    const element =
      typeof target === "string" ? document.querySelector(target) : target;
    if (!element) {
      return false;
    }

    const targetRect = element.getBoundingClientRect();
    const startRect = scene.getBoundingClientRect();
    if (
      targetRect.width === 0 ||
      targetRect.height === 0 ||
      startRect.width === 0
    ) {
      return false;
    }

    const actorElement = ensureActor();
    if (!actorElement) {
      return false;
    }

    clearTimers();
    isFlying = true;
    scrollGuardUntil = Date.now() + 700;

    const startScale = startRect.width / ACTOR_WIDTH;
    const endScale = Math.min(
      1.35,
      Math.max(0.7, targetRect.width / 260),
    );
    const startVisible =
      startRect.bottom > 0 && startRect.top < window.innerHeight;
    const startX = startVisible
      ? startRect.left
      : window.innerWidth / 2 - (ACTOR_WIDTH * startScale) / 2;
    const startY = startVisible ? startRect.top : -ACTOR_HEIGHT * 1.2;
    const endX =
      targetRect.left +
      targetRect.width / 2 -
      (ACTOR_WIDTH * endScale) / 2 +
      offsetX;
    const endY =
      targetRect.top +
      targetRect.height / 2 -
      (ACTOR_HEIGHT * endScale) / 2 +
      offsetY;
    const deltaX = endX - startX;
    const lift = Math.min(120, Math.abs(deltaX) * 0.18 + 52);
    const midOneX = startX + deltaX * 0.35;
    const midOneY = Math.min(startY, endY) - lift;
    const midTwoX = startX + deltaX * 0.72;
    const midTwoY = Math.min(startY, endY) - lift * 0.45;

    actorElement.classList.add("is-instant");
    setActorPosition(startX, startY, startScale);
    void actorElement.getBoundingClientRect();
    actorElement.classList.remove("is-instant");
    actorElement.classList.add("is-visible");
    hideSceneBird();
    actorVisible = true;

    setTimer(() => setActorPosition(midOneX, midOneY, endScale), 20);
    setTimer(
      () => setActorPosition(midTwoX, midTwoY, endScale),
      FLIGHT_STEP + 20,
    );
    setTimer(
      () => setActorPosition(endX, endY, endScale),
      FLIGHT_STEP * 2 + 20,
    );
    setTimer(() => {
      actorElement.classList.add("is-landed");
      if (featherDrop) {
        actorElement.classList.add("is-dropping");
      }
    }, FLIGHT_STEP * 3 + 40);

    setTimer(() => {
      const returnRect = scene.getBoundingClientRect();
      const returnScale = returnRect.width / ACTOR_WIDTH;
      const returnX = returnRect.left;
      const returnY = returnRect.top;
      const returnMidX = endX + (returnX - endX) * 0.35;
      const returnMidY = Math.min(endY, returnY) - lift * 0.7;

      setActorPosition(returnMidX, returnMidY, returnScale);
      setTimer(
        () => setActorPosition(returnX, returnY, returnScale),
        FLIGHT_STEP,
      );
      setTimer(() => {
        hideActor();
        showSceneBird();
        isFlying = false;
      }, FLIGHT_STEP * 2);
    }, FLIGHT_STEP * 3 + 40 + hold);

    return true;
  };

  const returnToPerch = () => {
    abortFlight();
    perch();
  };

  const setAudioPlaying = (playing) => {
    scene.dataset.birdAudio = playing ? "playing" : "idle";
    document.querySelectorAll("[data-audio-bird]").forEach((element) => {
      element.classList.toggle("is-playing", playing);
    });
  };

  const syncVisibility = () => {
    document.documentElement.classList.toggle(
      "is-page-hidden",
      document.hidden,
    );
    if (document.hidden) {
      abortFlight();
    }
  };

  const onToast = (event) => {
    const toast = event.detail?.toast;
    if (!toast || isFlying || prefersReducedMotion() || document.hidden) {
      return;
    }
    const now = Date.now();
    if (now - lastToastAt < TOAST_COOLDOWN) {
      return;
    }
    lastToastAt = now;
    flyTo(toast, { hold: 700 });
  };

  motion?.addEventListener("animationend", (event) => {
    if (event.target === motion) {
      settleScene();
    }
  });

  scene.addEventListener("click", () => react("play"));
  document.addEventListener("visibilitychange", syncVisibility);
  document.addEventListener("birdle:toast", onToast);
  window.addEventListener("resize", abortFlight);
  window.addEventListener(
    "scroll",
    () => {
      if (isFlying && Date.now() >= scrollGuardUntil) {
        abortFlight();
      }
    },
    { passive: true },
  );
  syncVisibility();

  return {
    element: scene,
    actorIsVisible: () => actorVisible,
    flyTo,
    perch,
    react,
    returnToPerch,
    setAudioPlaying,
  };
}

let birdDirector = null;

export function ensureBirdDirector(root = document) {
  if (birdDirector?.element.isConnected) {
    return birdDirector;
  }

  const scene = root.querySelector("[data-scene-bird]");
  if (!scene) {
    return null;
  }

  birdDirector = createBirdDirector(scene);
  return birdDirector;
}
