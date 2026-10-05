#!/usr/bin/env bash
# Shows whether the server runs the newest version and whether automatic updates work.
cd "$(dirname "$0")/.."
git fetch -q origin 2>/dev/null
echo "Version auf dem Server:  $(git log --oneline -1 HEAD)"
echo "Neueste Version (GitHub): $(git log --oneline -1 '@{u}')"
[ "$(git rev-parse HEAD)" = "$(git rev-parse '@{u}')" ] && echo "=> Server ist aktuell." || echo "=> Server ist NICHT aktuell."
[ -f /etc/cron.d/apexwave-update ] && echo "Automatische Updates: eingerichtet" || echo "Automatische Updates: NICHT eingerichtet"
systemctl is-active --quiet cron 2>/dev/null && echo "Zeitplaner (cron): läuft" || echo "Zeitplaner (cron): läuft NICHT"
echo "Letzte Update-Einträge:"; tail -n 4 /var/log/apexwave-update.log 2>/dev/null || echo "  (noch keine)"
echo "Container:"; docker compose ps --format '  {{.Service}}: {{.Status}}' 2>/dev/null
