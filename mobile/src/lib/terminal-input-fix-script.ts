// Corrige el TECLEO CORRUPTO del terminal del panel dentro del WebView (pulsar una tecla
// 2+ veces para que escriba, Enter ejecuta doble, letras repetidas). CAUSA RAÍZ (en
// LUXIPANEL): `floating-terminal.ts` registra `term.onData(...)` DENTRO de `connectWs()` y
// DESCARTA el `IDisposable`, así que cada reconexión APILA otro handler de entrada. Las
// reconexiones las dispara el wake de `AppState` al volver la app a primer plano
// (`handleWake` atado a focus/pageshow/online). Tras N reconexiones, una sola tecla se
// envía N veces al PTY. LUXIPANEL corre en servidores de cliente (no se puede redeployar
// desde aquí), así que se corrige DEFENSIVAMENTE desde el WebView, con dos defensas
// independientes:
//   (1) Parche de CAUSA: `Terminal.prototype.onData` se envuelve para que cada terminal
//       mantenga UN solo handler (dispone el anterior antes de añadir el nuevo). Esto
//       también arregla Ctrl+L (con varios handlers el 2º mandaba la letra cruda).
//   (2) Red de seguridad a nivel WebSocket: si el MISMO frame `{type:"input",...}` se manda
//       2+ veces en el mismo tick síncrono (los N handlers disparan síncronos), deja pasar
//       solo el 1º. No afecta tecleo real ni frames distintos.
//
// CÓMO ALCANZA (1) EL `Terminal.prototype` REAL DE LA PÁGINA — SIN CDN:
// Antes este parche hacía `import('https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/+esm')`
// y confiaba en que los módulos ES son singleton por URL (LUXIPANEL importa xterm de esa
// MISMA URL, así que el re-import devolvía la MISMA clase). La política del proyecto
// prohíbe dependencias de CDN, y OJO: empaquetar xterm localmente (blob URL / asset) NO
// sirve — sería OTRA instancia del módulo con OTRO `Terminal.prototype`, y parchearlo sería
// un no-op sobre los terminales de la página. En su lugar se captura la PRIMERA instancia
// real que construye la página y se parchea SU prototype:
//   - El constructor del `Terminal` público de xterm 5.5.0 hace una asignación plana
//     `this._core = this.register(new TerminalCore(...))` (verificado en el bundle +esm de
//     jsdelivr: `class h extends Disposable{constructor(s){super(),this._core=...`; esbuild
//     minifica pero NO mangla nombres de propiedad, así que `_core` se conserva).
//   - Un setter-trampa `configurable` en `Object.prototype._core` se dispara DENTRO de ese
//     constructor con `this` = el Terminal público recién creado. De ahí,
//     `Object.getPrototypeOf(instancia)` ES el prototype real que usa la página, venga el
//     módulo de donde venga (CDN, bundle propio del panel, otra copia). Se parchea `onData`
//     ahí y la trampa SE RETIRA (delete) para no dejar pollution en `Object.prototype`.
//   - Falsos positivos: otras clases de xterm (BufferNamespaceApi/ParserApi/UnicodeApi) y
//     cualquier objeto ajeno también asignan `_core`; se filtran exigiendo que el prototype
//     tenga `open`/`write` (funciones) y un descriptor propio `onData` — solo el Terminal
//     público cumple las tres. Para esos objetos la trampa replica la asignación normal
//     (own property) y no toca nada más.
//   - Orden: se inyecta en `injectedJavaScriptBeforeContentLoaded` (antes de que corra
//     cualquier script del panel y de que exista ningún Terminal) y se reintenta en
//     `markWebViewComponentReady`; idempotente por documento (`__lxpTermInputFix`). El
//     terminal flotante del panel se crea bajo demanda (al abrirlo el usuario), siempre
//     después de nuestra inyección, así que la trampa lo ve nacer. Si aun así un Terminal
//     naciera antes que la trampa, la defensa (2) sigue cubriendo el síntoma.
// El resultado NO hace ninguna petición de red (ni a jsdelivr ni a ningún otro dominio).
export function buildTerminalInputFixScript(): string {
  return `(function(){
    if (window.__lxpTermInputFix) return; window.__lxpTermInputFix = true;
    // (2) Red de seguridad a nivel WebSocket: descarta el MISMO frame {type:"input"} enviado
    // 2+ veces en el MISMO tick SÍNCRONO. Los N handlers apilados disparan JUNTOS en un solo
    // emit de onData (bucle síncrono), así que sus envíos caen en el mismo tick; la marca por
    // socket se limpia en el siguiente microtask. CLAVE: NO usar ventana por tiempo — eso
    // descartaba letras repetidas LEGÍTIMAS (swipe-typing, ráfagas del IME, doble espacio) que
    // van en ticks distintos y "se comía letras". El mismo-tick no tiene ese falso positivo.
    try {
      var WS = window.WebSocket;
      if (WS && WS.prototype && !WS.prototype.__lxpDedup) {
        var origSend = WS.prototype.send;
        WS.prototype.send = function(d){
          try {
            if (typeof d === 'string' && d.indexOf('"input"') >= 0) {
              var tf = this.__lxpTickFrames;
              if (!tf) { tf = this.__lxpTickFrames = Object.create(null); var self = this; Promise.resolve().then(function(){ self.__lxpTickFrames = null; }); }
              if (tf[d]) return;
              tf[d] = true;
            }
          } catch(e){}
          return origSend.apply(this, arguments);
        };
        WS.prototype.__lxpDedup = true;
      }
    } catch(e){}
    // (1) Parche de causa: un solo onData por terminal. Maneja onData como getter (IEvent) o
    // como método, según cómo exponga xterm la API. Sin CDN: setter-trampa en
    // Object.prototype._core que captura la primera instancia real de Terminal que construye
    // la página y parchea SU prototype (ver comentario de cabecera del módulo).
    try {
      var patchXtermProto = function(proto){
        try {
          if (!proto || proto === Object.prototype || proto.__lxpOnDataPatched) return false;
          if (typeof proto.open !== 'function' || typeof proto.write !== 'function') return false;
          var dd = Object.getOwnPropertyDescriptor(proto, 'onData');
          if (!dd) return false;
          proto.__lxpOnDataPatched = true;
          if (dd.get) {
            var origGet = dd.get;
            Object.defineProperty(proto, 'onData', { configurable: true, get: function(){
              var self = this; var registrar = origGet.call(self);
              return function(listener){
                try { if (self.__lxpDataDisp && self.__lxpDataDisp.dispose) self.__lxpDataDisp.dispose(); } catch(e){}
                var disp = registrar.call(self, listener);
                try { self.__lxpDataDisp = disp; } catch(e){}
                return disp;
              };
            } });
            return true;
          }
          if (typeof dd.value === 'function') {
            var origFn = dd.value;
            Object.defineProperty(proto, 'onData', { configurable: true, writable: true, value: function(listener){
              try { if (this.__lxpDataDisp && this.__lxpDataDisp.dispose) this.__lxpDataDisp.dispose(); } catch(e){}
              var disp = origFn.call(this, listener);
              try { this.__lxpDataDisp = disp; } catch(e){}
              return disp;
            } });
            return true;
          }
          return false;
        } catch(e){ return false; }
      };
      if (!Object.getOwnPropertyDescriptor(Object.prototype, '_core')) {
        Object.defineProperty(Object.prototype, '_core', {
          configurable: true,
          set: function(v){
            // Replica la asignación normal (own property escribible/enumerable) para que el
            // resto de la página no note la trampa.
            try { Object.defineProperty(this, '_core', { value: v, writable: true, configurable: true, enumerable: true }); } catch(e){}
            try {
              if (patchXtermProto(Object.getPrototypeOf(this))) { delete Object.prototype._core; }
            } catch(e){}
          }
        });
      }
    } catch(e){}
  })(); true;`;
}
