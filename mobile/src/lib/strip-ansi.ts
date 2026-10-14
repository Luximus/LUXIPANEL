/**
 * Limpia secuencias de escape ANSI (colores, cursor, OSC) del output de
 * consola que llega por los tools del asistente del servidor. Sin esto se
 * ven como basura ("[36m", "[0m") en los bloques de terminal. Patrón
 * equivalente al del paquete `ansi-regex` (OSC no-greedy hasta BEL/ST + CSI),
 * sin dependencias.
 */
const ANSI_RE = new RegExp(
  [
    // OSC: ESC ] … terminado por BEL, ESC \ o ST (títulos, hyperlinks…).
    "\\u001B\\][\\s\\S]*?(?:\\u0007|\\u001B\\u005C|\\u009C)",
    // CSI y secuencias de un solo byte: ESC [ params letra (SGR, cursor, borrado…).
    "[\\u001B\\u009B][[\\]()#;?]*(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]",
  ].join("|"),
  "g",
);

export function stripAnsi(input: string): string {
  if (!input) return input;
  return input.replace(ANSI_RE, "");
}
