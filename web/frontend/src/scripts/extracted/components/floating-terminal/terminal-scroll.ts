/** Run after xterm's own wheel/touch handlers, including TUI mouse reporting.
 * xterm deliberately lets scrolling escape at buffer boundaries; a floating
 * terminal must keep it from reaching the page/chat behind it. */
export function containTerminalScroll(container: HTMLElement): void {
  const contain = (event: WheelEvent | TouchEvent) => {
    // Preserve browser zoom and multi-touch gestures.
    if ("ctrlKey" in event && event.ctrlKey) return;
    if ("touches" in event && event.touches.length !== 1) return;
    event.stopPropagation();
    if (event.cancelable) event.preventDefault();
  };
  container.addEventListener("wheel", contain, { passive: false });
  container.addEventListener("touchmove", contain, { passive: false });
}
