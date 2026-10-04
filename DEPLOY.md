# Going live on Render

Render runs the site as one web service with a small persistent disk (database and uploaded screenshots).
Costs: the instance type with a disk is a paid plan. Check the current price in the Render dashboard before you confirm.

## Steps

1. Create an account at render.com and connect your GitHub account.
2. **New → Blueprint**, choose the `Analysehaus` repository and the branch to deploy. Render reads `render.yaml`.
3. Fill in the secrets Render asks for:
   - `ADMIN_PASSWORD`: a long, unique password for `/admin`. Never reuse the demo password.
   - `PUBLIC_URL`: your final address, for example `https://apexwave.pro` (no slash at the end). You can set the Render address first and change it when your domain is connected.
   - `ANTHROPIC_API_KEY`: your key from console.anthropic.com. Set a spending limit there.
   - Leave the Stripe fields empty until payments are set up.
4. Deploy. When the build is green, open the Render address. `/healthz` should answer `ok`.
5. Open `/admin`, log in and set **Settings** (free access end date, price).
6. Set `AGENT_PROVIDER=claude` in the Render environment, redeploy, then use **AI agent → Test connection**.
7. **Custom domain:** Render dashboard → Settings → Custom Domains. Add the DNS records Render shows at your domain provider. HTTPS is issued automatically.
8. Fill in the legal pages in **Settings** (Imprint, Privacy, Terms) before you promote the site.

## Payments with Stripe (membership paywall)

How it works: after the free period ends, the details of each analysis and the zones of running depot positions need a
membership. Visitors create an account on `/account` and pay on Stripe's hosted page. Card data never touches this server.
Stripe tells the site about the subscription through a signed webhook. Public content (chart, wave count, the whole
track record) stays free. The admin **Members** tab shows everyone and lets you grant free access.

1. Create a Stripe account at stripe.com and **stay in test mode** first.
2. Products → create a product "Membership" with a recurring monthly price. Copy the **price ID** (`price_...`).
3. Developers → API keys: copy the **secret key** (`sk_test_...`).
4. Developers → Webhooks → add an endpoint `https://YOUR-ADDRESS/api/stripe/webhook` and select these events:
   `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.
   Copy the **signing secret** (`whsec_...`).
5. In Render set `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` and redeploy.
6. Settings (admin): set the end date of the free period and the price shown on the site (same as in Stripe).
7. Test the full flow with Stripe's test card `4242 4242 4242 4242`: create an account, subscribe, check that details unlock,
   cancel in the billing portal, check that they lock again.
8. Stripe dashboard → Settings → Customer portal: turn on cancellation. Settings → Branding and Public details: add your terms and privacy links.
9. Only then switch to live keys (`sk_live_...`, live price ID, a new live webhook secret).

Before charging real customers in the EU you need: terms with a cancellation policy, a privacy policy, an imprint,
a way to handle the right of withdrawal for digital content, and correct VAT. Stripe Tax can calculate VAT:
set `STRIPE_AUTOMATIC_TAX=1` after you have set it up in Stripe. Please have the legal texts checked by a lawyer.

Consumer law details already built in: the footer link "Verträge hier kündigen" (§ 312k BGB) opens a cancellation
form that works without login, cancels a Stripe subscription at the period end automatically and puts every
cancellation into the admin Inbox. You must send the customer a confirmation by email right away (use "Reply by email").
Before checkout the customer must tick the withdrawal-right notice, and the order button reads "Zahlungspflichtig
abonnieren". Have these texts checked together with your terms.

Not built yet: password reset by email and email verification (both need an email provider). Until then you can
delete a member or grant access from the admin Members tab.

## Daily briefing at 09:00

`BRIEFING_AUTO=1` creates a draft briefing every day at 09:00 Europe/Berlin and puts a note in the admin Inbox.
`BRIEFING_NEWS=websearch` (with `AGENT_PROVIDER=claude`) lets the agent search the web for the day's macro news and
list the sources it found. It is a draft: you review it, open the social pack in the Content studio, render the motion
video and post it yourself. Each briefing costs a few API calls; the web search adds cost, so start with it off.

## Backups

The database is one SQLite file on the disk (`/var/data/analysehaus.db`) plus the `uploads` folder.
Turn on disk snapshots in the Render dashboard if they are offered for your plan, and download a copy regularly.

## Other hosts

Hostinger VPS (or any server with Docker): see `DEPLOY-HOSTINGER.md`. It uses `docker-compose.yml`, which adds Caddy for automatic HTTPS.
The `Dockerfile` alone works on any container host. Mount a volume at `/data` and set the same environment variables.
