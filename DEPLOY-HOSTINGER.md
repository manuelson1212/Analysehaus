# Live gehen mit Hostinger (apexwave.pro)

Die Seite braucht einen Server, auf dem Node.js dauerhaft läuft und eine kleine Datenbank speichern kann.
Bei Hostinger ist das ein **VPS** (z. B. KVM 1 oder KVM 2). Normales Webhosting reicht dafür nicht sicher aus.
Domain und E-Mail (info@apexwave.pro) bleiben ganz normal bei Hostinger.

## 1. VPS einrichten

1. hPanel → **VPS** → Betriebssystem wählen: **Ubuntu 24.04 mit Docker** (falls angeboten), sonst Ubuntu 24.04.
2. Ein sicheres Root-Passwort setzen. Die **IP-Adresse** des VPS notieren.
3. hPanel → VPS → **Firewall**: Ports **22**, **80** und **443** erlauben.

## 2. Domain auf den VPS zeigen lassen

hPanel → **Domains** → apexwave.pro → **DNS / Nameserver**:

| Typ | Name  | Ziel            |
|-----|-------|-----------------|
| A   | @     | IP deines VPS   |
| A   | www   | IP deines VPS   |

Alte A- oder CNAME-Einträge für `@` und `www` löschen.
**MX-, SPF- (TXT) und DKIM-Einträge nicht anfassen**, sonst funktioniert deine E-Mail nicht mehr.
Die Umstellung braucht meist wenige Minuten, manchmal bis zu einigen Stunden.

## 3. Seite installieren

Im hPanel beim VPS auf **Browser-Terminal** klicken (oder per SSH verbinden) und nacheinander eingeben:

```bash
# Nur nötig, wenn Docker noch nicht installiert ist:
curl -fsSL https://get.docker.com | sh

git clone -b claude/finance-platform-ai-marketing-b6habe https://github.com/manuelson1212/Analysehaus.git
cd Analysehaus
cp deploy/env.example .env
openssl rand -hex 32     # zweimal ausführen: einmal für SESSION_SECRET, einmal als ADMIN_PASSWORD
nano .env                # Werte eintragen, speichern mit Strg+O, Enter, Strg+X
docker compose up -d --build
```

Nach etwa einer Minute ist die Seite unter **https://apexwave.pro** erreichbar. Das HTTPS-Zertifikat holt sich der
Server automatisch. `https://apexwave.pro/healthz` sollte `ok` anzeigen. `www.apexwave.pro` leitet automatisch weiter.

Falls es nicht klappt: `docker compose logs --tail 50` zeigt, was los ist. Meist zeigt die Domain noch nicht auf den VPS.

## 4. Danach im Admin-Bereich

1. `https://apexwave.pro/admin` öffnen, mit dem ADMIN_PASSWORD einloggen.
2. **Einstellungen**: Ende der kostenlosen Phase, Preis, Kleinunternehmer-Haken, Impressum, Datenschutz, AGB.
3. KI-Agent: `ANTHROPIC_API_KEY` in `.env` eintragen, `AGENT_PROVIDER=claude` setzen, dann `docker compose up -d`.
4. Stripe: siehe `DEPLOY.md`. Die Webhook-Adresse ist `https://apexwave.pro/api/stripe/webhook`.

## Updates einspielen

```bash
cd Analysehaus && git pull && docker compose up -d --build
```

Datenbank und hochgeladene Charts liegen in einem eigenen Docker-Volume und bleiben bei Updates erhalten.

## Backup

```bash
cd Analysehaus
docker run --rm -v apexwave_app-data:/data -v "$PWD":/backup alpine tar czf /backup/backup-$(date +%F).tar.gz -C /data .
```

Die Datei regelmäßig herunterladen (z. B. per SFTP). Zusätzlich im hPanel die automatischen VPS-Backups/Snapshots einschalten.
