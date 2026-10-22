# relivance.app

Static landing page for **Relivance**, designed to mirror the iOS app's
login screen one-for-one. Hosted on GitHub Pages, connected to the custom
domain `relivance.app`. Adds a quiet early-access email capture and the
two legal pages a site that collects email addresses should have.

No frameworks. No build step. Edit a file, push to `main`, GitHub serves it.

## What's inside

```
relivance.app/
├── index.html              ← the landing page (logo + slogan + early-access form)
├── privacy.html            ← Privacy Policy (plain-English placeholder, see caveat)
├── terms.html              ← Terms (plain-English placeholder, see caveat)
├── styles.css              ← all visual styling, shared across the three pages
├── CNAME                   ← tells GitHub Pages which domain to serve
├── assets/
│   ├── logo-light.svg      ← gradient disc, light-mode variant (from the app)
│   ├── logo-dark.svg       ← silver disc, dark-mode variant (from the app)
│   ├── favicon.svg         ← compact logo for browser tabs
│   └── og-image.svg        ← 1200×630 social-preview card
└── README.md
```

The four SVG assets are the same source files the iOS app ships, copied here
so the brand mark is identical pixel-for-pixel between the app and the web.
Any future logo refresh should update both places.

## Design rationale

The login screen (`AuthView.swift` in the iOS app) is a calm three-line brand
moment: gradient disc → "Relivance" wordmark in Roboto SemiBold 40pt → slogan
in Roboto Regular 17pt, vertically centred on a pure background. This page
preserves all of that one-for-one and adds two elements that read as a
native extension, not a redesign:

1. **Early-access form** beneath the brand block — same `wvSurface` input
   pill the app uses for `TextField`s in the credentials stage, same
   `wvAccent` capsule button the app uses for primary CTAs, same 12pt
   vertical gap, same 14px input corner radius, same 54pt button height,
   same "no extra weight" Roboto.
2. **Tiny footer-nav** with Privacy + Terms links alongside the
   `© Relivance LLC` line. Subtitle-weight, secondary colour, no
   competition with the brand block.

Decisions worth calling out:

- **Same SVGs as the app.** `logo-light.svg` and `logo-dark.svg` are byte-for-
  byte copies of `Assets.xcassets/LaunchLogo.imageset/*`. Light mode renders
  the blue gradient disc; dark mode renders the silver gradient disc. The
  switch is driven by `<picture><source media="(prefers-color-scheme: dark)">`,
  which is native browser behaviour — no JS, no flash-of-wrong-theme.
- **Same colour tokens.** Every CSS variable in `:root` is the sRGB hex
  equivalent of a `wv*` colour-set in the app's asset catalog
  (`wvBackground`, `wvPrimary`, `wvSecondary`, `wvSurface`, `wvBorder`,
  `wvAccent`). Light and dark values mirror the asset catalog's two
  appearance variants.
- **Same typography.** Roboto from Google Fonts at the two weights the app
  uses (`400` for body / slogan, `600` for the wordmark and headlines).
- **No newsletter widget aesthetics.** The form is one field, one button,
  one quiet privacy note. No promo box, no graphics, no two-column layout.
  The success state replaces the form inline, no toast, no redirect.
- **Privacy + Terms reuse the same design language.** Top-aligned document
  layout, 640px max-width, same typography ramp, footer nav highlights the
  current page via `aria-current="page"`.

## Local preview

Any static-file server works. Two options:

```sh
# Python (no install needed on macOS)
cd relivance.app
python3 -m http.server 5173
# open http://localhost:5173
```

```sh
# npx, if you have Node installed
cd relivance.app
npx --yes serve@latest -l 5173
```

Toggle macOS or iOS into dark mode while the page is open to see the dark
variant. Logo, palette, and form pill swap together; no reload required.

## Early-access form — first-party waitlist

The website submits email to the existing EU Supabase `waitlist-signup` Edge
Function. It stores only email and the original signup timestamp in the isolated
`public.waitlist` table. There is no browser database client or Supabase key.

`waitlist.js` maintains inline loading/error/success announcements and checks
Cloudflare Turnstile before signup. `index.html` deliberately ships with an empty
`data-turnstile-sitekey`: submissions stay disabled until approved setup.

Before separately authorized website cutover:

1. Create a free **Managed** Turnstile widget restricted to `relivance.app`.
   Keep pre-clearance off. Its public site key belongs in `data-turnstile-sitekey`
   in `index.html`; its secret belongs only in the backend function environment
   as `WAITLIST_TURNSTILE_SECRET`. Do not use Cloudflare test keys in production.
2. Backend owner reviews and deploys only `waitlist-signup` to the existing EU
   project, with `verify_jwt = false`. The handler is intentionally public and
   validates Turnstile server-side (hostname `relivance.app`, action
   `waitlist_signup`, single-use verification and a five-minute lifetime).
3. Verify backend operation/security first under a separately approved plan.
   Then approve the website revision, processor disclosures and public key.
4. Publish only after separate founder authorization. Run local tests with
   `node --test tests/waitlist.test.cjs`; they use DOM/fetch mocks, not live services.

The only allowed website origin is `https://relivance.app` (verified GitHub Pages
CNAME/HTTPS configuration). Do not silently add localhost, preview or www origins
to production. Local tests mock both Turnstile and the submission endpoint.

The honeypot supplements Turnstile; it is not a security boundary. Browser CORS
is not authentication. No IP or other tracking field is retained in the waitlist.
Repeated email submissions return the same success response. Genuine backend
failures keep the form retryable and reset the consumed CAPTCHA token.

Without JavaScript, the submit button remains disabled and an explanation asks
visitors to enable JavaScript and reload. There is no native provider fallback.
Purpose, removal and retention remain as described in the Privacy Policy.

Deployment order and rollback: backend first, website second. If cutover fails,
serve the unavailable signup state (empty site key); leave the existing waitlist
and 14 imported registrations untouched. Do not reinstate the retired third-party
form or roll back database permissions. Disable only the new function if necessary,
with separate production authorization. Preserve the unresolved full-bootstrap
gate for any fresh backend environment; no migrations are part of this cutover.

## GitHub Pages — setup

The repo can sit at the root of the iOS repo or in its own dedicated repo.
A dedicated repo is cleaner for a marketing site and is the assumption
below.

### 1. Push to GitHub

```sh
cd relivance.app
git init -b main
git add .
git commit -m "Initial coming-soon page with early-access form"
git remote add origin git@github.com:<your-org>/relivance.app.git
git push -u origin main
```

### 2. Enable Pages

1. Repo → **Settings** → **Pages**.
2. **Source**: `Deploy from a branch`. **Branch**: `main`, folder: `/ (root)`.
3. Wait ~30–60 seconds. The temporary URL
   `https://<your-org>.github.io/relivance.app/` goes live.

### 3. Custom domain

The `CNAME` file in this repo already contains `relivance.app`, so GitHub
Pages picks it up automatically. Confirm in **Settings → Pages → Custom
domain** that it reads `relivance.app`. Tick **Enforce HTTPS** once DNS
resolves.

### 4. DNS records at your registrar

| Type  | Host  | Value                       |
| ----- | ----- | --------------------------- |
| A     | `@`   | `185.199.108.153`           |
| A     | `@`   | `185.199.109.153`           |
| A     | `@`   | `185.199.110.153`           |
| A     | `@`   | `185.199.111.153`           |
| AAAA  | `@`   | `2606:50c0:8000::153`       |
| AAAA  | `@`   | `2606:50c0:8001::153`       |
| AAAA  | `@`   | `2606:50c0:8002::153`       |
| AAAA  | `@`   | `2606:50c0:8003::153`       |
| CNAME | `www` | `<your-org>.github.io.`     |

Replace `<your-org>` with your GitHub username/org. Propagation: 5–30
minutes typical. Verify with `dig +short relivance.app`.

**Cloudflare users**: set the four A records to **DNS only** (grey cloud)
during initial cert provisioning. Once Let's Encrypt issues and "Enforce
HTTPS" is on, you can switch them back to Proxied if you want Cloudflare's
CDN in front.

## Updating the page

```sh
# Edit any file
git add .
git commit -m "Tweak heading"
git push
# Pages redeploys in ~30 seconds; hard-refresh the browser to see it.
```

## Privacy / Terms — important caveat

`privacy.html` and `terms.html` ship as **practical plain-English
placeholders** appropriate for a pre-launch site that only collects email
addresses for early-access updates. They are NOT legal advice and were
not drafted by a lawyer.

Before launch — and especially before the app starts collecting any
additional personal data beyond email addresses (account profile, contact
imports, etc.) — have a lawyer review and revise both documents to match
your jurisdiction, your actual data practices, your subscription /
payment terms, and any platform requirements (Apple App Review §5.1.1
ATT / privacy nutrition labels, GDPR, CCPA, etc.).

Things specifically deferred to that lawyer review:

- DPA / processor relationships with Supabase, Cloudflare, your future email-
  service provider, and analytics if you add them later.
- App-specific consents (push notifications, contacts access, calendar
  access, microphone for recap, LinkedIn import scope, etc.).
- Subscription terms, trial/refund policy, founding-tier pricing
  language, auto-renewal disclosures.
- EU/UK Standard Contractual Clauses if you process personal data of
  EU/UK users while operating from the US.

Both pages are linked from the homepage footer and from each other's
footer. They use `<meta name="robots" content="noindex,follow">` so they
don't compete with the homepage in search results before launch — remove
that meta tag once you want them indexed.

## Optional: better social-preview compatibility

`assets/og-image.svg` is an SVG OG card. Twitter renders SVG OG images;
some other platforms (older Facebook crawlers, LinkedIn) still prefer
raster. To maximise compatibility, rasterise:

```sh
# Requires librsvg installed (brew install librsvg)
rsvg-convert -w 1200 -h 630 assets/og-image.svg > assets/og-image.png
```

Then change the `og:image` and `twitter:image` `<meta>` tags in
`index.html` from `og-image.svg` to `og-image.png`.

## What this page deliberately does not do

- No counter, no fake scarcity ("3,847 people in line"), no countdown.
- No testimonial quotes, pricing tier, or feature list.
- No newsletter-widget aesthetics (promo box, two-column, "Subscribe"
  capitalised across two pills).
- No analytics or tracking pixels; Cloudflare Turnstile is loaded only for
  form security. Fonts are self-hosted. If you add analytics later, Plausible / Vercel Analytics drop in
  as a single script tag — and remember to mention them in
  `privacy.html`.
