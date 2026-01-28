export default {
  async fetch(request, env) {
    const defaultOrigin = env.DEFAULT_ORIGIN || env.TARGET_ORIGIN;
    if (!defaultOrigin) {
      return new Response('Missing DEFAULT_ORIGIN', { status: 500 });
    }

    const appOrigins = {
      aichat: env.APP_AICHAT_ORIGIN,
      connect: env.APP_CONNECT_ORIGIN,
      photos: env.APP_PHOTOS_ORIGIN
    };

    const url = new URL(request.url);
    let targetOrigin = defaultOrigin;

    const jsonResponse = (payload, status = 200) => {
      return new Response(JSON.stringify(payload), {
        status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      });
    };

    if (url.pathname === '/__html/publish') {
      if (request.method === 'OPTIONS') {
        return jsonResponse({ ok: true });
      }
      if (request.method !== 'POST') {
        return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
      }
      if (!env.HTML_PAGES) {
        return jsonResponse({ ok: false, error: 'HTML_PAGES binding missing' }, 500);
      }

      let payload = null;
      try {
        payload = await request.json();
      } catch {
        return jsonResponse({ ok: false, error: 'Invalid JSON body' }, 400);
      }

      const hostname = String(payload?.hostname || '').trim().toLowerCase();
      const html = String(payload?.html || '');
      const overwrite = Boolean(payload?.overwrite);
      if (!hostname || !html) {
        return jsonResponse({ ok: false, error: 'hostname and html are required' }, 400);
      }

      const key = `html:${hostname}`;
      const existing = await env.HTML_PAGES.get(key);
      if (existing && !overwrite) {
        return jsonResponse(
          { ok: false, error: 'Content already exists', exists: true, hostname },
          409,
        );
      }

      await env.HTML_PAGES.put(key, html);
      return jsonResponse({ ok: true, hostname });
    }

    if (url.pathname === '/__html/check') {
      if (request.method === 'OPTIONS') {
        return jsonResponse({ ok: true });
      }
      if (request.method !== 'GET') {
        return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
      }
      if (!env.HTML_PAGES) {
        return jsonResponse({ ok: false, error: 'HTML_PAGES binding missing' }, 500);
      }

      const hostname = String(url.searchParams.get('hostname') || '').trim().toLowerCase();
      if (!hostname) {
        return jsonResponse({ ok: false, error: 'hostname is required' }, 400);
      }

      const existing = await env.HTML_PAGES.get(`html:${hostname}`);
      return jsonResponse({ ok: true, hostname, exists: Boolean(existing) });
    }

    const maybeServeHtmlPage = async () => {
      if (url.pathname === '/branding.json') return null;
      if (!env.HTML_PAGES) return null;

      const keys = [`html:${url.hostname}`];
      if (url.hostname.startsWith('www.')) {
        keys.push(`html:${url.hostname.replace(/^www\./, '')}`);
      }

      for (const key of keys) {
        const html = await env.HTML_PAGES.get(key);
        if (html) {
          return new Response(html, {
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600'
            }
          });
        }
      }

      return null;
    };

    const htmlResponse = await maybeServeHtmlPage();
    if (htmlResponse) {
      return htmlResponse;
    }

    const buildBrandingResponse = async () => {
      const cache = caches.default;
      const cacheKey = new Request(url.toString(), { method: 'GET' });
      const cached = await cache.match(cacheKey);
      if (cached) return cached;

      const defaults = {
        brand: {
          name: 'Vegvisr',
          logoUrl: '',
          slogan: 'Vegvisr Connect - Early Access'
        },
        meta: {
          title: '',
          faviconUrl: '',
          description: '',
          ogImageUrl: ''
        },
        theme: {
          background: {
            base: '#0b1020',
            radialTop: 'rgba(59,130,246,0.35)',
            radialBottom: 'rgba(139,92,246,0.35)'
          },
          text: {
            primary: '#e5e7eb',
            muted: 'rgba(229,231,235,0.7)',
            headlineGradient: ['#3b82f6', '#8b5cf6']
          },
          card: {
            bg: 'rgba(255,255,255,0.12)',
            border: 'rgba(255,255,255,0.2)'
          },
          button: {
            bgGradient: ['#3b82f6', '#8b5cf6'],
            text: '#ffffff'
          }
        },
        copy: {
          badge: 'Vegvisr Connect - Early Access',
          headline: 'Find your learning path with Vegvisr',
          subheadline: 'Answer a few questions so we can tailor your onboarding experience.',
          emailLabel: 'Enter your email to get a magic link',
          emailPlaceholder: 'Enter your email address',
          cta: 'Send magic link'
        },
        language: {
          default: 'en'
        },
        layout: {
          showLanguageToggle: true
        }
      };

      let config = null;
      if (env.BRAND_CONFIG) {
        const keys = [`brand:${url.hostname}`];
        if (url.hostname.startsWith('www.')) {
          keys.push(`brand:${url.hostname.replace(/^www\./, '')}`);
        }
        for (const key of keys) {
          const raw = await env.BRAND_CONFIG.get(key);
          if (raw) {
            try {
              config = JSON.parse(raw);
              break;
            } catch {
              // ignore invalid config
            }
          }
        }
      }

      const branding = config?.branding || {};
      const merged = {
        brand: {
          ...defaults.brand,
          ...branding.brand,
          logoUrl: branding?.brand?.logoUrl || config?.logoUrl || defaults.brand.logoUrl,
          slogan: branding?.brand?.slogan || config?.slogan || defaults.brand.slogan,
          name: branding?.brand?.name || defaults.brand.name
        },
        meta: {
          ...defaults.meta,
          ...branding.meta
        },
        theme: {
          ...defaults.theme,
          ...branding.theme,
          background: { ...defaults.theme.background, ...branding?.theme?.background },
          text: { ...defaults.theme.text, ...branding?.theme?.text },
          card: { ...defaults.theme.card, ...branding?.theme?.card },
          button: { ...defaults.theme.button, ...branding?.theme?.button }
        },
        copy: {
          ...defaults.copy,
          ...branding.copy
        },
        language: {
          ...defaults.language,
          ...branding.language
        },
        layout: {
          ...defaults.layout,
          ...branding.layout
        },
        // Pass through translations if provided in branding config
        ...(branding.translations ? { translations: branding.translations } : {})
      };

      const response = new Response(JSON.stringify(merged), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600'
        }
      });
      await cache.put(cacheKey, response.clone());
      return response;
    };

    if (url.pathname === '/branding.json') {
      return buildBrandingResponse();
    }

    if (env.BRAND_CONFIG) {
      const lookupKeys = [`brand:${url.hostname}`];
      if (url.hostname.startsWith('www.')) {
        lookupKeys.push(`brand:${url.hostname.replace(/^www\./, '')}`);
      }

      for (const key of lookupKeys) {
        const configRaw = await env.BRAND_CONFIG.get(key);
        if (configRaw) {
          try {
            const config = JSON.parse(configRaw);
            const candidate = appOrigins[config?.targetApp] || defaultOrigin;
            if (candidate) {
              targetOrigin = candidate;
            }
            break;
          } catch {
            // ignore config parse errors
          }
        }
      }
    }

    if (targetOrigin === defaultOrigin) {
      const hostParts = url.hostname.split('.');
      const subdomain = hostParts[0];
      if (appOrigins[subdomain]) {
        targetOrigin = appOrigins[subdomain];
      }
    }

    const targetUrl = new URL(targetOrigin);
    targetUrl.pathname = url.pathname;
    targetUrl.search = url.search;

    const headers = new Headers(request.headers);
    headers.set('x-original-hostname', url.hostname);
    headers.set('host', new URL(targetOrigin).host);

    return fetch(targetUrl.toString(), {
      method: request.method,
      headers,
      body: request.body,
      redirect: 'follow'
    });
  }
};
