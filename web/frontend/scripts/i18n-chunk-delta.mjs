// Splits /tmp/i18n-es-delta.json into N balanced chunk files that preserve the
// nested structure (each chunk is a partial of the delta). Writes
// /tmp/i18n-chunk-<i>.json and prints the count.
import fs from "fs";
import { leafPaths, setPath } from "./i18n-shared.mjs";

const TARGET = Number(process.argv[2] || 170); // approx leaves per chunk
const delta = JSON.parse(fs.readFileSync("/tmp/i18n-es-delta.json", "utf8"));

// Flatten to [path, value] then re-nest per chunk.
const leaves = leafPaths(delta);

const chunks = [];
for (let i = 0; i < leaves.length; i += TARGET) {
  const obj = {};
  for (const [path, val] of leaves.slice(i, i + TARGET)) setPath(obj, path, val);
  chunks.push(obj);
}

for (let i = 0; i < chunks.length; i++) {
  fs.writeFileSync(`/tmp/i18n-chunk-${i}.json`, JSON.stringify(chunks[i]));
}
console.log(`total leaves=${leaves.length} chunks=${chunks.length} (~${TARGET}/chunk)`);
