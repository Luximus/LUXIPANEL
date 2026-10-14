// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it } from "vitest";
import { sdkRangeSupported } from "./sdk-range.js";
describe("SDK compatibility admission", () => {
  it.each(["1", "1.0", "1.0.0", "^1.0.0", "~1.0", ">=1", ">0.9", "<=1", "<2"])("accepts %s", range => expect(sdkRangeSupported(range, "1.0.0")).toBe(true));
  it.each(["2", "^2.0.0", "^0.9.0", "~0.9", ">1", ">1.0.0", "<1", "garbage", ">=1 || *"])("rejects %s", range => expect(sdkRangeSupported(range, "1.0.0")).toBe(false));
});
