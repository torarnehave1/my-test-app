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
