#!/usr/bin/env bash
set -euo pipefail

mkdir -p out .cache/render-v2
export TMPDIR="$(pwd)/.cache/render-v2"
raw="out/luxipanel-chat-impact-v2-raw.mp4"
final="out/luxipanel-chat-impact-v2.mp4"

node scripts/generate-impact-audio.mjs
./node_modules/.bin/remotion render src/index.ts LuxiPanelChatImpact "$raw" \
  --codec h264 --pixel-format yuv420p --crf 16 \
  --audio-codec aac --audio-bitrate 256K --concurrency 2 --log error

ffmpeg -hide_banner -loglevel error -y -i "$raw" \
  -vf 'scale=in_range=pc:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709,format=yuv420p' \
  -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p \
  -color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -c:a copy -movflags +faststart "$final"
rm "$raw"
