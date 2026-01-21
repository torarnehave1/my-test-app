# Whitelabel + Custom Domain Setup (Test App)

This document explains how the custom domains (like `universi.no` and `movemetime.com`) are set up to use the reverse proxy + branding.
It uses simple language and is written for this test app.

## 1) What is the setup?

- A **Cloudflare Worker** sits in front of the app and works as a reverse proxy.
- The Worker forwards requests to the real app (Pages site) and adds a header:
  - `x-original-hostname` = the domain the user visited.
- The frontend reads that hostname and loads branding for it (logo, colors, etc.).

## 2) Two ways to add a domain

There are two types of domains:

### A) Subdomain (easy)
Example: `customer.yourdomain.com`

You can automate this with a script (DNS CNAME + attach to worker).

### B) Main domain (apex domain)
Example: `customer.com`

This must be added as a **custom domain** in the Cloudflare Workers dashboard.
CNAME alone is not enough for a main domain.

---

## 3) How the reverse proxy works

**Worker flow:**
1. User visits `https://customer.com`.
2. Cloudflare routes it to the Worker.
3. The Worker proxies requests to the real app (Pages site).
4. The Worker adds `x-original-hostname: customer.com`.
5. Frontend uses that header to load branding.

---

## 4) Cloudflare setup (step‑by‑step)

### Step 1: Create or reuse a Worker
Create a Worker called something like `brand-worker` or `test-brand-worker`.

The Worker should:
- Proxy all requests to your Pages URL.
- Set the `x-original-hostname` header.

### Step 2: Add a custom domain to the Worker
In Cloudflare dashboard:
1. Go to **Workers & Pages**.
2. Open your Worker.
3. Go to **Custom Domains**.
4. Add the domain you want (example: `customer.com`).
5. Cloudflare will guide you for DNS (Apex domains usually need Cloudflare DNS).

### Step 3: DNS for subdomains
For subdomains (example: `brand.yourdomain.com`):
1. Create a CNAME:
   - Name: `brand`
   - Target: `your-worker.workers.dev`
   - Proxy: ON (orange cloud)
2. (Optional) Also add the subdomain as a Worker custom domain.

### Step 4: Verify
Open the domain in a browser and confirm:
- The app loads.
- The hostname is correct.

---

## 5) Branding flow

Your frontend should:
1. Detect the hostname (from `x-original-hostname` or `window.location.hostname`).
2. Request branding config from your API/KV using that hostname.
3. Apply branding (logo, title, colors).

---

## 6) What to copy from vegvisr-frontend

These files show the real setup used in production:

- Reverse proxy worker: `vegvisr-frontend/brand-worker/index.js`
- Domain automation (subdomains): `vegvisr-frontend/brand-worker/create-custom-domain.js`
- Branding detection in frontend: `vegvisr-frontend/src/composables/useBranding.js`
- UI note about apex domains: `vegvisr-frontend/src/components/BrandingModal.vue`

---

## 7) Quick checklist (test app)

- [ ] Create Worker that proxies to `my-test-app.pages.dev`.
- [ ] Add `x-original-hostname` header in Worker.
- [ ] Add a custom domain in Cloudflare Workers.
- [ ] Point DNS to the Worker.
- [ ] Update the frontend to read branding from hostname.

---

## 8) Tips / common issues

- If a main domain (apex) is not working, make sure it is added under **Custom Domains** in Workers.
- If branding is not loading, check that `x-original-hostname` is passed through the Worker.
- Make sure all assets (JS/CSS) are also proxied by the Worker.

---

## 9) Self‑serve panel (test app)

The test app now has a control panel that talks to a **separate Worker**. That worker does two things:

1) Creates a DNS CNAME for the domain → the proxy worker.
2) Attaches the domain to the proxy worker (Cloudflare Workers custom domains).

This keeps branding headers working (reverse proxy).

### Components
- **Proxy Worker** (reverse proxy): `proxy-worker/`
- **Domain Worker** (control panel API): `domain-worker/`
- **UI panel**: `src/App.tsx`

### KV storage (brand mapping)
Both workers use a KV namespace to store the brand mapping:

- Key: `brand:<domain>`
- Value: `{ domain, targetApp, logoUrl, slogan, branding, createdAt, updatedAt }`

Create it once and bind it in **both** workers.
Update `proxy-worker/wrangler.toml` and `domain-worker/wrangler.toml` with the KV id.

### Required environment variables (Domain Worker)
Set these on the **domain worker** in Cloudflare (or with `wrangler secret`):

- `CF_API_TOKEN` = API token with **Zone DNS Edit** + **Zone Workers Routes Edit**
- `TARGET_WORKER_NAME` = proxy worker name (example: `test-brand-proxy-worker`)
- `TARGET_WORKER_DOMAIN` = proxy worker workers.dev domain
  (example: `test-brand-proxy-worker.yourname.workers.dev`)
 - `BRAND_CONFIG` = KV binding (see `wrangler.toml`)

### Required environment variables (Proxy Worker)
Set this on the **proxy worker**:

- `DEFAULT_ORIGIN` = `https://my-test-app.vegvisr.org`
- `APP_AICHAT_ORIGIN` = `https://aichat.vegvisr.org`
- `APP_CONNECT_ORIGIN` = `https://connect.vegvisr.org`
- `APP_PHOTOS_ORIGIN` = `https://photos.vegvisr.org`
- `BRAND_CONFIG` = KV binding (same namespace as domain worker)

### Frontend configuration
Set in your test app build env (Vite):

- `VITE_DOMAIN_API_BASE` = domain worker URL
  (example: `https://test-domain-worker.yourname.workers.dev`)

### API routes
The domain worker exposes:
- `GET /custom-domain` → list domains attached to the proxy worker
- `POST /custom-domain` → add domain

Body example:
```json
{
  "domain": "connect.universi.no",
  "targetApp": "connect",
  "logoUrl": "https://example.com/logo.png",
  "slogan": "Move with intention",
  "branding": {
    "brand": {
      "name": "Movemetime",
      "logoUrl": "https://example.com/logo.png",
      "slogan": "Vegvisr Connect - Early Access"
    },
    "theme": {
      "background": {
        "base": "#0b1020",
        "radialTop": "rgba(59,130,246,0.35)",
        "radialBottom": "rgba(139,92,246,0.35)"
      },
      "text": {
        "primary": "#e5e7eb",
        "muted": "rgba(229,231,235,0.7)",
        "headlineGradient": ["#3b82f6", "#8b5cf6"]
      },
      "card": {
        "bg": "rgba(255,255,255,0.12)",
        "border": "rgba(255,255,255,0.2)"
      },
      "button": {
        "bgGradient": ["#3b82f6", "#8b5cf6"],
        "text": "#ffffff"
      }
    },
    "copy": {
      "badge": "Vegvisr Connect - Early Access",
      "headline": "Find your learning path with Vegvisr",
      "subheadline": "Answer a few questions so we can tailor your onboarding experience.",
      "emailLabel": "Enter your email to get a magic link",
      "emailPlaceholder": "Enter your email address",
      "cta": "Send magic link"
    },
    "language": { "default": "en" },
    "layout": { "showLanguageToggle": true }
  }
}
```

### Notes
- This uses **Workers Routes** instead of Workers custom domains.
- This only works for domains in your Cloudflare account.
- DNS + SSL can take a few minutes after adding a domain.
