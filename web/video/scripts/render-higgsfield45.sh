#!/usr/bin/env bash
set -euo pipefail

mkdir -p out/higgsfield45 .cache/render-higgsfield45
export TMPDIR="$PWD/.cache/render-higgsfield45"
node scripts/prepare-higgsfield45.mjs
node scripts/generate-higgsfield45-audio.mjs

if [[ "${1:-}" != "--reuse-raw" ]]; then
  node scripts/render-higgsfield45.mjs "$@"
fi
if [[ "${1:-}" == "--stills-only" ]]; then
  exit 0
fi

ffmpeg -hide_banner -loglevel error -y -i out/higgsfield45/preview-raw.mp4 \
  -vf 'sidedata=mode=delete:type=ICC_PROFILE,scale=in_range=pc:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709,format=yuv420p,setparams=range=limited:color_primaries=bt709:color_trc=bt709:colorspace=bt709' \
  -c:v libx264 -threads 2 -preset fast -crf 19 -pix_fmt yuv420p \
  -color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -af 'loudnorm=I=-16:TP=-1.8:LRA=9,aresample=48000' \
  -c:a aac -b:a 192k -t 45 -movflags +faststart \
  out/higgsfield45/luxipanel-45s-preview.mp4
