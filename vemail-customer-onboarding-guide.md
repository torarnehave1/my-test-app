# Vemail Customer Onboarding Guide

How to set up a new vemail store-worker for a customer. Each customer gets their own Cloudflare account with an isolated D1 database and R2 bucket for email storage.

---

## System Architecture

```
                      ┌─────────────────────────────────────────────┐
                      │  CUSTOMER'S CLOUDFLARE ACCOUNT              │
                      │                                             │
                      │  vemail-store-worker                        │
                      │  ├── D1: vemail_db                          │
                      │  │   ├── emails table (metadata)            │
                      │  │   └── attachments table (R2 pointers)    │
                      │  ├── R2: vemail-emails                      │
                      │  │   ├── bodies/{id}.html                   │
                      │  │   ├── raw/{id}.eml                       │
                      │  │   └── attachments/{id}/{filename}        │
                      │  └── HTTP API (CRUD)                        │
                      │      https://vemail-store-worker.<sub>.workers.dev │
                      └──────────────▲──────────────────────────────┘
                                     │ HTTP POST/GET
       ┌─────────────────────────────┼─────────────────────────────────┐
       │  MAIN CLOUDFLARE ACCOUNT    │  (torarnehave, vegvisr.org)     │
       │                             │                                 │
       │  email-worker (cookie.vegvisr.org)                            │
       │  ├── D1: vegvisr_org                                         │
       │  │   └── config table                                        │
       │  │       ├── email accounts + aliases (per user)              │
       │  │       ├── app passwords (encrypted, per account)           │
       │  │       └── storeUrl (per account → customer store-worker)   │
       │  ├── email() handler ← CF Email Routing (inbound)            │
       │  │   └── Parses with postal-mime → POST to store-worker      │
       │  ├── /send-gmail-email → slowyou.io SMTP + store sent copy   │
       │  └── /email-accounts (CRUD for account settings)             │
       │                                                               │
       │  vemail-vegvisr (Cloudflare Pages)                            │
       │  └── https://vemail.vegvisr.org                               │
       └───────────────────────────────────────────────────────────────┘
```

---

## Where Data Is Stored

### Overview

| Data | Location | Table / Key | Details |
|------|----------|-------------|---------|
| Email metadata (subject, from, to, folder, flags, timestamps) | **Customer D1** (`vemail_db`) | `emails` table | One row per email. `user_email` scopes all queries |
| Email HTML body | **Customer R2** (`vemail-emails`) | `bodies/{email_id}.html` | HTML content, `text/html` |
| Raw inbound email (RFC 5322) | **Customer R2** (`vemail-emails`) | `raw/{email_id}.eml` | Full original message, `message/rfc822`. Inbound only |
| Attachments (binary files) | **Customer R2** (`vemail-emails`) | `attachments/{email_id}/{filename}` | Original MIME type preserved |
| Attachment metadata (filename, mime, size) | **Customer D1** (`vemail_db`) | `attachments` table | FK to `emails.id`, `r2_key` points to R2 object |
| User account config (email, name, aliases, storeUrl) | **Main D1** (`vegvisr_org`) | `config` table, `data` JSON | Key: user's login email. JSON path: `settings.emailAccounts[]` |
| App passwords (Google 16-char) | **Main D1** (`vegvisr_org`) | `config` table, `data` JSON | JSON path: `settings.emailAccountPasswords[accountId]`. Never sent to browser |

### D1 Schema: Customer's vemail_db

```sql
-- emails table: one row per email
CREATE TABLE IF NOT EXISTS emails (
  id TEXT PRIMARY KEY,              -- crypto.randomUUID()
  user_email TEXT NOT NULL,         -- owner email (e.g. torarnehave@gmail.com)
  message_id TEXT,                  -- RFC 5322 Message-ID (for dedup)
  folder TEXT NOT NULL DEFAULT 'inbox',  -- inbox | sent | drafts | trash | archive
  from_address TEXT NOT NULL,
  from_name TEXT,
  to_address TEXT NOT NULL,
  cc TEXT,
  bcc TEXT,
  subject TEXT,
  snippet TEXT,                     -- first ~200 chars of plain text
  body_r2_key TEXT,                 -- R2 key: bodies/{id}.html
  raw_r2_key TEXT,                  -- R2 key: raw/{id}.eml (inbound only)
  has_attachments INTEGER DEFAULT 0,
  read INTEGER DEFAULT 0,
  starred INTEGER DEFAULT 0,
  received_at TEXT NOT NULL,        -- ISO 8601
  created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX idx_emails_user_folder ON emails(user_email, folder);
CREATE INDEX idx_emails_user_received ON emails(user_email, received_at DESC);
CREATE INDEX idx_emails_message_id ON emails(message_id);

-- attachments table: one row per file, FK to emails
CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  email_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER,
  r2_key TEXT NOT NULL,             -- R2 key: attachments/{email_id}/{filename}
  FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE
);

CREATE INDEX idx_attachments_email ON attachments(email_id);
```

### R2 Bucket: Customer's vemail-emails

| Key pattern | Content | MIME type |
|-------------|---------|-----------|
| `bodies/{email_id}.html` | Email HTML body | `text/html` |
| `raw/{email_id}.eml` | Raw RFC 5322 message (inbound only) | `message/rfc822` |
| `attachments/{email_id}/{filename}` | Binary attachment file | Original MIME type |

### D1 Schema: Main account's vegvisr_org (config table)

The main account D1 `config` table stores per-user settings as a JSON blob:

```
config table
├── email (TEXT, PRIMARY KEY) — the user's login email (e.g. torarnehave@gmail.com)
└── data (TEXT, JSON) — serialized settings object:
    {
      "settings": {
        "emailAccounts": [
          {
            "id": "uuid",
            "name": "Display Name",
            "email": "user@gmail.com",
            "aliases": ["user@vegvisr.org"],
            "isDefault": true,
            "hasPassword": true,
            "storeUrl": "https://vemail-store-worker.<sub>.workers.dev"
          }
        ],
        "emailAccountPasswords": {
          "<accountId>": "xxxx xxxx xxxx xxxx"   ← Google App Password (server-only)
        }
      }
    }
```

---

## Data Flows

### Sending an email

**Gmail accounts** use `/send-gmail-email`, **domain accounts** (@vegvisr.org, @movemetime.com, etc.) use `/send-email`.

```
Browser (ComposeView)
  │
  │ POST /send-gmail-email OR /send-email
  │   { userEmail, accountId, toEmail, subject, html }
  v
email-worker (cookie.vegvisr.org)
  │ 1. Loads account from D1 config (vegvisr_org)
  │ 2. Gmail: sends via Gmail SMTP with app password
  │    Domain: forwards to slowyou.io/api/smtp/send-domain-email → Postfix
  │ 3. On success: POST copy to store-worker with folder='sent'
  v
Customer store-worker
  │ 1. Generates UUID for email ID
  │ 2. Stores HTML body in R2: bodies/{id}.html
  │ 3. Inserts metadata row in D1: emails table (folder='sent')
  v
Email appears in Sent folder in vemail app
```

### Receiving an email (inbound via @vegvisr.org)

```
External sender → torarnehave@vegvisr.org
  │
  │ Cloudflare Email Routing (vegvisr.org MX records)
  v
email-worker email() handler (cookie.vegvisr.org)
  │ 1. Reads raw email bytes from message.raw
  │ 2. Parses with postal-mime → extracts from, to, subject, HTML body, attachments
  │ 3. Looks up recipient in main D1 config table:
  │    - Scans all rows in config table
  │    - For each user's settings.emailAccounts[], checks email + aliases
  │    - Finds matching account's storeUrl
  │    - Falls back to VEMAIL_STORE_URL env var if no match
  │ 4. POST parsed email to matching store-worker
  v
Customer store-worker
  │ 1. Deduplicates by message_id (if already stored, returns existing ID)
  │ 2. Generates UUID for email ID
  │ 3. Stores HTML body in R2: bodies/{id}.html
  │ 4. Stores raw email in R2: raw/{id}.eml
  │ 5. Stores each attachment in R2: attachments/{id}/{filename}
  │ 6. Inserts metadata in D1: emails table (folder='inbox')
  │ 7. Inserts one row per attachment in D1: attachments table
  v
Email appears in Inbox in vemail app
```

### Gmail forwarding → vemail

```
External sender → torarnehave@gmail.com
  │
  │ Gmail forwarding rule (configured in Gmail settings)
  v
torarnehave@vegvisr.org
  │
  │ (same as inbound flow above)
  v
email-worker → store-worker → vemail app inbox
```

---

## Prerequisites

- Node.js 18+ installed
- Wrangler CLI installed (`npm i -g wrangler`)
- Access to the `my-test-app.code-workspace` multi-repo workspace

---

## Step 1: Create a Cloudflare Account

1. Go to https://dash.cloudflare.com/sign-up
2. Register with the customer's email (e.g. `customer@example.com`)
3. Note down the **Account ID** from the Cloudflare dashboard (found in the URL or under Account Home > right sidebar)
4. Create an **API Token** with "Edit Cloudflare Workers" permissions (Account Settings > API Tokens > Create Token)

---

## Step 2: Create the Local Folder

Create a folder named after the Cloudflare login email:

```bash
mkdir -p "/Users/torarnehave/Documents/GitHub/cloudflare<CUSTOMER_EMAIL>"
mkdir -p "/Users/torarnehave/Documents/GitHub/cloudflare<CUSTOMER_EMAIL>/store-worker/src"
```

Example: `cloudflaremsneeggen@gmail.com`

---

## Step 3: Scaffold the Store Worker

### 3a. package.json

Create `store-worker/package.json`:

```json
{
  "name": "vemail-store-worker-<CUSTOMER_NAME>",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "db:create": "wrangler d1 create vemail_db",
    "db:migrate": "wrangler d1 execute vemail_db --file=schema.sql --remote",
    "db:migrate:local": "wrangler d1 execute vemail_db --file=schema.sql --local",
    "r2:create": "wrangler r2 bucket create vemail-emails"
  },
  "devDependencies": {
    "wrangler": "^4.0.0",
    "typescript": "^5.7.0",
    "@cloudflare/workers-types": "^4.20250109.0"
  }
}
```

### 3b. tsconfig.json

Create `store-worker/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

### 3c. schema.sql

Create `store-worker/schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS emails (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  message_id TEXT,
  folder TEXT NOT NULL DEFAULT 'inbox',
  from_address TEXT NOT NULL,
  from_name TEXT,
  to_address TEXT NOT NULL,
  cc TEXT,
  bcc TEXT,
  subject TEXT,
  snippet TEXT,
  body_r2_key TEXT,
  raw_r2_key TEXT,
  has_attachments INTEGER DEFAULT 0,
  read INTEGER DEFAULT 0,
  starred INTEGER DEFAULT 0,
  received_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_emails_user_folder ON emails(user_email, folder);
CREATE INDEX idx_emails_user_received ON emails(user_email, received_at DESC);
CREATE INDEX idx_emails_message_id ON emails(message_id);

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  email_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER,
  r2_key TEXT NOT NULL,
  FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE
);

CREATE INDEX idx_attachments_email ON attachments(email_id);
```

### 3d. src/index.ts

Copy the store-worker source from an existing customer folder:

```bash
cp "/Users/torarnehave/Documents/GitHub/cloudflaremsneeggen@gmail.com/store-worker/src/index.ts" \
   "/Users/torarnehave/Documents/GitHub/cloudflare<CUSTOMER_EMAIL>/store-worker/src/index.ts"
```

The source code is identical across all customers — no per-customer changes needed in `src/index.ts`.

### 3e. wrangler.toml (placeholder)

Create `store-worker/wrangler.toml` with the customer's account ID. Leave the D1 database_id as a placeholder — it will be filled in after creation:

```toml
name = "vemail-store-worker"
main = "src/index.ts"
compatibility_date = "2025-01-15"
compatibility_flags = ["nodejs_compat"]
workers_dev = true
account_id = "<CUSTOMER_ACCOUNT_ID>"

[[d1_databases]]
binding = "DB"
database_name = "vemail_db"
database_id = "<WILL_BE_FILLED_AFTER_CREATION>"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "vemail-emails"
```

---

## Step 4: Authenticate Wrangler

Log in with the customer's Cloudflare credentials:

```bash
cd "/Users/torarnehave/Documents/GitHub/cloudflare<CUSTOMER_EMAIL>/store-worker"
CLOUDFLARE_API_TOKEN=<CUSTOMER_API_TOKEN> npx wrangler whoami
```

Or use interactive login (will open browser):

```bash
npx wrangler login
```

> **Tip:** You can set the token as an env var for the session:
> ```bash
> export CLOUDFLARE_API_TOKEN="<TOKEN>"
> ```

---

## Step 5: Create D1 Database

```bash
cd store-worker
npx wrangler d1 create vemail_db
```

This outputs the database ID. Copy it and update `wrangler.toml`:

```
database_id = "<THE_RETURNED_ID>"
```

Then run the migration:

```bash
npm run db:migrate
```

**What this creates in the customer's D1 (vemail_db):**
- `emails` table — one row per email with metadata (subject, from, to, folder, read/starred flags, R2 keys for body/raw/attachments, timestamps)
- `attachments` table — one row per attachment with filename, MIME type, size, and R2 key. Foreign key to `emails.id` with cascade delete
- Indexes on `user_email+folder`, `user_email+received_at DESC`, `message_id`, `email_id`

---

## Step 6: Create R2 Bucket

```bash
npm run r2:create
```

This creates the `vemail-emails` R2 bucket on the customer's account.

**R2 key structure for stored emails:**

| Key | What is stored |
|-----|----------------|
| `bodies/{email_id}.html` | HTML body of the email (text/html) |
| `raw/{email_id}.eml` | Original raw RFC 5322 message (inbound only) |
| `attachments/{email_id}/{filename}` | Binary attachment files (original MIME type) |

---

## Step 7: Install Dependencies

```bash
npm install
```

---

## Step 8: Enable workers.dev Subdomain

If this is a brand new Cloudflare account, the workers.dev subdomain may not be active yet. Check:

```bash
npx wrangler deploy
```

If it fails with a subdomain error, the customer needs to:
1. Go to https://dash.cloudflare.com/<ACCOUNT_ID>/workers-and-pages
2. Complete the onboarding to register a `*.workers.dev` subdomain

You can also check via API:

```bash
curl -s "https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/workers/subdomain" \
  -H "Authorization: Bearer <API_TOKEN>" | jq .
```

---

## Step 9: Deploy

```bash
npm run deploy
```

The worker will be available at:
```
https://vemail-store-worker.<SUBDOMAIN>.workers.dev
```

---

## Step 10: Verify Deployment

```bash
curl https://vemail-store-worker.<SUBDOMAIN>.workers.dev/health
```

Expected response:
```json
{"ok":true,"worker":"vemail-store-worker"}
```

---

## Step 11: Add to Workspace

Edit `/Users/torarnehave/Documents/GitHub/my-test-app.code-workspace` and add the new folder:

```json
{
  "path": "cloudflare<CUSTOMER_EMAIL>"
}
```

---

## Step 12: Create a Google App Password

The customer needs a Google App Password so vemail can send emails through their Gmail account.

**Prerequisites:** The Google account must have 2-Step Verification enabled.

1. Go to https://myaccount.google.com/apppasswords
2. Sign in with the Gmail account (e.g. `torarnehave@gmail.com`)
3. Under "App name", enter `vemail` (or any label)
4. Click **Create**
5. Google shows a 16-character password (e.g. `abcd efgh ijkl mnop`). Copy it — you will need it in Step 14

> **Note:** This password is only shown once. If you lose it, delete the app password and create a new one.

**Where the app password ends up:**
- Stored in the **main account D1** (`vegvisr_org`), table `config`, JSON path: `settings.emailAccountPasswords[accountId]`
- The password is stored **server-side only** — it is never sent back to the browser
- The browser only sees `hasPassword: true` on the account object
- Used by the email-worker when sending via `/send-gmail-email` (resolved by `userEmail + accountId`)

---

## Step 13: Set Up Gmail "Send Mail As" (Optional)

If the customer wants to send emails from a vegvisr.org address (e.g. `torarnehave@vegvisr.org`) through their Gmail account:

### In Gmail:

1. Open Gmail and go to **Settings** (gear icon) > **See all settings**
2. Go to the **Accounts and Import** tab
3. Under "Send mail as", click **Add another email address**
4. Enter:
   - **Name**: The customer's display name
   - **Email address**: `torarnehave@vegvisr.org`
   - Uncheck "Treat as an alias" if you want replies to go to the vegvisr address
5. Click **Next Step**
6. Enter SMTP settings:
   - **SMTP Server**: `smtp.gmail.com`
   - **Port**: `587`
   - **Username**: `torarnehave@gmail.com` (the Gmail address)
   - **Password**: The App Password from Step 12
   - Select **Secured connection using TLS**
7. Click **Add Account**
8. Gmail sends a verification email to `torarnehave@vegvisr.org`. The customer must click the confirmation link in that email (see Step 15 for how inbound email reaches them)

After verification, the customer can select `torarnehave@vegvisr.org` as the "From" address when composing in Gmail or in vemail.

---

## Step 14: Configure in Vemail App

### 14a. User adds their account in the UI

The customer adds their email account in the vemail app:

1. Log in to vemail at https://vemail.vegvisr.org
2. Go to **Settings** (gear icon in the sidebar)
3. Click **Add Account**
4. Fill in:
   - **Display Name**: e.g. "Tor Arne" or "Work Email"
   - **Email Address**: `torarnehave@gmail.com` (the Gmail address used for sending)
   - **App Password**: The 16-character password from Step 12
5. Click **Add Account**
6. (Optional) If the customer also uses a vegvisr.org alias:
   - Click **+ Add alias** on the account card
   - Enter `torarnehave@vegvisr.org`
   - This alias will appear as a "From" option when composing

**What happens when the user adds an account:**
1. Account metadata saved to browser localStorage
2. Account metadata + app password synced to main D1 (`vegvisr_org`), table `config`:
   - Metadata in `settings.emailAccounts[]`: `{ id, name, email, aliases, isDefault, hasPassword, storeUrl }`
   - App password in `settings.emailAccountPasswords[accountId]` (server-side only)
3. The `storeUrl` field is empty (`""`) until an admin sets it via the setup script

### 14b. Admin sets the store URL via setup script

The **Store Worker URL** is not editable in the UI. It must be set by an admin using the setup script:

```bash
cd /Users/torarnehave/Documents/GitHub/my-test-app

# List the user's accounts to find the account email/ID
node vemail-setup.mjs list-accounts --user torarnehave@gmail.com

# Set the store URL for the account
node vemail-setup.mjs set-store-url \
  --user torarnehave@gmail.com \
  --account-email torarnehave@gmail.com \
  --store-url https://vemail-store-worker.<SUBDOMAIN>.workers.dev
```

**What the setup script does:**
1. `GET /email-accounts?user=<email>` on `cookie.vegvisr.org` → fetches existing accounts from main D1
2. Finds the matching account by email address
3. `POST /email-accounts` with updated `storeUrl` → email-worker saves to D1 `config` table
4. The `storeUrl` is now stored in `settings.emailAccounts[].storeUrl` for this account

After this, the store URL appears (read-only) in the user's Settings view, and all email storage for this account routes to the customer's dedicated store-worker.

---

## Step 15: Set Up Cloudflare Email Routing (Inbound Email)

This allows the customer to receive emails at their `@vegvisr.org` address. Inbound emails are routed through Cloudflare Email Routing to the email-worker, which parses them and stores them in the customer's store-worker.

### Prerequisites

- The `vegvisr.org` domain must be on the **main** Cloudflare account (where the email-worker runs)
- Email Routing must be enabled for `vegvisr.org`

### In the Cloudflare Dashboard (main account):

1. Go to https://dash.cloudflare.com > select the **vegvisr.org** zone
2. Navigate to **Email** > **Email Routing**
3. If Email Routing is not yet enabled, click **Get started** and follow the setup (this adds the required MX and TXT DNS records automatically)

### Add the customer's routing rule:

4. Under **Email Routing** > **Routing rules**, click **Create address**
5. Set:
   - **Custom address**: `torarnehave` (the part before @vegvisr.org)
   - **Action**: **Send to a Worker**
   - **Destination**: `email-worker`
6. Click **Save**

### What happens when an inbound email arrives:

1. External sender sends to `torarnehave@vegvisr.org`
2. Cloudflare Email Routing receives it (via MX records)
3. Routes to the `email-worker`'s `email()` handler
4. email-worker parses raw email with `postal-mime` (extracts from, to, subject, HTML body, attachments)
5. Looks up recipient in main D1 `config` table:
   - Scans all user rows
   - For each `settings.emailAccounts[]`, checks if `email` or any `aliases[]` match the recipient
   - Uses the matching account's `storeUrl`
   - Falls back to `VEMAIL_STORE_URL` env var (`https://vemail-store-worker.post-e91.workers.dev`) if no match
6. POSTs parsed email to the customer's store-worker: `POST /emails`
7. Store-worker saves:
   - D1 `emails` table: metadata row (id, user_email, folder='inbox', from, to, subject, snippet, body_r2_key, raw_r2_key, received_at)
   - R2 `bodies/{id}.html`: HTML body
   - R2 `raw/{id}.eml`: original raw message
   - D1 `attachments` + R2 `attachments/{id}/{filename}`: one entry per attachment
8. Email appears in the vemail app inbox

### Set up Gmail forwarding (for existing Gmail addresses):

If the customer also wants emails sent to `torarnehave@gmail.com` to appear in vemail:

1. In Gmail, go to **Settings** > **See all settings** > **Forwarding and POP/IMAP**
2. Click **Add a forwarding address**
3. Enter `torarnehave@vegvisr.org`
4. Gmail sends a confirmation code to `torarnehave@vegvisr.org` — since Email Routing is now active, this email will arrive in the vemail inbox. Find the confirmation code there
5. Enter the confirmation code in Gmail
6. Select **Forward a copy of incoming mail to** `torarnehave@vegvisr.org`
7. Choose what happens with the Gmail copy: **keep Gmail's copy in the Inbox** (recommended)
8. Click **Save Changes**

Now all emails to `torarnehave@gmail.com` are also forwarded to `torarnehave@vegvisr.org`, parsed by the email-worker, and stored in the customer's store-worker.

### Complete email flow diagram:

```
Sender → torarnehave@gmail.com
               │
               │ (Gmail forwarding rule)
               v
           torarnehave@vegvisr.org
               │
               │ (Cloudflare Email Routing → MX records)
               v
           email-worker email() handler (cookie.vegvisr.org)
               │
               │ 1. postal-mime parses raw RFC 5322 message
               │ 2. Looks up recipient in main D1 config → finds storeUrl
               │ 3. HTTP POST /emails to store-worker
               v
           vemail-store-worker.<subdomain>.workers.dev
               │
               ├── D1 (vemail_db):
               │   ├── emails row: id, user_email, folder='inbox', subject,
               │   │   from_address, to_address, snippet, body_r2_key,
               │   │   raw_r2_key, received_at, has_attachments
               │   └── attachments rows: id, email_id, filename,
               │       mime_type, size_bytes, r2_key
               │
               └── R2 (vemail-emails):
                   ├── bodies/{id}.html         ← HTML body
                   ├── raw/{id}.eml             ← original raw email
                   └── attachments/{id}/{file}  ← binary attachments
               │
               v
           vemail app inbox (https://vemail.vegvisr.org)
           Browser calls: GET /emails?user=<email>&folder=inbox
           from the store-worker URL on the active account
```

---

## Store Worker API Reference

All endpoints are on the customer's store-worker: `https://vemail-store-worker.<SUBDOMAIN>.workers.dev`

| Method | Path | Description | Parameters |
|--------|------|-------------|------------|
| `GET` | `/health` | Health check | — |
| `GET` | `/emails` | List emails (metadata only, no body) | `?user=<email>&folder=inbox&limit=50&offset=0` |
| `GET` | `/emails/:id` | Get single email + HTML body from R2 | `?user=<email>` |
| `POST` | `/emails` | Store a new email (used by send flow + inbound) | Body: `{ userEmail, folder, fromAddress, fromName, toAddress, subject, snippet, bodyHtml, rawEmail, attachments, messageId }` |
| `PUT` | `/emails/:id` | Update flags (read, starred, move folder) | Body: `{ userEmail, read, starred, folder }` |
| `DELETE` | `/emails/:id` | Hard delete (cleans up R2 body + attachments) | `?user=<email>` |
| `GET` | `/emails/:id/attachments` | List attachments for an email | — |
| `GET` | `/attachments/:id` | Download attachment binary from R2 | — |

All endpoints require `user` query param for authorization scoping. CORS is enabled (`Access-Control-Allow-Origin: *`).

---

## Email-Worker API Reference

All endpoints are on the main account: `https://cookie.vegvisr.org`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/email-accounts?user=<email>` | List user's email accounts (metadata only, no passwords returned) |
| `POST` | `/email-accounts` | Create or update account. Body: `{ userEmail, account: { id, name, email, aliases, isDefault, storeUrl }, appPassword }` |
| `DELETE` | `/email-accounts?user=<email>&id=<accountId>` | Remove account + stored password from D1 |
| `PUT` | `/email-accounts/sync` | Bulk sync account metadata (no passwords). Body: `{ userEmail, accounts: [...] }` |
| `POST` | `/send-gmail-email` | Send email via Gmail SMTP. Body: `{ userEmail, accountId, toEmail, subject, html }` |
| `POST` | `/send-email` | Send email via domain SMTP (Postfix). Body: `{ userEmail, accountId, toEmail, subject, html, text }` |

---

## Quick Reference: Existing Customers

| Customer | CF Email | Account ID | Subdomain | Store URL |
|----------|----------|------------|-----------|-----------|
| post@universi.no | cloudflarepost@universi.no | `e91711ab7a5bf10ef92e1b2a91d52148` | post-e91 | `https://vemail-store-worker.post-e91.workers.dev` |
| msneeggen@gmail.com | cloudflaremsneeggen@gmail.com | `4f85ea7e6d018005b2d50333cc7dc6b1` | msneeggen | `https://vemail-store-worker.msneeggen.workers.dev` |

### Local folder structure per customer:

```
/Users/torarnehave/Documents/GitHub/cloudflare<CF_EMAIL>/
└── store-worker/
    ├── wrangler.toml      ← account_id + D1 database_id + R2 bucket binding
    ├── schema.sql          ← D1 table definitions (emails + attachments)
    ├── package.json        ← scripts: dev, deploy, db:create, db:migrate, r2:create
    ├── tsconfig.json
    └── src/
        └── index.ts        ← Email CRUD API (identical across all customers)
```

---

## Setup Script Reference

The admin setup script is at `/Users/torarnehave/Documents/GitHub/my-test-app/vemail-setup.mjs`.

```bash
# List all accounts for a user (shows ID, email, storeUrl, aliases, accountType, etc.)
node vemail-setup.mjs list-accounts --user torarnehave@gmail.com

# Set store URL for a specific account
node vemail-setup.mjs set-store-url \
  --user torarnehave@gmail.com \
  --account-email torarnehave@gmail.com \
  --store-url https://vemail-store-worker.post-e91.workers.dev

# Create a new domain email account for a user (with storeUrl + accountType in one step)
node vemail-setup.mjs add-account \
  --user msneeggen@gmail.com \
  --email maiken@vegvisr.org \
  --name "Maiken" \
  --store-url https://vemail-store-worker.msneeggen.workers.dev \
  --account-type vegvisr

# Print onboarding checklist for a new domain
node vemail-setup.mjs add-domain --domain movemetime.com

# Create Cloudflare Email Routing rule (requires CF_API_TOKEN env var)
export CF_API_TOKEN="your-cloudflare-api-token"
node vemail-setup.mjs add-email-route --domain vegvisr.org --address maiken

# Show all known domains and their Cloudflare zone IDs
node vemail-setup.mjs list-domains

# Help
node vemail-setup.mjs --help
```

---

## Multi-Domain Email Support

The system supports sending and receiving emails from multiple domains (e.g., `@vegvisr.org`, `@movemetime.com`, `@alivenesslab.org`). A single user can have accounts on multiple domains.

### Known domains

Run `node vemail-setup.mjs list-domains` to see all domains with Cloudflare zone IDs.

### Adding a new domain

Run the checklist generator:

```bash
node vemail-setup.mjs add-domain --domain movemetime.com
```

This prints the steps:

1. **SMTP allowlist** — Add the domain to `SMTP_RELAY_ALLOWED_DOMAINS` (comma-separated) in `/root/slowyou.io/.env` on the VPS. Restart with `pm2 restart slowyou`.

2. **Postfix** — Add the domain to `virtual_alias_domains` in `/etc/postfix/main.cf` on the VPS. Reload with `sudo postfix reload`.

3. **Cloudflare Email Routing** — Enable Email Routing for the domain zone in the Cloudflare dashboard. This auto-adds MX and TXT DNS records.

4. **SPF/DKIM/DMARC** — Ensure DNS records are set for the new domain so outbound emails pass authentication.

### Adding an email address on an existing domain

Example: Adding `maiken@vegvisr.org` for user `msneeggen@gmail.com`.

```bash
# 1. Create the account (storeUrl + accountType set in one step)
node vemail-setup.mjs add-account \
  --user msneeggen@gmail.com \
  --email maiken@vegvisr.org \
  --name "Maiken" \
  --store-url https://vemail-store-worker.msneeggen.workers.dev \
  --account-type vegvisr

# 2. Add Cloudflare Email Routing rule for inbound email
export CF_API_TOKEN="your-cloudflare-api-token"
node vemail-setup.mjs add-email-route --domain vegvisr.org --address maiken

# 3. Verify store-worker is healthy
curl https://vemail-store-worker.msneeggen.workers.dev/health
```

After this:
- **Sending**: User can compose from `maiken@vegvisr.org` in the vemail app → routed through Postfix via slowyou.io
- **Receiving**: Emails to `maiken@vegvisr.org` → Cloudflare Email Routing → email-worker → store-worker → vemail inbox

### Adding multiple domain addresses for one user

A user can have multiple domain accounts. Example for Maiken:

```bash
# Account 1: maiken@vegvisr.org
node vemail-setup.mjs add-account \
  --user msneeggen@gmail.com \
  --email maiken@vegvisr.org \
  --name "Maiken (vegvisr)" \
  --store-url https://vemail-store-worker.msneeggen.workers.dev

# Account 2: maiken@movemetime.com
node vemail-setup.mjs add-account \
  --user msneeggen@gmail.com \
  --email maiken@movemetime.com \
  --name "Maiken (movemetime)" \
  --store-url https://vemail-store-worker.msneeggen.workers.dev

# Email routing for both
node vemail-setup.mjs add-email-route --domain vegvisr.org --address maiken
node vemail-setup.mjs add-email-route --domain movemetime.com --address maiken
```

All domain accounts share the same store-worker (same D1/R2 on the customer's Cloudflare account), but emails are scoped by `user_email` in the database.

### SMTP configuration (slowyou.io)

The `SMTP_RELAY_ALLOWED_DOMAINS` env var in slowyou.io controls which domains can be used as "from" addresses. It's a comma-separated list:

```
SMTP_RELAY_ALLOWED_DOMAINS=vegvisr.org,movemetime.com,alivenesslab.org
```

This replaces the old `SMTP_RELAY_FROM_DOMAIN` (single domain). The old env var still works as a fallback if `SMTP_RELAY_ALLOWED_DOMAINS` is not set.

### Postfix multi-domain setup (VPS)

For Postfix to accept sending as a new domain, add it to `/etc/postfix/main.cf`:

```
# Add to virtual_alias_domains (comma-separated)
virtual_alias_domains = vegvisr.org, movemetime.com, alivenesslab.org
```

Then reload: `sudo postfix reload`

All domains use the same Postfix system account for authentication (`SMTP_RELAY_USER`/`SMTP_RELAY_PASS` in slowyou.io `.env`).

---

## Gmail Inbox Sync

Vemail supports automatic Gmail inbox synchronization, allowing users to view their Gmail emails alongside their domain emails in a unified inbox.

### Architecture

```
Gmail API
  │
  │ OAuth 2.0 (refresh token)
  v
auth-worker (auth.vegvisr.org)
  ├── /gmail/auth — OAuth flow start
  ├── /gmail/callback — OAuth callback, stores credentials + refresh token
  ├── /gmail/get-credentials — Retrieve credentials (auto-refreshes token)
  └── /gmail/delete-credentials — Remove credentials
  │
  v
email-worker scheduled() handler (runs every 5 minutes)
  │ 1. Get Gmail credentials from auth-worker
  │ 2. Fetch unread messages from Gmail API
  │ 3. Parse email headers and body
  │ 4. Store in user's store-worker
  │ 5. Mark as read in Gmail
  v
Customer store-worker
  │
  └── Emails appear in vemail unified inbox
```

### How It Works

1. **User connects Gmail** in vemail Settings (OAuth flow)
2. **auth-worker stores credentials** in KV (with refresh token for long-term access)
3. **email-worker runs scheduled sync** every 5 minutes (Cron Trigger)
4. **Unread Gmail emails are fetched**, parsed, and stored in the user's store-worker
5. **Emails are marked as read** in Gmail after syncing
6. **Emails appear** in the vemail unified inbox alongside domain emails

### Gmail API Scopes

The OAuth flow requests these Gmail API scopes:

- `gmail.readonly` — Read emails
- `gmail.modify` — Modify labels (mark as read)
- `gmail.labels` — Manage labels

### Setup Steps

#### 1. Enable Gmail API in Google Cloud Console

The Gmail API must be enabled in the Google Cloud Console project used for OAuth:

1. Go to https://console.cloud.google.com/apis/library/gmail.googleapis.com
2. Select the project (e.g., "Vegvisr Photos Picker")
3. Click **Enable**

#### 2. Add Gmail API Scopes to OAuth Consent Screen

1. Go to https://console.cloud.google.com/apis/credentials/consent
2. Click **Edit App**
3. Under **Scopes**, click **Add or Remove Scopes**
4. Add these scopes:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.modify`
   - `https://www.googleapis.com/auth/gmail.labels`
5. Click **Update** and **Save and Continue**

#### 3. Add OAuth Redirect URI

1. Go to https://console.cloud.google.com/apis/credentials
2. Click on the OAuth 2.0 Client ID (e.g., "Vegvisr Web Client")
3. Under **Authorized redirect URIs**, add:
   ```
   https://auth.vegvisr.org/gmail/callback
   ```
4. Click **Save**

#### 4. Deploy auth-worker with Gmail Endpoints

The Gmail OAuth endpoints are already implemented in auth-worker:

```bash
cd /Users/torarnehave/Documents/GitHub/vegvisr-frontend/auth-worker
npx wrangler deploy
```

The following endpoints are available:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/gmail/auth` | GET | Initiates OAuth flow (redirects to Google) |
| `/gmail/callback` | GET | Handles OAuth callback, stores credentials with refresh token |
| `/gmail/get-credentials` | POST | Retrieves credentials (auto-refreshes if expired) |
| `/gmail/delete-credentials` | POST | Removes credentials from KV |
| `/gmail/test-fetch` | POST | Test endpoint (fetches latest Gmail email) |

**Token refresh logic:** Credentials are automatically refreshed 5 minutes before expiry using the stored refresh token.

#### 5. Deploy email-worker with Scheduled Sync

The email-worker has a `scheduled()` handler that runs every 5 minutes via Cron Trigger:

```bash
cd /Users/torarnehave/Documents/GitHub/vegvisr-frontend/email-worker
npx wrangler deploy
```

**Cron configuration** (in `wrangler.toml`):

```toml
[triggers]
crons = ["*/5 * * * *"]
```

**Service binding** to auth-worker (in `wrangler.toml`):

```toml
[[services]]
binding = "AUTH_WORKER"
service = "auth-worker"
```

#### 6. User Connects Gmail in Vemail Settings

The user connects their Gmail account in the vemail Settings UI:

1. Log in to vemail at https://vemail.vegvisr.org
2. Go to **Settings** (gear icon in sidebar)
3. Scroll to **Gmail Inbox Sync** section
4. Click **Connect Gmail**
5. Approve Gmail permissions in Google OAuth consent screen
6. Redirected back to vemail with success message

**What happens during OAuth:**

1. User clicks "Connect Gmail" → redirects to `https://auth.vegvisr.org/gmail/auth`
2. auth-worker redirects to Google OAuth consent screen
3. User approves permissions
4. Google redirects to `https://auth.vegvisr.org/gmail/callback?code=...`
5. auth-worker exchanges code for tokens (access_token + **refresh_token**)
6. Credentials stored in KV: `gmail:{user_email}`
7. User redirected to `https://www.vegvisr.org/?gmail_auth_success=true&user_email=...`
8. vemail Settings shows "Connected" status

**Credentials stored in KV:**

```json
{
  "access_token": "ya29.a0...",
  "refresh_token": "1//0c...",
  "expires_at": 1770844154822,
  "stored_at": 1770840555822,
  "user_email": "torarnehave@gmail.com",
  "scopes": ["gmail.readonly", "gmail.modify", "gmail.labels"]
}
```

#### 7. Verify Scheduled Sync

Monitor the email-worker logs to see the scheduled sync in action:

```bash
npx wrangler tail email-worker
```

You should see logs like:

```
[Gmail Sync] Starting scheduled sync at 2026-02-11T20:15:00.000Z
[Gmail Sync] Syncing for user: torarnehave@gmail.com
[Gmail Sync] Found 3 unread messages for torarnehave@gmail.com
[Gmail Sync] Stored message 19c4e4ec4128c61c for torarnehave@gmail.com
[Gmail Sync] Completed scheduled sync
```

### User Management

The current implementation syncs for a hardcoded test user (`torarnehave@gmail.com`). For production, the list of users with Gmail sync enabled should be maintained in D1 or KV.

**Current test users** (in email-worker `index.js`):

```javascript
const testUsers = ['torarnehave@gmail.com']
```

**Future enhancement:** Add a `gmail_sync_enabled` flag to the user's config in D1, and query all users with Gmail credentials and sync enabled.

### Testing Gmail Sync

#### Manual OAuth Test

```bash
# 1. Visit OAuth URL in browser
open https://auth.vegvisr.org/gmail/auth

# 2. Approve permissions in Google consent screen

# 3. Check credentials stored in KV (use --remote flag!)
cd /Users/torarnehave/Documents/GitHub/vegvisr-frontend/auth-worker
npx wrangler kv key get "gmail:torarnehave@gmail.com" --namespace-id=25ce32bfa2814b839389bb9e9c849642 --remote

# 4. Test fetching latest Gmail email
curl -X POST https://auth.vegvisr.org/gmail/test-fetch \
  -H "Content-Type: application/json" \
  -d '{"user_email":"torarnehave@gmail.com"}'
```

#### Manual Sync Test

Trigger the scheduled handler manually using wrangler:

```bash
# Note: wrangler doesn't have a direct "trigger cron" command
# The scheduled() handler runs automatically every 5 minutes
# To test, send a test email to the Gmail account and wait for the next cron run
```

### Disconnecting Gmail

Users can disconnect their Gmail account in vemail Settings:

1. Go to **Settings** > **Gmail Inbox Sync**
2. Click **Disconnect**
3. Credentials are deleted from KV
4. Scheduled sync will skip this user (no credentials found)

### Data Storage

| Data | Location | Details |
|------|----------|---------|
| Gmail OAuth credentials (access_token, refresh_token) | **auth-worker KV** (`GOOGLE_CREDENTIALS`) | Key: `gmail:{user_email}` |
| Synced Gmail emails (metadata + body) | **Customer store-worker** (D1 + R2) | Same as domain emails, scoped by `user_email` |

### Security

- **Refresh tokens** are stored securely in Cloudflare KV (never exposed to browser)
- **Access tokens** are auto-refreshed 5 minutes before expiry
- **OAuth flow** uses HTTPS and secure redirect URIs
- **Credentials** are scoped per user email (isolated)

### Limitations

- **Sync frequency:** Every 5 minutes (Cloudflare Cron Trigger minimum is 1 minute, but 5 minutes is reasonable for inbox sync)
- **Sync scope:** Only unread messages (marked as read after syncing)
- **Max messages per sync:** 10 (configurable in `maxResults` param)
- **No historical sync:** Only new emails since last sync (no backfill of old emails)

### Future Enhancements

- [ ] Add UI toggle in Settings to enable/disable Gmail sync per user
- [ ] Store list of users with Gmail sync enabled in D1
- [ ] Add webhook support for real-time push notifications (Google Pub/Sub)
- [ ] Support syncing sent emails from Gmail
- [ ] Add support for multiple Gmail accounts per user
- [ ] Add historical email backfill (sync all emails from past N days)

---

## Troubleshooting

### "workers.dev subdomain not registered"
The CF account needs a workers.dev subdomain. Go to Workers & Pages in the dashboard and complete the onboarding step.

### D1 migration fails
Make sure `wrangler.toml` has the correct `database_id`. Re-run `npx wrangler d1 list` to verify.

### CORS errors in browser
The store-worker sets `Access-Control-Allow-Origin: *` on all responses. If you see CORS errors, check that the worker deployed successfully and the URL is correct.

### "user param required" errors
All store-worker API calls require a `user` query parameter (the email address). The frontend sends this automatically based on the active account.

### Health check returns 404
The worker likely didn't deploy. Check `npx wrangler deploy` output for errors. Verify the account ID and API token are correct.

### Inbound emails not appearing
1. Check Cloudflare Email Routing rules — is the address routed to `email-worker`?
2. Check email-worker logs: `wrangler tail email-worker`
3. Verify the storeUrl is set: `node vemail-setup.mjs list-accounts --user <email>`
4. Check store-worker health: `curl https://vemail-store-worker.<sub>.workers.dev/health`

### Sent emails not stored
The email-worker uses `VEMAIL_STORE_URL` env var for sent copies (currently `https://vemail-store-worker.post-e91.workers.dev`). For per-account routing of sent copies, the email-worker would need to look up the sender's storeUrl (same pattern as inbound routing).

### Store URL not showing in Settings
The storeUrl is not editable in the UI. Run the setup script: `node vemail-setup.mjs set-store-url ...`

### Gmail OAuth fails with "redirect_uri_mismatch"
The redirect URI must be added to the Google Cloud Console OAuth client. Add `https://auth.vegvisr.org/gmail/callback` to Authorized redirect URIs.

### Gmail credentials not found in KV
Make sure to use the `--remote` flag when checking KV: `npx wrangler kv key get "gmail:user@gmail.com" --namespace-id=... --remote`. Wrangler defaults to local/preview KV without the flag.

### Gmail sync not running
1. Check email-worker deployment: `npx wrangler deployments list --name=email-worker`
2. Verify Cron Trigger is configured: `npx wrangler triggers deploy`
3. Check logs: `npx wrangler tail email-worker`
4. Verify user is in the test users list in `email-worker/index.js`

### Gmail emails not appearing in vemail inbox
1. Check if credentials exist: `npx wrangler kv key get "gmail:user@gmail.com" --namespace-id=... --remote`
2. Verify store URL is set for the user: `node vemail-setup.mjs list-accounts --user user@gmail.com`
3. Check email-worker logs during scheduled sync
4. Verify Gmail API is enabled in Google Cloud Console
5. Check if access token is expired (should auto-refresh, but verify in logs)
