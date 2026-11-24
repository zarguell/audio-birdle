/** Small DOM helpers shared by page controllers. */
export const qs = (selector, root = document) => root.querySelector(selector);

export const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export function fromTemplate(templateId, documentRef = document) {
  const template = documentRef.getElementById(templateId);
  if (!template) {
    throw new Error(`Missing template: #${templateId}`);
  }
  const fragment = template.content.cloneNode(true);
  const element = fragment.firstElementChild;
  if (!element) {
    throw new Error(`Template #${templateId} is empty`);
  }
  return element;
}

export function show(element, visible = true) {
  if (element) {
    element.hidden = !visible;
  }
}

export function setText(element, text) {
  if (element) {
    element.textContent = text ?? "";
  }
}

export function setAttr(element, name, value) {
  if (!element) {
    return;
  }
  if (value === null || value === undefined) {
    element.removeAttribute(name);
  } else {
    element.setAttribute(name, String(value));
  }
}

