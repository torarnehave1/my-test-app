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
const normalizeApp = (value) => value.trim().toLowerCase();
const isValidApp = (value) => /^[a-z0-9-]{2,50}$/i.test(value);

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

const listWorkerRoutes = async ({ zoneId, token }) => {
  const data = await cfRequest(
    `${API_BASE}/zones/${zoneId}/workers/routes`,
    { headers: getAuthHeaders(token) }
  );
  return Array.isArray(data?.result) ? data.result : [];
};

const readBrandConfig = async (env, domain) => {
  if (!env.BRAND_CONFIG) return null;
  const primary = await env.BRAND_CONFIG.get(`brand:${domain}`);
  if (primary) {
    return JSON.parse(primary);
  }
  if (domain.startsWith('www.')) {
    const fallback = await env.BRAND_CONFIG.get(`brand:${domain.replace(/^www\./, '')}`);
    return fallback ? JSON.parse(fallback) : null;
  }
  return null;
};

const writeBrandConfig = async (env, domain, config) => {
  if (!env.BRAND_CONFIG) return;
  await env.BRAND_CONFIG.put(`brand:${domain}`, JSON.stringify(config));
};

const ensureWorkerRoute = async ({ zoneId, hostname, script, token }) => {
  const pattern = `${hostname}/*`;
  const routes = await listWorkerRoutes({ zoneId, token });
  const existing = routes.find((route) => route.pattern === pattern);

  if (existing) {
    if (existing.script === script) {
      return existing;
    }
    return cfRequest(`${API_BASE}/zones/${zoneId}/workers/routes/${existing.id}`, {
      method: 'PUT',
      headers: getAuthHeaders(token),
      body: JSON.stringify({ pattern, script })
    });
  }

  return cfRequest(`${API_BASE}/zones/${zoneId}/workers/routes`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify({ pattern, script })
  });
};

const listDomainsForScript = async ({ token, script }) => {
  const zones = await cfRequest(`${API_BASE}/zones`, {
    headers: getAuthHeaders(token)
  });
  const results = Array.isArray(zones?.result) ? zones.result : [];
  const domains = [];

  for (const zone of results) {
    const routes = await listWorkerRoutes({ zoneId: zone.id, token });
    routes.forEach((route) => {
      if (route.script === script && typeof route.pattern === 'string') {
        domains.push(route.pattern.replace(/\/\*$/, ''));
      }
    });
  }

  return domains;
};

const getDomainStatus = async ({ hostname, token, script }) => {
  const zone = await findZone(hostname, token);
  const dns = await cfRequest(
    `${API_BASE}/zones/${zone.id}/dns_records?type=CNAME&name=${encodeURIComponent(hostname)}`,
    { headers: getAuthHeaders(token) }
  );
  const dnsRecord = Array.isArray(dns?.result) ? dns.result[0] : null;
  const routes = await listWorkerRoutes({ zoneId: zone.id, token });
  const routePattern = `${hostname}/*`;
  const route = routes.find((item) => item.pattern === routePattern);

  return {
    hostname,
    zone: zone.name,
    dns: dnsRecord
      ? { ok: true, content: dnsRecord.content, proxied: dnsRecord.proxied }
      : { ok: false },
    route: route ? { ok: true, script: route.script } : { ok: false },
    ready: Boolean(dnsRecord) && Boolean(route) && route.script === script
  };
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

    const { CF_API_TOKEN, TARGET_WORKER_NAME, TARGET_WORKER_DOMAIN } = env;
    if (!CF_API_TOKEN || !TARGET_WORKER_NAME || !TARGET_WORKER_DOMAIN) {
      return jsonResponse(
        { success: false, message: 'Missing worker env vars.' },
        500
      );
    }
    if (!env.BRAND_CONFIG) {
      return jsonResponse(
        { success: false, message: 'Missing BRAND_CONFIG KV binding.' },
        500
      );
    }

    if (request.method === 'GET') {
      try {
        const domainParam = url.searchParams.get('domain');
        if (domainParam) {
          const domain = normalizeDomain(domainParam);
          if (!domain || !isValidDomain(domain)) {
            return jsonResponse({ success: false, message: 'Invalid domain.' }, 400);
          }
          const status = await getDomainStatus({
            hostname: domain,
            token: CF_API_TOKEN,
            script: TARGET_WORKER_NAME
          });
          const config = await readBrandConfig(env, domain);
          return jsonResponse({ success: true, status, config });
        }

        const domains = await listDomainsForScript({
          token: CF_API_TOKEN,
          script: TARGET_WORKER_NAME
        });
        const configs = await Promise.all(
          domains.map(async (domain) => ({
            domain,
            config: await readBrandConfig(env, domain)
          }))
        );
        return jsonResponse({ success: true, domains, configs });
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
    const targetAppRaw = body?.targetApp || '';
    const logoUrl = typeof body?.logoUrl === 'string' ? body.logoUrl.trim() : '';
    const slogan = typeof body?.slogan === 'string' ? body.slogan.trim() : '';
    const targetApp = normalizeApp(targetAppRaw || '');
    if (!domain || !isValidDomain(domain)) {
      return jsonResponse({ success: false, message: 'Please provide a valid domain.' }, 400);
    }
    if (!targetApp || !isValidApp(targetApp)) {
      return jsonResponse({ success: false, message: 'Please provide a valid target app.' }, 400);
    }

    let step = 'start';
    try {
      step = 'find-zone';
      const zone = await findZone(domain, CF_API_TOKEN);
      step = 'ensure-dns';
      await ensureDnsRecord({
        zoneId: zone.id,
        hostname: domain,
        target: TARGET_WORKER_DOMAIN,
        token: CF_API_TOKEN
      });
      step = 'attach-domain';
      await ensureWorkerRoute({
        zoneId: zone.id,
        hostname: domain,
        script: TARGET_WORKER_NAME,
        token: CF_API_TOKEN
      });

      step = 'save-config';
      const existingConfig = await readBrandConfig(env, domain);
      const now = new Date().toISOString();
      const config = {
        domain,
        targetApp,
        logoUrl,
        slogan,
        updatedAt: now,
        createdAt: existingConfig?.createdAt || now
      };
      await writeBrandConfig(env, domain, config);

      step = 'list-domains';
      const domains = await listDomainsForScript({
        token: CF_API_TOKEN,
        script: TARGET_WORKER_NAME
      });
      const configs = await Promise.all(
        domains.map(async (domainName) => ({
          domain: domainName,
          config: await readBrandConfig(env, domainName)
        }))
      );

      return jsonResponse({
        success: true,
        domain,
        domains,
        config,
        configs
      });
    } catch (error) {
      console.error('Domain setup failed', { step, message: error.message, data: error.data });
      return jsonResponse(
        {
          success: false,
          message: error.message,
          step,
          details: error.data || null
        },
        500
      );
    }
  }
};
