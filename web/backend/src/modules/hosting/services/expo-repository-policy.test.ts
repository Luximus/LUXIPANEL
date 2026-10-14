import { describe, expect, it } from "vitest";
import {
  validateRepositoryExpoSource,
  repositoryExpoFiles,
} from "./expo-repository-policy.js";
const base = {
  "package.json": JSON.stringify({
    name: "customer-app",
    main: "expo-router/entry",
    dependencies: {
      expo: "~57.0.17",
      "react-native": "0.86.3",
      "expo-router": "~7.0.0",
      zustand: "^5.0.0",
    },
  }),
  "app.json": JSON.stringify({
    expo: {
      android: { package: "com.example.app" },
      ios: { bundleIdentifier: "com.example.app" },
      plugins: ["expo-router"],
    },
  }),
  "eas.json": JSON.stringify({
    build: { production: { autoIncrement: true, credentialsSource: "remote" } },
  }),
  "tsconfig.json": JSON.stringify({ extends: "expo/tsconfig.base" }),
  "app/index.tsx": "export default function Screen(){return null;}",
  "assets/font.ttf": Buffer.from([0, 1, 2, 3]).toString("base64"),
};
describe("GitHub Expo imports", () => {
  it("preserves router entries, custom source, registry dependencies and binary assets", () =>
    expect(() => validateRepositoryExpoSource(base)).not.toThrow());
  it.each([
    "app.config.ts",
    "src/../app.json",
    "node_modules/expo/index.js",
    "credentials.json",
    "key.p8",
    ".env.production",
  ])(
    "rejects credential-side executable configuration or secret path %s",
    (name) =>
      expect(
        repositoryExpoFiles.safeParse({ ...base, [name]: "secret" }).success,
      ).toBe(false),
  );
  it.each([
    "file:/etc/luxipanel",
    "https://evil.example/archive.tgz",
    "git+https://example.test/repo",
    "workspace:*",
  ])("rejects non-registry dependency %s", (version) =>
    expect(() =>
      validateRepositoryExpoSource({
        ...base,
        "package.json": JSON.stringify({
          dependencies: { expo: version, "react-native": "0.86.3" },
        }),
      }),
    ).toThrow("registry_dependency_required"),
  );
  it("rejects local plugins and custom EAS workflows", () => {
    expect(() =>
      validateRepositoryExpoSource({
        ...base,
        "app.json": JSON.stringify({
          expo: {
            android: { package: "com.example.app" },
            ios: { bundleIdentifier: "com.example.app" },
            plugins: ["./plugin.js"],
          },
        }),
      }),
    ).toThrow("native_plugin");
    expect(() =>
      validateRepositoryExpoSource({
        ...base,
        "eas.json": JSON.stringify({
          build: { production: { config: "custom.yml" } },
        }),
      }),
    ).toThrow("build_configuration");
  });
});
