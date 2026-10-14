const { contextBridge, ipcRenderer } = require("electron");
const invoke = channel => (...args) => ipcRenderer.invoke(`panel:${channel}`, ...args);
contextBridge.exposeInMainWorld("panelDesktop", {
  state: invoke("state"), language: invoke("language"), settings: invoke("settings"), hideSettings: invoke("hide-settings"),
  probe: invoke("probe"), save: invoke("save"), migrate: invoke("migrate"), remove: invoke("delete"),
  open: invoke("open"), activate: invoke("activate"), close: invoke("close"), reload: invoke("reload"), window: invoke("window"),
  subscribe: callback => { const listener = (_e, state) => callback(state); ipcRenderer.on("panel:state", listener); return () => ipcRenderer.removeListener("panel:state", listener); }
});
