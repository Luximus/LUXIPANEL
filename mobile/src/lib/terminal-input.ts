/** VT keyboard encoding shared by every native terminal surface. */
export function terminalKey(key: string, applicationCursor: boolean, ctrl = false, alt = false): string {
  const finals: Record<string, string> = { up: "A", down: "B", right: "C", left: "D", home: "H", end: "F" };
  let result = "";
  if (finals[key]) result = ctrl || alt ? `\x1b[1;${1 + (alt ? 2 : 0) + (ctrl ? 4 : 0)}${finals[key]}` : `\x1b${applicationCursor ? "O" : "["}${finals[key]}`;
  else if (key === "pgup" || key === "pgdn") result = `\x1b[${key === "pgup" ? 5 : 6}${ctrl || alt ? `;${1 + (alt ? 2 : 0) + (ctrl ? 4 : 0)}` : ""}~`;
  else result = ({ esc: "\x1b", tab: "\t", enter: "\r", backspace: "\x7f", ctrlc: "\x03" } as Record<string, string>)[key] ?? key;
  return result;
}
export function terminalPaste(text: string, bracketed: boolean): string {
  const normalized = text.replace(/\r\n|\n/g, "\r");
  return bracketed ? `\x1b[200~${normalized}\x1b[201~` : normalized;
}
