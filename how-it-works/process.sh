#!/bin/bash
# Usage: process.sh raw.mp4 out-basename   -> out.mp4 (1280x800 H.264 loop w/ crossfade seam) + out.webp poster
set -e
IN=$1; OUT=$2; XF=${XF:-0.5}
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$IN")
# crossfade loop: blend last XF seconds into first XF seconds, then drop the head
L=$(python3 -c "print(round($D-$XF,3))")
ffmpeg -v error -y -i "$IN" -filter_complex "
 [0:v]scale=1280:800:force_original_aspect_ratio=increase:flags=lanczos,crop=1280:800,fps=24,${GRADE:-null},format=yuv420p,split[a][b];
 [a]trim=start=$XF,setpts=PTS-STARTPTS[body];
 [b]trim=0:$XF,setpts=PTS-STARTPTS[head];
 [body][head]xfade=transition=fade:duration=$XF:offset=$(python3 -c "print(round($L-$XF,3))")[v]" \
 -map "[v]" -an -c:v libx264 -preset slow -crf ${CRF:-27} -profile:v high -pix_fmt yuv420p -movflags +faststart "$OUT.mp4"
ffmpeg -v error -y -i "$OUT.mp4" -frames:v 1 -c:v libwebp -quality 82 "$OUT.webp"
ls -la "$OUT.mp4" "$OUT.webp"
