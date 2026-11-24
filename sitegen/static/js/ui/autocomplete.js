import { fromTemplate, setAttr } from "../core/dom.js";
import { filterBirdsByQuery } from "../core/taxonomy.js";

export function createAutocomplete({
  input,
  list,
  empty,
  birds,
  onSelect,
  limit = 8,
}) {
  let matches = [];
  let activeIndex = -1;
  let debounceTimer = null;
  let currentBirds = Array.isArray(birds) ? birds : [];

  const isOpen = () => !list.hidden;

  const setActive = (index) => {
    activeIndex = index;
    const options = Array.from(list.children);
    options.forEach((option, optionIndex) => {
      option.setAttribute(
        "aria-selected",
        optionIndex === activeIndex ? "true" : "false",
      );
    });
    if (activeIndex >= 0 && options[activeIndex]) {
      input.setAttribute("aria-activedescendant", options[activeIndex].id);
      options[activeIndex].scrollIntoView({ block: "nearest" });
    } else {
      input.removeAttribute("aria-activedescendant");
    }
  };

  const close = () => {
    list.hidden = true;
    setAttr(input, "aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    activeIndex = -1;
  };

  const open = () => {
    list.hidden = false;
    setAttr(input, "aria-expanded", "true");
  };

  const clearEmpty = () => {
    if (empty) {
      empty.hidden = true;
      empty.textContent = "";
    }
  };

  const select = (bird) => {
    if (!bird) {
      return;
    }
    onSelect(bird);
    input.value = "";
    matches = [];
    list.replaceChildren();
    clearEmpty();
    close();
  };

  const render = (query) => {
    matches = filterBirdsByQuery(currentBirds, query).slice(0, limit);
    list.replaceChildren();

    if (matches.length === 0) {
      close();
      clearEmpty();
      if (empty && query.trim().length >= 2) {
        empty.textContent = `No birds found matching “${query.trim()}”.`;
        empty.hidden = false;
      }
      return;
    }

    clearEmpty();
    const fragment = document.createDocumentFragment();
    matches.forEach((bird, index) => {
      const option = fromTemplate("tpl-suggestion");
      option.id = `${list.id}-option-${bird.id}`;
      option.dataset.birdId = bird.id;
      option.setAttribute("aria-selected", "false");
      option.querySelector("[data-name]").textContent = bird.name;
      option.querySelector("[data-scientific]").textContent =
        bird.scientificName;
      option.addEventListener("mouseenter", () => setActive(index));
      fragment.appendChild(option);
    });
    list.appendChild(fragment);
    open();
    setActive(-1);
  };

  const scheduleRender = () => {
    window.clearTimeout(debounceTimer);
    const query = input.value.trim();
    if (query.length < 2) {
      matches = [];
      list.replaceChildren();
      clearEmpty();
      close();
      return;
    }
    debounceTimer = window.setTimeout(() => render(query), 150);
  };

  const commitActive = () => {
    if (matches.length === 0) {
      return;
    }
    const index = activeIndex >= 0 ? activeIndex : 0;
    select(matches[index]);
  };

  input.addEventListener("input", scheduleRender);

  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      if (!isOpen() || matches.length === 0) {
        return;
      }
      event.preventDefault();
      setActive((activeIndex + 1) % matches.length);
    } else if (event.key === "ArrowUp") {
      if (!isOpen() || matches.length === 0) {
        return;
      }
      event.preventDefault();
      setActive(activeIndex <= 0 ? matches.length - 1 : activeIndex - 1);
    } else if (event.key === "Enter") {
      if (!isOpen() || matches.length === 0) {
        return;
      }
      event.preventDefault();
      commitActive();
    } else if (event.key === "Escape") {
      close();
      clearEmpty();
    } else if (event.key === "Tab") {
      close();
    }
  });

  list.addEventListener("pointerdown", (event) => {
    const option = event.target.closest("[data-bird-id]");
    if (!option) {
      return;
    }
    event.preventDefault();
    const bird = currentBirds.find((entry) => entry.id === option.dataset.birdId);
    if (bird) {
      select(bird);
    }
  });

  document.addEventListener("pointerdown", (event) => {
    if (!list.parentElement?.contains(event.target)) {
      close();
    }
  });

  return {
    setBirds: (nextBirds) => {
      currentBirds = Array.isArray(nextBirds) ? nextBirds : [];
    },
    clear: () => {
      input.value = "";
      scheduleRender();
    },
    close,
    focus: () => input.focus(),
  };
}
