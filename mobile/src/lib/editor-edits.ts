export type Range = { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number };
export function applyEditorEdit(content: string, edit: { mode: string; content: string; range?: Range }): string {
  if (edit.mode === "replaceAll") return edit.content;
  if (edit.mode !== "replaceRange" || !edit.range) throw new Error("La IA devolvió un cambio no válido.");
  const rows = content.split("\n"), range = edit.range;
  const offset = (line: number, column: number) => {
    if (!Number.isInteger(line) || line < 1 || line > rows.length || !Number.isInteger(column) || column < 1 || column > rows[line - 1].length + 1) throw new Error("El cambio apunta fuera del archivo.");
    return rows.slice(0, line - 1).reduce((sum, row) => sum + row.length + 1, 0) + column - 1;
  };
  const start = offset(range.startLineNumber, range.startColumn), end = offset(range.endLineNumber, range.endColumn);
  if (end < start) throw new Error("El rango del cambio no es válido.");
  return content.slice(0, start) + edit.content + content.slice(end);
}
