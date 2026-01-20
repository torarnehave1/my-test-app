const API_BASE = 'https://api.cloudflare.com/client/v4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

const jsonResponse = (payload, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });

const isValidDomain = (value) => {
  const pattern = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
  return pattern.test(value);
};

const normalizeDomain = (value) => value.trim().toLowerCase();

const getAuthHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json'
});

const cfRequest = async (url, options = {}) => {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok || data?.success === false) {
    const message = data?.errors?.[0]?.message || `Cloudflare API error (${response.status})`;
    const error = new Error(message);
    error.data = data;
    throw error;
  }
  return data;
};

const findZone = async (hostname, token) => {
  const labels = hostname.split('.');
  for (let i = 0; i < labels.length - 1; i += 1) {
    const candidate = labels.slice(i).join('.');
    const data = await cfRequest(
      `${API_BASE}/zones?name=${encodeURIComponent(candidate)}`,
      { headers: getAuthHeaders(token) }
    );
    if (Array.isArray(data?.result) && data.result.length > 0) {
      return data.result[0];
    }
  }
  throw new Error('No matching zone found for this domain.');
};

const ensureDnsRecord = async ({ zoneId, hostname, target, token }) => {
  const list = await cfRequest(
    `${API_BASE}/zones/${zoneId}/dns_records?type=CNAME&name=${encodeURIComponent(hostname)}`,
    { headers: getAuthHeaders(token) }
  );

  const existing = Array.isArray(list?.result) ? list.result[0] : null;
  const payload = {
    type: 'CNAME',
    name: hostname,
    content: target,
    proxied: true
  };

  if (existing) {
    if (existing.content === target && existing.proxied === true) {
      return existing;
    }
    return cfRequest(`${API_BASE}/zones/${zoneId}/dns_records/${existing.id}`, {
      method: 'PUT',
      headers: getAuthHeaders(token),
      body: JSON.stringify(payload)
    });
  }

  return cfRequest(`${API_BASE}/zones/${zoneId}/dns_records`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify(payload)
  });
};

const attachCustomDomain = async ({ accountId, service, hostname, token }) => {
  try {
    return await cfRequest(`${API_BASE}/accounts/${accountId}/workers/domains`, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify({ hostname, service })
    });
  } catch (error) {
    const message = error?.data?.errors?.[0]?.message || error.message || '';
    if (message.toLowerCase().includes('already exists')) {
      return { result: { hostname, status: 'active' } };
    }
    throw error;
  }
};

const listWorkerDomains = async ({ accountId, token, service }) => {
  const data = await cfRequest(
    `${API_BASE}/accounts/${accountId}/workers/domains`,
    { headers: getAuthHeaders(token) }
  );
  if (!Array.isArray(data?.result)) return [];
  return data.result
    .filter((entry) => !service || entry?.service === service)
    .map((entry) => entry?.hostname)
    .filter(Boolean);
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    if (url.pathname !== '/custom-domain') {
      return jsonResponse({ success: false, message: 'Not Found' }, 404);
    }

    const { CF_API_TOKEN, CF_ACCOUNT_ID, TARGET_WORKER_NAME, TARGET_WORKER_DOMAIN } = env;
    if (!CF_API_TOKEN || !CF_ACCOUNT_ID || !TARGET_WORKER_NAME || !TARGET_WORKER_DOMAIN) {
      return jsonResponse(
        { success: false, message: 'Missing worker env vars.' },
        500
      );
    }

    if (request.method === 'GET') {
      try {
        const domains = await listWorkerDomains({
          accountId: CF_ACCOUNT_ID,
          token: CF_API_TOKEN,
          service: TARGET_WORKER_NAME
        });
        return jsonResponse({ success: true, domains });
      } catch (error) {
        return jsonResponse({ success: false, message: error.message }, 500);
      }
    }

    if (request.method !== 'POST') {
      return jsonResponse({ success: false, message: 'Method not allowed.' }, 405);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ success: false, message: 'Invalid JSON body.' }, 400);
    }

    const domain = normalizeDomain(body?.domain || '');
    if (!domain || !isValidDomain(domain)) {
      return jsonResponse({ success: false, message: 'Please provide a valid domain.' }, 400);
    }

    try {
      const zone = await findZone(domain, CF_API_TOKEN);
      await ensureDnsRecord({
        zoneId: zone.id,
        hostname: domain,
        target: TARGET_WORKER_DOMAIN,
        token: CF_API_TOKEN
      });
      await attachCustomDomain({
        accountId: CF_ACCOUNT_ID,
        service: TARGET_WORKER_NAME,
        hostname: domain,
        token: CF_API_TOKEN
      });

      const domains = await listWorkerDomains({
        accountId: CF_ACCOUNT_ID,
        token: CF_API_TOKEN,
        service: TARGET_WORKER_NAME
      });

      return jsonResponse({
        success: true,
        domain,
        domains
      });
    } catch (error) {
      return jsonResponse({ success: false, message: error.message }, 500);
    }
  }
};
