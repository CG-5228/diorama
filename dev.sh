#!/bin/sh
# Starts the Diorama viewer and opens it in the browser (macOS and Linux). Windows: dev.bat.
URL="http://localhost:5173"
if curl -s -o /dev/null "$URL"; then
  echo "Diorama viewer already running at $URL"
else
  npm run view &
  sleep 3
fi
if command -v open >/dev/null 2>&1; then open "$URL"; elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL"; fi
wait
