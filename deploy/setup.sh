#!/usr/bin/env bash
# One-step install/update on a fresh Ubuntu server. Run from the repository folder: bash deploy/setup.sh
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v docker >/dev/null 2>&1; then
  echo "Installiere Docker ..."
  curl -fsSL https://get.docker.com | sh
fi

if [ ! -f .env ]; then
  cp deploy/env.example .env
  sed -i "s/^SESSION_SECRET=.*/SESSION_SECRET=$(openssl rand -hex 32)/" .env
  sed -i "s/^ADMIN_PASSWORD=.*/ADMIN_PASSWORD=$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 20)/" .env
  chmod 600 .env
  echo
  echo "Neue Einstellungen in .env angelegt."
  echo "Dein Admin-Passwort (bitte sicher aufschreiben, nicht weitergeben):"
  grep '^ADMIN_PASSWORD=' .env | cut -d= -f2-
  echo
fi

docker compose up -d --build
echo
echo "Fertig. Die Seite startet unter https://$(grep '^DOMAIN=' .env | cut -d= -f2-)"
echo "Das HTTPS-Zertifikat kommt automatisch, sobald die Domain auf diesen Server zeigt."
