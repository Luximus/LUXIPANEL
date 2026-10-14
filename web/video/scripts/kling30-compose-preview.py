"""Integrate recorded LUXIPANEL UI into the first real Higgsfield clip.

This creates a silent visual review, not the final advertised film. It never
generates footage, speech, substitute app screens or modified brand assets.
"""
import json
from pathlib import Path
import subprocess
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "out/kling30"
CAPTURES = OUT / "captures"
cv2.setNumThreads(2)
tracking = json.loads((OUT / "calibration/first-display-tracks.json").read_text())
records = {r["name"]: r for r in json.loads((CAPTURES / "web-captures.json").read_text())["records"]}
players = {name: cv2.VideoCapture(str(CAPTURES / item["movie"])) for name, item in records.items()}
crops = {"web-ai": (310, 55, 1235, 655), "web-monitor": (20, 60, 1285, 860), "web-modules": (250, 70, 1280, 820)}
last_frames = {}

def ui_frame(name, elapsed):
    item = records[name]
    usable = max(.1, item["usableSeconds"] - .25)
    time = item["stableStartSeconds"] + elapsed % usable
    player = players[name]
    player.set(cv2.CAP_PROP_POS_MSEC, time * 1000)
    ok, frame = player.read()
    if ok:
        last_frames[name] = frame
    elif name in last_frames:
        frame = last_frames[name]
    else:
        raise RuntimeError(f"Cannot read actual product recording: {name}")
    x1, y1, x2, y2 = crops[name]
    return frame[y1:y2, x1:x2]

regular = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
bold = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
font_title = ImageFont.truetype(bold, 40)
font_brand = ImageFont.truetype(bold, 34)
font_url = ImageFont.truetype(regular, 27)
icon = Image.open(OUT / "assets/luxipanel-icon.png").convert("RGBA")
icon.thumbnail((104, 104), Image.Resampling.LANCZOS)

def graphics(title):
    layer = Image.new("RGBA", (720, 1280))
    draw = ImageDraw.Draw(layer)
    # Restrained text over the moving film; the product remains on the device.
    draw.text((48, 127), title, font=font_title, fill=(0, 0, 0, 115), stroke_width=3, stroke_fill=(0, 0, 0, 115))
    draw.text((48, 124), title, font=font_title, fill=(246, 250, 255, 255))
    draw.line((48, 183, 104, 183), fill=(80, 231, 238, 255), width=3)
    layer.alpha_composite(icon, (40, 1106))
    draw.text((155, 1123), "LUXIPANEL", font=font_brand, fill=(245, 249, 255, 255), stroke_width=2, stroke_fill=(0, 0, 0, 140))
    draw.text((155, 1165), "luxipanel.com", font=font_url, fill=(220, 239, 247, 255), stroke_width=1, stroke_fill=(0, 0, 0, 140))
    return np.asarray(layer).copy()

layers = {name: graphics(title) for name, title in {
    "intro": "Desarrollo e infraestructura",
    "web-ai": "IA con tu aprobación",
    "web-monitor": "Tu infraestructura, en vivo",
    "web-modules": "Amplía con módulos",
}.items()}

def screen_composite(frame, content, corners, preserve_foreground):
    height, width = content.shape[:2]
    src = np.float32([[0, 0], [width - 1, 0], [width - 1, height - 1], [0, height - 1]])
    target = np.float32(corners)
    transform = cv2.getPerspectiveTransform(src, target)
    warped = cv2.warpPerspective(content, transform, (720, 1280), flags=cv2.INTER_LINEAR)
    mask = cv2.warpPerspective(np.full((height, width), 255, np.uint8), transform, (720, 1280))
    mask = cv2.GaussianBlur(mask, (3, 3), .5).astype(np.float32) / 255
    if preserve_foreground:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        # The source coat is much darker than the matte display. Protect only
        # the left portion where that foreground can intersect the display.
        coord_x = cv2.warpPerspective(np.tile(np.linspace(0, 1, width, dtype=np.float32), (height, 1)), transform, (720, 1280))
        protection = np.clip((gray.astype(np.float32) - 37) / 17, 0, 1)
        mask *= np.where(coord_x < .38, protection, 1)
    # Keep restrained display brightness appropriate to the photographed room.
    warped = np.clip(warped.astype(np.float32) * .91, 0, 255)
    return np.clip(frame * (1 - mask[:, :, None]) + warped * mask[:, :, None], 0, 255).astype(np.uint8)

source = cv2.VideoCapture(str(OUT / "01-infrastructure-ai.mp4"))
target = OUT / "preview-first15-silent.mp4"
process = subprocess.Popen([
    "ffmpeg", "-v", "error", "-nostdin", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24",
    "-s", "720x1280", "-r", str(tracking["fps"]), "-i", "pipe:0", "-an",
    "-c:v", "libx264", "-threads", "2", "-preset", "fast", "-crf", "18",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(target),
], stdin=subprocess.PIPE)
review = OUT / "visual-review"
review.mkdir(exist_ok=True)
sample_indices = {48, 96, 144, 192, 240, 264, 336}
try:
    index = 0
    while True:
        if index >= round(15 * tracking["fps"]):
            break
        ok, frame = source.read()
        if not ok:
            break
        time = index / tracking["fps"]
        track = tracking["tracks"][index]
        name = "intro" if not track else "web-ai" if time < 7.7 else "web-monitor" if time < 10.2917 else "web-modules"
        if track:
            start = {"web-ai": 3.7083, "web-monitor": 7.7, "web-modules": 10.2917}[name]
            content = ui_frame(name, max(0, time - start))
            frame = screen_composite(frame, content, track["corners"], track["shot"] == "developer-monitor")
        layer = layers[name]
        alpha = layer[:, :, 3:4].astype(np.float32) / 255
        # Fade the opening caption into the moving rack shot; later cuts are
        # already supplied by Kling, with captions following the product view.
        alpha *= min(1, max(0, (time - .25) / .4))
        frame = np.clip(frame * (1 - alpha) + layer[:, :, :3][:, :, ::-1] * alpha, 0, 255).astype(np.uint8)
        if index in sample_indices:
            cv2.imwrite(str(review / f"preview-{time:g}.jpg"), frame)
        process.stdin.write(frame.tobytes())
        index += 1
finally:
    source.release()
    for player in players.values():
        player.release()
    process.stdin.close()
    code = process.wait()
    if code:
        raise RuntimeError(f"Preview encoding failed: {code}")
evidence = {
    "file": str(target), "type": "Silent first-clip visual review, not the final campaign",
    "source": str(OUT / "01-infrastructure-ai.mp4"), "provider": "Higgsfield",
    "productSources": [str(CAPTURES / r["movie"]) for r in records.values()],
    "productData": "Isolated synthetic demonstration data in actual installed LUXIPANEL frontend",
    "nativeNarrationAccepted": False, "secondClipSubmitted": False,
    "method": "Optical-flow display tracking, measured anchors, perspective warp, foreground preservation",
    "reviewFrames": sorted(p.name for p in review.glob("preview-*.jpg")),
}
(OUT / "visual-preview-evidence.json").write_text(json.dumps(evidence, indent=2) + "\n")
print(json.dumps({"file": str(target), "frames": index, "nativeNarrationAccepted": False}))
