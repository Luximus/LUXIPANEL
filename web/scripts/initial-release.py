#!/usr/bin/env python3
"""Only the first reviewed-by-owner public source snapshot uses this bootstrap."""
import json, subprocess, urllib.error
from pathlib import Path
from importlib.util import spec_from_file_location,module_from_spec
spec=spec_from_file_location("prepare",Path(__file__).with_name("prepare-release.py"));prepare=module_from_spec(spec);spec.loader.exec_module(prepare)
root=prepare.metadata_root(Path.cwd());manifest=json.loads((root/"release.manifest.json").read_text());tag="v2.0.2"
if manifest["version"]!="2.0.2" or manifest["format"]!=1:raise ValueError("Not the initial public source snapshot")
commit=subprocess.check_output(["git","rev-parse","HEAD"],text=True).strip();ref=prepare.api("/git/ref/tags/"+tag)
obj=ref["object"]
if obj["type"]=="tag":obj=prepare.api("/git/tags/"+obj["sha"])["object"]
if obj["sha"]!=commit:raise ValueError("Initial tag mismatch")
try:release=prepare.api("/releases/tags/"+tag)
except urllib.error.HTTPError as error:
 if error.code!=404:raise
 notes=(root/"CHANGELOG.md").read_text()
 release=prepare.api("/releases","POST",{"tag_name":tag,"target_commitish":commit,"name":"LUXIPANEL v2.0.2 — first public monorepo release","body":notes,"draft":False,"prerelease":False})
for label in ["announcement","release:v2.0.2"]:
 try:prepare.api("/labels","POST",{"name":label,"color":"1565c0"})
 except urllib.error.HTTPError as error:
  if error.code!=422:raise
issues=prepare.api("/issues?state=all&labels=release:v2.0.2")
if not issues:prepare.api("/issues","POST",{"title":"LUXIPANEL v2.0.2 disponible","body":"Primera entrega pública de web, desktop y mobile. Notas, instalación y comentarios: "+release["html_url"],"labels":["announcement","release:v2.0.2"]})
print(release["html_url"])
