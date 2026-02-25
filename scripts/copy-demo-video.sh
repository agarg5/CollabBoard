#!/bin/bash
# Script to copy the latest demo video to scripts/fun-board-demo.webm

LATEST_VIDEO=$(find test-results -name "video.webm" -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2-)

if [ -n "$LATEST_VIDEO" ] && [ -f "$LATEST_VIDEO" ]; then
  cp "$LATEST_VIDEO" scripts/fun-board-demo.webm
  echo "✅ Copied video to scripts/fun-board-demo.webm"
  ls -lh scripts/fun-board-demo.webm
else
  echo "❌ No video file found in test-results"
  exit 1
fi
