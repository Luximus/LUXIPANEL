import assert from "node:assert/strict";
import test from "node:test";
import { internalModuleControllers } from "./internal-module-controllers.mjs";

test("Files keeps the editor behind its public dynamic import", async () => {
  const plugin = internalModuleControllers();
  const code = await plugin.load("\0virtual:lxp-controller/pages_panel_files_index");
  assert.match(code, /import\("\/scripts\/extracted\/pages\/panel\/files\/panel-files-monaco\.js\?/);
  assert.match(code, /export function mount\(scope\)/);
  assert.match(code, /files-download-progress/);
  // Browsing must not transfer the multi-megabyte editor before it can start.
  assert.ok(Buffer.byteLength(code) < 1_000_000, "editor leaked into Files startup");
});
