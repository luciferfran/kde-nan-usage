#!/usr/bin/env bash
# Check API key file permissions and warn if insecure.
#
# Usage:
#   check-key-perms [key-path]
#
# Exit codes:
#   0 - key exists and has secure permissions (mode 600 or 400)
#   1 - key missing or has insecure permissions

set -euo pipefail

KEY_PATH="${1:-$HOME/.config/nan/api-key}"

if [ ! -f "$KEY_PATH" ]; then
    printf '\033[1;33m⚠ Warning\033[0m: key file not found at %s\n' "$KEY_PATH"
    printf 'Create it with: (umask 177; printf "%%s" "YOUR_KEY" > %s)\n\n' "$KEY_PATH"
    exit 1
fi

PERMS=$(stat -c '%a' "$KEY_PATH" 2>/dev/null || stat -f '%Lp' "$KEY_PATH" 2>/dev/null || echo "unknown")

if [ "$PERMS" = "600" ] || [ "$PERMS" = "400" ]; then
    printf '\033[1;32m✓\033[0m Key file %s has secure permissions (mode %s)\n' "$KEY_PATH" "$PERMS"
    exit 0
fi

printf '\033[1;31m✗ Insecure permissions\033[0m on %s (mode %s, should be 600 or 400)\n\n' "$KEY_PATH" "$PERMS"
printf 'Fix with:\n'
printf '    chmod 600 %s\n\n' "$KEY_PATH"

# Without a terminal (CI, piped installs) there is nobody to answer the prompt.
if [ -n "${CI:-}" ] || [ ! -t 0 ]; then
    printf '\033[1;33mℹ Non-interactive: not changing permissions\033[0m\n'
    exit 0
fi

printf '⚠ Fix permissions now? [y/N] '
read -r RESP
if [[ "$RESP" =~ ^[Yy] ]]; then
    chmod 600 "$KEY_PATH"
    printf '\033[1;32m✓\033[0m Permissions fixed\n'
    exit 0
else
    printf '\033[1;33mℹ Skipped — fix manually:\n'
    printf '     chmod 600 %s\n' "$KEY_PATH"
    printf '\033[0m\n'
    exit 1
fi
