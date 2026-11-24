const MAX_TOASTS = 4;

const dismiss = (toast) => {
  if (!toast || toast.dataset.leaving === "true") {
    return;
  }
  toast.dataset.leaving = "true";
  toast.classList.add("is-leaving");
  const remove = () => toast.remove();
  toast.addEventListener("animationend", remove, { once: true });
  window.setTimeout(remove, 350);
};

export function notify(message, { type = "info", duration = 4200 } = {}) {
  const region = document.getElementById("toast-region");
  const template = document.getElementById("tpl-toast");
  if (!region || !template) {
    console.info(message);
    return null;
  }

  const toast = template.content.firstElementChild.cloneNode(true);
  toast.dataset.type = type;
  toast.setAttribute("role", type === "error" ? "alert" : "status");
  toast.querySelector("[data-toast-message]").textContent = message;
  toast.querySelector("[data-toast-close]").addEventListener("click", () => {
    dismiss(toast);
  });

  region.appendChild(toast);
  while (region.children.length > MAX_TOASTS) {
    region.firstElementChild.remove();
  }

  let timer = window.setTimeout(() => dismiss(toast), duration);
  toast.addEventListener("mouseenter", () => window.clearTimeout(timer));
  toast.addEventListener("mouseleave", () => {
    timer = window.setTimeout(() => dismiss(toast), 1800);
  });

  return toast;
}
