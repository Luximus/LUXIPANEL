(() => {
  if (!window.__LUXIPANEL_MANAGED_BY_LICENSE_SERVER__) return;
  document.body.classList.add("is-managed-by-license");
  const HIDE_EXTRAS = [
    "s-layout-login-letter-glitch-speed",
    "s-layout-login-letter-glitch-characters",
    "s-layout-login-letter-glitch-center-vignette",
    "s-layout-login-letter-glitch-outer-vignette",
    "s-layout-login-letter-glitch-smooth",
    "s-layout-login-linewaves-speed",
    "s-layout-login-linewaves-inner-line-count",
    "s-layout-login-linewaves-outer-line-count",
    "s-layout-login-linewaves-warp-intensity",
    "s-layout-login-linewaves-rotation",
    "s-layout-login-linewaves-edge-fade-width",
    "s-layout-login-linewaves-color-cycle-speed",
    "s-layout-login-linewaves-brightness",
    "s-layout-login-linewaves-mouse-influence",
    "s-layout-login-linewaves-enable-mouse-interaction"
  ];
  for (const id of HIDE_EXTRAS) {
    const el = document.getElementById(id);
    const wrapper = el && (el.closest("div.space-y-1") || el.closest("label.inline-flex"));
    if (wrapper) wrapper.classList.add("simplify-hide-managed");
  }
})();
