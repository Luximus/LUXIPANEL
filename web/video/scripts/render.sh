#!/usr/bin/env bash
set -euo pipefail

mkdir -p out
raw="out/luxipanel-portrait-45s-raw.mp4"
final="out/luxipanel-portrait-45s.mp4"

./node_modules/.bin/remotion render src/index.ts LuxiPanelPortrait "$raw" \
  --codec h264 --pixel-format yuv420p --crf 18 \
  --audio-codec aac --audio-bitrate 256K --concurrency 2

ffmpeg -hide_banner -loglevel error -y -i "$raw" \
  -vf 'scale=in_range=pc:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709,format=yuv420p' \
  -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p \
  -color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -c:a copy -movflags +faststart "$final"
rm "$raw"
