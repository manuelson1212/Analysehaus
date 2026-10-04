# Analysehaus

Elliott Wave analysis platform: a public gallery of analyses plus a private admin area with an
automated marketing agent that turns each analysis into a TikTok script and an Instagram carousel.

- Frontend: plain HTML/CSS and small ES modules, no framework, no build step.
- Backend: Node (>= 22.13) with `node:http` and `node:sqlite`. The only dependency is the official `@anthropic-ai/sdk` (used by the Claude provider).
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
| `AGENT_PROVIDER` | `mock` | `mock` (templates, no AI) or `claude` (chart vision + generation) |
| `ANTHROPIC_API_KEY` | none | Required for `AGENT_PROVIDER=claude` |
| `CLAUDE_MODEL` | `claude-opus-5-5` | Model used by the Claude provider |
| `CLAUDE_FALLBACK` | on | Set to `off` on platforms without server-side fallbacks (Bedrock, Vertex, Foundry) |

## Workflow

1. `/admin` → **New analysis**: asset, timeframe, wave count, scenarios, invalidation, targets, Fibonacci levels, text, tags and the TradingView screenshot (paste, drop or choose; it is converted to WebP in the browser).
2. Set status to *published* to show it in the public gallery.
3. **Content studio** → *Generate content*: the agent drafts the TikTok script and carousel.
4. Edit, *Save & preview visuals* (9:16 cover, 4:5 slides), *Approve*, *Export ZIP*.

Every caption and the last carousel slide carry the disclaimer. The server enforces this on generation and on save.

## Claude provider (chart vision)

```bash
npm install
ANTHROPIC_API_KEY=sk-ant-... AGENT_PROVIDER=claude ADMIN_PASSWORD=... npm start
```

`lib/agent/claude.js` sends the screenshot (image block) plus the written fields to Claude with a system prompt for
classical Elliott Wave content, and requests a JSON-schema constrained answer (`output_config.format`) with
adaptive thinking. The model:

- reads wave labels and levels from the chart and treats the analyst's text as the source of truth,
- reports mismatches between chart and text in **Chart reading (internal)** in the Content studio, never in the posts,
- never invents levels, and writes no trading instructions. The disclaimer is still enforced by the server.

A safety-classifier refusal is retried server-side on a fallback model (`fallbacks: "default"`). Errors such as missing
credentials, rate limits or refusals show up as readable messages in the studio.

## Tests

```bash
npm test
```

## Online preview (no server)

`npm run demo:build` writes `demo-dist/index.html`: one self-contained page that runs the real frontend code against a
browser-only stand-in for the server (`demo/demo-api.js`, data in localStorage, mock agent, sample analyses). Admin
password in the preview: `demo`. The ZIP download is turned off there; everything else works.

## Pages

`/` home (interactive Elliott Wave diagram) · `/analyses` · `/analysis?id=…` · `/about` · `/pricing` · `/support` · `/admin`.
Pricing is example content; no payment is connected. The support form stores messages in the admin Inbox
(5 messages per hour per IP). Before going public, add the legal pages your jurisdiction requires (for Germany:
Impressum and Datenschutzerklärung).
