#!/usr/bin/env bash
set -euo pipefail

mkdir -p out .cache/render-voice
export TMPDIR="$(pwd)/.cache/render-voice"
raw=".cache/render-voice/luxisoft-business-en-raw.mp4"
final="out/luxisoft-negocio-gratis-en-preview.mp4"
converted=".cache/render-voice/luxisoft-business-en-color.mp4"

if [[ "${1:-}" == "--reuse-raw" ]]; then
  frames="$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of default=noprint_wrappers=1:nokey=1 "$raw")"
  [[ "$frames" == "1350" ]] || { echo "The cached render must contain exactly 1350 frames." >&2; exit 1; }
else
  ./node_modules/.bin/remotion render src/index.ts LuxiSoftBusinessFreeEnglish "$raw" \
    --codec h264 --pixel-format yuv420p --crf 16 --muted --concurrency 2 --log error
fi
ffmpeg -hide_banner -loglevel error -y -i "$raw" -i public/audio/score-business.wav \
  -vf 'sidedata=mode=delete:type=ICC_PROFILE,scale=in_range=pc:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709,format=yuv420p,setparams=range=limited:color_primaries=bt709:color_trc=bt709:colorspace=bt709' \
  -map 0:v:0 -map 1:a:0 -c:v libx264 -threads 2 -preset medium -crf 18 -pix_fmt yuv420p \
  -color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -c:a aac -b:a 256k -ar 48000 -t 45 -movflags +faststart "$converted"
mv "$converted" "$final"
rm "$raw"
