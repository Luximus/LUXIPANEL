const { createHash } = require("node:crypto");
function panelOrigin(input) {
  const raw = String(input || "").trim();
  if (!raw) throw new Error("Introduce la URL de LUXIPANEL.");
  const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || !["/", "/api", "/login"].includes(url.pathname.replace(/\/$/, "") || "/")) throw new Error("Usa el dominio o IP y puerto del panel, sin credenciales ni rutas.");
  return url.origin;
}
const partitionFor = id => `persist:luxipanel-${createHash("sha256").update(id).digest("hex")}`;
const samePanel = (url, origin) => { try { return new URL(url).origin === origin; } catch { return false; } };
const browserUA = ua => ua.replace(/\sElectron\/[^\s]+/gi, "").replace(/\s(?:desktop|LP-LICENSE-SERVER|LUXIPANEL)\/[^\s]+/gi, "");
module.exports = { panelOrigin, partitionFor, samePanel, browserUA };
