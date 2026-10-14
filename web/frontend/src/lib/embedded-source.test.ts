// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, it, expect } from "vitest";
import {
  detectEmbeddedSourceFromUA,
  isDesktopWebframeUA,
  isEmbeddedClientUA,
  isDesktopChromeUA,
} from "./embedded-source";

describe("detectEmbeddedSourceFromUA", () => {
  it("defaults to web when the UA is missing/empty", () => {
    expect(detectEmbeddedSourceFromUA(null)).toBe("web");
    expect(detectEmbeddedSourceFromUA(undefined)).toBe("web");
    expect(detectEmbeddedSourceFromUA("")).toBe("web");
  });

  it("treats a plain browser UA as web", () => {
    const chrome =
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
    expect(detectEmbeddedSourceFromUA(chrome)).toBe("web");
  });

  it("detects the React Native mobile wrapper as app", () => {
    expect(detectEmbeddedSourceFromUA("MyApp ReactNativeWebView/1.0")).toBe("app");
    // case-insensitive
    expect(detectEmbeddedSourceFromUA("foo reactnativewebview bar")).toBe("app");
  });

  it("detects the desktop webframe before plain electron", () => {
    expect(detectEmbeddedSourceFromUA("Foo LpsDesktopWebframe/2")).toBe("webframe");
    // electron + webview also resolves to webframe (nested)
    expect(detectEmbeddedSourceFromUA("Foo Electron/30 webview")).toBe("webframe");
  });

  it("detects plain Electron desktop", () => {
    expect(detectEmbeddedSourceFromUA("App/1.0 Electron/30.0 Chrome/120")).toBe("desktop");
  });

  it("prioritises app over electron when both markers present", () => {
    // reactnativewebview is checked first
    expect(detectEmbeddedSourceFromUA("ReactNativeWebView Electron/30")).toBe("app");
  });
});

describe("isDesktopWebframeUA", () => {
  it("is true only for the webframe source", () => {
    expect(isDesktopWebframeUA("LpsDesktopWebframe")).toBe(true);
    expect(isDesktopWebframeUA("Electron/30")).toBe(false);
    expect(isDesktopWebframeUA("ReactNativeWebView")).toBe(false);
    expect(isDesktopWebframeUA(null)).toBe(false);
  });
});

describe("isEmbeddedClientUA", () => {
  it("is true for app, desktop and webframe but not web", () => {
    expect(isEmbeddedClientUA("ReactNativeWebView")).toBe(true);
    expect(isEmbeddedClientUA("Electron/30")).toBe(true);
    expect(isEmbeddedClientUA("LpsDesktopWebframe")).toBe(true);
    expect(isEmbeddedClientUA("Mozilla/5.0 Chrome/120")).toBe(false);
    expect(isEmbeddedClientUA(null)).toBe(false);
  });
});

describe("isDesktopChromeUA", () => {
  it("is true for desktop and webframe, but NOT the mobile app or web", () => {
    expect(isDesktopChromeUA("Electron/30")).toBe(true);
    expect(isDesktopChromeUA("LpsDesktopWebframe")).toBe(true);
    // mobile app must keep its own controls — explicitly excluded
    expect(isDesktopChromeUA("ReactNativeWebView")).toBe(false);
    expect(isDesktopChromeUA("Mozilla/5.0 Chrome/120")).toBe(false);
    expect(isDesktopChromeUA(undefined)).toBe(false);
  });
});
