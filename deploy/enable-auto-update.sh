#!/usr/bin/env bash
# One-time setup: checks GitHub every 5 minutes and puts new versions live automatically. Log: /var/log/apexwave-update.log
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
chmod +x "$DIR/deploy/auto-update.sh"
echo "*/5 * * * * root $DIR/deploy/auto-update.sh >> /var/log/apexwave-update.log 2>&1" > /etc/cron.d/apexwave-update
chmod 644 /etc/cron.d/apexwave-update
echo "Automatische Updates sind an: Neue Versionen gehen innerhalb von 5 Minuten live."
