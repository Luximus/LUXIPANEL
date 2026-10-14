// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type esDefault from "./es-aggregate.generated";

// Maps the const-asserted Spanish source shape onto plain (mutable) string
// values, so each translation file is a structural mirror with the same keys.
type Translatable<T> = T extends readonly (infer U)[]
  ? readonly Translatable<U>[]
  : T extends object
    ? { [K in keyof T]: Translatable<T[K]> }
    : T extends string
      ? string
      : T;

export type Messages = Translatable<typeof esDefault>;
