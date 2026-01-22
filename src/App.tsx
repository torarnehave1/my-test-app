import { useEffect, useMemo, useRef, useState } from 'react';
import { AuthBar, EcosystemNav, LanguageSelector } from 'vegvisr-ui-kit';
import appLogo from './assets/app-logo.png';
import { LanguageContext } from './lib/LanguageContext';
import { readStoredUser, type AuthUser } from './lib/auth';
import { getStoredLanguage, setStoredLanguage } from './lib/storage';
import { useTranslation } from './lib/useTranslation';

const MAGIC_BASE = 'https://cookie.vegvisr.org';
const DASHBOARD_BASE = 'https://dashboard.vegvisr.org';
const DOMAIN_API_BASE = 'https://test-domain-worker.torarnehave.workers.dev';
const OPENAI_WORKER_BASE = 'https://openai.vegvisr.org';
const API_WORKER_BASE = 'https://api.vegvisr.org';

type BrandingPreview = {
  brand?: {
    name?: string;
    logoUrl?: string;
    slogan?: string;
  };
  meta?: {
    title?: string;
    faviconUrl?: string;
    description?: string;
    ogImageUrl?: string;
  };
  theme?: {
    background?: {
      points?: Array<{ id: string; x: number; y: number; color: string }>;
    };
    text?: {
      primary?: string;
      muted?: string;
      headlineGradient?: [string, string];
    };
    card?: {
      bg?: string;
      border?: string;
    };
    button?: {
      bgGradient?: [string, string];
      text?: string;
    };
  };
  copy?: {
    badge?: string;
    headline?: string;
    subheadline?: string;
    emailLabel?: string;
    emailPlaceholder?: string;
    cta?: string;
  };
  language?: {
    default?: string;
  };
  layout?: {
    showLanguageToggle?: boolean;
  };
  translations?: {
    [language: string]: {
      [key: string]: string | string[] | { [nestedKey: string]: string | string[] };
    };
  };
};

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');

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
  const [slogan, setSlogan] = useState('');
  const [brandingJson, setBrandingJson] = useState('');
  const [brandingJsonError, setBrandingJsonError] = useState('');
  const [previewBranding, setPreviewBranding] = useState<BrandingPreview | null>(null);
  const [brandingDraft, setBrandingDraft] = useState<BrandingPreview>({
    brand: {},
    meta: {},
    theme: {},
    copy: {},
    language: { default: 'en' },
    layout: { showLanguageToggle: true }
  });
  const lastBrandingUpdate = useRef<'json' | 'form' | null>(null);
  const [splitRatio, setSplitRatio] = useState(50);
  const [isResizing, setIsResizing] = useState(false);
  const splitRef = useRef<HTMLDivElement | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [aiBrandName, setAiBrandName] = useState('');
  const [aiAudience, setAiAudience] = useState('');
  const [aiNotes, setAiNotes] = useState('');
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiStatus, setAiStatus] = useState('');
  const themeCards = [
    {
      id: 'oceanic',
      name: 'Oceanic Calm',
      description: 'Deep navy, cool blues, soft glow, modern calm.',
      prompt: 'Oceanic theme. Deep navy base, cool blue accents, soft glow. Calm, premium feel.',
      classes: 'from-slate-900 via-slate-900 to-sky-900 border-sky-400/40'
    },
    {
      id: 'tech',
      name: 'Neon Tech',
      description: 'High-contrast dark UI with cyan/teal highlights.',
      prompt: 'High-contrast tech theme. Dark base, cyan/teal accents. Bold, confident copy.',
      classes: 'from-slate-950 via-slate-900 to-emerald-900 border-emerald-400/40'
    },
    {
      id: 'wellness',
      name: 'Soft Wellness',
      description: 'Warm neutrals, gentle tone, friendly UI.',
      prompt: 'Soft wellness theme. Warm neutrals, gentle gradients, empathetic copy.',
      classes: 'from-amber-950 via-stone-900 to-rose-900 border-rose-300/40'
    },
    {
      id: 'nordic',
      name: 'Nordic Minimal',
      description: 'Monochrome with one crisp accent, understated.',
      prompt: 'Nordic minimal theme. Monochrome base with one crisp accent. Clean, professional copy.',
      classes: 'from-slate-900 via-slate-800 to-zinc-900 border-white/30'
    },
    {
      id: 'playful',
      name: 'Playful Pop',
      description: 'Bright accents, friendly language, upbeat.',
      prompt: 'Playful startup theme. Bright accents, energetic tone, short friendly CTA.',
      classes: 'from-fuchsia-950 via-indigo-950 to-sky-950 border-fuchsia-300/40'
    },
    {
      id: 'luxury',
      name: 'Luxury Editorial',
      description: 'Deep navy with gold accents, elegant.',
      prompt: 'Luxury editorial theme. Deep navy base with gold accents. Elegant, confident tone.',
      classes: 'from-slate-950 via-slate-900 to-amber-900 border-amber-300/40'
    }
  ];
  const [domainStatus, setDomainStatus] = useState('');
  const [domainError, setDomainError] = useState('');
  const [domainLoading, setDomainLoading] = useState(false);
  const [domainList, setDomainList] = useState<string[]>([]);
  const [domainStatuses, setDomainStatuses] = useState<Record<string, { ready: boolean; pending: boolean; error?: string }>>({});
  const [domainConfigs, setDomainConfigs] = useState<Record<string, { targetApp?: string; logoUrl?: string; slogan?: string; branding?: unknown }>>({});
  const [brandLogo, setBrandLogo] = useState<string | null>(null);
  const [brandApp, setBrandApp] = useState<string | null>(null);
  const [brandSlogan, setBrandSlogan] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'starter' | 'domains' | 'branding' | 'translations'>('starter');
  const isEditing = Boolean(domainInput && domainConfigs[domainInput]);

  // Translations state
  const [translationsData, setTranslationsData] = useState<Record<string, Record<string, unknown>>>({
    en: {
      home: {
        title: 'Find your learning path with Vegvisr',
        subtitle: 'Answer a few questions so we can tailor your onboarding experience.',
        chooseAuth: 'Enter your email to get a magic link',
        google: 'Continue with Google',
        email: 'Continue with email',
        emailPlaceholder: 'Enter your email address',
        sendLink: 'Send magic link',
        linkSent: 'Magic link sent. Check your inbox.',
        language: 'Language'
      },
      auth: {
        verifying: 'Verifying your access...',
        success: 'You are verified. Redirecting to onboarding.',
        failure: 'We could not verify that link. Request a new one.',
        callbackError: 'We could not complete Google sign-in. Try again.'
      },
      onboarding: {
        title: 'Your Vegvisr onboarding',
        step: 'Step',
        of: 'of',
        next: 'Next step',
        back: 'Back',
        submit: 'Submit onboarding',
        saving: 'Saving progress...',
        saved: 'All changes saved',
        successTitle: 'You are all set, You rock!',
        successBody: 'We have received your onboarding responses. We will review them and get back to you soon.'
      },
      common: {
        loading: 'Loading...',
        emailLabel: 'Email address',
        required: 'This field is required',
        tryAgain: 'Try again',
        signOut: 'Use a different email',
        autosaveHint: 'Progress saves automatically.'
      }
    },
    is: {
      home: {
        title: 'Finndu þína leið með Vegvisr',
        subtitle: 'Svaraðu nokkrum spurningum svo við getum sérsniðið onboarding.',
        chooseAuth: 'Sláðu inn netfangið til að fá töfrahlekk',
        google: 'Halda áfram með Google',
        email: 'Halda áfram með netfangi',
        emailPlaceholder: 'Sláðu inn netfangið þitt',
        sendLink: 'Senda töfrahlekk',
        linkSent: 'Töfrahlekkur sendur. Athugaðu pósthólfið.',
        language: 'Tungumál'
      },
      auth: {
        verifying: 'Staðfestum aðgang...',
        success: 'Þú ert staðfest(ur). Flyt á onboarding.',
        failure: 'Við gátum ekki staðfest hlekkinn. Biddu um nýjan.',
        callbackError: 'Google innskráning mistókst. Reyndu aftur.'
      },
      onboarding: {
        title: 'Vegvisr onboarding',
        step: 'Skref',
        of: 'af',
        next: 'Næsta skref',
        back: 'Til baka',
        submit: 'Senda onboarding',
        saving: 'Vista framvindu...',
        saved: 'Allt vistað',
        successTitle: 'Allt klárt!',
        successBody: 'Við höfum móttekið svörin þín.'
      },
      common: {
        loading: 'Hleð...',
        emailLabel: 'Netfang',
        required: 'Þetta reit er nauðsynlegur',
        tryAgain: 'Reyndu aftur',
        signOut: 'Nota annað netfang',
        autosaveHint: 'Framvinda vistast sjálfkrafa.'
      }
    },
    no: {
      home: {
        title: 'Finn din læringsvei med Vegvisr',
        subtitle: 'Svar på noen spørsmål så vi kan tilpasse onboardingen din.',
        chooseAuth: 'Skriv inn e-posten din for å få en magisk lenke',
        google: 'Fortsett med Google',
        email: 'Fortsett med e-post',
        emailPlaceholder: 'Skriv inn e-postadressen din',
        sendLink: 'Send magisk lenke',
        linkSent: 'Magisk lenke sendt. Sjekk innboksen.',
        language: 'Språk'
      },
      auth: {
        verifying: 'Verifiserer tilgangen din...',
        success: 'Du er verifisert. Sender deg til onboarding.',
        failure: 'Vi kunne ikke verifisere lenken. Be om en ny.',
        callbackError: 'Vi kunne ikke fullføre Google-innloggingen. Prøv igjen.'
      },
      onboarding: {
        title: 'Din Vegvisr onboarding',
        step: 'Steg',
        of: 'av',
        next: 'Neste steg',
        back: 'Tilbake',
        submit: 'Send onboarding',
        saving: 'Lagrer fremdrift...',
        saved: 'Alt er lagret',
        successTitle: 'Du er klar!',
        successBody: 'Vi har mottatt svarene dine. Vi vil gå gjennom dem og komme tilbake til deg så snart vi kan.'
      },
      common: {
        loading: 'Laster...',
        emailLabel: 'E-postadresse',
        required: 'Dette feltet er påkrevd',
        tryAgain: 'Prøv igjen',
        signOut: 'Bruk en annen e-post',
        autosaveHint: 'Fremdriften lagres automatisk.'
      }
    },
    nl: {
      home: {
        title: 'Vind je leerpad met Vegvisr',
        subtitle: 'Beantwoord een paar vragen zodat we je onboarding kunnen afstemmen.',
        chooseAuth: 'Vul je e-mailadres in om een magische link te krijgen',
        google: 'Doorgaan met Google',
        email: 'Doorgaan met e-mail',
        emailPlaceholder: 'Vul je e-mailadres in',
        sendLink: 'Stuur magische link',
        linkSent: 'Magische link verzonden. Controleer je inbox.',
        language: 'Taal'
      },
      auth: {
        verifying: 'Je toegang wordt geverifieerd...',
        success: 'Je bent geverifieerd. We sturen je naar de onboarding.',
        failure: 'We konden die link niet verifiëren. Vraag een nieuwe aan.',
        callbackError: 'We konden Google-aanmelding niet voltooien. Probeer opnieuw.'
      },
      onboarding: {
        title: 'Jouw Vegvisr onboarding',
        step: 'Stap',
        of: 'van',
        next: 'Volgende stap',
        back: 'Terug',
        submit: 'Onboarding verzenden',
        saving: 'Voortgang opslaan...',
        saved: 'Alles opgeslagen',
        successTitle: 'Je bent er klaar voor!',
        successBody: 'We hebben je antwoorden ontvangen. We bekijken ze en nemen zo snel mogelijk contact met je op.'
      },
      common: {
        loading: 'Laden...',
        emailLabel: 'E-mailadres',
        required: 'Dit veld is verplicht',
        tryAgain: 'Probeer opnieuw',
        signOut: 'Gebruik een ander e-mailadres',
        autosaveHint: 'Voortgang wordt automatisch opgeslagen.'
      }
    }
  });
  const [selectedTranslationLang, setSelectedTranslationLang] = useState<'en' | 'is' | 'no' | 'nl'>('en');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ home: true, auth: false, onboarding: false, common: false });
  const [aiTranslateLoading, setAiTranslateLoading] = useState(false);
  const [aiTranslateStatus, setAiTranslateStatus] = useState('');
  const [aiTranslateError, setAiTranslateError] = useState('');
  const [selectedKeyForTranslation, setSelectedKeyForTranslation] = useState<string | null>(null);

  const updateBrandingDraft = (partial: BrandingPreview) => {
    lastBrandingUpdate.current = 'form';
    setBrandingDraft((prev) => {
      const next = {
        ...prev,
        ...partial,
        brand: { ...prev.brand, ...partial.brand },
        meta: { ...prev.meta, ...partial.meta },
        copy: { ...prev.copy, ...partial.copy },
        language: { ...prev.language, ...partial.language },
        layout: { ...prev.layout, ...partial.layout },
        theme: {
          ...prev.theme,
          ...partial.theme,
          background: { ...prev.theme?.background, ...partial.theme?.background },
          text: { ...prev.theme?.text, ...partial.theme?.text },
          card: { ...prev.theme?.card, ...partial.theme?.card },
          button: { ...prev.theme?.button, ...partial.theme?.button }
        }
      };
      setBrandingJson(JSON.stringify(next, null, 2));
      setBrandingJsonError('');
      setPreviewBranding(next);
      return next;
    });
  };

  const renderBrandingEditor = () => (
    <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/40 p-4">
      <div className="text-xs uppercase tracking-[0.3em] text-white/60">Direct branding fields</div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <input
          type="text"
          value={brandingDraft.brand?.name || ''}
          onChange={(event) => updateBrandingDraft({ brand: { name: event.target.value } })}
          placeholder="Brand name"
          className="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
        />
        <input
          type="text"
          value={brandingDraft.brand?.logoUrl || ''}
          onChange={(event) => updateBrandingDraft({ brand: { logoUrl: event.target.value } })}
          placeholder="Logo URL"
          className="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
        />
        <input
          type="text"
          value={brandingDraft.brand?.slogan || ''}
          onChange={(event) => updateBrandingDraft({ brand: { slogan: event.target.value } })}
          placeholder="Slogan"
          className="sm:col-span-2 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
        />
      </div>

      <div className="mt-5 text-xs uppercase tracking-[0.3em] text-white/60">Meta / tab</div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <input
          type="text"
          value={brandingDraft.meta?.title || ''}
          onChange={(event) => updateBrandingDraft({ meta: { title: event.target.value } })}
          placeholder="Tab title"
          className="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
        />
        <input
          type="text"
          value={brandingDraft.meta?.faviconUrl || ''}
          onChange={(event) => updateBrandingDraft({ meta: { faviconUrl: event.target.value } })}
          placeholder="Favicon URL"
          className="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
        />
        <input
          type="text"
          value={brandingDraft.meta?.description || ''}
          onChange={(event) => updateBrandingDraft({ meta: { description: event.target.value } })}
          placeholder="Meta description"
          className="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
        />
        <input
          type="text"
          value={brandingDraft.meta?.ogImageUrl || ''}
          onChange={(event) => updateBrandingDraft({ meta: { ogImageUrl: event.target.value } })}
          placeholder="OG image URL"
          className="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
        />
      </div>

      <div className="mt-5 text-xs uppercase tracking-[0.3em] text-white/60">Copy</div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <input
          type="text"
          value={brandingDraft.copy?.badge || ''}
          onChange={(event) => updateBrandingDraft({ copy: { badge: event.target.value } })}
          placeholder="Badge"
          className="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
        />
        <input
          type="text"
          value={brandingDraft.copy?.headline || ''}
          onChange={(event) => updateBrandingDraft({ copy: { headline: event.target.value } })}
          placeholder="Headline"
          className="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
        />
        <input
          type="text"
          value={brandingDraft.copy?.subheadline || ''}
          onChange={(event) => updateBrandingDraft({ copy: { subheadline: event.target.value } })}
          placeholder="Subheadline"
          className="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
        />
        <input
          type="text"
          value={brandingDraft.copy?.emailLabel || ''}
          onChange={(event) => updateBrandingDraft({ copy: { emailLabel: event.target.value } })}
          placeholder="Email label"
          className="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
        />
        <input
          type="text"
          value={brandingDraft.copy?.emailPlaceholder || ''}
          onChange={(event) => updateBrandingDraft({ copy: { emailPlaceholder: event.target.value } })}
          placeholder="Email placeholder"
          className="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
        />
        <input
          type="text"
          value={brandingDraft.copy?.cta || ''}
          onChange={(event) => updateBrandingDraft({ copy: { cta: event.target.value } })}
          placeholder="CTA"
          className="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
        />
      </div>

      <div className="mt-5 text-xs uppercase tracking-[0.3em] text-white/60">Theme Colors</div>

      <div className="mt-4 text-[10px] uppercase tracking-[0.2em] text-white/40">Text Colors</div>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3">
          <input
            type="color"
            value={brandingDraft.theme?.text?.primary || '#e5e7eb'}
            onChange={(event) => updateBrandingDraft({ theme: { text: { primary: event.target.value } } })}
            className="h-8 w-10 cursor-pointer rounded border border-white/20 bg-transparent"
            title="Primary text color"
          />
          <div className="flex-1">
            <div className="text-[10px] text-white/50">Primary Text</div>
            <input
              type="text"
              value={brandingDraft.theme?.text?.primary || ''}
              onChange={(event) => updateBrandingDraft({ theme: { text: { primary: event.target.value } } })}
              placeholder="#e5e7eb"
              className="mt-1 w-full bg-transparent text-xs text-white placeholder:text-white/30 focus:outline-none"
            />
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3">
          <input
            type="color"
            value={brandingDraft.theme?.text?.muted?.replace(/rgba?\([^)]+\)/, '#888888') || '#888888'}
            onChange={(event) => updateBrandingDraft({ theme: { text: { muted: event.target.value } } })}
            className="h-8 w-10 cursor-pointer rounded border border-white/20 bg-transparent"
            title="Muted text color"
          />
          <div className="flex-1">
            <div className="text-[10px] text-white/50">Muted Text</div>
            <input
              type="text"
              value={brandingDraft.theme?.text?.muted || ''}
              onChange={(event) => updateBrandingDraft({ theme: { text: { muted: event.target.value } } })}
              placeholder="rgba(229,231,235,0.7)"
              className="mt-1 w-full bg-transparent text-xs text-white placeholder:text-white/30 focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="mt-4 text-[10px] uppercase tracking-[0.2em] text-white/40">Headline Gradient</div>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3">
          <input
            type="color"
            value={brandingDraft.theme?.text?.headlineGradient?.[0] || '#3b82f6'}
            onChange={(event) =>
              updateBrandingDraft({
                theme: {
                  text: {
                    headlineGradient: [
                      event.target.value,
                      brandingDraft.theme?.text?.headlineGradient?.[1] || '#8b5cf6'
                    ]
                  }
                }
              })
            }
            className="h-8 w-10 cursor-pointer rounded border border-white/20 bg-transparent"
            title="Headline gradient start"
          />
          <div className="flex-1">
            <div className="text-[10px] text-white/50">Gradient Start</div>
            <input
              type="text"
              value={brandingDraft.theme?.text?.headlineGradient?.[0] || ''}
              onChange={(event) =>
                updateBrandingDraft({
                  theme: {
                    text: {
                      headlineGradient: [
                        event.target.value,
                        brandingDraft.theme?.text?.headlineGradient?.[1] || ''
                      ]
                    }
                  }
                })
              }
              placeholder="#3b82f6"
              className="mt-1 w-full bg-transparent text-xs text-white placeholder:text-white/30 focus:outline-none"
            />
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3">
          <input
            type="color"
            value={brandingDraft.theme?.text?.headlineGradient?.[1] || '#8b5cf6'}
            onChange={(event) =>
              updateBrandingDraft({
                theme: {
                  text: {
                    headlineGradient: [
                      brandingDraft.theme?.text?.headlineGradient?.[0] || '#3b82f6',
                      event.target.value
                    ]
                  }
                }
              })
            }
            className="h-8 w-10 cursor-pointer rounded border border-white/20 bg-transparent"
            title="Headline gradient end"
          />
          <div className="flex-1">
            <div className="text-[10px] text-white/50">Gradient End</div>
            <input
              type="text"
              value={brandingDraft.theme?.text?.headlineGradient?.[1] || ''}
              onChange={(event) =>
                updateBrandingDraft({
                  theme: {
                    text: {
                      headlineGradient: [
                        brandingDraft.theme?.text?.headlineGradient?.[0] || '',
                        event.target.value
                      ]
                    }
                  }
                })
              }
              placeholder="#8b5cf6"
              className="mt-1 w-full bg-transparent text-xs text-white placeholder:text-white/30 focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="mt-4 text-[10px] uppercase tracking-[0.2em] text-white/40">Card Styling</div>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3">
          <input
            type="color"
            value={brandingDraft.theme?.card?.bg?.replace(/rgba?\([^)]+\)/, '#1e1e1e') || '#1e1e1e'}
            onChange={(event) => updateBrandingDraft({ theme: { card: { bg: event.target.value } } })}
            className="h-8 w-10 cursor-pointer rounded border border-white/20 bg-transparent"
            title="Card background"
          />
          <div className="flex-1">
            <div className="text-[10px] text-white/50">Card Background</div>
            <input
              type="text"
              value={brandingDraft.theme?.card?.bg || ''}
              onChange={(event) => updateBrandingDraft({ theme: { card: { bg: event.target.value } } })}
              placeholder="rgba(255,255,255,0.12)"
              className="mt-1 w-full bg-transparent text-xs text-white placeholder:text-white/30 focus:outline-none"
            />
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3">
          <input
            type="color"
            value={brandingDraft.theme?.card?.border?.replace(/rgba?\([^)]+\)/, '#333333') || '#333333'}
            onChange={(event) => updateBrandingDraft({ theme: { card: { border: event.target.value } } })}
            className="h-8 w-10 cursor-pointer rounded border border-white/20 bg-transparent"
            title="Card border"
          />
          <div className="flex-1">
            <div className="text-[10px] text-white/50">Card Border</div>
            <input
              type="text"
              value={brandingDraft.theme?.card?.border || ''}
              onChange={(event) => updateBrandingDraft({ theme: { card: { border: event.target.value } } })}
              placeholder="rgba(255,255,255,0.2)"
              className="mt-1 w-full bg-transparent text-xs text-white placeholder:text-white/30 focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="mt-4 text-[10px] uppercase tracking-[0.2em] text-white/40">Button Styling</div>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3">
          <input
            type="color"
            value={brandingDraft.theme?.button?.bgGradient?.[0] || '#3b82f6'}
            onChange={(event) =>
              updateBrandingDraft({
                theme: {
                  button: {
                    bgGradient: [
                      event.target.value,
                      brandingDraft.theme?.button?.bgGradient?.[1] || '#8b5cf6'
                    ]
                  }
                }
              })
            }
            className="h-8 w-10 cursor-pointer rounded border border-white/20 bg-transparent"
            title="Button gradient start"
          />
          <div className="flex-1">
            <div className="text-[10px] text-white/50">Button Gradient Start</div>
            <input
              type="text"
              value={brandingDraft.theme?.button?.bgGradient?.[0] || ''}
              onChange={(event) =>
                updateBrandingDraft({
                  theme: {
                    button: {
                      bgGradient: [
                        event.target.value,
                        brandingDraft.theme?.button?.bgGradient?.[1] || ''
                      ]
                    }
                  }
                })
              }
              placeholder="#3b82f6"
              className="mt-1 w-full bg-transparent text-xs text-white placeholder:text-white/30 focus:outline-none"
            />
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3">
          <input
            type="color"
            value={brandingDraft.theme?.button?.bgGradient?.[1] || '#8b5cf6'}
            onChange={(event) =>
              updateBrandingDraft({
                theme: {
                  button: {
                    bgGradient: [
                      brandingDraft.theme?.button?.bgGradient?.[0] || '#3b82f6',
                      event.target.value
                    ]
                  }
                }
              })
            }
            className="h-8 w-10 cursor-pointer rounded border border-white/20 bg-transparent"
            title="Button gradient end"
          />
          <div className="flex-1">
            <div className="text-[10px] text-white/50">Button Gradient End</div>
            <input
              type="text"
              value={brandingDraft.theme?.button?.bgGradient?.[1] || ''}
              onChange={(event) =>
                updateBrandingDraft({
                  theme: {
                    button: {
                      bgGradient: [
                        brandingDraft.theme?.button?.bgGradient?.[0] || '',
                        event.target.value
                      ]
                    }
                  }
                })
              }
              placeholder="#8b5cf6"
              className="mt-1 w-full bg-transparent text-xs text-white placeholder:text-white/30 focus:outline-none"
            />
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3">
          <input
            type="color"
            value={brandingDraft.theme?.button?.text || '#ffffff'}
            onChange={(event) => updateBrandingDraft({ theme: { button: { text: event.target.value } } })}
            className="h-8 w-10 cursor-pointer rounded border border-white/20 bg-transparent"
            title="Button text color"
          />
          <div className="flex-1">
            <div className="text-[10px] text-white/50">Button Text Color</div>
            <input
              type="text"
              value={brandingDraft.theme?.button?.text || ''}
              onChange={(event) => updateBrandingDraft({ theme: { button: { text: event.target.value } } })}
              placeholder="#ffffff"
              className="mt-1 w-full bg-transparent text-xs text-white placeholder:text-white/30 focus:outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderEditableCopy = (
    key: keyof NonNullable<BrandingPreview['copy']>,
    value: string | undefined,
    placeholder: string,
    className: string,
    inputClassName?: string
  ) => {
    const fieldKey = `copy.${key}`;
    if (editingKey === fieldKey) {
      return (
        <input
          value={value || ''}
          onChange={(event) => updateBrandingDraft({ copy: { [key]: event.target.value } })}
          onBlur={() => setEditingKey(null)}
          autoFocus
          placeholder={placeholder}
          className={cx(
            'w-full rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-sm text-white outline-none',
            inputClassName
          )}
        />
      );
    }

    return (
      <span
        role="button"
        tabIndex={0}
        onClick={() => setEditingKey(fieldKey)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            setEditingKey(fieldKey);
          }
        }}
        className={cx('cursor-text text-white/90 hover:text-white', className)}
      >
        {value || placeholder}
      </span>
    );
  };

  const renderEditableBrand = (
    key: keyof NonNullable<BrandingPreview['brand']>,
    value: string | undefined,
    placeholder: string,
    className: string,
    inputClassName?: string
  ) => {
    const fieldKey = `brand.${key}`;
    if (editingKey === fieldKey) {
      return (
        <input
          value={value || ''}
          onChange={(event) => updateBrandingDraft({ brand: { [key]: event.target.value } })}
          onBlur={() => setEditingKey(null)}
          autoFocus
          placeholder={placeholder}
          className={cx(
            'w-full rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-sm text-white outline-none',
            inputClassName
          )}
        />
      );
    }

    return (
      <span
        role="button"
        tabIndex={0}
        onClick={() => setEditingKey(fieldKey)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            setEditingKey(fieldKey);
          }
        }}
        className={cx('cursor-text text-white/90 hover:text-white', className)}
      >
        {value || placeholder}
      </span>
    );
  };

  const ensureBackgroundPoints = (points?: Array<{ id: string; x: number; y: number; color: string }>) => {
    if (points && points.length >= 5) return points;
    return [
      { id: 'tl', x: 10, y: 10, color: '#1d4ed8' },
      { id: 'tr', x: 90, y: 10, color: '#0f172a' },
      { id: 'bl', x: 10, y: 90, color: '#e0f2fe' },
      { id: 'br', x: 90, y: 90, color: '#2563eb' },
      { id: 'c', x: 50, y: 50, color: '#60a5fa' }
    ];
  };

  const updatePoint = (id: string, next: Partial<{ x: number; y: number; color: string }>) => {
    const points = ensureBackgroundPoints(brandingDraft.theme?.background?.points).map((point) =>
      point.id === id ? { ...point, ...next } : point
    );
    updateBrandingDraft({ theme: { background: { points } } });
  };

  useEffect(() => {
    if (!brandingJson.trim()) {
      setBrandingJsonError('');
      setPreviewBranding(null);
      return;
    }
    try {
      const parsed = JSON.parse(brandingJson) as BrandingPreview;
      setPreviewBranding(parsed);
      setBrandingJsonError('');
      if (lastBrandingUpdate.current !== 'form') {
        setBrandingDraft(parsed);
      }
      lastBrandingUpdate.current = null;
    } catch {
      setPreviewBranding(null);
      setBrandingJsonError('Branding JSON must be valid JSON.');
      lastBrandingUpdate.current = null;
    }
  }, [brandingJson]);

  useEffect(() => {
    if (lastBrandingUpdate.current !== 'form') return;
    setBrandingJson(JSON.stringify(brandingDraft, null, 2));
    lastBrandingUpdate.current = null;
  }, [brandingDraft]);

  useEffect(() => {
    if (!isResizing) return;
    const handleMove = (event: MouseEvent) => {
      if (!splitRef.current) return;
      const bounds = splitRef.current.getBoundingClientRect();
      if (!bounds.width) return;
      const next = ((event.clientX - bounds.left) / bounds.width) * 100;
      const clamped = Math.min(70, Math.max(30, next));
      setSplitRatio(clamped);
    };
    const handleUp = () => setIsResizing(false);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isResizing]);

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
          const nextConfigs: Record<string, { targetApp?: string; logoUrl?: string; slogan?: string; branding?: unknown }> = {};
          data.configs.forEach((entry: { domain?: string; config?: { targetApp?: string; logoUrl?: string; slogan?: string; branding?: unknown } }) => {
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
        setBrandSlogan(data?.config?.slogan || null);
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

  const handleEditDomain = (domain: string) => {
    const config = domainConfigs[domain] || {};
    setDomainInput(domain);
    setTargetApp(config.targetApp || 'aichat');
    setLogoUrl(config.logoUrl || '');
    setSlogan(config.slogan || '');
    if (config?.branding) {
      lastBrandingUpdate.current = 'json';
      setBrandingJson(JSON.stringify(config.branding, null, 2));
    } else {
      lastBrandingUpdate.current = 'json';
      setBrandingJson('');
    }
  };

  const handleViewBranding = async (domain: string) => {
    if (!DOMAIN_API_BASE) return;
    try {
      const response = await fetch(
        `${DOMAIN_API_BASE}/custom-domain?domain=${encodeURIComponent(domain)}`
      );
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || 'Failed to load branding.');
      }
      if (data?.config?.branding) {
        lastBrandingUpdate.current = 'json';
        setBrandingJson(JSON.stringify(data.config.branding, null, 2));
        setDomainInput(domain);
        setTargetApp(data?.config?.targetApp || 'aichat');
        setLogoUrl(data?.config?.logoUrl || '');
        setSlogan(data?.config?.slogan || '');
      } else {
        setDomainError('No branding JSON stored for this domain yet.');
      }
    } catch (error) {
      setDomainError(error instanceof Error ? error.message : 'Failed to load branding.');
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
      let brandingPayload;
      if (brandingJson.trim()) {
        try {
          brandingPayload = JSON.parse(brandingJson);
        } catch {
          throw new Error('Branding JSON must be valid JSON.');
        }
      }

      const response = await fetch(`${DOMAIN_API_BASE}/custom-domain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: domainInput.trim(),
          targetApp,
          logoUrl,
          slogan,
          branding: brandingPayload
        })
      });
      const data = await response.json();
      if (!response.ok || data?.success === false) {
        throw new Error(data?.message || 'Failed to add domain.');
      }
      setDomainStatus(`Added ${data.domain}. DNS/SSL may take a few minutes.`);
      setDomainInput(data.domain || domainInput.trim());
      if (data?.config?.logoUrl !== undefined) setLogoUrl(data.config.logoUrl || '');
      if (data?.config?.slogan !== undefined) setSlogan(data.config.slogan || '');
      if (data?.config?.branding !== undefined) {
        lastBrandingUpdate.current = 'json';
        setBrandingJson(
          data.config.branding ? JSON.stringify(data.config.branding, null, 2) : brandingJson
        );
      }
      if (Array.isArray(data.domains)) {
        setDomainList(data.domains);
        refreshDomainStatuses(data.domains);
      }
      if (data?.config) {
        setDomainConfigs((prev) => ({
          ...prev,
          [data.domain]: {
            targetApp: data.config.targetApp,
            logoUrl: data.config.logoUrl,
            slogan: data.config.slogan,
            branding: data.config.branding
          }
        }));
      } else if (Array.isArray(data.configs)) {
        const nextConfigs: Record<string, { targetApp?: string; logoUrl?: string; slogan?: string; branding?: unknown }> = {};
        data.configs.forEach((entry: { domain?: string; config?: { targetApp?: string; logoUrl?: string; slogan?: string; branding?: unknown } }) => {
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

  const handleGenerateBranding = async () => {
    setAiError('');
    setAiStatus('');
    if (!authUser?.userId) {
      setAiError('You must be logged in to generate branding JSON.');
      return;
    }
    setAiLoading(true);
    try {
      const appNameMap: Record<string, string> = {
        connect: 'Vegvisr Connect',
        aichat: 'Vegvisr AI Chat',
        photos: 'Vegvisr Photos'
      };
      const response = await fetch(`${OPENAI_WORKER_BASE}/branding/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': authUser.userId },
        body: JSON.stringify({
          userId: authUser.userId,
          brandName: aiBrandName,
          audience: aiAudience,
          appName: appNameMap[targetApp] || 'Vegvisr Connect',
          prompt: aiNotes
        })
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || 'Failed to generate branding JSON.');
      }
      lastBrandingUpdate.current = 'json';
      setBrandingJson(JSON.stringify(data.branding, null, 2));
      setAiStatus('Branding JSON generated.');
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'Failed to generate branding JSON.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <LanguageContext.Provider value={contextValue}>
      <div className="min-h-screen bg-slate-950 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.25),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(139,92,246,0.25),_transparent_55%)]" />
        <div className="relative flex min-h-screen w-full flex-col px-6 py-12">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <img
              src={brandLogo || appLogo}
              alt={t('app.title')}
              className="h-12 w-auto"
            />
              <div className="flex items-center gap-3">
                {authStatus === 'authed' && authUser?.profileimage && (
                  <img
                    src={authUser.profileimage}
                    alt="User avatar"
                    className="h-9 w-9 rounded-full border border-white/20 object-cover"
                  />
                )}
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
            <div className="mb-6 flex gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('starter')}
                className={cx(
                  'rounded-full px-5 py-2 text-sm font-medium transition',
                  activeTab === 'starter'
                    ? 'bg-white/10 text-white'
                    : 'text-white/60 hover:text-white/80'
                )}
              >
                Starter
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('domains')}
                className={cx(
                  'rounded-full px-5 py-2 text-sm font-medium transition',
                  activeTab === 'domains'
                    ? 'bg-white/10 text-white'
                    : 'text-white/60 hover:text-white/80'
                )}
              >
                Domains
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('branding')}
                className={cx(
                  'rounded-full px-5 py-2 text-sm font-medium transition',
                  activeTab === 'branding'
                    ? 'bg-white/10 text-white'
                    : 'text-white/60 hover:text-white/80'
                )}
              >
                Branding
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('translations')}
                className={cx(
                  'rounded-full px-5 py-2 text-sm font-medium transition',
                  activeTab === 'translations'
                    ? 'bg-white/10 text-white'
                    : 'text-white/60 hover:text-white/80'
                )}
              >
                Translations
              </button>
            </div>

            {activeTab === 'starter' && (
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
                {brandSlogan && (
                  <p className="mt-1 text-sm text-white/70">
                    {brandSlogan}
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
            )}

            {activeTab === 'branding' && (
            <section className="rounded-3xl border border-white/10 bg-white/5 p-8">
              <h2 className="text-2xl font-semibold text-white">
                {isEditing ? `Edit: ${domainInput}` : 'Add New Domain'}
              </h2>
              <p className="mt-2 text-sm text-white/70">
                {isEditing
                  ? 'Configure branding and settings for this domain.'
                  : 'Add a custom domain and configure its branding. This uses the Cloudflare API on your account.'}
              </p>

              {previewBranding ? (
                <div ref={splitRef} className="mt-5 flex flex-col gap-6 lg:flex-row lg:gap-0">
                  <div
                    className="lg:pr-6"
                    style={{ flexBasis: `${splitRatio}%` }}
                  >
                    <div className="text-xs uppercase tracking-[0.3em] text-white/60">
                      Branding preview (click text to edit)
                    </div>
                    <div
                      className="mt-3 rounded-3xl border border-white/10 bg-white/5 p-6"
                      style={{
                        '--brand-text-primary': brandingDraft.theme?.text?.primary || '#e5e7eb',
                        '--brand-text-muted': brandingDraft.theme?.text?.muted || 'rgba(229,231,235,0.7)',
                        '--brand-gradient-start': brandingDraft.theme?.text?.headlineGradient?.[0] || '#3b82f6',
                        '--brand-gradient-end': brandingDraft.theme?.text?.headlineGradient?.[1] || '#8b5cf6',
                        '--brand-card-bg': brandingDraft.theme?.card?.bg || 'rgba(255,255,255,0.12)',
                        '--brand-card-border': brandingDraft.theme?.card?.border || 'rgba(255,255,255,0.2)',
                        '--brand-btn-start': brandingDraft.theme?.button?.bgGradient?.[0] || '#3b82f6',
                        '--brand-btn-end': brandingDraft.theme?.button?.bgGradient?.[1] || '#8b5cf6',
                        '--brand-btn-text': brandingDraft.theme?.button?.text || '#ffffff',
                        background: ensureBackgroundPoints(brandingDraft.theme?.background?.points)
                          .map(
                            (point) =>
                              `radial-gradient(circle at ${point.x}% ${point.y}%, ${point.color} 0%, transparent 60%)`
                          )
                          .join(', '),
                        color: 'var(--brand-text-primary)'
                      } as Record<string, string>}
                    >
                      <div className="relative mb-3 h-72 w-full rounded-2xl border border-white/10 bg-white/5">
                        {ensureBackgroundPoints(brandingDraft.theme?.background?.points).map((point) => (
                          <button
                            key={point.id}
                            type="button"
                            onMouseDown={(event) => {
                              event.preventDefault();
                              setSelectedPointId(point.id);
                              const container = event.currentTarget.parentElement;
                              if (!container) return;
                              const onMove = (moveEvent: MouseEvent) => {
                                const rect = container.getBoundingClientRect();
                                const x = ((moveEvent.clientX - rect.left) / rect.width) * 100;
                                const y = ((moveEvent.clientY - rect.top) / rect.height) * 100;
                                updatePoint(point.id, {
                                  x: Math.min(100, Math.max(0, x)),
                                  y: Math.min(100, Math.max(0, y))
                                });
                              };
                              const onUp = () => {
                                window.removeEventListener('mousemove', onMove);
                                window.removeEventListener('mouseup', onUp);
                              };
                              window.addEventListener('mousemove', onMove);
                              window.addEventListener('mouseup', onUp);
                            }}
                            className={`absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70 shadow ${
                              selectedPointId === point.id ? 'ring-2 ring-white' : 'ring-1 ring-white/30'
                            }`}
                            style={{
                              left: `${point.x}%`,
                              top: `${point.y}%`,
                              backgroundColor: point.color
                            }}
                            aria-label={`Gradient point ${point.id}`}
                          />
                        ))}
                      </div>
                      {selectedPointId && (
                        <div className="mb-4 flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3">
                          <div className="text-[10px] uppercase tracking-[0.3em] text-white/50">
                            Gradient point
                          </div>
                          <input
                            type="color"
                            title="Gradient point color picker"
                            value={
                              ensureBackgroundPoints(brandingDraft.theme?.background?.points).find(
                                (point) => point.id === selectedPointId
                              )?.color || '#3b82f6'
                            }
                            onChange={(event) =>
                              updatePoint(selectedPointId, { color: event.target.value })
                            }
                            className="h-8 w-10 cursor-pointer rounded border border-white/20 bg-transparent"
                          />
                          <input
                            type="text"
                            title="Gradient point color value"
                            placeholder="#3b82f6"
                            value={
                              ensureBackgroundPoints(brandingDraft.theme?.background?.points).find(
                                (point) => point.id === selectedPointId
                              )?.color || ''
                            }
                            onChange={(event) =>
                              updatePoint(selectedPointId, { color: event.target.value })
                            }
                            className="w-28 rounded-md border border-white/10 bg-slate-900/80 px-3 py-2 text-xs text-white/80"
                          />
                          <button
                            type="button"
                            onClick={() => setSelectedPointId(null)}
                            className="ml-auto text-xs text-white/50 hover:text-white/80"
                          >
                            Done
                          </button>
                        </div>
                      )}
                      <div className="flex items-start gap-4">
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => setEditingKey('brand.logoUrl')}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              setEditingKey('brand.logoUrl');
                            }
                          }}
                          className="h-12 w-12 rounded-full border border-white/10 bg-white/10 text-[10px] text-white/60 flex items-center justify-center overflow-hidden"
                        >
                          {editingKey === 'brand.logoUrl' ? (
                            <input
                              value={brandingDraft.brand?.logoUrl || ''}
                              onChange={(event) => updateBrandingDraft({ brand: { logoUrl: event.target.value } })}
                              onBlur={() => setEditingKey(null)}
                              autoFocus
                              placeholder="Logo URL"
                              className="w-full h-full bg-transparent text-[10px] text-white/80 outline-none px-1"
                            />
                          ) : brandingDraft.brand?.logoUrl ? (
                            <img
                              src={brandingDraft.brand?.logoUrl}
                              alt="Brand logo preview"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            'Logo'
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-white">
                            {renderEditableBrand(
                              'name',
                              brandingDraft.brand?.name,
                              'Brand name',
                              ''
                            )}
                          </div>
                          <div className="mt-1 text-xs text-white/60">
                            {renderEditableBrand(
                              'slogan',
                              brandingDraft.brand?.slogan,
                              'Brand slogan',
                              ''
                            )}
                          </div>
                          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-white/70">
                            {renderEditableCopy(
                              'badge',
                              brandingDraft.copy?.badge,
                              'Brand badge',
                              ''
                            )}
                          </div>
                        </div>
                      </div>
                      <h3
                        className="mt-4 text-2xl font-semibold"
                        style={{
                          background: 'linear-gradient(90deg, var(--brand-gradient-start), var(--brand-gradient-end))',
                          WebkitBackgroundClip: 'text',
                          color: 'transparent'
                        }}
                      >
                        {renderEditableCopy(
                          'headline',
                          brandingDraft.copy?.headline,
                          'Brand headline',
                          ''
                        )}
                      </h3>
                      <p className="mt-2 text-sm" style={{ color: 'var(--brand-text-muted)' }}>
                        {renderEditableCopy(
                          'subheadline',
                          brandingDraft.copy?.subheadline,
                          'Subheadline preview text.',
                          ''
                        )}
                      </p>
                      <div
                        className="mt-4 rounded-2xl border p-4"
                        style={{
                          background: 'var(--brand-card-bg)',
                          borderColor: 'var(--brand-card-border)'
                        }}
                      >
                        <p className="text-xs font-semibold text-white/80">
                          {renderEditableCopy(
                            'emailLabel',
                            brandingDraft.copy?.emailLabel,
                            'Enter your email to get a magic link',
                            ''
                          )}
                        </p>
                        <div className="mt-3 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-xs text-white/60">
                          {renderEditableCopy(
                            'emailPlaceholder',
                            brandingDraft.copy?.emailPlaceholder,
                            'Enter your email address',
                            ''
                          )}
                        </div>
                        <button
                          type="button"
                          className="mt-3 rounded-xl px-4 py-2 text-xs font-semibold"
                          style={{
                            background: 'linear-gradient(90deg, var(--brand-btn-start), var(--brand-btn-end))',
                            color: 'var(--brand-btn-text)'
                          }}
                        >
                          {renderEditableCopy(
                            'cta',
                            brandingDraft.copy?.cta,
                            'Send magic link',
                            ''
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="hidden lg:flex items-stretch">
                    <div
                      role="separator"
                      aria-orientation="vertical"
                      onMouseDown={() => setIsResizing(true)}
                      className={`mx-2 w-1 cursor-col-resize rounded-full bg-white/10 hover:bg-white/30 ${
                        isResizing ? 'bg-white/40' : ''
                      }`}
                    />
                  </div>

                  <div
                    className="lg:pl-6"
                    style={{ flexBasis: `${100 - splitRatio}%` }}
                  >
                    <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr]">
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
                      <input
                        type="text"
                        value={slogan}
                        onChange={(event) => setSlogan(event.target.value)}
                        placeholder="Brand slogan"
                        className="flex-1 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
                      />
                      <button
                        type="button"
                        onClick={handleAddDomain}
                        disabled={domainLoading}
                        className="rounded-2xl bg-gradient-to-r from-sky-500 to-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/30"
                      >
                        {domainLoading ? 'Saving...' : isEditing ? 'Save changes' : 'Add domain'}
                      </button>
                    </div>
                    <textarea
                      value={brandingJson}
                      onChange={(event) => {
                        lastBrandingUpdate.current = 'json';
                        setBrandingJson(event.target.value);
                      }}
                      placeholder="Branding JSON (optional)"
                      rows={4}
                      className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
                    />
                    {renderBrandingEditor()}
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <input
                        type="text"
                        value={aiBrandName}
                        onChange={(event) => setAiBrandName(event.target.value)}
                        placeholder="Brand name for AI (optional)"
                        className="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
                      />
                      <input
                        type="text"
                        value={aiAudience}
                        onChange={(event) => setAiAudience(event.target.value)}
                        placeholder="Audience (optional)"
                        className="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
                      />
                      <input
                        type="text"
                        value={aiNotes}
                        onChange={(event) => setAiNotes(event.target.value)}
                        placeholder="AI prompt (style, tone, colors)"
                        className="sm:col-span-2 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
                      />
                    </div>
                    <div className="mt-3 grid gap-3 lg:grid-cols-3">
                      {themeCards.map((theme) => (
                        <button
                          key={theme.id}
                          type="button"
                          onClick={() => {
                            setSelectedTheme(theme.id);
                            setAiNotes(theme.prompt);
                          }}
                          className={`rounded-2xl border px-4 py-3 text-left text-xs text-white/80 transition ${
                            selectedTheme === theme.id
                              ? 'border-white/40 ring-1 ring-white/30'
                              : 'border-white/10 hover:border-white/30'
                          }`}
                        >
                          <div className={`mb-3 h-14 rounded-xl border bg-gradient-to-br ${theme.classes}`} />
                          <div className="text-sm font-semibold text-white">{theme.name}</div>
                          <div className="mt-1 text-xs text-white/60">{theme.description}</div>
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={handleGenerateBranding}
                        disabled={aiLoading}
                        className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/80 hover:border-white/30"
                      >
                        {aiLoading ? 'Generating…' : 'Generate with AI'}
                      </button>
                      {aiStatus && <span className="text-xs text-emerald-300">{aiStatus}</span>}
                      {aiError && <span className="text-xs text-rose-300">{aiError}</span>}
                    </div>
                    {brandingJsonError && (
                      <p className="mt-2 text-xs text-rose-300">{brandingJsonError}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-5">
                  <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr]">
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
                    <input
                      type="text"
                      value={slogan}
                      onChange={(event) => setSlogan(event.target.value)}
                      placeholder="Brand slogan"
                      className="flex-1 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
                    />
                    <button
                      type="button"
                      onClick={handleAddDomain}
                      disabled={domainLoading}
                      className="rounded-2xl bg-gradient-to-r from-sky-500 to-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/30"
                    >
                      {domainLoading ? 'Saving...' : isEditing ? 'Save changes' : 'Add domain'}
                    </button>
                  </div>
                  <textarea
                    value={brandingJson}
                    onChange={(event) => {
                      lastBrandingUpdate.current = 'json';
                      setBrandingJson(event.target.value);
                    }}
                    placeholder="Branding JSON (optional)"
                    rows={4}
                    className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
                  />
                  {renderBrandingEditor()}
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <input
                      type="text"
                      value={aiBrandName}
                      onChange={(event) => setAiBrandName(event.target.value)}
                      placeholder="Brand name for AI (optional)"
                      className="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
                    />
                    <input
                      type="text"
                      value={aiAudience}
                      onChange={(event) => setAiAudience(event.target.value)}
                      placeholder="Audience (optional)"
                      className="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
                    />
                    <input
                      type="text"
                      value={aiNotes}
                      onChange={(event) => setAiNotes(event.target.value)}
                      placeholder="AI prompt (style, tone, colors)"
                      className="sm:col-span-2 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
                    />
                  </div>
                  <div className="mt-3 grid gap-3 lg:grid-cols-3">
                    {themeCards.map((theme) => (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => {
                          setSelectedTheme(theme.id);
                          setAiNotes(theme.prompt);
                        }}
                        className={`rounded-2xl border px-4 py-3 text-left text-xs text-white/80 transition ${
                          selectedTheme === theme.id
                            ? 'border-white/40 ring-1 ring-white/30'
                            : 'border-white/10 hover:border-white/30'
                        }`}
                      >
                        <div className={`mb-3 h-14 rounded-xl border bg-gradient-to-br ${theme.classes}`} />
                        <div className="text-sm font-semibold text-white">{theme.name}</div>
                        <div className="mt-1 text-xs text-white/60">{theme.description}</div>
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleGenerateBranding}
                      disabled={aiLoading}
                      className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/80 hover:border-white/30"
                    >
                      {aiLoading ? 'Generating…' : 'Generate with AI'}
                    </button>
                    {aiStatus && <span className="text-xs text-emerald-300">{aiStatus}</span>}
                    {aiError && <span className="text-xs text-rose-300">{aiError}</span>}
                  </div>
                  {brandingJsonError && (
                    <p className="mt-2 text-xs text-rose-300">{brandingJsonError}</p>
                  )}
                </div>
              )}

              {domainStatus && (
                <p className="mt-3 text-xs text-emerald-300">{domainStatus}</p>
              )}
              {domainError && (
                <p className="mt-3 text-xs text-rose-300">{domainError}</p>
              )}
            </section>
            )}

            {activeTab === 'domains' && (
              <section className="rounded-3xl border border-white/10 bg-white/5 p-8">
                <h2 className="text-2xl font-semibold text-white">Domains</h2>
                <p className="mt-2 text-sm text-white/70">
                  Manage your custom domains. Click Edit to configure branding for a domain.
                </p>

                <div className="mt-6 rounded-2xl border border-white/10 bg-slate-900/50 px-6 py-5 text-sm text-white/70">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold uppercase tracking-[0.3em] text-white/50">
                      Domains on this project
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDomainInput('');
                        setTargetApp('aichat');
                        setLogoUrl('');
                        setSlogan('');
                        setBrandingJson('');
                        setActiveTab('branding');
                      }}
                      className="rounded-full bg-gradient-to-r from-sky-500 to-emerald-500 px-4 py-1.5 text-xs font-semibold text-white shadow-lg shadow-sky-500/20"
                    >
                      + Add Domain
                    </button>
                  </div>
                  {domainList.length === 0 ? (
                    <p className="mt-4 text-white/50">No custom domains found yet.</p>
                  ) : (
                    <div className="mt-4 space-y-3">
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
                          <div key={domain} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                            <span className={`h-2.5 w-2.5 rounded-full ${indicatorClass}`} />
                            <span className="font-medium">{domain}</span>
                            {config?.targetApp && (
                              <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/60">{config.targetApp}</span>
                            )}
                            {config?.logoUrl && (
                              <img
                                src={config.logoUrl}
                                alt={`${domain} logo`}
                                className="h-6 w-6 rounded-full border border-white/10 bg-white/5 object-cover"
                              />
                            )}
                            <span className="text-xs text-white/50">{label}</span>
                            <div className="ml-auto flex gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  handleEditDomain(domain);
                                  setActiveTab('branding');
                                }}
                                className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/70 hover:border-white/30 hover:bg-white/5"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  handleViewBranding(domain);
                                  setActiveTab('branding');
                                }}
                                className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/70 hover:border-white/30 hover:bg-white/5"
                              >
                                View JSON
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => refreshDomainStatuses(domainList)}
                    className="mt-4 rounded-full border border-white/10 px-3 py-1 text-xs text-white/70 hover:border-white/30"
                  >
                    Refresh status
                  </button>
                </div>
              </section>
            )}

            {activeTab === 'translations' && (
              <section className="rounded-3xl border border-white/10 bg-white/5 p-8">
                <h2 className="text-2xl font-semibold text-white">Translations Editor v1.0</h2>
                <p className="mt-2 text-sm text-white/70">
                  Edit translation strings for all supported languages. Use AI to translate strings to other languages.
                </p>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <div className="text-xs uppercase tracking-[0.3em] text-white/60">Select language:</div>
                  {(['en', 'is', 'no', 'nl'] as const).map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setSelectedTranslationLang(lang)}
                      className={cx(
                        'rounded-full px-4 py-2 text-sm font-medium transition',
                        selectedTranslationLang === lang
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                          : 'border border-white/10 text-white/60 hover:text-white/80 hover:border-white/30'
                      )}
                    >
                      {lang === 'en' ? 'English' : lang === 'is' ? 'Icelandic' : lang === 'no' ? 'Norwegian' : 'Dutch'}
                    </button>
                  ))}
                </div>

                <div className="mt-6 space-y-4">
                  {Object.entries(translationsData[selectedTranslationLang] || {}).map(([sectionKey, sectionValue]) => (
                    <div key={sectionKey} className="rounded-2xl border border-white/10 bg-slate-900/40">
                      <button
                        type="button"
                        onClick={() => setExpandedSections(prev => ({ ...prev, [sectionKey]: !prev[sectionKey] }))}
                        className="flex w-full items-center justify-between px-5 py-4 text-left"
                      >
                        <span className="text-sm font-semibold uppercase tracking-[0.2em] text-white/80">{sectionKey}</span>
                        <span className="text-white/40">{expandedSections[sectionKey] ? '−' : '+'}</span>
                      </button>

                      {expandedSections[sectionKey] && typeof sectionValue === 'object' && sectionValue !== null && (
                        <div className="border-t border-white/10 px-5 py-4">
                          <div className="space-y-3">
                            {Object.entries(sectionValue as Record<string, unknown>).map(([key, value]) => {
                              const fullKey = `${sectionKey}.${key}`;
                              const isSelected = selectedKeyForTranslation === fullKey;

                              return (
                                <div key={key} className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                      <div className="text-xs font-medium text-white/50 mb-2">{key}</div>
                                      <input
                                        type="text"
                                        title={`Edit ${key} translation`}
                                        value={typeof value === 'string' ? value : JSON.stringify(value)}
                                        onChange={(e) => {
                                          setTranslationsData(prev => ({
                                            ...prev,
                                            [selectedTranslationLang]: {
                                              ...prev[selectedTranslationLang],
                                              [sectionKey]: {
                                                ...(prev[selectedTranslationLang]?.[sectionKey] as Record<string, unknown> || {}),
                                                [key]: e.target.value
                                              }
                                            }
                                          }));
                                        }}
                                        className="w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setSelectedKeyForTranslation(isSelected ? null : fullKey)}
                                      className={cx(
                                        'rounded-lg px-3 py-2 text-xs font-medium transition',
                                        isSelected
                                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                                          : 'border border-white/10 text-white/60 hover:text-white/80 hover:border-white/30'
                                      )}
                                    >
                                      AI Translate
                                    </button>
                                  </div>

                                  {isSelected && (
                                    <div className="mt-4 rounded-lg border border-sky-500/20 bg-sky-500/5 p-4">
                                      <div className="text-xs font-medium text-sky-300/80 mb-3">Translate to other languages</div>
                                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                        {(['en', 'is', 'no', 'nl'] as const)
                                          .filter(lang => lang !== selectedTranslationLang)
                                          .map((targetLang) => {
                                            const targetValue = (translationsData[targetLang]?.[sectionKey] as Record<string, unknown>)?.[key];
                                            return (
                                              <div key={targetLang} className="rounded-lg border border-white/10 bg-slate-900/60 p-3">
                                                <div className="flex items-center justify-between mb-2">
                                                  <span className="text-xs font-medium text-white/60">
                                                    {targetLang === 'en' ? 'English' : targetLang === 'is' ? 'Icelandic' : targetLang === 'no' ? 'Norwegian' : 'Dutch'}
                                                  </span>
                                                  <button
                                                    type="button"
                                                    onClick={async () => {
                                                      if (!authUser?.userId) {
                                                        setAiTranslateError('You must be logged in to use AI translation.');
                                                        return;
                                                      }
                                                      setAiTranslateLoading(true);
                                                      setAiTranslateError('');
                                                      setAiTranslateStatus('');
                                                      try {
                                                        const sourceLangName = selectedTranslationLang === 'en' ? 'English' : selectedTranslationLang === 'is' ? 'Icelandic' : selectedTranslationLang === 'no' ? 'Norwegian' : 'Dutch';
                                                        const targetLangName = targetLang === 'en' ? 'English' : targetLang === 'is' ? 'Icelandic' : targetLang === 'no' ? 'Norwegian' : 'Dutch';

                                                        const response = await fetch(`${API_WORKER_BASE}/ai-translate`, {
                                                          method: 'POST',
                                                          headers: {
                                                            'Content-Type': 'application/json'
                                                          },
                                                          body: JSON.stringify({
                                                            text: value,
                                                            targetLanguage: targetLang,
                                                            prompt: `Translate the following UI string from ${sourceLangName} to ${targetLangName}. This is a "${key}" field in the "${sectionKey}" section of a learning platform. Keep it concise and natural. Only return the translated text, nothing else.

Text to translate:
${value}`
                                                          })
                                                        });
                                                        const data = await response.json();
                                                        if (!response.ok || !data?.success) {
                                                          throw new Error(data?.message || 'Translation failed');
                                                        }
                                                        setTranslationsData(prev => ({
                                                          ...prev,
                                                          [targetLang]: {
                                                            ...prev[targetLang],
                                                            [sectionKey]: {
                                                              ...(prev[targetLang]?.[sectionKey] as Record<string, unknown> || {}),
                                                              [key]: data.translation
                                                            }
                                                          }
                                                        }));
                                                        setAiTranslateStatus(`Translated to ${targetLangName}`);
                                                      } catch (err) {
                                                        setAiTranslateError(err instanceof Error ? err.message : 'Translation failed');
                                                      } finally {
                                                        setAiTranslateLoading(false);
                                                      }
                                                    }}
                                                    disabled={aiTranslateLoading}
                                                    className="rounded px-2 py-1 text-[10px] font-medium bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 disabled:opacity-50"
                                                  >
                                                    {aiTranslateLoading ? '...' : 'Translate'}
                                                  </button>
                                                </div>
                                                <input
                                                  type="text"
                                                  value={typeof targetValue === 'string' ? targetValue : (targetValue ? JSON.stringify(targetValue) : '')}
                                                  onChange={(e) => {
                                                    setTranslationsData(prev => ({
                                                      ...prev,
                                                      [targetLang]: {
                                                        ...prev[targetLang],
                                                        [sectionKey]: {
                                                          ...(prev[targetLang]?.[sectionKey] as Record<string, unknown> || {}),
                                                          [key]: e.target.value
                                                        }
                                                      }
                                                    }));
                                                  }}
                                                  placeholder={`${targetLang === 'en' ? 'English' : targetLang === 'is' ? 'Icelandic' : targetLang === 'no' ? 'Norwegian' : 'Dutch'} translation`}
                                                  className="w-full rounded border border-white/10 bg-slate-800/60 px-2 py-1.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-sky-500/60"
                                                />
                                              </div>
                                            );
                                          })}
                                      </div>
                                      {aiTranslateStatus && <p className="mt-2 text-xs text-emerald-300">{aiTranslateStatus}</p>}
                                      {aiTranslateError && <p className="mt-2 text-xs text-rose-300">{aiTranslateError}</p>}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const json = JSON.stringify(translationsData, null, 2);
                      navigator.clipboard.writeText(json);
                      setAiTranslateStatus('Translations copied to clipboard');
                      setTimeout(() => setAiTranslateStatus(''), 3000);
                    }}
                    className="rounded-full bg-gradient-to-r from-sky-500 to-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-500/30"
                  >
                    Copy All as JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const blob = new Blob([JSON.stringify(translationsData, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'translations.json';
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="rounded-full border border-white/10 px-5 py-2 text-sm font-medium text-white/70 hover:border-white/30 hover:text-white"
                  >
                    Download JSON
                  </button>
                  {aiTranslateStatus && <span className="text-xs text-emerald-300">{aiTranslateStatus}</span>}
                </div>
              </section>
            )}
          </main>
        </div>
      </div>
    </LanguageContext.Provider>
  );
}

export default App
