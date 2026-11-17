#!/bin/bash
SRC="/mnt/c/Users/GABS/wand/vanilla-media/media/play/v2/content/global/rooms"
OUT="/mnt/e/project/club-penguin-browser/client/public/assets/sfx"
mkdir -p "$OUT"
cd /mnt/e/project/club-penguin-browser
for room in town coffee dance pizza plaza forts dojo beach dock lodge mine rink shop book boiler lounge pet cave stage forest light ship village attic dojoext cavemine mtn cove shack berg; do
  swf="$SRC/$room.swf"
  if [ ! -f "$swf" ]; then echo "$room: no swf"; continue; fi
  cp "$swf" "tools/sndtmp/$room.swf"
  rm -rf "$OUT/$room"
  mkdir -p "$OUT/$room"
  /mnt/e/node.exe tools/extract-swf-mp3.mjs "E:\\project\\club-penguin-browser\\tools\\sndtmp\\$room.swf" "E:\\project\\club-penguin-browser\\client\\public\\assets\\sfx\\$room\\sound" --all 2>&1 | grep -E "sounds found|NO SOUNDS" | head -1 | sed "s/^/$room: /"
done
