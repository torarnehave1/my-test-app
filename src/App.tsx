import { useEffect, useMemo, useState } from 'react';
import { AuthBar, EcosystemNav, LanguageSelector } from 'vegvisr-ui-kit';
import appLogo from './assets/app-logo.png';
import { LanguageContext } from './lib/LanguageContext';
import { readStoredUser, type AuthUser } from './lib/auth';
import { getStoredLanguage, setStoredLanguage } from './lib/storage';
import { useTranslation } from './lib/useTranslation';

const MAGIC_BASE = 'https://cookie.vegvisr.org';
const DASHBOARD_BASE = 'https://dashboard.vegvisr.org';
const DOMAIN_API_BASE = 'https://test-domain-worker.torarnehave.workers.dev';

function App() {
  const [language, setLanguageState] = useState(getStoredLanguage());
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authStatus, setAuthStatus] = useState<'checking' | 'authed' | 'anonymous'>('checking');
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginStatus, setLoginStatus] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [domainInput, setDomainInput] = useState('');
  const [targetApp, setTargetApp] = useState('aichat');
  const [logoUrl, setLogoUrl] = useState('');
  const [domainStatus, setDomainStatus] = useState('');
  const [domainError, setDomainError] = useState('');
  const [domainLoading, setDomainLoading] = useState(false);
  const [domainList, setDomainList] = useState<string[]>([]);
  const [domainStatuses, setDomainStatuses] = useState<Record<string, { ready: boolean; pending: boolean; error?: string }>>({});
  const [domainConfigs, setDomainConfigs] = useState<Record<string, { targetApp?: string; logoUrl?: string }>>({});
  const [brandLogo, setBrandLogo] = useState<string | null>(null);
  const [brandApp, setBrandApp] = useState<string | null>(null);

  const setLanguage = (value: typeof language) => {
    setLanguageState(value);
    setStoredLanguage(value);
  };

  const contextValue = useMemo(
    () => ({ language, setLanguage }),
    [language]
  );
  const t = useTranslation(language);

  const setAuthCookie = (token: string) => {
    if (!token) return;
    const isVegvisr = window.location.hostname.endsWith('vegvisr.org');
    const domain = isVegvisr ? '; Domain=.vegvisr.org' : '';
    const maxAge = 60 * 60 * 24 * 30;
    document.cookie = `vegvisr_token=${encodeURIComponent(
      token
    )}; Path=/; Max-Age=${maxAge}; SameSite=Lax; Secure${domain}`;
  };

  const persistUser = (user: {
    email: string;
    role: string;
    user_id: string | null;
    emailVerificationToken: string | null;
    oauth_id?: string | null;
    phone?: string | null;
    phoneVerifiedAt?: string | null;
    branding?: { mySite: string | null; myLogo: string | null };
    profileimage?: string | null;
  }) => {
    const payload = {
      email: user.email,
      role: user.role,
      user_id: user.user_id,
      oauth_id: user.oauth_id || user.user_id || null,
      emailVerificationToken: user.emailVerificationToken,
      phone: user.phone || null,
      phoneVerifiedAt: user.phoneVerifiedAt || null,
      branding: user.branding || { mySite: null, myLogo: null },
      profileimage: user.profileimage || null
    };
    localStorage.setItem('user', JSON.stringify(payload));
    if (user.emailVerificationToken) {
      setAuthCookie(user.emailVerificationToken);
    }
    sessionStorage.setItem('email_session_verified', '1');
    setAuthUser({
      userId: payload.user_id || payload.oauth_id || '',
      email: payload.email,
      role: payload.role || null
    });
  };

  const fetchUserContext = async (targetEmail: string) => {
    const roleRes = await fetch(
      `${DASHBOARD_BASE}/get-role?email=${encodeURIComponent(targetEmail)}`
    );
    if (!roleRes.ok) {
      throw new Error(`User role unavailable (status: ${roleRes.status})`);
    }
    const roleData = await roleRes.json();
    if (!roleData?.role) {
      throw new Error('Unable to retrieve user role.');
    }

    const userDataRes = await fetch(
      `${DASHBOARD_BASE}/userdata?email=${encodeURIComponent(targetEmail)}`
    );
    if (!userDataRes.ok) {
      throw new Error(`Unable to fetch user data (status: ${userDataRes.status})`);
    }
    const userData = await userDataRes.json();
    return {
      email: targetEmail,
      role: roleData.role,
      user_id: userData.user_id,
      emailVerificationToken: userData.emailVerificationToken,
      oauth_id: userData.oauth_id,
      phone: userData.phone,
      phoneVerifiedAt: userData.phoneVerifiedAt,
      branding: userData.branding,
      profileimage: userData.profileimage
    };
  };

  const verifyMagicToken = async (token: string) => {
    const res = await fetch(
      `${MAGIC_BASE}/login/magic/verify?token=${encodeURIComponent(token)}`,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } }
    );
    const data = await res.json();
    if (!res.ok || !data.success || !data.email) {
      throw new Error(data.error || 'Invalid or expired magic link.');
    }
    try {
      const userContext = await fetchUserContext(data.email);
      persistUser(userContext);
    } catch {
      persistUser({
        email: data.email,
        role: 'user',
        user_id: data.email,
        emailVerificationToken: null
      });
    }
  };

  const sendMagicLink = async () => {
    if (!loginEmail.trim()) return;
    setLoginError('');
    setLoginStatus('');
    setLoginLoading(true);
    try {
      const redirectUrl = `${window.location.origin}${window.location.pathname}`;
      const res = await fetch(`${MAGIC_BASE}/login/magic/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail.trim(), redirectUrl })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to send magic link.');
      }
      setLoginStatus('Magic link sent. Check your email.');
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Failed to send magic link.');
    } finally {
      setLoginLoading(false);
    }
  };

  const clearAuthCookie = () => {
    const base = 'vegvisr_token=; Path=/; Max-Age=0; SameSite=Lax; Secure';
    const hostname = window.location.hostname;
    document.cookie = base;
    if (hostname.endsWith('vegvisr.org')) {
      document.cookie = `${base}; Domain=.vegvisr.org`;
    }
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem('user');
      sessionStorage.removeItem('email_session_verified');
    } catch {
      // ignore storage errors
    }
    clearAuthCookie();
    setAuthUser(null);
    setAuthStatus('anonymous');
  };

  useEffect(() => {
    const url = new URL(window.location.href);
    const magic = url.searchParams.get('magic');
    if (!magic) return;
    setAuthStatus('checking');
    verifyMagicToken(magic)
      .then(() => {
        url.searchParams.delete('magic');
        window.history.replaceState({}, '', url.toString());
        setAuthStatus('authed');
      })
      .catch(() => {
        setAuthStatus('anonymous');
      });
  }, []);

  useEffect(() => {
    let isMounted = true;
    const bootstrap = async () => {
      const stored = readStoredUser();
      if (stored && isMounted) {
        setAuthUser(stored);
        setAuthStatus('authed');
        return;
      }
      if (isMounted) {
        setAuthStatus('anonymous');
      }
    };
    bootstrap();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadDomains = async () => {
      try {
        if (!DOMAIN_API_BASE) return;
        const response = await fetch(`${DOMAIN_API_BASE}/custom-domain`);
        if (!response.ok) return;
        const data = await response.json();
        if (!isMounted) return;
        const list = Array.isArray(data.domains) ? data.domains : [];
        setDomainList(list);
        if (Array.isArray(data.configs)) {
          const nextConfigs: Record<string, { targetApp?: string; logoUrl?: string }> = {};
          data.configs.forEach((entry: { domain?: string; config?: { targetApp?: string; logoUrl?: string } }) => {
            if (entry?.domain) {
              nextConfigs[entry.domain] = entry.config || {};
            }
          });
          setDomainConfigs(nextConfigs);
        }
        if (list.length > 0) {
          refreshDomainStatuses(list);
        }
      } catch {
        // ignore list errors for now
      }
    };
    loadDomains();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadBranding = async () => {
      if (!DOMAIN_API_BASE) return;
      const hostname = window.location.hostname;
      try {
        const response = await fetch(
          `${DOMAIN_API_BASE}/custom-domain?domain=${encodeURIComponent(hostname)}`
        );
        const data = await response.json();
        if (!response.ok || !data?.success) return;
        if (!isMounted) return;
        setBrandLogo(data?.config?.logoUrl || null);
        setBrandApp(data?.config?.targetApp || null);
      } catch {
        // ignore branding errors
      }
    };
    loadBranding();
    return () => {
      isMounted = false;
    };
  }, []);

  const fetchDomainStatus = async (domain: string) => {
    try {
      const response = await fetch(
        `${DOMAIN_API_BASE}/custom-domain?domain=${encodeURIComponent(domain)}`
      );
      const data = await response.json();
      if (!response.ok || !data?.success) {
        return { ready: false, pending: false, error: data?.message || 'Error' };
      }
      const ready = Boolean(data?.status?.ready);
      return { ready, pending: !ready };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error';
      return { ready: false, pending: false, error: message };
    }
  };

  const refreshDomainStatuses = async (domains: string[]) => {
    if (!DOMAIN_API_BASE || domains.length === 0) return;
    const statusEntries = await Promise.all(
      domains.map(async (domain) => [domain, await fetchDomainStatus(domain)] as const)
    );

    setDomainStatuses((prev) => {
      const next = { ...prev };
      statusEntries.forEach(([domain, status]) => {
        next[domain] = status;
      });
      return next;
    });
  };

  const pollDomainStatus = async (domain: string) => {
    if (!DOMAIN_API_BASE) return;
    const attempts = 12;
    for (let i = 0; i < attempts; i += 1) {
      const status = await fetchDomainStatus(domain);
      setDomainStatuses((prev) => ({ ...prev, [domain]: status }));
      if (status.ready) return;
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  };

  const handleAddDomain = async () => {
    if (!domainInput.trim()) return;
    setDomainStatus('');
    setDomainError('');
    setDomainLoading(true);
    try {
      if (!DOMAIN_API_BASE) {
        setDomainError('Missing VITE_DOMAIN_API_BASE.');
        setDomainLoading(false);
        return;
      }
      const response = await fetch(`${DOMAIN_API_BASE}/custom-domain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: domainInput.trim(),
          targetApp,
          logoUrl
        })
      });
      const data = await response.json();
      if (!response.ok || data?.success === false) {
        throw new Error(data?.message || 'Failed to add domain.');
      }
      setDomainStatus(`Added ${data.domain}. DNS/SSL may take a few minutes.`);
      setDomainInput('');
      setLogoUrl('');
      if (Array.isArray(data.domains)) {
        setDomainList(data.domains);
        refreshDomainStatuses(data.domains);
      }
      if (data?.config) {
        setDomainConfigs((prev) => ({
          ...prev,
          [data.domain]: {
            targetApp: data.config.targetApp,
            logoUrl: data.config.logoUrl
          }
        }));
      } else if (Array.isArray(data.configs)) {
        const nextConfigs: Record<string, { targetApp?: string; logoUrl?: string }> = {};
        data.configs.forEach((entry: { domain?: string; config?: { targetApp?: string; logoUrl?: string } }) => {
          if (entry?.domain) {
            nextConfigs[entry.domain] = entry.config || {};
          }
        });
        setDomainConfigs(nextConfigs);
      }
      pollDomainStatus(data.domain);
    } catch (err) {
      setDomainError(err instanceof Error ? err.message : 'Failed to add domain.');
    } finally {
      setDomainLoading(false);
    }
  };

  return (
    <LanguageContext.Provider value={contextValue}>
      <div className="min-h-screen bg-slate-950 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.25),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(139,92,246,0.25),_transparent_55%)]" />
        <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-12">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <img
              src={brandLogo || appLogo}
              alt={t('app.title')}
              className="h-12 w-auto"
            />
            <div className="flex items-center gap-3">
              <LanguageSelector value={language} onChange={setLanguage} />
              <AuthBar
                userEmail={authStatus === 'authed' ? authUser?.email : undefined}
                badgeLabel={t('app.badge')}
                signInLabel="Sign in"
                onSignIn={() => setLoginOpen((prev) => !prev)}
                logoutLabel="Log out"
                onLogout={handleLogout}
              />
            </div>
          </header>

          <EcosystemNav className="mt-4" />

          {authStatus === 'anonymous' && loginOpen && (
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-sm text-white/80">
              <div className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
                Magic Link Sign In
              </div>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(event) => setLoginEmail(event.target.value)}
                  placeholder="you@email.com"
                  className="flex-1 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
                />
                <button
                  type="button"
                  onClick={sendMagicLink}
                  disabled={loginLoading}
                  className="rounded-2xl bg-gradient-to-r from-sky-500 to-violet-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/30"
                >
                  {loginLoading ? 'Sending...' : 'Send link'}
                </button>
              </div>
              {loginStatus && <p className="mt-3 text-xs text-emerald-300">{loginStatus}</p>}
              {loginError && <p className="mt-3 text-xs text-rose-300">{loginError}</p>}
              <p className="mt-3 text-xs text-white/50">
                We will send a secure link that logs you into this app.
              </p>
            </div>
          )}

          {authStatus === 'checking' && (
            <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-sm text-white/70">
              Checking session...
            </div>
          )}

          {authStatus === 'anonymous' && (
            <div className="mt-10 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-6 py-4 text-sm text-rose-100">
              You are not signed in. Click “Sign in” to continue.
            </div>
          )}

          <main className="mt-16">
            <section className="rounded-3xl border border-white/10 bg-white/5 p-8">
              <h1 className="text-3xl font-semibold text-white">{t('app.title')}</h1>
              <p className="mt-3 text-sm text-white/70">
                Starter shell. Replace this section with your app content.
              </p>
              {brandApp && (
                <p className="mt-2 text-xs text-white/50">
                  Brand target app: {brandApp}
                </p>
              )}
              <div className="mt-6 rounded-2xl border border-white/10 bg-slate-900/50 px-6 py-5 text-sm text-white/70">
                <div className="text-xs font-semibold uppercase tracking-[0.3em] text-white/50">
                  Starter Notes
                </div>
                <ul className="mt-3 list-disc space-y-2 pl-5">
                  <li>Auth + magic link flow is wired.</li>
                  <li>Language selector and ecosystem nav are ready.</li>
                  <li>Replace logo + icon assets for your app.</li>
                </ul>
              </div>
            </section>

            <section className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-8">
              <h2 className="text-2xl font-semibold text-white">Custom Domain Panel</h2>
              <p className="mt-2 text-sm text-white/70">
                Add a custom domain and point it to the correct app. This uses the Cloudflare API
                on your account.
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-[1.4fr_1fr]">
                <input
                  type="text"
                  value={domainInput}
                  onChange={(event) => setDomainInput(event.target.value)}
                  placeholder="connect.universi.no"
                  className="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
                />
                <select
                  value={targetApp}
                  onChange={(event) => setTargetApp(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500/60"
                >
                  <option value="aichat">aichat</option>
                  <option value="connect">connect</option>
                  <option value="photos">photos</option>
                </select>
              </div>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <input
                  type="text"
                  value={logoUrl}
                  onChange={(event) => setLogoUrl(event.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="flex-1 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
                />
                <button
                  type="button"
                  onClick={handleAddDomain}
                  disabled={domainLoading}
                  className="rounded-2xl bg-gradient-to-r from-sky-500 to-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/30"
                >
                  {domainLoading ? 'Adding...' : 'Add domain'}
                </button>
              </div>

              {domainStatus && (
                <p className="mt-3 text-xs text-emerald-300">{domainStatus}</p>
              )}
              {domainError && (
                <p className="mt-3 text-xs text-rose-300">{domainError}</p>
              )}

              <div className="mt-6 rounded-2xl border border-white/10 bg-slate-900/50 px-6 py-5 text-sm text-white/70">
                <div className="text-xs font-semibold uppercase tracking-[0.3em] text-white/50">
                  Domains on this project
                </div>
                {domainList.length === 0 ? (
                  <p className="mt-3 text-white/50">No custom domains found yet.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {domainList.map((domain) => {
                      const status = domainStatuses[domain];
                      const config = domainConfigs[domain];
                      const indicatorClass = status?.ready
                        ? 'bg-emerald-400'
                        : status?.pending
                          ? 'bg-amber-400'
                          : status?.error
                            ? 'bg-rose-400'
                            : 'bg-white/30';
                      const label = status?.ready
                        ? 'Ready'
                        : status?.pending
                          ? 'Pending'
                          : status?.error
                            ? 'Error'
                            : 'Unknown';

                      return (
                        <div key={domain} className="flex items-center gap-3">
                          <span className={`h-2.5 w-2.5 rounded-full ${indicatorClass}`} />
                          <span>{domain}</span>
                          {config?.targetApp && (
                            <span className="text-xs text-white/50">→ {config.targetApp}</span>
                          )}
                          {config?.logoUrl && (
                            <img
                              src={config.logoUrl}
                              alt={`${domain} logo`}
                              className="h-5 w-auto rounded-full border border-white/10 bg-white/5"
                            />
                          )}
                          <span className="text-xs text-white/50">{label}</span>
                        </div>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => refreshDomainStatuses(domainList)}
                      className="mt-2 rounded-full border border-white/10 px-3 py-1 text-xs text-white/70 hover:border-white/30"
                    >
                      Refresh status
                    </button>
                  </div>
                )}
              </div>
            </section>
          </main>
        </div>
      </div>
    </LanguageContext.Provider>
  );
}

export default App
