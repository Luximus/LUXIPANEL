import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import ts from "typescript";

// Prepare only this change; never overwrite dist or publish unrelated sources.
const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "../.cache/backend-auth-scope/release");
const files = ["mail", "users", "dashboard", "jobs", "sudo", "notifications", "chat"]
  .map(name => `modules/${name}/routes/${name}.routes`);
const hash = data => createHash("sha256").update(data).digest("hex");
const manifest = [];
for (const file of files) {
  const source = await readFile(resolve(root, `src/${file}.ts`), "utf8");
  const { outputText, diagnostics } = ts.transpileModule(source, {
    fileName: `${file}.ts`, reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  });
  if (diagnostics?.some(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error)) {
    throw new Error(`Compilation failed: ${file}`);
  }
  const current = await readFile(resolve(root, `dist/${file}.js`), "utf8");
  const gate = outputText.split("\n").filter(line => /^router\.use\(.+, requireAuth\);$/.test(line));
  if (gate.length !== 1 || current.split("router.use(requireAuth);").length !== 2) {
    throw new Error(`Unexpected session gate; rebase the release: ${file}`);
  }
  // Preserve the installed artifact's other code, including concurrent work.
  const release = current.replace("router.use(requireAuth);", gate[0]);
  const destination = resolve(output, `${file}.js`);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, release);
  manifest.push({ file: `${file}.js`, sourceSha256: hash(source), baselineSha256: hash(current), releaseSha256: hash(release) });
}
await writeFile(resolve(output, "manifest.json"), JSON.stringify({ preparedAt: new Date().toISOString(), deployed: false, files: manifest }, null, 2) + "\n");
console.log(`Prepared ${files.length} backend files in ${output}; dist unchanged.`);
