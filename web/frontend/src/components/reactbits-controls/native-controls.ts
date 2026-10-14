/** Native DOM adapters for React Bits Rubber Segment and Shredder.
 * Keep existing React/Astro ownership, form events and module persistence.
 * Motion constants and edge dilation follow the vendored upstream components.
 * See LICENSE.md for upstream attribution and license. */
import { animate, motionValue } from "motion";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const segments = new Map<
  HTMLElement,
  { update: () => void; destroy: () => void }
>();
const isTab = (node: Element) =>
  node instanceof HTMLButtonElement &&
  (node.getAttribute("role") === "tab" ||
    node.getAttribute("aria-current") === "page" ||
    (node.hasAttribute("aria-selected") &&
      node.getAttribute("role") !== "option" &&
      !node.closest('[role="listbox"]')) ||
    node.classList.contains("tab-btn") ||
    node.classList.contains("tab-button") ||
    [...node.attributes].some((a) => /^data-(?:[\w-]+-)?tab$/.test(a.name)));
function tabItems(group: HTMLElement): HTMLButtonElement[] {
  const all = [...group.querySelectorAll<HTMLButtonElement>("button")].filter(
    (b) => !b.disabled && b.getBoundingClientRect().width > 0,
  );
  return all.filter(
    (b) =>
      (b.closest('[role="tablist"], [data-rubber-tabs]') === group &&
        (isTab(b) || b.parentElement === group)) ||
      (b.parentElement === group &&
        (isTab(b) || group.hasAttribute("data-rubber-tabs"))),
  );
}
function attachSegment(group: HTMLElement) {
  if (segments.has(group)) return;
  const thumb = document.createElement("span");
  thumb.className = "lxp-rubber-thumb";
  thumb.setAttribute("aria-hidden", "true");
  group.dataset.rubberSegment = "";
  if (!group.hasAttribute("role")) group.dataset.rubberTabs = "";
  group.append(thumb);
  const l = motionValue(0),
    r = motionValue(0);
  let orientation = "horizontal",
    crossStart = 0,
    crossSize = 0,
    previous = "",
    timer: ReturnType<typeof setTimeout> | undefined;
  let active: HTMLButtonElement | undefined,
    generation = 0;
  const paint = () => {
    const start = l.get(),
      size = Math.max(0, r.get() - start);
    thumb.style.transform =
      orientation === "vertical"
        ? `translate(${crossStart}px,${start}px)`
        : `translate(${start}px,${crossStart}px)`;
    thumb.style.width = `${orientation === "vertical" ? crossSize : size}px`;
    thumb.style.height = `${orientation === "vertical" ? size : crossSize}px`;
  };
  const unsubL = l.on("change", paint),
    unsubR = r.on("change", paint);
  const selected = (b: HTMLButtonElement) => {
    if (
      b.getAttribute("aria-selected") === "true" ||
      (b.hasAttribute("aria-current") &&
        b.getAttribute("aria-current") !== "false") ||
      b.dataset.state === "active"
    )
      return 100;
    if (
      b.getAttribute("aria-selected") === "false" ||
      b.getAttribute("aria-current") === "false"
    )
      return 0;
    if (/(?:^|\s)bg-primary(?:\/\d+)?(?:\s|$)/.test(b.className)) return 30;
    if (/(?:^|\s)border-primary(?:\s|$)/.test(b.className)) return 20;
    if (/(?:^|\s)text-primary(?:\s|$)/.test(b.className)) return 10;
    if (/(?:^|\s)bg-background(?:\s|$)/.test(b.className)) return 5;
    return 0;
  };
  const update = () => {
    const items = tabItems(group);
    // Legacy tab renderers replace their children; restore only our inert thumb.
    if (thumb.parentElement !== group) group.append(thumb);
    if (!items.length) {
      if (!thumb.hidden) thumb.hidden = true;
      return;
    }
    if (thumb.hidden) thumb.hidden = false;
    const strongest = Math.max(...items.map(selected));
    active =
      (strongest ? items.find((b) => selected(b) === strongest) : undefined) ??
      items.find((b) => b.dataset.rubberActive === "true") ??
      items[0];
    items.forEach((b) => {
      if (!b.hasAttribute("data-rubber-item")) b.dataset.rubberItem = "";
      const v = String(b === active);
      if (b.dataset.rubberActive !== v) b.dataset.rubberActive = v;
    });
    const g = group.getBoundingClientRect(),
      a = active.getBoundingClientRect();
    orientation =
      group.getAttribute("aria-orientation") === "vertical" ||
      getComputedStyle(group).flexDirection === "column"
        ? "vertical"
        : "horizontal";
    if (group.dataset.rubberOrientation !== orientation)
      group.dataset.rubberOrientation = orientation;
    const vertical = orientation === "vertical";
    const start = vertical
      ? a.top - g.top + group.scrollTop
      : a.left - g.left + group.scrollLeft;
    const size = vertical ? a.height : a.width;
    crossStart = vertical ? a.left - g.left : a.top - g.top;
    crossSize = vertical ? a.width : a.height;
    const key = `${orientation}/${start}/${size}/${crossStart}/${crossSize}`;
    if (key === previous) return;
    const initial = !previous;
    previous = key;
    clearTimeout(timer);
    const gen = ++generation;
    if (initial || reduced()) {
      l.jump(start);
      r.jump(start + size);
      paint();
      return;
    }
    const fromL = l.get(),
      fromR = r.get(),
      dir = Math.sign(start - fromL) || 1;
    animate(l, Math.min(start, fromL), {
      duration: 0.19,
      ease: [0.23, 1, 0.32, 1],
    });
    animate(r, Math.max(start + size, fromR), {
      duration: 0.19,
      ease: [0.23, 1, 0.32, 1],
    });
    timer = setTimeout(() => {
      if (gen !== generation) return;
      const lead = dir > 0 ? r : l,
        trail = dir > 0 ? l : r;
      const leadTo = dir > 0 ? start + size : start,
        trailTo = dir > 0 ? start : start + size;
      animate(lead, leadTo, { type: "spring", duration: 0.3, bounce: 0 });
      animate(trail, trailTo + dir * 3, {
        type: "spring",
        duration: 0.3,
        bounce: 0,
      }).then(() => {
        if (gen === generation)
          animate(trail, trailTo, {
            type: "spring",
            duration: 0.16,
            bounce: 0,
          });
      });
    }, 150);
    paint();
  };
  const click = (e: Event) => {
    const button = (e.target as Element).closest("button");
    if (button && tabItems(group).includes(button))
      requestAnimationFrame(update);
  };
  const keydown = (e: KeyboardEvent) => {
    if (e.defaultPrevented) return;
    const items = tabItems(group),
      from = items.indexOf(e.target as HTMLButtonElement);
    if (from < 0 || e.altKey || e.ctrlKey || e.metaKey) return;
    const vertical =
      group.getAttribute("aria-orientation") === "vertical" ||
      getComputedStyle(group).flexDirection === "column";
    const delta =
      e.key === (vertical ? "ArrowDown" : "ArrowRight")
        ? 1
        : e.key === (vertical ? "ArrowUp" : "ArrowLeft")
          ? -1
          : 0;
    if (!delta && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const to =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? items.length - 1
          : (from + delta + items.length) % items.length;
    items[to].focus();
    items[to].click();
  };
  const observer = new ResizeObserver(update);
  observer.observe(group);
  let gesture: { id: number; x: number; y: number; live: boolean } | null =
    null;
  let suppressClick = false;
  const down = (e: PointerEvent) => {
    if (
      e.button !== 0 ||
      !(e.target as Element).closest("button") ||
      (e.pointerType === "touch" && orientation === "vertical")
    )
      return;
    gesture = { id: e.pointerId, x: e.clientX, y: e.clientY, live: false };
    (e.target as Element)
      .closest<HTMLButtonElement>("button")!
      .setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent) => {
    if (!gesture || gesture.id !== e.pointerId) return;
    const delta =
      orientation === "vertical"
        ? e.clientY - gesture.y
        : e.clientX - gesture.x;
    if (Math.abs(delta) < 10 && !gesture.live) return;
    gesture.live = true;
    e.preventDefault();
    clearTimeout(timer);
    generation++;
    l.stop();
    r.stop();
    const g = group.getBoundingClientRect(),
      point =
        orientation === "vertical"
          ? e.clientY - g.top + group.scrollTop
          : e.clientX - g.left + group.scrollLeft;
    const width = Math.max(0, r.get() - l.get());
    const size =
      orientation === "vertical" ? group.scrollHeight : group.scrollWidth;
    // The original component's rubber resistance at each edge.
    let start = point - width / 2;
    if (start < 0)
      start = (start * size * 0.55) / (size + 0.55 * Math.abs(start));
    if (start + width > size) {
      const over = start + width - size;
      start =
        size - width + (over * size * 0.55) / (size + 0.55 * Math.abs(over));
    }
    l.jump(start);
    r.jump(start + width);
  };
  const up = (e: PointerEvent) => {
    if (!gesture || gesture.id !== e.pointerId) return;
    const live = gesture.live;
    gesture = null;
    if (!live) return;
    suppressClick = true;
    previous = "";
    const point = orientation === "vertical" ? e.clientY : e.clientX;
    const items = tabItems(group);
    const nearest = items.reduce<HTMLButtonElement | undefined>((best, b) => {
      const r = b.getBoundingClientRect(),
        distance = Math.abs(
          (orientation === "vertical"
            ? r.top + r.height / 2
            : r.left + r.width / 2) - point,
        );
      if (!best) return b;
      const q = best.getBoundingClientRect();
      return distance <
        Math.abs(
          (orientation === "vertical"
            ? q.top + q.height / 2
            : q.left + q.width / 2) - point,
        )
        ? b
        : best;
    }, undefined);
    setTimeout(() => {
      suppressClick = false;
      if (e.type !== "pointercancel") nearest?.click();
      update();
    }, 0);
  };
  const captureClick = (e: Event) => {
    if (suppressClick) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  };
  group.addEventListener("click", click);
  group.addEventListener("keydown", keydown);
  group.addEventListener("pointerdown", down);
  group.addEventListener("pointermove", move, { passive: false });
  group.addEventListener("pointerup", up);
  group.addEventListener("pointercancel", up);
  group.addEventListener("click", captureClick, true);
  segments.set(group, {
    update,
    destroy() {
      generation++;
      clearTimeout(timer);
      l.stop();
      r.stop();
      unsubL();
      unsubR();
      observer.disconnect();
      group.removeEventListener("click", click);
      group.removeEventListener("keydown", keydown);
      thumb.remove();
      group.removeEventListener("pointerdown", down);
      group.removeEventListener("pointermove", move);
      group.removeEventListener("pointerup", up);
      group.removeEventListener("pointercancel", up);
      group.removeEventListener("click", captureClick, true);
    },
  });
  update();
}

/** Shredder's reorder-only interaction for existing module cards. */
const orderBindings = new WeakMap<
  HTMLElement,
  { onReorder: (sourceId: string, targetId: string) => void }
>();
export function bindShredderOrder(
  root: HTMLElement,
  onReorder: (sourceId: string, targetId: string) => void,
) {
  const previousBinding = orderBindings.get(root);
  if (previousBinding) {
    previousBinding.onReorder = onReorder;
    return;
  }
  const binding = { onReorder };
  orderBindings.set(root, binding);
  root.dataset.shredderOrder = "";
  const cards = () => [
    ...root.querySelectorAll<HTMLElement>(".mod-card[data-module-id]"),
  ];
  let drag: {
    card: HTMLElement;
    id: number;
    x: number;
    y: number;
    from: number;
    to: number;
    boxes: DOMRect[];
    items: HTMLElement[];
    moved: boolean;
    container: HTMLElement | null;
    scrollTop: number;
  } | null = null;
  let suppressClick = false;
  const reset = () => {
    cards().forEach((c) => {
      c.style.transform = "";
      c.style.transition = "";
      delete c.dataset.shredderDragging;
    });
  };
  root.addEventListener("pointerdown", (e) => {
    const handle = (e.target as Element).closest<HTMLButtonElement>(
      ".mod-drag-handle",
    );
    const card = handle?.closest<HTMLElement>(".mod-card");
    if (!card || handle?.disabled || e.button !== 0) return;
    const items = cards(),
      from = items.indexOf(card);
    const container = root.closest<HTMLElement>('[class*="overflow-y-auto"]');
    drag = {
      card,
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      from,
      to: from,
      boxes: items.map((c) => c.getBoundingClientRect()),
      items,
      moved: false,
      container,
      scrollTop: container?.scrollTop ?? 0,
    };
    card.draggable = false;
    handle!.setPointerCapture(e.pointerId);
  });
  root.addEventListener(
    "pointermove",
    (e) => {
      if (!drag || drag.id !== e.pointerId) return;
      const d = drag,
        dx = e.clientX - d.x,
        dy = e.clientY - d.y + (d.container?.scrollTop ?? 0) - d.scrollTop;
      if (Math.hypot(dx, dy) < 4 && !d.moved) return;
      d.moved = true;
      e.preventDefault();
      d.card.dataset.shredderDragging = "";
      d.card.style.transform = `translate(${dx}px,${dy}px) scale(1.01) rotate(${reduced() ? 0 : Math.max(-2, Math.min(2, dx / 50))}deg)`;
      const box = d.boxes[d.from],
        x = box.left + box.width / 2 + dx,
        y = box.top + box.height / 2 + dy;
      const distances = d.boxes.map((b) =>
        Math.hypot(b.left + b.width / 2 - x, b.top + b.height / 2 - y),
      );
      d.to = distances.indexOf(Math.min(...distances));
      const order = [...d.items];
      const [moved] = order.splice(d.from, 1);
      order.splice(d.to, 0, moved);
      order.forEach((c, i) => {
        if (c === d.card) return;
        const old = d.boxes[d.items.indexOf(c)],
          next = d.boxes[i];
        c.style.transition = reduced()
          ? "none"
          : "transform 200ms cubic-bezier(.23,1,.32,1)";
        c.style.transform = `translate(${next.left - old.left}px,${next.top - old.top}px)`;
      });
      const container = d.container;
      if (container) {
        const r = container.getBoundingClientRect();
        if (e.clientY < r.top + 40) container.scrollTop -= 10;
        else if (e.clientY > r.bottom - 40) container.scrollTop += 10;
      }
    },
    { passive: false },
  );
  const finish = (e: PointerEvent) => {
    if (!drag || drag.id !== e.pointerId) return;
    const d = drag;
    drag = null;
    reset();
    suppressClick = d.moved;
    setTimeout(() => (suppressClick = false), 0);
    if (e.type !== "pointercancel" && d.moved && d.from !== d.to)
      binding.onReorder(
        d.card.dataset.moduleId!,
        d.items[d.to].dataset.moduleId!,
      );
  };
  root.addEventListener("pointerup", finish);
  root.addEventListener("pointercancel", finish);
  root.addEventListener(
    "click",
    (e) => {
      if (suppressClick) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true,
  );
  root.addEventListener("keydown", (e) => {
    const handle = (e.target as Element).closest(".mod-drag-handle");
    if (
      !handle ||
      !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
    )
      return;
    e.preventDefault();
    const items = cards(),
      card = handle.closest<HTMLElement>(".mod-card")!,
      from = items.indexOf(card),
      to = from + (["ArrowUp", "ArrowLeft"].includes(e.key) ? -1 : 1);
    if (items[to]) {
      const id = card.dataset.moduleId!;
      binding.onReorder(id, items[to].dataset.moduleId!);
      cards()
        .find((c) => c.dataset.moduleId === id)
        ?.querySelector<HTMLButtonElement>(".mod-drag-handle")
        ?.focus();
    }
  });
}

let scheduled = false;
function scan() {
  scheduled = false;
  for (const [group, state] of segments) {
    if (!group.isConnected) {
      state.destroy();
      segments.delete(group);
    }
  }
  const groups = new Set(
    document.querySelectorAll<HTMLElement>(
      '[role="tablist"], [data-rubber-tabs]',
    ),
  );
  document
    .querySelectorAll<HTMLButtonElement>(
      'button[aria-current="page"], button[aria-selected], button[role="tab"], button.tab-btn, button.tab-button, button.cred-tab, button[data-tab], button[data-cred-tab], button[data-files-settings-tab], button[data-host-tab], button[data-lxp-settings-tab], button[data-mail-main-tab], button[data-obs-settings-tab], button[data-ps-tab], button[data-repo-settings-tab], button[data-report-subtab], button[data-role-tab], button[data-terminal-config-tab]',
    )
    .forEach((b) => {
      const owner = b.closest('[role="tablist"], [data-rubber-tabs]');
      if (owner && owner !== b.parentElement) return;
      if (
        b.parentElement &&
        b.parentElement.querySelectorAll("button").length > 1 &&
        (isTab(b) || b.classList.contains("cred-tab"))
      )
        groups.add(b.parentElement);
    });
  groups.forEach((g) => attachSegment(g));
  segments.forEach((s) => s.update());
}
function schedule() {
  if (!scheduled) {
    scheduled = true;
    requestAnimationFrame(scan);
  }
}
export function startNativeControls() {
  if (
    (window as Window & { __lxpReactBitsControls?: boolean })
      .__lxpReactBitsControls
  )
    return;
  (
    window as Window & { __lxpReactBitsControls?: boolean }
  ).__lxpReactBitsControls = true;
  const observer = new MutationObserver((records) => {
    if (
      records.some(
        (r) =>
          r.type === "childList" ||
          (r.type === "attributes" &&
            [
              "aria-selected",
              "aria-current",
              "data-state",
              "class",
              "hidden",
            ].includes(r.attributeName || "")),
      )
    )
      schedule();
  });
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: [
      "aria-selected",
      "aria-current",
      "data-state",
      "class",
      "hidden",
    ],
  });
  document.addEventListener("astro:page-load", schedule);
  window.addEventListener("resize", schedule);
  scan();
}
