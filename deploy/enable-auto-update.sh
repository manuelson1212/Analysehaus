#!/usr/bin/env bash
# One-time setup: checks GitHub every 5 minutes and puts new versions live automatically. Log: /var/log/apexwave-update.log
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
if ! command -v cron >/dev/null 2>&1; then
  echo "Installiere den Zeitplaner (cron) ..."
  apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq cron >/dev/null
fi
systemctl enable --now cron >/dev/null 2>&1 || service cron start >/dev/null 2>&1 || true
chmod +x "$DIR/deploy/auto-update.sh"
echo "*/5 * * * * root $DIR/deploy/auto-update.sh >> /var/log/apexwave-update.log 2>&1" > /etc/cron.d/apexwave-update
chmod 644 /etc/cron.d/apexwave-update
echo "Automatische Updates sind an: Neue Versionen gehen innerhalb von 5 Minuten live."
