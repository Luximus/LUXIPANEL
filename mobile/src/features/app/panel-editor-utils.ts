/** Sanitizadores de los campos del editor de panel, compartidos por el formulario
 *  (`PanelEditorPanel`) y las tarjetas editables del tab "Server" del drawer. */

/** Normaliza una IPv4 mientras se teclea: solo dígitos y puntos, máx 4 grupos de 3. */
export function sanitizeIp(value: string): string {
  const cleaned = value.replace(/[^\d.]/g, "");
  let result = "";
  let groupLen = 0;
  let dots = 0;
  for (const ch of cleaned) {
    if (ch === ".") {
      if (groupLen === 0 || dots >= 3) continue;
      result += ".";
      dots += 1;
      groupLen = 0;
      continue;
    }
    if (groupLen === 3) {
      if (dots >= 3) continue;
      result += ".";
      dots += 1;
      groupLen = 0;
    }
    result += ch;
    groupLen += 1;
  }
  return result;
}

/** Subdominio/nombre de panel: minúsculas, alfanumérico y guiones, máx 63. */
export function sanitizePanelName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 63);
}

/** Puerto: solo dígitos, máx 5. */
export function sanitizePort(value: string): string {
  return value.replace(/[^\d]/g, "").slice(0, 5);
}
