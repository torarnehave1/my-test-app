# Reverse Proxy og i18n (Connect)

Dette dokumentet forklarer:
- hvordan reverse proxy fungerer for `connect.movemetime.com`
- hvordan backend, mellomlag og frontend henger sammen
- hvordan språk/i18n fungerer i Connect‑appen

## Reverse proxy (enkelt forklart)

### 1) DNS (domeneeier peker til oss)
- Domeneeier legger inn en **CNAME** for `connect.movemetime.com`
- Den peker til vår Cloudflare Worker (proxy), f.eks.  
  `connect.movemetime.com -> test-brand-proxy-worker.torarnehave.workers.dev`

**Resultat:** all trafikk til `connect.movemetime.com` går via Cloudflare.

### 2) Reverse proxy (mellomlag)
Proxy‑en gjør to ting:

1. **Slår opp riktig app**
   - Sjekker hvilken app domenet skal peke til (f.eks. `connect.vegvisr.org`)
   - Informasjonen ligger i **KV** (nøkkel‑verdi lagring)

2. **Sender videre trafikken**
   - Proxy‑en videresender requesten til riktig app

### 3) Branding JSON (samme proxy)
Proxy‑en svarer også på:
```
https://connect.movemetime.com/branding.json
```

Her ligger f.eks:
- Logo
- Slogan
- Farger
- Tekst
- Meta (tab‑tittel og favicon)

### 4) Frontend (Connect‑app)
Connect‑appen henter `branding.json` ved oppstart:

- Setter farger (CSS‑variabler)
- Setter tekst (badge, headline, CTA)
- Setter **tab‑tittel** og **favicon** hvis `meta` finnes

## Teknologi (kort)

**Backend:**
- Cloudflare API (DNS + Pages + Routes)
- KV (lagrer branding per domene)

**Mellomlag:**
- Cloudflare Worker (reverse proxy + branding.json)

**Frontend:**
- React/Vite app (Connect)
- Leser branding og setter UI

## Oppsummert (enkelt)
Når noen åpner `connect.movemetime.com`:

1. DNS peker til Cloudflare Worker  
2. Worker finner riktig app (connect.vegvisr.org)  
3. Worker sender trafikken videre  
4. Appen henter `branding.json` og tilpasser design  

---

## Språk/i18n i Connect‑appen (enkelt forklart)

### 1) Språkvalg lagres lokalt
- Språket lagres i **localStorage**
- Fil: `vegvisr-connect/src/lib/storage.ts`
- Nøkkel: `vegvisr_language`

### 2) LanguageContext holder valgt språk
- Språket legges i React‑context
- Fil: `vegvisr-connect/src/lib/LanguageContext.tsx`
- Alle sider bruker `useLanguage()` for å hente valgt språk

### 3) Tekstene ligger i én fil
- Fil: `vegvisr-connect/src/lib/i18n.ts`
- Inneholder alle tekster for:
  - `en` (engelsk)
  - `no` (norsk)
  - `is` (islandsk)
  - `nl` (nederlandsk)

Eksempel:
```ts
translations.no.home.title = "Finn din læringsvei med Vegvisr"
```

### 4) useTranslation() henter teksten
- Fil: `vegvisr-connect/src/lib/useTranslation.ts`
- Brukes slik:
```ts
const t = useTranslation(language)
t('home.title')
```

### 5) Branding kan overstyre tekster
- `branding.json` kan inneholde egne språk‑tekster
- Dette brukes inne i `getTranslation()` i `i18n.ts`
- Hvis branding har tekst, brukes den i stedet for standard

## Kort flyt (språk)

1. Appen leser språk fra localStorage  
2. LanguageContext gjør språket tilgjengelig  
3. `useTranslation()` henter riktige tekster  
4. Branding kan overstyre teksten hvis definert  

---

Hvis du vil, kan vi:
- Lage egen **branding‑tekst per språk** i `branding.json`
- Legge inn et UI i test‑appen for å redigere språkfelt direkte
