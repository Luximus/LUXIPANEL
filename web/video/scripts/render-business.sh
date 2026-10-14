#!/usr/bin/env bash
set -euo pipefail

mkdir -p out .cache/render-v3
export TMPDIR="$(pwd)/.cache/render-v3"
raw="out/luxisoft-negocio-gratis-raw.mp4"
final="out/luxisoft-negocio-gratis.mp4"

node scripts/generate-business-audio.mjs
./node_modules/.bin/remotion render src/index.ts LuxiSoftBusinessFree "$raw" \
  --codec h264 --pixel-format yuv420p --crf 16 \
  --audio-codec aac --audio-bitrate 256K --concurrency 2 --log error

ffmpeg -hide_banner -loglevel error -y -i "$raw" \
  -vf 'sidedata=mode=delete:type=ICC_PROFILE,scale=in_range=pc:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709,format=yuv420p,setparams=range=limited:color_primaries=bt709:color_trc=bt709:colorspace=bt709' \
  -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p \
  -color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -c:a copy -movflags +faststart "$final"
rm "$raw"
