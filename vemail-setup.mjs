#!/usr/bin/env node
/**
 * vemail-setup.mjs — Admin setup script for vemail multi-domain email management.
 *
 * Commands:
 *   list-accounts   List email accounts for a user
 *   set-store-url   Set the store-worker URL for a user's email account
 *   add-account     Create a new email account for a user (with storeUrl + accountType)
 *   add-domain      Print checklist for enabling a new domain
 *   add-email-route Create a Cloudflare Email Routing rule for an address
 *   list-domains    Show known domains and their Cloudflare zone IDs
 *
 * Usage:
 *   node vemail-setup.mjs --help
 */

const API_BASE = 'https://cookie.vegvisr.org';

// Known Cloudflare zone IDs for managed domains
const DOMAIN_ZONES = {
  'vegvisr.org': '9178eccd3a7e3d71d8ae09defb09422a',
  'movemetime.com': 'abb39e8d56446afe3ac098abd5c21732',
  'alivenesslab.org': '4dc34fae60abef723cb8ae9ace5475f0',
  'norsegong.com': 'e577205b812b49d012af046535369808',
  'xyzvibe.com': '602067f0cf860426a35860a8ab179a47',
  'slowyou.training': '1417691852abd0e8220f60184b7f4eca',
  'universi.no': '3adef6348a9c36282014fd78d88d49f5',
  'mystmkra.io': 'aec988658e7d484f74fe4e7e1efb5df7',
};

// --- Existing commands ---

async function listAccounts(userEmail) {
  const url = `${API_BASE}/email-accounts?user=${encodeURIComponent(userEmail)}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`Failed to fetch accounts: ${res.status} ${res.statusText}`);
    process.exit(1);
  }
  const data = await res.json();
  if (!data.success) {
    console.error('API error:', data.error || 'Unknown error');
    process.exit(1);
  }
  const accounts = data.accounts || [];
  if (accounts.length === 0) {
    console.log(`No email accounts found for ${userEmail}`);
    return;
  }
  console.log(`\nEmail accounts for ${userEmail}:\n`);
  for (const a of accounts) {
    console.log(`  ID:       ${a.id}`);
    console.log(`  Name:     ${a.name || '(none)'}`);
    console.log(`  Email:    ${a.email}`);
    console.log(`  Type:     ${a.accountType || 'gmail'}`);
    console.log(`  Default:  ${a.isDefault ? 'Yes' : 'No'}`);
    console.log(`  Password: ${a.hasPassword ? 'Saved' : 'Not set'}`);
    console.log(`  StoreURL: ${a.storeUrl || '(not set)'}`);
    if (a.aliases?.length > 0) {
      console.log(`  Aliases:  ${a.aliases.join(', ')}`);
    }
    console.log('');
  }
}

async function setStoreUrl(userEmail, accountEmail, storeUrl) {
  const listUrl = `${API_BASE}/email-accounts?user=${encodeURIComponent(userEmail)}`;
  const listRes = await fetch(listUrl);
  if (!listRes.ok) {
    console.error(`Failed to fetch accounts: ${listRes.status} ${listRes.statusText}`);
    process.exit(1);
  }
  const listData = await listRes.json();
  if (!listData.success) {
    console.error('API error:', listData.error || 'Unknown error');
    process.exit(1);
  }

  const accounts = listData.accounts || [];
  const account = accounts.find(
    (a) => a.email.toLowerCase() === accountEmail.toLowerCase()
  );

  if (!account) {
    console.error(
      `No account with email "${accountEmail}" found for user "${userEmail}".`
    );
    console.error('Available accounts:');
    for (const a of accounts) {
      console.error(`  - ${a.email} (id: ${a.id})`);
    }
    process.exit(1);
  }

  const updateRes = await fetch(`${API_BASE}/email-accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userEmail,
      account: {
        ...account,
        storeUrl,
      },
    }),
  });

  if (!updateRes.ok) {
    console.error(`Failed to update account: ${updateRes.status} ${updateRes.statusText}`);
    process.exit(1);
  }

  const updateData = await updateRes.json();
  if (!updateData.success) {
    console.error('API error:', updateData.error || 'Unknown error');
    process.exit(1);
  }

  console.log(`\nStore URL updated successfully!`);
  console.log(`  User:      ${userEmail}`);
  console.log(`  Account:   ${account.email} (${account.name || account.id})`);
  console.log(`  Store URL: ${storeUrl}`);
}

// --- New commands ---

async function addAccount(userEmail, email, name, storeUrl, accountType) {
  const id = crypto.randomUUID();

  const account = {
    id,
    name: name || '',
    email,
    aliases: [],
    isDefault: false,
    hasPassword: false,
    storeUrl: storeUrl || '',
    accountType: accountType || 'vegvisr',
  };

  const res = await fetch(`${API_BASE}/email-accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userEmail,
      account,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Failed to create account: ${res.status} ${res.statusText}`);
    console.error(text);
    process.exit(1);
  }

  const data = await res.json();
  if (!data.success) {
    console.error('API error:', data.error || 'Unknown error');
    process.exit(1);
  }

  console.log(`\nAccount created successfully!`);
  console.log(`  User:         ${userEmail}`);
  console.log(`  Account ID:   ${id}`);
  console.log(`  Email:        ${email}`);
  console.log(`  Name:         ${name || '(none)'}`);
  console.log(`  Type:         ${accountType || 'vegvisr'}`);
  console.log(`  Store URL:    ${storeUrl || '(default)'}`);
  console.log(`\nNext steps:`);
  console.log(`  1. Set up Cloudflare Email Routing for ${email}:`);
  const domain = email.split('@')[1];
  const address = email.split('@')[0];
  console.log(`     node vemail-setup.mjs add-email-route --domain ${domain} --address ${address}`);
  console.log(`  2. Verify the store-worker is healthy:`);
  if (storeUrl) {
    console.log(`     curl ${storeUrl}/health`);
  }
}

function addDomain(domain) {
  const zoneId = DOMAIN_ZONES[domain];

  console.log(`\n--- Domain Onboarding Checklist: ${domain} ---\n`);

  if (zoneId) {
    console.log(`  Cloudflare Zone ID: ${zoneId} (known)`);
  } else {
    console.log(`  Cloudflare Zone ID: NOT FOUND in known domains`);
    console.log(`  -> Add the domain to Cloudflare first, then update DOMAIN_ZONES in vemail-setup.mjs`);
  }

  console.log(`\n  Steps:\n`);
  console.log(`  1. SMTP allowlist (slowyou.io VPS):`);
  console.log(`     Add "${domain}" to SMTP_RELAY_ALLOWED_DOMAINS in /root/slowyou.io/.env`);
  console.log(`     Example: SMTP_RELAY_ALLOWED_DOMAINS=vegvisr.org,movemetime.com,${domain}`);
  console.log(`     Then restart: pm2 restart slowyou\n`);

  console.log(`  2. Postfix (VPS):`);
  console.log(`     Add "${domain}" to virtual_alias_domains in /etc/postfix/main.cf`);
  console.log(`     Then: sudo postfix reload\n`);

  console.log(`  3. Cloudflare Email Routing:`);
  if (zoneId) {
    console.log(`     Go to: https://dash.cloudflare.com/?zone=${zoneId} > Email > Email Routing`);
    console.log(`     Enable Email Routing if not already enabled`);
    console.log(`     Or use: node vemail-setup.mjs add-email-route --domain ${domain} --address <localpart>\n`);
  } else {
    console.log(`     First add domain to Cloudflare, then enable Email Routing in the dashboard\n`);
  }

  console.log(`  4. DNS records (if not already set):`);
  console.log(`     Cloudflare Email Routing auto-adds MX and TXT records when enabled\n`);

  console.log(`  5. SPF/DKIM/DMARC:`);
  console.log(`     Ensure SPF TXT record includes your Postfix server IP`);
  console.log(`     Set up DKIM signing in Postfix for ${domain}`);
  console.log(`     Add DMARC TXT record: _dmarc.${domain}\n`);
}

async function addEmailRoute(domain, address) {
  const zoneId = DOMAIN_ZONES[domain];
  if (!zoneId) {
    console.error(`Unknown domain: ${domain}`);
    console.error('Known domains:');
    for (const [d, z] of Object.entries(DOMAIN_ZONES)) {
      console.error(`  ${d} -> ${z}`);
    }
    process.exit(1);
  }

  const cfToken = process.env.CF_API_TOKEN;
  if (!cfToken) {
    console.error('Error: CF_API_TOKEN environment variable is required.');
    console.error('Set it with: export CF_API_TOKEN="your-cloudflare-api-token"');
    console.error(`\nAlternatively, add the rule manually in the Cloudflare dashboard:`);
    console.error(`  1. Go to https://dash.cloudflare.com/?zone=${zoneId}`);
    console.error(`  2. Navigate to Email > Email Routing > Routing rules`);
    console.error(`  3. Create address: ${address}@${domain} -> Send to Worker -> email-worker`);
    process.exit(1);
  }

  console.log(`Creating email routing rule: ${address}@${domain} -> email-worker`);

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/email/routing/rules`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cfToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        actions: [{ type: 'worker', value: ['email-worker'] }],
        matchers: [{ type: 'literal', field: 'to', value: `${address}@${domain}` }],
        enabled: true,
        name: `Route ${address}@${domain} to email-worker`,
      }),
    }
  );

  const data = await res.json();

  if (!res.ok || !data.success) {
    console.error(`Failed to create routing rule: ${res.status}`);
    if (data.errors) {
      for (const err of data.errors) {
        console.error(`  - ${err.message} (code: ${err.code})`);
      }
    }
    process.exit(1);
  }

  console.log(`\nEmail routing rule created!`);
  console.log(`  ${address}@${domain} -> email-worker`);
  console.log(`  Rule ID: ${data.result?.id || 'unknown'}`);
}

function listDomains() {
  console.log(`\nKnown domains and Cloudflare zone IDs:\n`);
  for (const [domain, zoneId] of Object.entries(DOMAIN_ZONES)) {
    console.log(`  ${domain.padEnd(22)} ${zoneId}`);
  }
  console.log(`\nTo add a new domain: node vemail-setup.mjs add-domain --domain <domain>`);
}

// --- CLI argument parsing ---

const args = process.argv.slice(2);
const command = args[0];

function getArg(name) {
  const idx = args.indexOf(name);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}

if (!command || command === '--help' || command === '-h') {
  console.log(`
vemail-setup — Admin setup script for vemail multi-domain email management

Commands:
  list-accounts     List email accounts for a user
  set-store-url     Set the store-worker URL for a user's email account
  add-account       Create a new email account for a user
  add-domain        Print onboarding checklist for a new domain
  add-email-route   Create a Cloudflare Email Routing rule
  list-domains      Show known domains and zone IDs

Options:
  --user <email>            The logged-in user's email (required for account commands)
  --account-email <email>   The email account to configure (for set-store-url)
  --store-url <url>         The store-worker URL to assign
  --email <email>           The new email address (for add-account)
  --name <name>             Display name (for add-account)
  --account-type <type>     Account type: gmail | vegvisr (for add-account, default: vegvisr)
  --domain <domain>         Domain name (for add-domain, add-email-route)
  --address <localpart>     Local part before @ (for add-email-route)

Examples:
  node vemail-setup.mjs list-accounts --user torarnehave@gmail.com

  node vemail-setup.mjs set-store-url \\
    --user torarnehave@gmail.com \\
    --account-email torarnehave@gmail.com \\
    --store-url https://vemail-store-worker.post-e91.workers.dev

  node vemail-setup.mjs add-account \\
    --user msneeggen@gmail.com \\
    --email maiken@vegvisr.org \\
    --name "Maiken" \\
    --store-url https://vemail-store-worker.msneeggen.workers.dev

  node vemail-setup.mjs add-domain --domain movemetime.com

  node vemail-setup.mjs add-email-route --domain vegvisr.org --address maiken

  node vemail-setup.mjs list-domains

Environment:
  CF_API_TOKEN    Cloudflare API token (required for add-email-route)
`);
  process.exit(0);
}

if (command === 'list-domains') {
  listDomains();
} else if (command === 'add-domain') {
  const domain = getArg('--domain');
  if (!domain) {
    console.error('Error: --domain <domain> is required.');
    process.exit(1);
  }
  addDomain(domain);
} else if (command === 'add-email-route') {
  const domain = getArg('--domain');
  const address = getArg('--address');
  if (!domain) {
    console.error('Error: --domain <domain> is required.');
    process.exit(1);
  }
  if (!address) {
    console.error('Error: --address <localpart> is required.');
    process.exit(1);
  }
  await addEmailRoute(domain, address);
} else {
  // Commands that require --user
  const userEmail = getArg('--user');
  if (!userEmail) {
    console.error('Error: --user <email> is required.');
    process.exit(1);
  }

  if (command === 'list-accounts') {
    await listAccounts(userEmail);
  } else if (command === 'set-store-url') {
    const accountEmail = getArg('--account-email');
    const storeUrl = getArg('--store-url');
    if (!accountEmail) {
      console.error('Error: --account-email <email> is required.');
      process.exit(1);
    }
    if (!storeUrl) {
      console.error('Error: --store-url <url> is required.');
      process.exit(1);
    }
    await setStoreUrl(userEmail, accountEmail, storeUrl);
  } else if (command === 'add-account') {
    const email = getArg('--email');
    const name = getArg('--name');
    const storeUrl = getArg('--store-url');
    const accountType = getArg('--account-type');
    if (!email) {
      console.error('Error: --email <email> is required.');
      process.exit(1);
    }
    await addAccount(userEmail, email, name, storeUrl, accountType);
  } else {
    console.error(`Unknown command: ${command}`);
    console.error('Run with --help for usage.');
    process.exit(1);
  }
}
