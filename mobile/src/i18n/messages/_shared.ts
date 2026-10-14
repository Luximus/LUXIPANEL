// Recursively widens literal string types to `string` so consumers see
// `string`, not the Spanish literal. Shared by every per-screen module.
export type Widen<T> = T extends string
  ? string
  : { -readonly [K in keyof T]: Widen<T[K]> };
