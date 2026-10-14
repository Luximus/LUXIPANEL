// Settings page — collapsible sections (Layout/UI + Credentials tabs). Leaf.

// ── Secciones colapsables (tab Layout/UI y tab Credenciales) ────────────────
// Patrón ligero, solo-frontend (sin estado en backend): la cabecera
// (`[data-lxp-collapse-toggle]`) alterna la visibilidad de los hermanos que le
// siguen dentro del contenedor `[data-lxp-collapse]`. Los nodos permanecen en el
// DOM (solo `hidden`), así que los scripts que leen/escriben inputs (color
// pickers, uploads de logo, formularios de credenciales) siguen operando al
// expandir. Todas arrancan COLAPSADAS. Las acciones de cabecera (Restaurar
// logos / Restablecer estilos) son hermanas del toggle → no lo disparan.
export function lxpCollapseHead(container: HTMLElement, trigger: HTMLElement): HTMLElement | null {
  let el: HTMLElement | null = trigger;
  while (el && el.parentElement !== container) el = el.parentElement;
  return el;
}
export function lxpSetCollapsed(container: HTMLElement, trigger: HTMLElement, collapsed: boolean): void {
  const head = lxpCollapseHead(container, trigger);
  if (!head) return;
  let n = head.nextElementSibling;
  while (n) {
    (n as HTMLElement).toggleAttribute("hidden", collapsed);
    n = n.nextElementSibling;
  }
  trigger.setAttribute("aria-expanded", String(!collapsed));
  const chev = trigger.querySelector<HTMLElement>("[data-lxp-collapse-chevron]");
  if (chev) chev.classList.toggle("rotate-180", !collapsed);
}
// Acordeón: al expandir una sección, colapsa sus HERMANAS del mismo grupo (el
// ancestro `[data-lxp-collapse-group]` compartido más cercano). Solo aplica al
// mismo nivel — una sección anidada tendría su propio grupo, así que abrir un
// hijo nunca cierra al padre. Cada hermana se cierra por el MISMO camino que el
// toggle (hidden + aria-expanded=false + rotación chevron).
export function lxpCloseGroupSiblings(container: HTMLElement): void {
  const group = container.closest<HTMLElement>("[data-lxp-collapse-group]") ?? container.parentElement;
  if (!group) return;
  group.querySelectorAll<HTMLElement>("[data-lxp-collapse]").forEach((other) => {
    if (other === container) return;
    if ((other.closest<HTMLElement>("[data-lxp-collapse-group]") ?? other.parentElement) !== group) return;
    const otherTrigger = other.querySelector<HTMLElement>("[data-lxp-collapse-toggle]");
    if (otherTrigger && otherTrigger.getAttribute("aria-expanded") === "true") {
      lxpSetCollapsed(other, otherTrigger, true);
    }
  });
}
export function initCollapsibles(): void {
  const root = document.getElementById("settings-content");
  if (!root) return;
  root.querySelectorAll<HTMLElement>("[data-lxp-collapse-toggle]").forEach((trigger) => {
    if (trigger.dataset.lxpCollapseBound === "1") return;
    trigger.dataset.lxpCollapseBound = "1";
    const container = trigger.closest<HTMLElement>("[data-lxp-collapse]");
    if (!container) return;
    lxpSetCollapsed(container, trigger, true); // por defecto: colapsada
    const onToggle = () => {
      const willExpand = trigger.getAttribute("aria-expanded") !== "true";
      lxpSetCollapsed(container, trigger, !willExpand);
      if (willExpand) lxpCloseGroupSiblings(container); // acordeón entre hermanas
    };
    trigger.addEventListener("click", onToggle);
    // Cabeceras que no son <button> nativo (div role="button", tarjetas de
    // credenciales): activar con teclado.
    if (trigger.tagName !== "BUTTON") {
      trigger.addEventListener("keydown", (ev) => {
        const e = ev as KeyboardEvent;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      });
    }
  });
  // Deep-link `#cred-<id>`: expandir la tarjeta enlazada para que el scroll/foco
  // del script de credenciales caiga sobre contenido visible.
  const hash = window.location.hash;
  if (hash.startsWith("#cred-")) {
    const card = document.getElementById("cred-card-" + (hash === "#cred-git" ? "repository-store" : hash.slice("#cred-".length)));
    const trig = card?.querySelector<HTMLElement>("[data-lxp-collapse-toggle]");
    if (card && trig && trig.getAttribute("aria-expanded") !== "true") {
      lxpSetCollapsed(card, trig, false);
    }
  }
}
