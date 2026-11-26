const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

const prefersReducedMotion = () =>
  window.matchMedia(REDUCED_MOTION).matches;

const STATE_FOR_TYPE = {
  correct: "flying",
  wrong: "startled",
  win: "celebrating",
  lose: "flying",
  play: "flying",
};

const ANIMATION_TYPES = new Set(["correct", "wrong", "win", "lose", "play"]);

function createSceneBird(element) {
  const motion = element.querySelector("[data-bird-motion]");

  const perch = () => {
    element.dataset.state = "perched";
    delete element.dataset.animation;
    element.classList.remove("is-animating");
  };

  const react = (type) => {
    if (!motion || prefersReducedMotion()) {
      return;
    }

    const animation = ANIMATION_TYPES.has(type) ? type : "play";
    element.dataset.state = STATE_FOR_TYPE[animation];
    element.dataset.animation = animation;

    element.classList.remove("is-animating");
    void element.getBoundingClientRect();
    element.classList.add("is-animating");
  };

  motion?.addEventListener("animationend", (event) => {
    if (event.target === motion) {
      perch();
    }
  });

  element.addEventListener("click", () => react("play"));

  return { element, perch, react };
}

let sceneBird = null;

export function ensureSceneBird(root = document) {
  if (sceneBird?.element.isConnected) {
    return sceneBird;
  }

  const element = root.querySelector("[data-scene-bird]");
  if (!element) {
    return null;
  }

  sceneBird = createSceneBird(element);
  return sceneBird;
}
