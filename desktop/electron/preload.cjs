const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronApi", {
  platform: process.platform,
  chatStream: (payload) => ipcRenderer.invoke("chat:stream", payload),
  stopChatStream: (id) => ipcRenderer.invoke("chat:stop", id),
  onChatStream: (callback) => { const listener = (_event,data) => callback(data); ipcRenderer.on("chat:chunk",listener); return () => ipcRenderer.removeListener("chat:chunk",listener); },
  request: (payload) => ipcRenderer.invoke("http:request", payload),
  // Como `request`, pero además devuelve `cookies` (blob Set-Cookie de la
  // respuesta). Necesario para el login DIRECTO a un box standalone
  // (`src/api/directAuth.ts`): capturar CSRF + JWT del handshake del panel.
  requestWithCookies: (payload) => ipcRenderer.invoke("http:request-cookies", payload),
  downloadBinary: (payload) => ipcRenderer.invoke("http:download-binary", payload),
  uploadBinary: (payload) => ipcRenderer.invoke("http:upload-binary", payload),
  // Cifrado en reposo con el keychain del SO (safeStorage). Lo usa el almacén de
  // servidores standalone para no dejar JWT/CSRF ni contraseña en claro.
  secureAvailable: () => ipcRenderer.invoke("secure:available"),
  secureEncrypt: (payload) => ipcRenderer.invoke("secure:encrypt", payload),
  secureDecrypt: (payload) => ipcRenderer.invoke("secure:decrypt", payload),
  setTitle: (title) => ipcRenderer.invoke("app:set-title", title),
  minimizeWindow: () => ipcRenderer.invoke("window:minimize"),
  toggleMaximizeWindow: () => ipcRenderer.invoke("window:toggle-maximize"),
  closeWindow: () => ipcRenderer.invoke("window:close"),
  openExternal: (url) => ipcRenderer.invoke("app:open-external", url),
  pickKeyFile: () => ipcRenderer.invoke("ssh:pick-key-file"),
  registerPasskey: (payload) => ipcRenderer.invoke("passkey:register", payload),
  authenticatePasskey: (payload) => ipcRenderer.invoke("passkey:authenticate", payload),
  stepUpPasskey: (payload) => ipcRenderer.invoke("passkey:step-up", payload),
  notify: (payload) => ipcRenderer.invoke("notify", payload),
  getAppVersion: () => ipcRenderer.invoke("app:get-version"),
  getAppPlatform: () => ipcRenderer.invoke("app:get-platform"),
  downloadUpdate: (payload) => ipcRenderer.invoke("update:download", payload),
  installUpdate: (payload) => ipcRenderer.invoke("update:install", payload),
  onUpdateProgress: (cb) => {
    const listener = (_event, data) => cb(data);
    ipcRenderer.on("update:progress", listener);
    return () => ipcRenderer.removeListener("update:progress", listener);
  },
  // Incoming luxipanel:// deep links (panel-share invitations) from the OS.
  onDeeplink: (cb) => {
    const listener = (_event, url) => cb(url);
    ipcRenderer.on("deeplink", listener);
    return () => ipcRenderer.removeListener("deeplink", listener);
  },
});
