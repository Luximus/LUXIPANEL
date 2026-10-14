// ── Language tab switcher ──────────────────────────────────────
const tabs    = document.querySelectorAll<HTMLButtonElement>('.example-tab');
const panels  = {
  curl:   document.getElementById('ex-curl')!,
  nodejs: document.getElementById('ex-nodejs')!,
  php:    document.getElementById('ex-php')!,
};

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const lang = tab.dataset['lang'] as keyof typeof panels;
    tabs.forEach(t => {
      t.classList.toggle('border-primary', t === tab);
      t.classList.toggle('text-primary',   t === tab);
      t.classList.toggle('border-transparent', t !== tab);
      t.classList.toggle('text-muted-foreground', t !== tab);
    });
    Object.entries(panels).forEach(([key, el]) => {
      el.classList.toggle('hidden', key !== lang);
    });
  });
});

// Marca este fichero como MÓDULO para TypeScript. Sin `export`/`import`, tsc lo
// trata como script en ámbito GLOBAL, y entonces sus `const` de nivel superior
// (setupTabs, sidebarInstances, tabs…) chocan con las homónimas de los demás
// scripts extraídos (TS2451). En runtime no hay colisión: se compilan a ESM
// (`format: "esm"` en build-extracted.mjs) y se cargan con `import`, así que cada
// uno ya tiene su propio ámbito. Esto solo alinea la vista de tsc con la realidad;
// en ESM es un no-op.
export {};
