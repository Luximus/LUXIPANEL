// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT

/** Show a module's existing AI form in the drawer footer without moving its DOM.
 * The original form keeps its listeners and module context (including selected
 * files); the footer relays text and submit to that form. */
export function mountModuleAiFooter(footer: HTMLElement, sourceDocument: Document): () => void {
  let disposed = false;
  let queued = false;
  let activeForm: HTMLFormElement | null = null;
  let activeInput: HTMLInputElement | null = null;
  let proxyInput: HTMLInputElement | null = null;
  let focusHandler: (() => void) | null = null;
  let restoreSourceAttributes: Array<() => void> = [];

  const setTemporaryAttribute = (element: Element, name: string, value: string) => {
    const previous = element.getAttribute(name);
    element.setAttribute(name, value);
    restoreSourceAttributes.push(() => {
      if (previous === null) element.removeAttribute(name);
      else element.setAttribute(name, previous);
    });
  };

  const visible = (form: HTMLFormElement): boolean => {
    if (!form.isConnected || form.closest("[hidden], [inert], [aria-hidden='true']")) return false;
    const view = sourceDocument.defaultView;
    for (let node: HTMLElement | null = form; node; node = node.parentElement) {
      if (view) {
        const style = view.getComputedStyle(node);
        if (style.display === "none" || style.visibility === "hidden") return false;
      }
    }
    return true;
  };

  const detach = () => {
    if (activeInput && focusHandler) activeInput.removeEventListener("focus", focusHandler);
    restoreSourceAttributes.forEach((restore) => restore());
    restoreSourceAttributes = [];
    activeForm?.removeAttribute("data-ai-footer-relocated");
    activeForm = null;
    activeInput = null;
    proxyInput = null;
    focusHandler = null;
    footer.replaceChildren();
  };

  const sync = () => {
    if (disposed || !footer.isConnected) return;
    const next = [...sourceDocument.querySelectorAll<HTMLFormElement>("form[data-module-ai-footer-form]")].find(visible) ?? null;
    if (next !== activeForm) {
      detach();
      if (next) {
        const row = next.querySelector<HTMLElement>("[data-module-ai-footer-row]");
        const input = next.querySelector<HTMLInputElement>("input[data-module-ai-footer-input]");
        const sourceSubmit = next.querySelector<HTMLButtonElement>("button[type='submit']");
        if (row && input && sourceSubmit) {
          const mirror = footer.ownerDocument.createElement("form");
          mirror.className = "lxp-module-ai-footer-form";
          const mirrorRow = row.cloneNode(true) as HTMLElement;
          mirrorRow.querySelectorAll("[id]").forEach((element) => element.removeAttribute("id"));
          mirror.appendChild(mirrorRow);
          const clonedInput = mirror.querySelector<HTMLInputElement>("input[data-module-ai-footer-input]");
          const clonedSubmit = mirror.querySelector<HTMLButtonElement>("button[type='submit']");
          if (clonedInput && clonedSubmit) {
            activeForm = next;
            activeInput = input;
            proxyInput = clonedInput;
            clonedInput.value = input.value;
            focusHandler = () => clonedInput.focus();
            input.addEventListener("focus", focusHandler);
            clonedInput.addEventListener("input", () => {
              input.value = clonedInput.value;
              input.dispatchEvent(new Event("input", { bubbles: true }));
            });
            clonedInput.addEventListener("keydown", (event) => {
              if (event.key !== "Escape" || next.id !== "files-editor-ai-form") return;
              event.preventDefault();
              event.stopPropagation();
              input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
            });
            mirror.addEventListener("submit", (event) => {
              event.preventDefault();
              if (input.disabled || sourceSubmit.disabled) return;
              input.value = clonedInput.value;
              next.requestSubmit(sourceSubmit);
              queueMicrotask(() => { if (proxyInput === clonedInput) clonedInput.value = input.value; });
            });
            setTemporaryAttribute(row, "aria-hidden", "true");
            setTemporaryAttribute(input, "tabindex", "-1");
            setTemporaryAttribute(sourceSubmit, "tabindex", "-1");
            next.setAttribute("data-ai-footer-relocated", "");
            footer.appendChild(mirror);
          }
        }
      }
    }
    if (activeForm && activeInput && proxyInput) {
      const sourceSubmit = activeForm.querySelector<HTMLButtonElement>("button[type='submit']");
      const mirrorSubmit = footer.querySelector<HTMLButtonElement>("button[type='submit']");
      const sourceSpinner = activeForm.querySelector<HTMLElement>("[data-module-ai-footer-spinner]");
      const mirrorSpinner = footer.querySelector<HTMLElement>("[data-module-ai-footer-spinner]");
      if (proxyInput.disabled !== activeInput.disabled) proxyInput.disabled = activeInput.disabled;
      if (mirrorSubmit && mirrorSubmit.disabled !== Boolean(sourceSubmit?.disabled)) mirrorSubmit.disabled = Boolean(sourceSubmit?.disabled);
      if (sourceSpinner && mirrorSpinner && mirrorSpinner.className !== sourceSpinner.className) mirrorSpinner.className = sourceSpinner.className;
      if (proxyInput.value !== activeInput.value) proxyInput.value = activeInput.value;
    }
  };

  const schedule = () => {
    if (queued || disposed) return;
    queued = true;
    queueMicrotask(() => { queued = false; sync(); });
  };
  const observer = new MutationObserver(schedule);
  observer.observe(sourceDocument.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "hidden", "inert", "aria-hidden", "disabled"],
  });
  sync();
  return () => { disposed = true; observer.disconnect(); detach(); };
}
