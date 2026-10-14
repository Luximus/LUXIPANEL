import { z } from "zod";
const binary = /\.(?:png|jpe?g|webp|ttf|otf|woff2?)$/;
export const repositoryExpoFiles = z
  .record(z.string(), z.string().max(2_800_000))
  .refine((files) => {
    const entries = Object.entries(files);
    return (
      entries.length > 0 &&
      entries.length <= 2000 &&
      Buffer.byteLength(JSON.stringify(files)) <= 16_000_000 &&
      entries.every(
        ([name, body]) =>
          name.length <= 500 &&
          !name.startsWith("/") &&
          !name.includes("\\") &&
          !name.includes("\0") &&
          name
            .split("/")
            .every((part) => part && part !== "." && part !== "..") &&
          /\.(?:[cm]?[jt]sx?|json|css|svg|png|jpe?g|webp|ttf|otf|woff2?|gradle|properties|xml|java|kt|swift|h|m|mm)$/.test(
            name,
          ) &&
          !/(?:^|\/)(?:node_modules|\.git|app\.config\.[cm]?[jt]s|\.env.*|credentials.*|.*\.(?:pem|key|p8|p12|pfx))(?:$|\/)/i.test(
            name,
          ) &&
          (!binary.test(name) || /^[a-zA-Z0-9+/]*={0,2}$/.test(body)),
      )
    );
  }, "invalid_repository_mobile_source");
const registryVersion = (value: unknown) =>
  typeof value === "string" &&
  value.length < 100 &&
  /^[~^<>=*0-9][0-9a-zA-Z~^<>=*.+| -]*$/.test(value);
export function validateRepositoryExpoSource(files: Record<string, string>) {
  repositoryExpoFiles.parse(files);
  if (
    Object.values(files).some((body) =>
      /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/.test(body),
    )
  )
    throw new Error("source_contains_secret");
  for (const key of ["package.json", "app.json", "eas.json", "tsconfig.json"])
    if (!files[key]) throw new Error(`source_missing:${key}`);
  const pkg = JSON.parse(files["package.json"]!);
  if (!pkg.dependencies?.expo || !pkg.dependencies?.["react-native"])
    throw new Error("expo_project_required");
  if (
    Object.keys(pkg).some(
      (key) =>
        ![
          "name",
          "version",
          "private",
          "main",
          "scripts",
          "dependencies",
          "devDependencies",
          "peerDependencies",
          "description",
          "license",
        ].includes(key),
    )
  )
    throw new Error("package_configuration_requires_review");
  for (const [name, version] of Object.entries({
    ...pkg.dependencies,
    ...pkg.devDependencies,
    ...pkg.peerDependencies,
  }))
    if (
      !/^(?:@[a-z0-9_.-]+\/)?[a-z0-9_.-]+$/.test(name) ||
      !registryVersion(version)
    )
      throw new Error(`registry_dependency_required:${name}`);
  if (
    (pkg.main && typeof pkg.main !== "string") ||
    (pkg.main &&
      (!/^[a-zA-Z0-9_.@/-]+$/.test(pkg.main) ||
        pkg.main.startsWith("/") ||
        pkg.main.split("/").includes("..")))
  )
    throw new Error("entry_requires_review");
  const config = JSON.parse(files["app.json"]!).expo;
  const staticPaths = (value: unknown): void => {
    if (
      typeof value === "string" &&
      (/^(?:\/|~|file:)/.test(value) ||
        value.split(/[\\/]/).includes("..") ||
        /(?:^|[\\/])(?:node_modules|\.env[^/]*|credentials[^/]*)/.test(value))
    )
      throw new Error("static_configuration_path_requires_review");
    if (value && typeof value === "object")
      for (const child of Object.values(value)) staticPaths(child);
  };
  staticPaths(config);
  if (
    !/^[a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*){2,}$/.test(
      config?.android?.package ?? "",
    ) ||
    !/^[a-zA-Z][a-zA-Z0-9.-]+$/.test(config?.ios?.bundleIdentifier ?? "")
  )
    throw new Error("application_identifier_missing");
  // Dynamic config and local plugins never execute alongside the Expo credential.
  // Approved Expo plugins resolve from authenticated npm packages, not customer paths.
  for (const plugin of config.plugins ?? []) {
    const name = Array.isArray(plugin) ? plugin[0] : plugin;
    if (
      typeof name !== "string" ||
      ![
        "expo-router",
        "expo-font",
        "expo-splash-screen",
        "expo-secure-store",
        "expo-notifications",
        "expo-image-picker",
        "expo-camera",
        "expo-location",
        "expo-build-properties",
      ].includes(name) ||
      !registryVersion(pkg.dependencies?.[name])
    )
      throw new Error("native_plugin_requires_static_configuration");
  }
  const eas = JSON.parse(files["eas.json"]!);
  if (
    Object.keys(eas).some((key) => !["cli", "build", "submit"].includes(key)) ||
    Object.values(eas.build ?? {}).some(
      (profile: any) =>
        Object.keys(profile).some(
          (key) =>
            ![
              "developmentClient",
              "distribution",
              "autoIncrement",
              "credentialsSource",
            ].includes(key),
        ) ||
        (profile.credentialsSource && profile.credentialsSource !== "remote"),
    )
  )
    throw new Error("build_configuration_requires_review");
  const ts = JSON.parse(files["tsconfig.json"]!);
  if (
    ts.extends &&
    ts.extends !== "expo/tsconfig.base" &&
    (!/^\.\/[a-zA-Z0-9_./-]+$/.test(ts.extends) ||
      ts.extends.split("/").includes(".."))
  )
    throw new Error("tsconfig_not_allowed");
}
export const expoBinaryPath = (name: string) => binary.test(name);
