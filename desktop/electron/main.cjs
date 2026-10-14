const { app, BrowserWindow, WebContentsView, ipcMain, shell, dialog, session, Tray, Menu } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { randomUUID } = require("node:crypto");
const { panelOrigin, partitionFor, samePanel, browserUA } = require("./panel-policy.cjs");
const messages = require("./connections.json");
const text = () => messages[store?.language] || messages.en;
const isDev = !app.isPackaged;
let win, overlay, tray, activeTab, store;
const views = new Map();
const trusted = new Set();
const file = () => path.join(app.getPath("userData"), "panel-connections.json");
function load() {
  try { store = JSON.parse(fs.readFileSync(file(), "utf8")); } catch { store = { profiles: [], tabs: [], activeTab: null }; }
  store.language = messages[store.language] ? store.language : (messages[app.getLocale().split("-")[0]] ? app.getLocale().split("-")[0] : "en");
  store.profiles = (store.profiles || []).filter(p => { try { return typeof p.id === "string" && panelOrigin(p.baseUrl) === p.baseUrl; } catch { return false; } });
  store.tabs = (store.tabs || []).filter(t => store.profiles.some(p => p.id === t.profileId));
  activeTab = store.tabs.find(t => t.id === store.activeTab)?.id || store.tabs[0]?.id;
}
function save() {
  store.activeTab = activeTab || null;
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  fs.writeFileSync(`${file()}.tmp`, JSON.stringify(store), { mode: 0o600 });
  fs.renameSync(`${file()}.tmp`, file());
  broadcast();
}
function snapshot() { return { ...store, activeTab, tabs: store.tabs.map(t => ({ ...t, error: views.get(t.id)?.error || "", loading: views.get(t.id)?.loading || false })) }; }
function broadcast() { for (const wc of trusted) if (!wc.isDestroyed()) wc.send("panel:state", snapshot()); }
function localPage(wc, surface) {
  if (isDev) return wc.loadURL(`http://localhost:5180/?surface=${surface}`);
  return wc.loadFile(path.join(__dirname, "..", "dist/index.html"), { query: { surface } });
}
function localView(wc) {
  trusted.add(wc);
  wc.on("destroyed", () => trusted.delete(wc));
  wc.on("will-navigate", event => event.preventDefault());
  wc.setWindowOpenHandler(() => ({ action: "deny" }));
}
function layout() {
  if (!win || win.isDestroyed()) return;
  const [width, height] = win.getContentSize();
  for (const [id, entry] of views) {
    entry.view.setVisible(id === activeTab);
    if (id === activeTab) entry.view.setBounds({ x: 0, y: 44, width, height: Math.max(0, height - 44) });
  }
  if (overlay) overlay.setBounds({ x: 0, y: 44, width, height: Math.max(0, height - 44) });
}
function hideOverlay() { if (overlay) { overlay.setVisible(false); views.get(activeTab)?.view.webContents.focus(); } }
function showOverlay() {
  if (!overlay) {
    overlay = new WebContentsView({ webPreferences: { preload: path.join(__dirname, "panel-preload.cjs"), contextIsolation: true, nodeIntegration: false, sandbox: true } });
    overlay.setBackgroundColor("#00000000");
    localView(overlay.webContents);
    win.contentView.addChildView(overlay);
    void localPage(overlay.webContents, "settings");
  } else { win.contentView.removeChildView(overlay); win.contentView.addChildView(overlay); }
  overlay.setVisible(true); layout(); overlay.webContents.focus();
}
function destroyTab(id) {
  const entry = views.get(id);
  if (entry) { win.contentView.removeChildView(entry.view); entry.view.webContents.close(); views.delete(id); }
}
const configuredSessions = new Set();
function configureSession(ses, profile) {
  if (configuredSessions.has(ses)) return;
  configuredSessions.add(ses);
  const allowed = (wc, url) => [...views.values()].some(v => v.view.webContents === wc && v.profileId === profile.id) && samePanel(url, profile.baseUrl);
  ses.setPermissionCheckHandler((wc, permission, origin) => allowed(wc, origin) && ["media", "notifications", "clipboard-sanitized-write"].includes(permission));
  ses.setPermissionRequestHandler(async (wc, permission, cb, details) => {
    if (!allowed(wc, details.requestingUrl) || !["media", "notifications"].includes(permission) || (permission === "media" && details.mediaTypes?.includes("video"))) return cb(false);
    const choice = await dialog.showMessageBox(win, { type: "question", title: "LUXIPANEL", message: `${profile.name} ${permission === "media" ? text().permissionMic : text().permissionNotifications}`, buttons: [text().allow, text().cancel], defaultId: 1, cancelId: 1 });
    cb(choice.response === 0);
  });
  ses.on("will-download", (_event, item) => {
    item.setSaveDialogOptions({ defaultPath: path.join(app.getPath("downloads"), path.basename(item.getFilename())) });
  });
}
function makeView(tab) {
  const profile = store.profiles.find(p => p.id === tab.profileId);
  if (!profile) return;
  const ses = session.fromPartition(partitionFor(profile.id));
  const view = new WebContentsView({ webPreferences: { session: ses, contextIsolation: true, nodeIntegration: false, sandbox: true, webviewTag: false } });
  const entry = { view, profileId: profile.id, error: "", loading: true }; views.set(tab.id, entry);
  configureSession(ses, profile);
  view.webContents.setUserAgent(browserUA(view.webContents.getUserAgent()));
  view.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) void shell.openExternal(url); return { action: "deny" }; });
  const navigate = (event, url) => { if (!samePanel(url, profile.baseUrl)) { event.preventDefault(); if (/^https?:/.test(url)) void shell.openExternal(url); } };
  view.webContents.on("will-navigate", navigate); view.webContents.on("will-redirect", navigate);
  view.webContents.on("will-attach-webview", event => event.preventDefault());
  view.webContents.on("did-start-loading", () => { entry.loading = true; entry.error = ""; broadcast(); });
  view.webContents.on("did-stop-loading", () => { entry.loading = false; broadcast(); });
  view.webContents.on("did-fail-load", (_e, code, message, _url, main) => { if (main && code !== -3) { entry.error = message; entry.loading = false; broadcast(); } });
  view.webContents.on("render-process-gone", () => { entry.error = text().reload; broadcast(); });
  view.webContents.on("before-input-event", (event, input) => {
    if ((input.control || input.meta) && input.type === "keyDown") {
      if (input.key.toLowerCase() === ",") { event.preventDefault(); showOverlay(); }
      if (input.key.toLowerCase() === "r") { event.preventDefault(); view.webContents.reload(); }
    }
  });
  win.contentView.addChildView(view);
  if (overlay) { win.contentView.removeChildView(overlay); win.contentView.addChildView(overlay); }
  layout();
  void view.webContents.loadURL(`${profile.baseUrl}/login`).catch(() => {});
}
function open(profileId) {
  if (!store.profiles.some(p => p.id === profileId)) throw new Error("Panel desconocido.");
  const tab = { id: randomUUID(), profileId }; store.tabs.push(tab); activeTab = tab.id;
  makeView(tab); hideOverlay(); layout(); save();
}
function handle(channel, action) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (!trusted.has(event.sender) || event.senderFrame !== event.sender.mainFrame) throw new Error("Invalid sender");
    return action(...args);
  });
}
handle("panel:state", () => snapshot());
handle("panel:language", language => { if (messages[language]) { store.language = language; save(); } });
handle("panel:settings", showOverlay);
handle("panel:hide-settings", hideOverlay);
handle("panel:probe", async input => {
  const origin = panelOrigin(input);
  const response = await fetch(`${origin}/api/auth/login-methods`, { signal: AbortSignal.timeout(15000), redirect: "error" });
  const data = await response.json();
  if (!response.ok || data.ok !== true || typeof data.data?.password !== "boolean") throw new Error("Esta dirección no responde como un servidor LUXIPANEL.");
  return { baseUrl: origin, methods: data.data };
});
handle("panel:save", async input => {
  const baseUrl = panelOrigin(input.baseUrl);
  let profile = store.profiles.find(p => p.id === input.id);
  if (profile && profile.baseUrl !== baseUrl) {
    for (const tab of store.tabs.filter(t => t.profileId === profile.id)) destroyTab(tab.id);
    store.tabs = store.tabs.filter(t => t.profileId !== profile.id);
    await session.fromPartition(partitionFor(profile.id)).clearStorageData();
    if (!store.tabs.some(t => t.id === activeTab)) activeTab = store.tabs[0]?.id;
    // A changed origin gets a new partition and never inherits cookies/permissions.
    store.profiles = store.profiles.filter(p => p.id !== profile.id); profile = null;
  }
  if (!profile) { profile = { id: randomUUID(), baseUrl, name: "" }; store.profiles.push(profile); }
  profile.name = String(input.name || "").trim().slice(0, 80) || new URL(baseUrl).host;
  save(); return profile;
});
handle("panel:migrate", candidates => {
  if (store.profiles.length || !Array.isArray(candidates)) return snapshot();
  for (const candidate of candidates.slice(0, 100)) {
    try { store.profiles.push({ id: randomUUID(), name: String(candidate.name || candidate.baseUrl).slice(0,80), baseUrl: panelOrigin(candidate.baseUrl) }); } catch { /* invalid legacy profile */ }
  }
  save(); return snapshot();
});
handle("panel:delete", async id => {
  for (const tab of store.tabs.filter(t => t.profileId === id)) destroyTab(tab.id);
  store.tabs = store.tabs.filter(t => t.profileId !== id); store.profiles = store.profiles.filter(p => p.id !== id);
  await session.fromPartition(partitionFor(id)).clearStorageData();
  if (!store.tabs.some(t => t.id === activeTab)) activeTab = store.tabs[0]?.id;
  layout(); save();
});
handle("panel:open", open);
handle("panel:activate", id => { if (!store.tabs.some(t => t.id === id)) return; activeTab = id; hideOverlay(); layout(); save(); views.get(id)?.view.webContents.focus(); });
handle("panel:close", id => { destroyTab(id); store.tabs = store.tabs.filter(t => t.id !== id); if (activeTab === id) activeTab = store.tabs[0]?.id; layout(); save(); });
handle("panel:reload", () => views.get(activeTab)?.view.webContents.reload());
handle("panel:window", action => { if (action === "minimize") win.minimize(); if (action === "maximize") win.isMaximized() ? win.unmaximize() : win.maximize(); if (action === "close") win.close(); });
app.setAppUserModelId("com.luxisoft.lplicenseserver.desktop");
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => { if (win) { win.show(); win.focus(); } });
  app.whenReady().then(() => {
    load();
    win = new BrowserWindow({ width: 1360, height: 860, minWidth: 760, minHeight: 560, frame: false, title: "LUXIPANEL", backgroundColor: "#151c2c", icon: path.join(__dirname, "../public/icon.png"), webPreferences: { preload: path.join(__dirname, "panel-preload.cjs"), contextIsolation: true, nodeIntegration: false, sandbox: true } });
    localView(win.webContents); void localPage(win.webContents, "shell");
    win.on("resize", layout);
    win.on("close", e => { if (!app.isQuitting && process.platform !== "darwin") { e.preventDefault(); win.hide(); } });
    win.on("closed", () => { for (const entry of views.values()) entry.view.webContents.close(); views.clear(); overlay?.webContents.close(); overlay = null; win = null; });
    for (const tab of store.tabs) makeView(tab);
    layout();
    try {
      tray = new Tray(path.join(__dirname, "../public/icon.png")); tray.setToolTip("LUXIPANEL");
      tray.setContextMenu(Menu.buildFromTemplate([{ label: text().open, click: () => win?.show() }, { label: text().quit, click: () => { app.isQuitting = true; app.quit(); } }]));
      tray.on("double-click", () => win?.show());
    } catch { /* Some Linux desktops do not provide a tray. */ }
  });
}
app.on("before-quit", () => { app.isQuitting = true; });
app.on("window-all-closed", () => app.quit());
