export function compareVersions(a: string, b: string): number {
  const parse = (value: string) => value.match(/^v?(\d+)\.(\d+)\.(\d+)$/)?.slice(1).map(Number);
  const x = parse(a); const y = parse(b); if (!x || !y) return 0;
  for (let i = 0; i < 3; i++) { if (x[i] !== y[i]) return x[i]! - y[i]!; } return 0;
}
