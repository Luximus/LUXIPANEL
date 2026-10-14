/**
 * Builders de JavaScript que se INYECTAN en el WebView de LUXIPANEL (`SshScreen`)
 * para controlarlo desde la app nativa SIN abrir otra webview ni rehacer SSO:
 *  - Navegación SPA entre vistas del MISMO panel (reutiliza el ClientRouter de Astro):
 *    módulos (`/panel/<route>`) y las herramientas con vista dedicada (`/assistant`,
 *    `/terminal` — ver `buildToolNextPath`).
 *
 * Devuelven el script CRUDO (sin `; true;`): cada quien lo añade al inyectar
 * (`SshScreen.injectIntoWebView` ya lo hace; el inyector genérico de `MainScreen`
 * usa el helper `injectModuleScript`). Comparten origen con `SshScreen.runAutoOpen`.
 */

/**
 * Navegación SPA del panel a `path` (p. ej. `/panel/files`). Crea un `<a href>` y
 * le hace `.click()`: el ClientRouter de LUXIPANEL (Astro) lo intercepta y hace la
 * transición suave (sin recarga ni re-SSO).
 *
 * GARANTÍA DE ATERRIZAJE: si por lo que sea el click NO navega (el ClientRouter no
 * lo intercepta, otra vista del panel se traga el click, o la transición se cancela),
 * la URL se quedaría igual y el módulo destino nunca cargaría → el usuario se queda
 * en la vista anterior (p. ej. tocar "Cron" con Obsidian abierto seguía mostrando
 * Obsidian). Por eso, tras intentar la navegación suave, si `astro:after-swap` no nos
 * llevó a `path`, forzamos una navegación DURA (`location.assign`) dentro de la misma
 * webview autenticada (no abre webview nueva). Solo se dispara si la suave no ocurrió,
 * así que no añade recargas cuando el ClientRouter sí funcionó.
 */
export function buildSpaNavigateScript(path: string): string {
  const p = JSON.stringify(path);
  return `(function(){try{var p=${p};` +
    `if(location.pathname===p){return}` +
    `var done=false;` +
    `function onSwap(){if(location.pathname===p){done=true;document.removeEventListener('astro:after-swap',onSwap);}}` +
    `document.addEventListener('astro:after-swap',onSwap);` +
    `var a=document.createElement('a');a.href=p;a.style.display='none';` +
    `document.body.appendChild(a);a.click();` +
    `setTimeout(function(){try{a.remove()}catch(e){}},120);` +
    `setTimeout(function(){try{document.removeEventListener('astro:after-swap',onSwap);` +
    `if(!done&&location.pathname!==p){location.assign(p);}}catch(e){}},900)}catch(e){}})()`;
}
