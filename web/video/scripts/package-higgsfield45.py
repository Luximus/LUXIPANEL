"""Archive the reviewable production assets, excluding intermediate renders."""
from pathlib import Path
import json
import zipfile

root = Path(__file__).resolve().parent.parent
out = root / "out" / "higgsfield45"
report = json.loads((out / "validation.json").read_text())
assert report["fullDecode"] == "passed"
archive = root / "out" / "luxipanel-higgsfield45-production.zip"
with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as package:
    for path in sorted(out.rglob("*")):
        if path.is_file() and path.name != "preview-raw.mp4":
            package.write(path, "higgsfield45/" + str(path.relative_to(out)))
    for path in sorted((root / "public" / "higgsfield45" / "captures").glob("*.png")):
        package.write(path, "higgsfield45/references/" + path.name)
    package.write(root / "public" / "higgsfield45" / "score-120bpm.wav", "higgsfield45/score-120bpm.wav")
    for path in sorted((root / "src").glob("higgsfield45*")):
        package.write(path, "higgsfield45/source/src/" + path.name)
    for path in sorted((root / "scripts").glob("*higgsfield45*")):
        package.write(path, "higgsfield45/source/scripts/" + path.name)
    package.write(root / "README.md", "higgsfield45/source/README.md")
with zipfile.ZipFile(archive) as package:
    assert package.testzip() is None
    entries = len(package.namelist())
print(json.dumps({"archive": str(archive), "bytes": archive.stat().st_size, "entries": entries, "integrity": "passed"}))
