#!/usr/bin/env bash
# Run home-watch.py in the background on this Mac: starts at login, restarts if it stops.
#   TV_HOST=192.168.1.50 ./home-watch-mac.sh            # install / update
#   ./home-watch-mac.sh uninstall
# Log: ~/Library/Logs/tv-vibehack-home-watch.log
set -euo pipefail
cd "$(dirname "$0")"
LABEL=com.tvvibehack.homewatch
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/tv-vibehack-home-watch.log"

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
if [ "${1:-}" = uninstall ]; then
  rm -f "$PLIST"
  echo "Removed. Home opens LG's home again."
  exit 0
fi

: "${TV_HOST:?set TV_HOST to the TV IP address, e.g. TV_HOST=192.168.1.50 $0}"
[ -x venv/bin/python ] || python3 -m venv venv
venv/bin/pip install -q websockets

mkdir -p "$(dirname "$PLIST")"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$PWD/venv/bin/python</string>
    <string>-u</string>
    <string>$PWD/home-watch.py</string>
    <string>$TV_HOST</string>
  </array>
  <key>WorkingDirectory</key><string>$PWD</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
EOF
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Running. Press Home on the remote. Log: $LOG"
