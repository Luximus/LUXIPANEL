function bindViewSettingsModal(root: HTMLElement): void {
  if (root.dataset.bound === "true") return;
  root.dataset.bound = "true";

  const dialogId = root.dataset.dialogId;
  const triggerId = root.dataset.triggerId;
  const closeId = root.dataset.closeId;
  const cancelId = root.dataset.cancelId;

  const dialog = dialogId ? document.getElementById(dialogId) as HTMLDialogElement | null : null;
  const trigger = triggerId ? document.getElementById(triggerId) : null;
  const closeBtn = closeId ? document.getElementById(closeId) : null;
  const cancelBtn = cancelId ? document.getElementById(cancelId) : null;

  const open = () => dialog?.showModal?.();
  const close = () => dialog?.close?.();

  trigger?.addEventListener("click", open);
  closeBtn?.addEventListener("click", close);
  cancelBtn?.addEventListener("click", close);
  dialog?.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });

  const sections = dialog?.querySelector<HTMLElement>("[data-lxp-settings-sections]");
  if (sections) {
    const tabs = [...sections.querySelectorAll<HTMLButtonElement>("[data-lxp-settings-tab]")];
    const panels = [...sections.querySelectorAll<HTMLElement>("[data-lxp-settings-panel]")];
    const activate = (id: string, focus = false): void => {
      if (!tabs.some((tab) => tab.dataset.lxpSettingsTab === id)) return;
      for (const tab of tabs) {
        const selected = tab.dataset.lxpSettingsTab === id;
        tab.setAttribute("aria-selected", String(selected));
        tab.tabIndex = selected ? 0 : -1;
        tab.classList.toggle("bg-primary/10", selected);
        tab.classList.toggle("text-primary", selected);
        tab.classList.toggle("text-muted-foreground", !selected);
        if (selected && focus) tab.focus();
      }
      for (const panel of panels) {
        const selected = panel.dataset.lxpSettingsPanel === id;
        panel.hidden = !selected;
        panel.classList.toggle("hidden", !selected);
      }
    };
    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => activate(tab.dataset.lxpSettingsTab ?? ""));
      tab.addEventListener("keydown", (event) => {
        const next = event.key === "ArrowDown" ? (index + 1) % tabs.length
          : event.key === "ArrowUp" ? (index - 1 + tabs.length) % tabs.length
          : event.key === "Home" ? 0
          : event.key === "End" ? tabs.length - 1 : -1;
        if (next < 0) return;
        event.preventDefault();
        activate(tabs[next].dataset.lxpSettingsTab ?? "", true);
      });
    });
    if (tabs.length) activate(tabs[0].dataset.lxpSettingsTab ?? "");
  }
}

function initViewSettingsModals(root: ParentNode = document): void {
  for (const modalRoot of root.querySelectorAll<HTMLElement>("[data-view-settings-modal]")) {
    bindViewSettingsModal(modalRoot);
  }
}

initViewSettingsModals();
document.addEventListener("astro:after-swap", () => initViewSettingsModals());

export {};
