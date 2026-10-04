# Analysehaus

Elliott Wave analysis platform: a public gallery of analyses plus a private admin area with an
automated marketing agent that turns each analysis into a TikTok script and an Instagram carousel.

- Frontend: plain HTML/CSS and small ES modules, no framework, no build step.
- Backend: Node (>= 22.13), zero dependencies (`node:http`, `node:sqlite`).
- Dark terminal look, English UI and content, mobile first.

## Run

```bash
ADMIN_PASSWORD=choose-a-password npm start   # http://localhost:3000
```

Without `ADMIN_PASSWORD` a temporary password is printed at startup. Data lives in `data/` (SQLite and uploads).

| Variable | Default | Purpose |
|---|---|---|
| `ADMIN_PASSWORD` | random | Admin login |
| `SESSION_SECRET` | random per start | Session signing (set it to keep logins across restarts) |
| `PORT` | 3000 | HTTP port |
| `DATA_DIR` | `./data` | Database and uploads |
| `AGENT_PROVIDER` | `mock` | `mock` or `claude` (not connected yet) |

## Workflow

1. `/admin` → **New analysis**: asset, timeframe, wave count, scenarios, invalidation, targets, Fibonacci levels, text, tags and the TradingView screenshot (paste, drop or choose; it is converted to WebP in the browser).
2. Set status to *published* to show it in the public gallery.
3. **Content studio** → *Generate content*: the agent drafts the TikTok script and carousel.
4. Edit, *Save & preview visuals* (9:16 cover, 4:5 slides), *Approve*, *Export ZIP*.

Every caption and the last carousel slide carry the disclaimer. The server enforces this on generation and on save.

## Connecting the Claude API later

Implement `generate({ analysis, imagePath })` in `lib/agent/claude.js`, returning `{ tiktok, instagram }`
in the shape produced by `lib/agent/mock.js`, then run with `AGENT_PROVIDER=claude`.

## Tests

```bash
npm test
```
