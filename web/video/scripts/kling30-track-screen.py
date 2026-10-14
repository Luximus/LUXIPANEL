"""Track a device display in actual Higgsfield footage using optical flow.

Anchors are measured on native frames. Each shot is independent; a tracking
failure is reported for manual review instead of silently inventing motion.
"""
import argparse
import json
from pathlib import Path
import cv2
import numpy as np

parser = argparse.ArgumentParser()
parser.add_argument("source", type=Path)
parser.add_argument("anchors", type=Path)
parser.add_argument("output", type=Path)
args = parser.parse_args()
cv2.setNumThreads(2)
cap = cv2.VideoCapture(str(args.source))
fps = cap.get(cv2.CAP_PROP_FPS)
frames = []
while True:
    ok, frame = cap.read()
    if not ok:
        break
    frames.append(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY))
cap.release()
height, width = frames[0].shape
spec = json.loads(args.anchors.read_text())
tracks = [None] * len(frames)
issues = []

def follow(anchor, endpoint, step):
    previous = anchor["frame"]
    corners = np.asarray(anchor["corners"], dtype=np.float32)
    for index in range(previous + step, endpoint + step, step):
        mask = np.zeros((height, width), np.uint8)
        cv2.fillConvexPoly(mask, np.rint(corners).astype(np.int32), 255)
        # Generic native UI details and the display edge supply tracking points.
        points = cv2.goodFeaturesToTrack(frames[previous], 260, .008, 5, mask=mask)
        if points is None or len(points) < 8:
            raise RuntimeError(f"Too few display features at frame {previous}")
        moved, status, error = cv2.calcOpticalFlowPyrLK(
            frames[previous], frames[index], points, None,
            winSize=(25, 25), maxLevel=3,
            criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 30, .005),
        )
        returned, back_status, _ = cv2.calcOpticalFlowPyrLK(
            frames[index], frames[previous], moved, None, winSize=(25, 25), maxLevel=3,
        )
        distance = np.linalg.norm(points - returned, axis=2).ravel()
        good = (status.ravel() == 1) & (back_status.ravel() == 1) & (distance < 1.2)
        if good.sum() < 8:
            raise RuntimeError(f"Display tracking lost at frame {index}")
        transform, inliers = cv2.findHomography(points[good], moved[good], cv2.RANSAC, 2)
        if transform is None or inliers.sum() < 8:
            raise RuntimeError(f"No reliable display transform at frame {index}")
        updated = cv2.perspectiveTransform(corners.reshape(1, 4, 2), transform)[0]
        delta = np.max(np.linalg.norm(updated - corners, axis=1))
        if not np.isfinite(updated).all() or delta > 14:
            raise RuntimeError(f"Unexpected display displacement at frame {index}: {delta}")
        corners = updated
        tracks[index] = {"corners": corners.tolist(), "inliers": int(inliers.sum())}
        previous = index

for shot in spec["shots"]:
    anchors = sorted(shot.get("anchors", [shot.get("anchor")]), key=lambda a: a["frame"])
    for anchor in anchors:
        tracks[anchor["frame"]] = {"corners": anchor["corners"], "anchor": True}
    follow(anchors[0], shot["startFrame"], -1)
    for left, right in zip(anchors, anchors[1:]):
        follow(left, right["frame"], 1)
        # Native generated monitors can deform slightly. Measured anchors correct
        # accumulated flow drift continuously without jumping at the next anchor.
        residual = np.asarray(right["corners"]) - np.asarray(tracks[right["frame"]]["corners"])
        span = right["frame"] - left["frame"]
        for index in range(left["frame"] + 1, right["frame"] + 1):
            amount = (index - left["frame"]) / span
            tracks[index]["corners"] = (np.asarray(tracks[index]["corners"]) + residual * amount).tolist()
        tracks[right["frame"]]["anchor"] = True
    follow(anchors[-1], shot["endFrame"], 1)
    for index in range(shot["startFrame"], shot["endFrame"] + 1):
        tracks[index]["shot"] = shot["name"]

args.output.write_text(json.dumps({
    "source": str(args.source.resolve()), "fps": fps, "width": width,
    "height": height, "frameCount": len(frames), "tracks": tracks,
    "issues": issues, "anchors": spec,
}, indent=2) + "\n")
print(json.dumps({"trackedFrames": sum(t is not None for t in tracks), "issues": issues}))
