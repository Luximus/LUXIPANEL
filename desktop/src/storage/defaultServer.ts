const KEY = "lp.desktop.default.server";

export async function saveDefaultServer(panelId: string) {
  localStorage.setItem(KEY, panelId);
}

export async function getDefaultServer() {
  return localStorage.getItem(KEY);
}
