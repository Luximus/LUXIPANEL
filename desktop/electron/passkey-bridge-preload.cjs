// Minimal, deliberately tiny preload for the isolated passkey-ceremony window.
//
// This window loads REMOTE content (the https portal bridge page), so unlike
// the main preload it must expose the absolute minimum. The ONLY capability
// granted is reporting the ceremony result back to the main process. There is
// no HTTP proxy, no file access, and no auto-update bridge here — even a
// compromised portal origin can do nothing worse than report a (server-
// validated) result, which just makes the desktop re-fetch its passkey list.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("lpPasskeyBridge", {
  done: (payload) => ipcRenderer.send("passkey:bridge-done", payload),
});
