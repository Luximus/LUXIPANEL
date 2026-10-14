import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, "out/higgsfield45");
const campaign = JSON.parse(readFileSync(resolve(out, "campaign.json"), "utf8"));
assert.equal(campaign.brand, "LUXIPANEL");
assert.equal(campaign.url, "luxipanel.com");
assert.equal(campaign.scenes.length, 8);
let cursor = 0;
for (const scene of campaign.scenes) {
  assert.equal(scene.start, cursor, `Timeline gap at ${scene.id}`);
  assert.ok(scene.end > scene.start);
  cursor = scene.end;
}
assert.equal(cursor, 45);
for (const name of ["captions", "previewCaptions"]) {
  let end = 0;
  for (const cue of campaign[name]) {
    assert.ok(cue.start >= end, "Subtitle cues overlap");
    assert.ok(cue.end > cue.start && cue.end <= 45, "Invalid subtitle interval");
    assert.ok(cue.text.length <= 85, "Subtitle phrase too long for two lines");
    end = cue.end;
  }
}
for (const asset of campaign.assets) {
  assert.equal(createHash("sha256").update(readFileSync(resolve(out, asset.name))).digest("hex"), asset.sha256, "Original brand asset changed");
}
const preview = resolve(out, "luxipanel-45s-preview.mp4");
const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-count_frames", "-show_streams", "-show_format", "-of", "json", preview], { encoding: "utf8" }));
const video = probe.streams.find(s => s.codec_type === "video");
const audio = probe.streams.find(s => s.codec_type === "audio");
assert.equal(video.codec_name, "h264");
assert.equal(video.width, 1080);
assert.equal(video.height, 1920);
assert.equal(video.r_frame_rate, "30/1");
assert.equal(Number(video.nb_read_frames), 1350);
assert.ok(Math.abs(Number(video.duration) - 45) < .001);
assert.equal(video.pix_fmt, "yuv420p");
assert.equal(video.color_space, "bt709");
assert.equal(video.color_range, "tv");
assert.equal(video.color_transfer, "bt709");
assert.equal(video.color_primaries, "bt709");
assert.equal(audio.codec_name, "aac");
assert.equal(audio.channels, 2);
assert.equal(Number(audio.sample_rate), 48000);
assert.ok(Math.abs(Number(probe.format.duration) - 45) <= .06);
execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-threads", "2", "-i", preview, "-f", "null", "-"], { stdio: "pipe" });
const snapshots = resolve(out, "encoded-storyboard");
mkdirSync(snapshots, { recursive: true });
const frames = [0, 180, 450, 660, 795, 945, 1110, 1260];
const select = "select=" + frames.map(f => `eq(n\\,${f})`).join("+");
execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-threads", "2", "-i", preview, "-vf", select, "-fps_mode", "vfr", "-frames:v", "8", resolve(snapshots, "scene-%02d.png")], { stdio: "pipe" });
const frontendRequire = createRequire(resolve(root, "../frontend/package.json"));
const sharp = frontendRequire("sharp");
const tiles = [];
for (let i = 0; i < frames.length; i++) {
  const input = await sharp(resolve(snapshots, `scene-${String(i + 1).padStart(2, "0")}.png`)).resize(270, 480).png().toBuffer();
  tiles.push({ input, left: i % 4 * 270, top: Math.floor(i / 4) * 480 });
}
await sharp({ create: { width: 1080, height: 960, channels: 3, background: "#080a12" } }).composite(tiles).png().toFile(resolve(out, "encoded-storyboard-contact.png"));
const report = {
  verifiedAt: new Date().toISOString(),
  file: "luxipanel-45s-preview.mp4",
  bytes: Number(probe.format.size),
  sha256: createHash("sha256").update(readFileSync(preview)).digest("hex"),
  video: { codec: video.codec_name, width: video.width, height: video.height, frames: Number(video.nb_read_frames), fps: 30, seconds: Number(video.duration), color: "BT.709 limited", pixelFormat: video.pix_fmt },
  audio: { codec: audio.codec_name, channels: audio.channels, sampleRate: Number(audio.sample_rate), content: "original synthesized guide score; no narration" },
  fullDecode: "passed",
  assetsIntact: true,
  timeline: "8 contiguous scenes; 45 seconds",
  subtitleTiming: "non-overlapping; within 45 seconds",
  visualReview: "8 source snapshots reviewed; final MP4 snapshots still to review",
  releaseReady: false,
  pending: campaign.production.releaseGates,
};
writeFileSync(resolve(out, "validation.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
