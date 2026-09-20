#!/usr/bin/env bash
# ==============================================================
# Launches a SEPARATE Chrome instance with its own profile dir
# and remote debugging on port 9222.
#
# Your main Chrome (with your day-to-day tabs and logins) stays
# open and untouched. This is a second window you log into the
# test sites in ONCE; cookies persist forever in that profile.
#
# Why a separate profile? Chrome cannot enable the debug port on
# a profile that's already in use, and Chrome 127+ encrypts
# cookies with App-Bound Encryption so we can't read them from
# your main profile externally.
# ==============================================================
set -euo pipefail

PORT=9222
DEBUG_PROFILE="$HOME/chrome-debug-profile"

case "$(uname -s)" in
  Darwin)
    CANDIDATES=(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
      "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary"
      "/Applications/Chromium.app/Contents/MacOS/Chromium"
    )
    ;;
  Linux)
    CANDIDATES=(
      "$(command -v google-chrome || true)"
      "$(command -v google-chrome-stable || true)"
      "$(command -v chromium || true)"
      "$(command -v chromium-browser || true)"
    )
    ;;
  *)
    echo "Unsupported OS: $(uname -s). Use start-chrome-debug.bat on Windows." >&2
    exit 1
    ;;
esac

CHROME=""
for c in "${CANDIDATES[@]}"; do
  if [[ -n "$c" && -x "$c" ]]; then CHROME="$c"; break; fi
done

if [[ -z "$CHROME" ]]; then
  echo "Chrome not found. Set CHROME=/path/to/chrome and re-run." >&2
  exit 1
fi

echo "Launching Chrome with:"
echo "  --remote-debugging-port=$PORT"
echo "  --user-data-dir=$DEBUG_PROFILE"
echo
echo "Your main Chrome is NOT affected. This is a second window with"
echo "its own profile. Log into the test sites the first time; cookies"
echo "persist between runs."
echo

"$CHROME" --remote-debugging-port="$PORT" --user-data-dir="$DEBUG_PROFILE" >/dev/null 2>&1 &
disown || true

echo "Done. You can now run:  python test_smd.py"
