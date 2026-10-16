// Move the original controls, preserving the server switcher's scope and all
// native listeners. Anchors restore their exact positions on desktop or swaps.
const root = document.documentElement;
const mobile = window.matchMedia('(max-width: 1024px)');
const viewport = window.visualViewport;
const homes = new Map();
const railHomes = new Map();
let swapping = false;
let scheduled = false;
let observedComposer = null;
let observedHeader = null;
const composerResize = new ResizeObserver(() => schedule());
const headerResize = new ResizeObserver(() => schedule());

function move(node, target, anchors = homes) {
  if (!node || !target || node.parentElement === target) return;
  if (!anchors.has(node)) {
    const anchor = document.createComment('chat-mobile-control');
    node.before(anchor);
    anchors.set(node, anchor);
  }
  target.append(node);
}

function restore() {
  for (const [node, anchor] of homes) {
    if (anchor.isConnected) anchor.replaceWith(node);
  }
  homes.clear();
  observedComposer?.style.removeProperty('--lxp-chat-input-max-height');
  composerResize.disconnect();
  observedComposer = null;
  headerResize.disconnect();
  observedHeader = null;
  root.style.removeProperty('--lxp-chat-header-height');
  root.removeAttribute('data-lxp-chat-mobile-layout');
}

function restoreRails() {
  for (const [node, anchor] of railHomes) {
    if (anchor.isConnected) anchor.replaceWith(node);
  }
  railHomes.clear();
  root.removeAttribute('data-lxp-mobile-rails');
}

function syncViewport(active) {
  if (!active || !viewport || Math.abs(viewport.scale - 1) > .05) {
    root.style.removeProperty('--lxp-chat-visible-bottom');
    root.style.removeProperty('--lxp-chat-viewport-inset');
    return;
  }
  const bottom = Math.round(viewport.height + viewport.offsetTop);
  const visibleBottom = `${bottom}px`;
  const inset = `${Math.max(0, window.innerHeight - bottom)}px`;
  if (root.style.getPropertyValue('--lxp-chat-visible-bottom') !== visibleBottom) root.style.setProperty('--lxp-chat-visible-bottom', visibleBottom);
  if (root.style.getPropertyValue('--lxp-chat-viewport-inset') !== inset) root.style.setProperty('--lxp-chat-viewport-inset', inset);
}

function arrange() {
  if (swapping) return;
  const mobileRails = mobile.matches && !root.classList.contains('lxp-webview') && !!document.querySelector('[data-workspace-shell]');
  if (mobileRails) {
    root.setAttribute('data-lxp-mobile-rails', '');
    const actions = document.getElementById('workspace-rail-header-actions');
    move(document.querySelector('#workspace-relocatable-footer .lxp-session-settings'), actions, railHomes);
    const logout = document.getElementById('logout-btn');
    if (logout && !logout.hasAttribute('aria-label')) {
      const label = logout.querySelector('span')?.textContent?.trim();
      if (label) { logout.setAttribute('aria-label', label); logout.setAttribute('title', label); }
    }
    move(logout, actions, railHomes);
  } else if (railHomes.size) restoreRails();
  const header = document.querySelector('[data-workspace-shell] [data-assistant-topbar]');
  const composer = [...document.querySelectorAll('.lxp-workspace-chat .lxp-chat-composer-navigation')]
    .find(node => node.parentElement.getBoundingClientRect().width > 0);
  const active = mobile.matches && !root.classList.contains('lxp-webview') && !!header && !!composer;
  syncViewport(active);
  if (!active) { if (homes.size) restore(); return; }
  if (!root.hasAttribute('data-lxp-chat-mobile-layout')) root.setAttribute('data-lxp-chat-mobile-layout', '');
  const servers = header.querySelector('#workspace-chat-server-controls');
  move(document.getElementById('server-switcher-wrap'), servers);
  move(document.getElementById('server-return-local'), servers);
  move(document.getElementById('workspace-chat-plus-control'), composer);
  move(document.getElementById('workspace-history-toggle'), composer);
  move(document.getElementById('workspace-chat-navbar-controls'), composer);
  move(document.getElementById('sidebar-toggle'), composer);
  if (observedHeader !== header) {
    headerResize.disconnect();
    observedHeader = header;
    headerResize.observe(header);
  }
  const headerHeight = `${Math.ceil(header.getBoundingClientRect().height)}px`;
  if (root.style.getPropertyValue('--lxp-chat-header-height') !== headerHeight) root.style.setProperty('--lxp-chat-header-height', headerHeight);
  const form = composer.parentElement;
  if (observedComposer !== form) {
    observedComposer?.style.removeProperty('--lxp-chat-input-max-height');
    composerResize.disconnect();
    observedComposer = form;
    composerResize.observe(form);
  }
  const input = form.querySelector('textarea');
  if (input) {
    const bottom = viewport && Math.abs(viewport.scale - 1) <= .05 ? viewport.height + viewport.offsetTop : window.innerHeight;
    const chrome = form.getBoundingClientRect().height - input.getBoundingClientRect().height;
    // The composer can also live in ChatTab's mobile portal slot.
    const pane = form.closest('[data-lxp-chat-empty]')
      ?? [...document.querySelectorAll('.lxp-workspace-chat [data-lxp-chat-empty]')].find(node => node.getBoundingClientRect().width > 0)
      ?? form.parentElement;
    const room = bottom - pane.getBoundingClientRect().top - chrome;
    const maxHeight = `${Math.max(24, Math.floor(Math.min(160, room)))}px`;
    if (form.style.getPropertyValue('--lxp-chat-input-max-height') !== maxHeight) {
      form.style.setProperty('--lxp-chat-input-max-height', maxHeight);
      if (document.activeElement === input && input.selectionEnd === input.value.length) input.scrollTop = input.scrollHeight;
    }
  }
}

function schedule() {
  if (scheduled || swapping) return;
  scheduled = true;
  requestAnimationFrame(() => { scheduled = false; arrange(); });
}

// React hydrates after the layout script and can change the active provider.
// Child mutations only: our own styles and attributes cannot loop this observer.
new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
viewport?.addEventListener('resize', schedule);
viewport?.addEventListener('scroll', schedule);
mobile.addEventListener('change', schedule);
window.addEventListener('resize', schedule);
document.addEventListener('astro:before-swap', () => { swapping = true; restore(); restoreRails(); });
document.addEventListener('astro:after-swap', () => { swapping = false; arrange(); });
document.addEventListener('astro:page-load', arrange);
arrange();
