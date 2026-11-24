import { formatCountdown, millisecondsUntilMidnight } from "../core/dates.js";

export function startCountdown(valueElement, { onComplete = null } = {}) {
  if (!valueElement) {
    return () => undefined;
  }

  let completed = false;
  const update = () => {
    const remaining = millisecondsUntilMidnight();
    valueElement.textContent = formatCountdown(remaining);
    if (remaining <= 1000 && !completed) {
      completed = true;
      onComplete?.();
    }
  };

  update();
  const timer = window.setInterval(update, 1000);

  const onVisible = () => {
    if (!document.hidden) {
      update();
    }
  };
  document.addEventListener("visibilitychange", onVisible);

  return () => {
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
