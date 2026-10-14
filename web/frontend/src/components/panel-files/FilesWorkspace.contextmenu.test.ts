// Regression — the shared right-click context menu (#files-context-menu) must
// NOT live inside #files-browser.
//
// Root cause of the reported bug: opening a file in the workspace editor toggles
// #files-browser to `hidden` (display:none) + `inert` (see editor.ts show/hide).
// The context-menu element used to be rendered *inside* #files-browser, so with
// the editor active its ancestor was display:none — right-clicking a node in the
// LEFT tree (which stays visible in the aside, outside #files-browser) fired the
// opener, which un-hid the menu, but an ancestor was still display:none → the
// menu never appeared, and no native menu either (preventDefault had run). Hence
// "no sale el menú" only in the editor view.
//
// The fix hoists #files-context-menu out of #files-browser (it's position:fixed,
// so DOM location is cosmetic-free). This test renders the real component and
// asserts that structural invariant, so the menu works in BOTH views.
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { FilesWorkspace } from "./FilesWorkspace";

function render(): Document {
  const html = renderToStaticMarkup(createElement(FilesWorkspace, { canUseAssistant: true, canExpo: false }));
  return new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
}

describe("FilesWorkspace — context menu placement", () => {
  it("renders the shared #files-context-menu element", () => {
    const doc = render();
    expect(doc.getElementById("files-context-menu")).toBeTruthy();
  });

  it("keeps #files-context-menu OUTSIDE #files-browser (editor view hides that container)", () => {
    const doc = render();
    const menu = doc.getElementById("files-context-menu")!;
    const browser = doc.getElementById("files-browser")!;
    // If the menu were nested under #files-browser, the editor's hidden+inert
    // toggle would make it invisible on right-click — the reported regression.
    expect(browser.contains(menu)).toBe(false);
  });
});

describe("FilesWorkspace — folder navigation", () => {
  it("places folder tabs before the location bar and actions, with open files outside the tab list", () => {
    const doc = render();
    const browser = doc.getElementById("files-browser")!;
    const tabs = doc.getElementById("files-manager-tabs")!;
    const path = doc.getElementById("breadcrumb")!;
    const toolbar = doc.getElementById("files-main-toolbar")!;
    expect(tabs.getAttribute("role")).toBe("tablist");
    expect(tabs.contains(doc.getElementById("btn-open-files"))).toBe(false);
    expect(browser.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_CONTAINED_BY).toBeTruthy();
    expect(tabs.compareDocumentPosition(path) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(path.compareDocumentPosition(toolbar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
