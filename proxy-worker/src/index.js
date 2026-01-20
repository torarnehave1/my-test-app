export default {
  async fetch(request, env) {
    const targetOrigin = env.TARGET_ORIGIN;
    if (!targetOrigin) {
      return new Response('Missing TARGET_ORIGIN', { status: 500 });
    }

    const url = new URL(request.url);
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
