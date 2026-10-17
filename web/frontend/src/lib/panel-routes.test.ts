import { describe, expect, it } from "vitest";
import { pathIsAgentMarket, pathIsAssistantView } from "./panel-routes";
import { findSearchEntry } from "./search-catalog";
import { isSafeNotificationTarget, normalizePath } from "./search-target";

describe("Market navigation", () => {
  it.each(["/assistant/market", "/panel/assistant/market", "/assistant/market/", "/panel/assistant/market?from=search#catalog"])(
    "uses the single assistant instance at %s", path => {
      expect(pathIsAgentMarket(path)).toBe(true);
      expect(pathIsAssistantView(path)).toBe(true);
    },
  );
  it.each(["/", "/panel", "/assistant", "/assistant/marketplace", "/assistant/market/other", "/files"])(
    "does not select Market for %s", path => expect(pathIsAgentMarket(path)).toBe(false),
  );
  it("offers a safe deep link from the search catalog", () => {
    const target = findSearchEntry("assistant.market")!.target;
    expect(isSafeNotificationTarget(target)).toBe(true);
    expect(normalizePath(target.href!)).toBe("/assistant/market");
  });
});
