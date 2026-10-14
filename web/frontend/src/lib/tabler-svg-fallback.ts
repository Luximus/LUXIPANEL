import criticalIcons from "./tabler-svg-critical.json";

/** Class membership avoids a computed-style/layout read for every icon mutation. */
const critical = new Set(criticalIcons);
let loading = false;
function inspect(root: Element) {
  const icons = root.matches('.ti') ? [root] : root.querySelectorAll('.ti');
  for (const icon of icons) {
    const names = [...icon.classList].filter(name => name.startsWith('ti-'));
    if (!names.length || names.every(name => critical.has(name))) continue;
    if (loading) return;
    loading = true;
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = '/icons/tabler-svg-all.css';
    document.head.append(link);
    return;
  }
}
if (typeof document !== 'undefined') {
  const start = () => {
    inspect(document.body);
    new MutationObserver(records => {
      if (loading) return;
      for (const record of records) {
        if (record.type === 'attributes' && record.target instanceof Element && record.target.matches('.ti')) inspect(record.target);
        else if (record.type === 'childList') for (const node of record.addedNodes) if (node instanceof Element) inspect(node);
      }
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}
