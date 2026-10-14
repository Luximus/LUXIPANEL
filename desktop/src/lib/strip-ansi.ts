/**
 * Limpia secuencias de escape ANSI (colores/cursor) del output de consola, que
 * si no se ven como basura ("[36m", "[0m"). LUXIPANEL usa xterm en vivo; aquí,
 * en el cliente reducido, mostramos texto limpio en un <pre> tipo terminal.
 */
export function stripAnsi(s: string): string {
  const esc = String.fromCharCode(27);
  const csi = new RegExp(esc + "\\[[0-9;?]*[ -/]*[@-~]", "g");
  return s.replace(csi, "").split(esc).join("");
}
