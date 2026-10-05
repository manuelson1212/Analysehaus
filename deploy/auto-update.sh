#!/usr/bin/env bash
# Pulls new commits of the deployed branch and rebuilds the site. Runs from cron every 5 minutes; does nothing if up to date.
set -euo pipefail
cd "$(dirname "$0")/.."
exec 9>/tmp/apexwave-update.lock
flock -n 9 || exit 0
git fetch -q origin
[ "$(git rev-parse HEAD)" = "$(git rev-parse '@{u}')" ] && exit 0
echo "$(date -Is) updating $(git rev-parse --short HEAD) -> $(git rev-parse --short '@{u}')"
git merge -q --ff-only '@{u}'
docker compose up -d --build
echo "$(date -Is) done"
