/** Astro waits for inline modules by appending an empty data: script. The
 * panel's CSP intentionally permits only same-origin scripts. A final external
 * module supplies that execution barrier without relaxing the script policy.
 * Keep this regression covered by the login -> panel browser smoke test. */
document.addEventListener("astro:before-swap", (event) => {
  const doc = (event as Event & {newDocument: Document}).newDocument;
  const barrier = doc.createElement("script");
  barrier.type = "module";
  barrier.setAttribute("data-astro-rerun", "");
  barrier.src = "/scripts/extracted/lib/spa-ready.js";
  doc.body.appendChild(barrier);
});
