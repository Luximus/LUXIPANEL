// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it } from "vitest";

import { quoteArg, quoteCmd } from "./quote.js";

describe("executor quote helpers", () => {
  it("quotes single arguments safely", () => {
    expect(quoteArg("simple")).toBe("'simple'");
    expect(quoteArg("")).toBe("''");
    expect(quoteArg("a'b")).toBe("'a'\"'\"'b'");
  });

  it("quotes whole commands", () => {
    expect(quoteCmd("rm", ["-rf", "/tmp/my folder"])).toBe("rm '-rf' '/tmp/my folder'");
  });
});
