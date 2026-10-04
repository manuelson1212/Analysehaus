# Apex Wave Capital

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

`/` home · `/analyses` (Research) · `/analysis?id=…` · `/depot` (live demo depot) · `/pricing` · `/support` (Contact) · `/admin`.

### Live demo depot and hit rate

Positions are added in the admin **Depot** tab: buy zone, stop, target, status (watching, open, target hit, stopped out),
entry and exit price, and proof (screenshot and/or link). The public hit rate is **calculated from these records**:
closed calls that reached the target before the stop, divided by all closed calls, always shown with the sample size
("8 of 10 closed calls"). With no closed calls the site shows "–". The depot is labelled as a simulation without real money.

### Free access period

The first start sets a free period of 30 days (`free_until`). Change the date and the later monthly price in the admin
**Settings** tab. The countdown bar, the home page and the pricing page follow it. Email sign-ups land in the **Inbox**.
This only controls texts and the countdown: it does not block content or take payments yet (that needs accounts and a
payment provider).

### AI agent and first videos

Admin **AI agent** tab: status, connection test and a step-by-step guide. In the **Content studio** choose
"★ Website promo" to generate a TikTok script and Instagram carousel that promote the free period and the depot, using
only numbers from your own records. Export the ZIP, record the video following the scene list and post it manually.
Direct posting to TikTok and Instagram is not built (it requires platform approval).

Pricing is example content. Before going public, add the legal pages your jurisdiction requires (for Germany:
Impressum and Datenschutzerklärung).
