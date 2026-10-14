import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const remotionRequire = createRequire(import.meta.resolve("@remotion/cli"));
const frontendRequire = createRequire(resolve(root, "../frontend/package.json"));
const { bundle } = remotionRequire("@remotion/bundler");
const { selectComposition, renderStill, renderMedia } = remotionRequire("@remotion/renderer");
const sharp = frontendRequire("sharp");
const out = resolve(root, "out/higgsfield45");
const snapshots = resolve(out, "storyboard");
mkdirSync(snapshots, { recursive: true });
const serveUrl = await bundle({ entryPoint: resolve(root, "src/higgsfield45-root.tsx"), publicDir: resolve(root, "public"), outDir: resolve(root, ".cache/render-higgsfield45/bundle") });
const composition = await selectComposition({ serveUrl, id: "LuxiPanelHiggsfield45Preview", browserExecutable: "/usr/bin/chromium", logLevel: "error" });
const frames = [0, 180, 450, 660, 795, 945, 1110, 1260];
for (let i = 0; i < frames.length; i++) {
  await renderStill({ serveUrl, composition, frame: frames[i], output: resolve(snapshots, `scene-${String(i + 1).padStart(2, "0")}.png`), imageFormat: "png", browserExecutable: "/usr/bin/chromium", logLevel: "error" });
}
const tiles = [];
for (let i = 0; i < frames.length; i++) {
  const input = await sharp(resolve(snapshots, `scene-${String(i + 1).padStart(2, "0")}.png`)).resize(270, 480).png().toBuffer();
  tiles.push({ input, left: i % 4 * 270, top: Math.floor(i / 4) * 480 });
}
await sharp({ create: { width: 1080, height: 960, channels: 3, background: "#080a12" } }).composite(tiles).png().toFile(resolve(out, "storyboard-contact.png"));
console.log(JSON.stringify({ stage: "storyboard", images: frames.length, output: resolve(out, "storyboard-contact.png") }));
if (!process.argv.includes("--stills-only")) {
  await renderMedia({ serveUrl, composition, codec: "h264", pixelFormat: "yuv420p", crf: 18, audioCodec: "aac", audioBitrate: "192k", concurrency: 2, browserExecutable: "/usr/bin/chromium", outputLocation: resolve(out, "preview-raw.mp4"), logLevel: "error", onProgress: ({ progress }) => { if (progress >= 1) console.log(JSON.stringify({ stage: "rendered", frames: 1350 })); } });
}
