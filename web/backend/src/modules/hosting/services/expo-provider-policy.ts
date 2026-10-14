import { createHash } from "node:crypto";
import { z } from "zod";
import { validateRepositoryExpoSource } from "./expo-repository-policy.js";

export const filesSchema = z.record(z.string(), z.string().max(400_000)).refine((files) => {
  const entries = Object.entries(files);
  return entries.length > 0 && entries.length <= 200 && entries.every(([name]) =>
    /^(?:App\.tsx|(?:app-spec|runtime-config|template-lock|package|app|eas|tsconfig)\.json|src\/[a-zA-Z0-9_/-]+\.(?:tsx?|json)|assets\/[a-zA-Z0-9_/-]+\.(?:png|jpg|jpeg|webp))$/.test(name)
    && !name.split("/").some((part) => !part || part === "." || part === ".."))
    && Buffer.byteLength(JSON.stringify(files)) <= 2_000_000;
}, "invalid_mobile_source");

export function sourceDigest(files: Record<string, string>): string {
  return createHash("sha256").update(JSON.stringify(Object.keys(files).sort().map((key) => [key, files[key]]))).digest("hex");
}

export function validateExpoSource(files: Record<string, string>,sourceMode?:string): void {
  if(sourceMode === "repository"){validateRepositoryExpoSource(files);return;}
  filesSchema.parse(files);
  for (const key of ["App.tsx", "package.json", "app.json", "eas.json", "tsconfig.json"]) if (!files[key]) throw new Error(`source_missing:${key}`);
  if(Object.values(files).some(body=>/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/.test(body)))throw new Error("source_contains_secret");
  const pkg = JSON.parse(files["package.json"]!);
  if(Object.keys(pkg).some(key=>!["name","version","private","main","scripts","dependencies","devDependencies"].includes(key)))throw new Error("package_configuration_requires_review");
  if(pkg.main&&pkg.main!=="./src/entry.tsx")throw new Error("entry_requires_review");
  const config = JSON.parse(files["app.json"]!).expo;
  if (!config?.android?.package || !config?.ios?.bundleIdentifier) throw new Error("application_identifier_missing");
  if (config.plugins?.length) throw new Error("native_plugins_require_review");
  for (const [name, version] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) {
    if (!["expo","expo-status-bar","expo-secure-store","react","react-native","react-dom","react-native-web","@types/react","typescript"].includes(name)
      || typeof version !== "string" || !/^[~^]?\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/.test(version)) throw new Error(`dependency_requires_review:${name}`);
  }
  if(pkg.scripts&&Object.entries(pkg.scripts).some(([name,value])=>!["start","android","ios","web","typecheck","export:web","export"].includes(name)||typeof value!=="string"||!/^expo (?:start(?: --(?:android|ios|web))?|export --platform web)$|^tsc --noEmit$/.test(value)))throw new Error("build_hooks_not_allowed");
  // Never run customer hooks with the central Expo credential.
  if (pkg.scripts && Object.keys(pkg.scripts).some((key) => /^(?:pre|post|eas-build)/.test(key))) throw new Error("build_hooks_not_allowed");
  const eas=JSON.parse(files["eas.json"]!);
  if(eas.build&&Object.values(eas.build).some((profile:any)=>Object.keys(profile).some(key=>!["developmentClient","distribution","autoIncrement","credentialsSource"].includes(key))||profile.credentialsSource&&profile.credentialsSource!=="remote"))throw new Error("build_configuration_requires_review");
  if(Object.keys(eas).some(key=>!["cli","build","submit"].includes(key)))throw new Error("build_configuration_requires_review");
  const ts = JSON.parse(files["tsconfig.json"]!);
  if (ts.extends !== "expo/tsconfig.base" || Object.keys(ts).some(key=>!["extends","compilerOptions"].includes(key)) || Object.keys(ts.compilerOptions??{}).some(key=>!["strict","resolveJsonModule"].includes(key)) || ts.compilerOptions?.strict!==true) throw new Error("tsconfig_not_allowed");
}
