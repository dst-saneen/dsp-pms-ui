# Project License & Third-Party Asset Audit

## 1. Purpose

This document is used to audit the project for:

* Third-party libraries and packages
* Images and illustrations
* Icons and icon libraries
* Fonts
* UI/component libraries
* CSS/JS libraries
* Templates and copied code
* SVG assets
* Videos/audio
* External APIs and services
* AI-generated assets
* Any other third-party content

The goal is to identify:

1. What third-party resources are being used.
2. Who owns them.
3. What license applies.
4. Whether commercial/project usage is allowed.
5. Whether attribution is required.
6. Whether there are restrictions.
7. Whether the project contains any assets with unknown ownership/license.
8. Whether any action is required before production release.

**Current snapshot:** Initial inventory (2026-09-24) plus remediation Phases A–D (SVG paths, Redis pin, NOTICE files, unzipper override removing `buffers`, design-folder cleanup, favicon rebuild, `license:guard`). Ownership of several auth images is still pending the company form.

**Companion docs:** `NOTICE`, `docs/THIRD_PARTY_NOTICES.md`, `docs/ASSET_OWNERSHIP_ATTESTATION.md`

---

# 2. Audit Status

| Status                  | Meaning                                                        |
| ----------------------- | -------------------------------------------------------------- |
| ✅ CLEAR                 | License/ownership confirmed and usage is allowed               |
| ⚠️ REVIEW               | License exists but requires additional review                  |
| ❌ NOT ALLOWED           | Usage conflicts with the license                               |
| ❓ UNKNOWN               | Ownership/license could not be confirmed                       |
| 🔍 NEEDS VERIFICATION   | Source exists but license information still needs confirmation |
| 🟢 INTERNAL             | Created/owned by the company/project                           |
| 🤖 AI-GENERATED         | Generated using an AI tool; verify applicable terms            |
| 📝 ATTRIBUTION REQUIRED | Can be used but attribution is required                        |

---

# 3. Project Information

| Field           | Details |
| --------------- | ------- |
| Project Name    | DSP PMS / Group ERP |
| Repository      | `dsp-pms-app` (private / proprietary application) |
| Project Type    | Multi-tenant HRMS / ERP SaaS |
| Framework       | NestJS (API) + Next.js (web) |
| Frontend        | Next.js `16.3.3`, React `19.2.8`, Tailwind CSS `4`, shadcn / Radix UI |
| Backend         | NestJS `11`, Prisma `7`, PostgreSQL, Redis |
| Database        | PostgreSQL schema `dsp_pms` (AWS RDS supported) |
| Current Version | Frontend `0.1.0` / Backend `0.0.1` (`private`; backend `"license": "UNLICENSED"`) |
| Audit Date      | 2026-09-24 (updated after remediations same day) |
| Auditor         | Cursor technical inventory (not a legal opinion) |
| Environment     | Development (local); intended Production SaaS |
| Intended Usage  | Commercial / Internal product |
| Package manager | pnpm `11.24.0` (separate frontend + backend lockfiles) |

---

# 4. NPM / Package Dependency Audit

Checked:

* `frontend/package.json` + `frontend/pnpm-lock.yaml`
* `backend/package.json` + `backend/pnpm-lock.yaml`
* Installed metadata under `node_modules/.pnpm`

**Installed unique packages (approx.):** Frontend ~808 · Backend ~950 (mostly MIT).

### Dependency Audit — Frontend direct (installed)

| Package | Version | Purpose | License | Copyright/Owner | Commercial Use | Attribution Required | Risk | Action | Status |
| ------- | ------- | ------- | ------- | --------------- | -------------- | -------------------- | ---- | ------ | ------ |
| next | 16.3.3 | App framework | MIT | Vercel / Next.js | Yes | Preserve notice | Low | None | ✅ CLEAR |
| react / react-dom | 19.2.8 | UI runtime | MIT | Meta | Yes | Preserve notice | Low | None | ✅ CLEAR |
| lucide-react | 1.33.0 | Icons | ISC | Lucide | Yes | Preserve notice | Low | None | ✅ CLEAR |
| radix-ui / @radix-ui/* | 1.x / 2.x | Primitives | MIT | WorkOS / Radix | Yes | Preserve notice | Low | None | ✅ CLEAR |
| shadcn | 4.18.0 | UI CLI / styles | MIT | shadcn | Yes | Preserve notice | Low | None | ✅ CLEAR |
| tailwindcss / @tailwindcss/postcss | 4.3.3 | CSS | MIT | Tailwind Labs | Yes | Preserve notice | Low | None | ✅ CLEAR |
| tw-animate-css | 1.4.0 | Animation CSS | MIT | Wombosvideo | Yes | Preserve notice | Low | None | ✅ CLEAR |
| @tanstack/react-query (+ devtools) | 5.101.x | Server state | MIT | Tanner Linsley | Yes | Preserve notice | Low | None | ✅ CLEAR |
| @tanstack/react-table | 8.21.3 | Tables | MIT | Tanner Linsley | Yes | Preserve notice | Low | None | ✅ CLEAR |
| axios | 1.19.0 | HTTP | MIT | Axios | Yes | Preserve notice | Low | None | ✅ CLEAR |
| react-hook-form / @hookform/resolvers | 7.x / 5.x | Forms | MIT | Beier Luo et al. | Yes | Preserve notice | Low | None | ✅ CLEAR |
| zod | 4.4.3 | Validation | MIT | Colin McDonnell | Yes | Preserve notice | Low | None | ✅ CLEAR |
| date-fns | 4.4.0 | Dates | MIT | date-fns | Yes | Preserve notice | Low | None | ✅ CLEAR |
| recharts | 3.10.1 | Charts | MIT | Recharts | Yes | Preserve notice | Low | None | ✅ CLEAR |
| sonner | 2.0.8 | Toasts | MIT | Emil Kowalski | Yes | Preserve notice | Low | None | ✅ CLEAR |
| react-day-picker | 10.0.1 | Calendar | MIT | gpbl | Yes | Preserve notice | Low | None | ✅ CLEAR |
| next-themes / clsx / tailwind-merge / cva | various | UI helpers | MIT / Apache-2.0 (cva) | Various | Yes | Preserve / NOTICE | Low | None | ✅ CLEAR |
| typescript / @typescript/native | 6.0.3 / 7.0.2 | Compiler | Apache-2.0 | Microsoft | Yes | NOTICE | Low | None | ✅ CLEAR |
| eslint / eslint-config-next / vitest / playwright / prettier / testing-library / jsdom / types | various | Tooling | MIT / Apache-2.0 | Various | Yes | Preserve | Low | None | ✅ CLEAR |

### Dependency Audit — Backend direct (installed)

| Package | Version | Purpose | License | Copyright/Owner | Commercial Use | Attribution Required | Risk | Action | Status |
| ------- | ------- | ------- | ------- | --------------- | -------------- | -------------------- | ---- | ------ | ------ |
| @nestjs/* | 11.x / related | API framework | MIT | Nest / Kamil Mysliwiec | Yes | Preserve notice | Low | None | ✅ CLEAR |
| @prisma/client / prisma / adapter-pg | 7.9.1 | ORM | Apache-2.0 | Prisma | Yes | NOTICE | Low | None | ✅ CLEAR |
| @aws-sdk/client-s3 / s3-request-presigner | 3.1114.0 | Object storage | Apache-2.0 | AWS | Yes | NOTICE | Low | None | ✅ CLEAR |
| exceljs | 4.4.0 | Excel import/export | MIT | Guyon Roche | Yes | Preserve notice | Low | Keep unzipper override | ✅ CLEAR |
| unzipper (forced) | 0.12.3 | Excel zip support | MIT | unzipper | Yes | Preserve notice | Low | Override in `pnpm-workspace.yaml` | ✅ CLEAR |
| jszip (transitive) | 3.10.1 | Zip (via exceljs) | MIT OR GPL-3.0-or-later | Stuart Knightley | Yes if MIT elected | Preserve; **MIT elected** in THIRD_PARTY_NOTICES | Low | Documented election | 📝 / ✅ CLEAR |
| pdfkit | 0.19.1 | PDF | MIT | Devon Govett | Yes | Preserve notice | Low | None | ✅ CLEAR |
| passport / passport-jwt / @nestjs/passport | various | Auth | MIT | Various | Yes | Preserve notice | Low | None | ✅ CLEAR |
| argon2 / bcrypt | 0.45.1 / 6.0.0 | Password hashing | MIT | Various | Yes | Preserve notice | Low | None | ✅ CLEAR |
| ioredis | 5.11.1 | Redis client | MIT | Zihua Li | Yes | Preserve notice | Low | None | ✅ CLEAR |
| nodemailer | 9.0.5 | SMTP | MIT-0 | Andris Reinman | Yes | Minimal | Low | None | ✅ CLEAR |
| pg / class-validator / class-transformer / cookie-parser / rxjs / reflect-metadata / swagger-ui-express | various | Infra | MIT / Apache-2.0 | Various | Yes | Preserve / NOTICE | Low | None | ✅ CLEAR |
| typescript / jest / eslint / prettier / prisma CLI / tsx / types | various | Tooling | MIT / Apache-2.0 / BSD-2-Clause | Various | Yes | Preserve | Low | None | ✅ CLEAR |

### Transitive / special-attention (current)

| Package | Version | Brought by | License | Status | Notes |
| ------- | ------- | ---------- | ------- | ------ | ----- |
| buffers | 0.1.1 | *removed* | Was undeclared | ✅ CLEAR (mitigated) | Was via exceljs→unzipper@0.10; **absent** after override to unzipper@0.12.3 |
| @img/sharp-win32-x64 | (Next optional) | Next image pipeline | Apache-2.0 AND LGPL-3.0-or-later | ⚠️ REVIEW | Typical Next deploy; legal optional |
| elkjs | 0.11.1 | Prisma Studio tooling | EPL-2.0 | ⚠️ REVIEW | Dev tooling; not product UI |
| caniuse-lite | tooling | browserslist | CC-BY-4.0 | 📝 ATTRIBUTION REQUIRED | Credited in THIRD_PARTY_NOTICES (caniuse.com) |
| axe-core / lightningcss | tooling | lint / CSS | MPL-2.0 | ⚠️ REVIEW | Build/dev tools |
| pause@0.0.1 | via passport | README indicates MIT; field missing | 🔍 NEEDS VERIFICATION | Low risk; field missing on old tarball |

### Things verified

* [x] Direct package names & installed versions
* [x] Licenses from installed `package.json` / LICENSE files where present
* [x] Commercial use for OSI-permissive directs: allowed
* [x] Copyleft / dual / missing licenses flagged or mitigated
* [x] `buffers` regression check via `pnpm run license:guard`

### Special attention

No GPL/AGPL/SSPL/BUSL as **sole** license on direct product dependencies. Dual MIT/GPL (`jszip`): **MIT elected**. LGPL appears only via optional sharp binary (⚠️ REVIEW).

---

# 5. Image Asset Audit

Scanned: `frontend/public/`, `frontend/app/`, `frontend/design/`, `docs/**/images/`.

### Image Audit — product / auth

| File | Location | Source | Owner | License | Commercial Use | Attribution | Modification Allowed | Status | Action |
| ---- | -------- | ------ | ----- | ------- | -------------- | ----------- | -------------------- | ------ | ------ |
| erp-dashboard.png | `frontend/public/images/` | Git add 2026-09-11 (Saneen / datascapetek.com); no license file | ❓ Unknown | ❓ Unknown | ❓ | ❓ | ❓ | ❓ UNKNOWN | Fill `ASSET_OWNERSHIP_ATTESTATION.md` or replace |
| organization-dashboard.png | `frontend/public/images/` | Same | ❓ Unknown | ❓ Unknown | ❓ | ❓ | ❓ | ❓ UNKNOWN | Same form |
| email-verification.png | `frontend/public/images/` | Same | ❓ Unknown | ❓ Unknown | ❓ | ❓ | ❓ | ❓ UNKNOWN | Same form |
| work-smarter.png | `frontend/public/images/` | Same | ❓ Unknown | ❓ Unknown | ❓ | ❓ | ❓ | ❓ UNKNOWN | Same form |
| favicon.ico | `frontend/app/` | Rebuilt from erp-logo geometry (Phase B) | Same as brand mark (pending form for logo) | Derived from logo SVG | Yes if logo owned | N/A | Yes | 🔍 NEEDS VERIFICATION | Cleared as “not third-party stock”; confirm logo ownership on form |

### Image Audit — docs

| File pattern | Location | Source | Owner | Status |
| ------------ | -------- | ------ | ----- | ------ |
| `01-*.png` … `17-*.png` (~52) | `docs/product/company-workflow-guide/images/` | App UI screenshots | Project / company | 🟢 INTERNAL |

### Image Audit — design folder

| File | Status |
| ---- | ------ |
| Former `frontend/design/*.{jpg,png}` | **Removed** (unused; no provenance). See `frontend/design/README.md` |

### Source categories used

* ❓ Unknown — auth PNGs (pending attestation)
* 🟢 INTERNAL — docs screenshots
* 🟢 Company-created (claimed pending form) — brand SVGs / derived favicon

### Verify

* [x] Shipping images inventoried
* [ ] Auth PNG creators signed attestation
* [x] Design mocks removed
* [x] No video/audio binaries found

---

# 6. SVG Audit

| SVG | Location | Source | Creator/Owner | License | Usage Allowed | Attribution | Status |
| --- | -------- | ------ | ------------- | ------- | ------------- | ----------- | ------ |
| erp-logo.svg | `frontend/public/images/` | Custom brand mark; employee commit | ❓ pending form | ❓ | ❓ until form | N/A | 🔍 NEEDS VERIFICATION |
| paper-plane.svg | `frontend/public/images/` | Custom illustration; employee commit | ❓ pending form | ❓ | ❓ until form | N/A | 🔍 NEEDS VERIFICATION |
| build-together.svg | `frontend/public/images/` | Path outlines from Dancing Script (OFL); font binary not shipped | Paths: project; font: OFL authors | OFL outlines only | Yes | Noted in THIRD_PARTY_NOTICES | ✅ CLEAR |
| icon.svg | `frontend/app/` | Copy of erp-logo mark | Same as erp-logo | Same as erp-logo | Same | N/A | 🔍 NEEDS VERIFICATION (follows logo) |
| Lucide icons (inline via React) | Many `*.tsx` | npm `lucide-react` | Lucide | ISC | Yes | Preserve package notice | ✅ CLEAR |

---

# 7. Icon Library Audit

| Icon Library | Version | Source | License | Commercial Use | Attribution | Status |
| ------------ | ------- | ------ | ------- | -------------- | ----------- | ------ |
| lucide-react | 1.33.0 | npm | ISC | Yes | Preserve notice | ✅ CLEAR |
| react-icons / Font Awesome / Material / Heroicons packages | — | Not used as deps | — | — | — | N/A |
| Manual icon packs | — | None found beyond Lucide + brand SVGs | — | — | — | — |

`components.json`: `"iconLibrary": "lucide"`.

---

# 8. Font Audit

No `.ttf` / `.otf` / `.woff` / `.woff2` font files committed in app source.

| Font | File/Source | Owner | License | Commercial Use | Web Embedding | Attribution | Status |
| ---- | ----------- | ----- | ------- | -------------- | ------------- | ----------- | ------ |
| Figtree | `next/font/google` (`app/layout.tsx`) | Figtree Project Authors | SIL OFL 1.1 | Yes | Yes under OFL | Keep OFL with font software | ✅ CLEAR |
| Geist Mono | `next/font/google` | Geist / Vercel | SIL OFL 1.1 | Yes | Yes under OFL | Keep OFL with font software | ✅ CLEAR |
| Segoe Script / Brush Script / Apple Chancery | *removed* from SVG | — | — | — | — | — | ✅ CLEAR (mitigated — no longer referenced) |
| Dancing Script | Used only to generate path outlines for `build-together.svg` | OFL authors | SIL OFL 1.1 | Yes | Font binary **not** shipped | Noted in THIRD_PARTY_NOTICES | ✅ CLEAR |

---

# 9. UI / Component Library Audit

| Library | Version | License | Components Used | Commercial Use | Restrictions | Status |
| ------- | ------- | ------- | --------------- | -------------- | ------------ | ------ |
| Tailwind CSS | 4.3.3 | MIT | Global styling | Yes | None material | ✅ CLEAR |
| tw-animate-css | 1.4.0 | MIT | Animations | Yes | None material | ✅ CLEAR |
| shadcn + `components/ui/*` | 4.x + local | MIT | Dialog, card, button, tabs, etc. | Yes | Preserve notices | ✅ CLEAR |
| Radix UI | multiple | MIT | Primitives | Yes | None material | ✅ CLEAR |
| class-variance-authority | 0.7.1 | Apache-2.0 | Variants | Yes | Apache NOTICE | ✅ CLEAR |
| sonner / recharts / react-day-picker | various | MIT | Toasts / charts / dates | Yes | None material | ✅ CLEAR |
| Ant Design / MUI / Chakra / Bootstrap | — | Not used | — | — | — | N/A |

---

# 10. Templates / Purchased Assets

| Asset | Source | Purchase/License Type | Owner | License | Allowed Usage | Attribution | Status |
| ----- | ------ | --------------------- | ----- | ------- | ------------- | ----------- | ------ |
| shadcn radix-nova style | ui.shadcn.com | Open MIT ecosystem | shadcn | MIT | Commercial OK | Preserve | ✅ CLEAR |
| ThemeForest / Envato / Creative Market / UI8 kits | — | None evidenced in repo | — | — | — | — | N/A |
| Former design comps in `frontend/design/` | Unknown | Removed | — | — | — | — | ✅ CLEAR (removed) |

---

# 11. Copied / Adapted Code Audit

| Code/File | Source | Original Author | License | Changes Made | Commercial Use | Attribution | Status |
| --------- | ------ | --------------- | ------- | ------------ | -------------- | ----------- | ------ |
| `frontend/components/ui/*` | shadcn/ui patterns | shadcn / Radix | MIT | Project-adapted | Yes | Preserve | ✅ CLEAR |
| Stack Overflow / CodePen attributions | — | None found in first-party headers | — | — | — | — | No evidence |
| Nest / Next patterns | Framework docs | Nest / Vercel | MIT | Application code | Yes | N/A | ✅ CLEAR |

---

# 12. JavaScript / CSS Third-Party Code

| File | Code Type | Source | License | Owner | Status | Action |
| ---- | --------- | ------ | ------- | ----- | ------ | ------ |
| `frontend/app/globals.css` | CSS imports | tailwind / tw-animate / shadcn | MIT | Upstream packages | ✅ CLEAR | None |
| Vendor folder in repo | — | None committed | — | — | N/A | — |

---

# 13. Animation / 3D / Lottie Assets

| Asset | Source | Creator | License | Commercial Use | Attribution | Status |
| ----- | ------ | ------- | ------- | -------------- | ----------- | ------ |
| Lottie / Rive / Three.js models | — | Not found | — | — | — | N/A |
| CSS motion | tw-animate-css + Tailwind | Package authors | MIT | Yes | Preserve | ✅ CLEAR |

---

# 14. Video / Audio Audit

| Asset | Source | Owner | License | Commercial Use | Attribution | Status |
| ----- | ------ | ----- | ------- | -------------- | ----------- | ------ |
| `.mp4` / `.webm` / `.mp3` / `.wav` / `.ogg` | Scan excluding node_modules | — | — | — | — | **None found** |

---

# 15. External APIs / Services

| Service | Purpose | Account/Owner | Terms/License | Commercial Use | Restrictions | Status |
| ------- | ------- | ------------- | ------------- | -------------- | ------------ | ------ |
| PostgreSQL / AWS RDS | Database | Customer AWS | AWS Customer Agreement + PG license | Yes under AWS | SSL CA, region, keys | ⚠️ REVIEW (account) |
| Redis (`redis:7.2.16-alpine`) | Cache / sessions | Self-hosted Docker | Redis **7.2.x** = BSD-3-Clause | Yes for internal cache | Do not float to `redis:7` / 7.4+ (RSALv2/SSPL) | ✅ CLEAR (pinned) |
| AWS S3 / compatible | File storage | Customer AWS | AWS / vendor terms | Yes | Least-privilege keys | ⚠️ REVIEW (account) |
| Zoho ZeptoMail | Transactional email | Customer Zoho | Zoho commercial terms | Yes with plan | Webhooks / region | ⚠️ REVIEW (account) |
| Cloudflare Turnstile | Careers bot protection | Customer Cloudflare | Cloudflare subscription / Turnstile plans | Free plan allows typical prod use | Hostname limits; branding on Free | ⚠️ REVIEW (account) |
| Google Fonts (`next/font`) | Figtree, Geist Mono | Google delivery / font authors | OFL 1.1 | Yes | OFL redistribution conditions | ✅ CLEAR |
| ClamAV (optional) | Malware scan | If enabled | ClamAV GPL as separate daemon | Service use ≠ shipping GPL in app binary | Do not embed GPL into proprietary binary | ⚠️ REVIEW if packaging ClamAV |

---

# 16. Logos / Trademarks / Brand Assets

| Asset | Owner | Source | Permission | Usage Type | Status |
| ----- | ----- | ------ | ---------- | ---------- | ------ |
| Group ERP / erp-logo.svg / app icon | Pending company attestation | `public/images/erp-logo.svg`, `app/icon.svg`, favicon | Confirm work-for-hire | Product branding | 🔍 NEEDS VERIFICATION |
| Nest / Next / Prisma / AWS / Zoho / Cloudflare marks | Trademark owners | Docs/README mentions | Trademark ≠ OSS license | Do not imply endorsement in marketing UI | ⚠️ REVIEW if used as logos |
| Payment / social logos | — | Not found as assets | — | — | N/A |

---

# 17. AI-Generated Assets

| Asset | AI Tool | Generated By | Date | Source/Prompt Record | Commercial Terms Checked | Status |
| ----- | ------- | ------------ | ---- | -------------------- | ------------------------ | ------ |
| Auth marketing PNGs | ❓ | ❓ | ❓ | None in repo | No | ❓ UNKNOWN — ask on ownership form whether AI was used |

No in-repo declaration of Midjourney/DALL·E/ChatGPT image generation was found.

---

# 18. Copyright Notices

* Backend `package.json`: `"license": "UNLICENSED"` (proprietary npm meaning).
* Root `NOTICE` present (points to third-party doc).
* `docs/THIRD_PARTY_NOTICES.md` records elections & OFL/CC-BY notes.
* First-party source generally lacks SPDX headers.
* Dependency copyrights live under `node_modules/*/LICENSE*`.

---

# 19. License Files

| File | Related To | License | Status |
| ---- | ---------- | ------- | ------ |
| *(no root LICENSE)* | Application | Proprietary by intent | OK for closed product |
| `NOTICE` | App + pointer | Proprietary pointer | ✅ Present |
| `docs/THIRD_PARTY_NOTICES.md` | Attributions / elections | Mixed (documented) | ✅ Present |
| `docs/ASSET_OWNERSHIP_ATTESTATION.md` | Image ownership form | Process | ✅ Present (unsigned) |
| `docs/LICENSE_AUDIT.md` | This audit | N/A | ✅ Present |
| `frontend/package.json` | Frontend | private | Proprietary assumption |
| `backend/package.json` | Backend | `UNLICENSED` | Proprietary |
| `node_modules/**/LICENSE*` | Dependencies | Various | Present for most packages |

---

# 20. Unknown / Unverified Assets

| Asset | Type | Location | Why Unknown | Risk | Recommended Action |
| ----- | ---- | -------- | ----------- | ---- | ------------------ |
| erp-dashboard.png | Raster | `frontend/public/images/` | No written ownership | 🟠 MEDIUM | Sign `ASSET_OWNERSHIP_ATTESTATION.md` or replace |
| organization-dashboard.png | Raster | same | same | 🟠 MEDIUM | Same |
| email-verification.png | Raster | same | same | 🟠 MEDIUM | Same |
| work-smarter.png | Raster | same | same | 🟠 MEDIUM | Same |
| erp-logo.svg | SVG | same | Form not signed | 🟠 MEDIUM | Same |
| paper-plane.svg | SVG | same | Form not signed | 🟠 MEDIUM | Same |
| AI origin of PNGs | Process | auth images | No records | 🟠 MEDIUM | Answer on ownership form |

**Mitigated / removed (no longer unknown blockers):** `buffers@0.1.1`, system script fonts in SVG, floating Redis `7-alpine`, design-folder comps, unknown favicon (rebuilt from logo).

---

# 21. High-Risk Findings

| Finding | File/Asset | License | Problem | Severity | Recommended Action |
| ------- | ---------- | ------- | ------- | -------- | ------------------ |
| Auth / brand asset ownership unsigned | 4 PNGs + erp-logo + paper-plane | Unknown | No attestation yet | 🟠 MEDIUM | Complete `docs/ASSET_OWNERSHIP_ATTESTATION.md` |
| Redis container may still be old image on a machine | Local Docker | BSD if 7.2.x | Config pinned; runtime may lag | 🟢 LOW | `pnpm run redis:down` && `redis:up` when Docker available |
| sharp LGPL binary (optional) | `@img/sharp-*` | Apache-2.0 + LGPL | Native binary via Next | 🟢 LOW–🟠 MEDIUM | Optional legal note if policy requires |
| elkjs EPL via Prisma Studio | elkjs | EPL-2.0 | Weak copyleft in tooling | 🟢 LOW | Confirm not shipped to customers |
| caniuse-lite CC-BY | tooling | CC-BY-4.0 | Attribution if Sharing data | 🟢 LOW | Already noted in THIRD_PARTY_NOTICES |
| ~~buffers undeclared~~ | ~~exceljs chain~~ | — | **Mitigated** | — | Keep unzipper override + `license:guard` |
| ~~Redis floating tag~~ | ~~redis:7-alpine~~ | — | **Mitigated** | — | Keep `7.2.16-alpine` pin |
| ~~System fonts in SVG~~ | ~~build-together.svg~~ | — | **Mitigated** | — | Paths only |

### Severity

🔴 **HIGH** — Potential prohibited / blocking issue → **none open after remediations**.
🟠 **MEDIUM** — Needs ownership form or policy review.
🟢 **LOW** — Hygiene / optional.

---

# 22. Final Audit Summary

## Dependency Summary

* Total unique installed packages (approx.): **~808 FE + ~950 BE**
* Direct deps verified permissive: **Yes**
* Unknown licenses in tree: **`buffers` removed**
* Restricted / review: sharp LGPL combo, elkjs EPL, MPL tooling, caniuse CC-BY (attributed), jszip dual (**MIT elected**)
* Licenses requiring ongoing guard: Redis 7.2 pin, unzipper override

## Asset Summary

* Shipping public images: **4 PNG + 3 SVG** (+ app favicon/icon)
* Verified image sources: docs screenshots INTERNAL; build-together CLEAR; favicon derived
* Unknown image sources: **4 auth PNGs** (+ logo/paper-plane pending form)
* Design comps: **0** (removed)
* Videos / audio: **0**

## Font Summary

* Bundled font files in repo: **0**
* Runtime OFL fonts: **2** (Figtree, Geist Mono) — verified
* Proprietary system fonts in assets: **0** (cleared)

## Icon Summary

* Icon libraries: **1** (lucide-react) — verified ISC
* Unknown icon packs: **0**

## Other Assets

* Videos: 0 · Audio: 0 · Animations: CSS only · 3D: 0
* Logos: Group ERP mark — **pending attestation**
* AI-generated: **unknown / undeclared** for auth PNGs

---

# 23. Final Compliance Status

| Category         | Status | Notes |
| ---------------- | ------ | ----- |
| NPM Dependencies | ✅ CLEAR / ⚠️ REVIEW | Directs OK; optional sharp/elkjs review |
| Images           | ❓ UNKNOWN | Auth PNGs await ownership form |
| SVGs             | 🔍 NEEDS VERIFICATION | Logo/paper-plane await form; build-together CLEAR |
| Icons            | ✅ CLEAR | Lucide ISC |
| Fonts            | ✅ CLEAR | OFL Figtree / Geist Mono |
| UI Libraries     | ✅ CLEAR | MIT/Apache stack |
| Templates        | ✅ CLEAR | shadcn MIT; design mocks removed |
| Copied Code      | ✅ CLEAR | No SO/CodePen evidence |
| Animations       | ✅ CLEAR | |
| Videos           | ✅ CLEAR | None |
| Audio            | ✅ CLEAR | None |
| APIs             | ⚠️ REVIEW | AWS / Zoho / Cloudflare account terms |
| Logos/Trademarks | 🔍 NEEDS VERIFICATION | Brand mark form pending |
| AI Assets        | ❓ UNKNOWN | No records; ask on form |

### Overall Status

**[ ] ✅ READY**

**[x] ⚠️ READY WITH REVIEW**

Code/package remediations are in place. Remaining: **sign asset ownership form** (or replace images), optional Docker recreate, account terms.

**[ ] ❌ NOT READY**

---

# 24. Evidence / Source Links

| Asset | Source URL | License URL | Evidence/Notes |
| ----- | ---------- | ----------- | -------------- |
| Package licenses | Local `node_modules/.pnpm` | Per-package LICENSE | Scanned 2026-09-24 |
| lucide-react | npm | ISC LICENSE | Copyright Lucide Icons |
| Figtree / Geist Mono | google/fonts OFL trees | SIL OFL 1.1 | Verified OFL.txt |
| jszip | github.com/Stuk/jszip | Dual MIT/GPL | MIT elected in THIRD_PARTY_NOTICES |
| unzipper 0.12.3 | npm / exceljs#2866 | MIT | Override removes buffers |
| Redis 7.2 | redis.io/legal/licenses | BSD-3-Clause for ≤7.2 | `docker-compose.yml` pin `7.2.16-alpine` |
| caniuse-lite | github.com/browserslist/caniuse-lite | CC BY 4.0 | Credit caniuse.com |
| Auth PNGs git | `git log` public/images | — | Author Saneen; form pending |
| license:guard | `scripts/license-guard.mjs` | — | Passes Redis pin + no buffers |

---

# 25. Audit Rules

1. Do not assume an asset is free because it is available online.
2. Do not assume an npm package is MIT without checking its actual license.
3. Do not assume an image from Google Images is free to use.
4. Do not assume an icon copied from a website is free to use.
5. Do not assume a font is free for commercial use.
6. Do not assume a GitHub repository has a permissive license unless a license is actually provided.
7. Do not treat "no license" as permission to use.
8. Do not automatically classify GPL/AGPL/LGPL as prohibited; flag them for license review.
9. Check transitive dependencies where practical.
10. Record unknown ownership instead of guessing.
11. Preserve license and copyright notices when required.
12. Verify attribution requirements.
13. Verify commercial-use requirements.
14. Verify redistribution requirements.
15. Verify trademark/logo restrictions separately from software licenses.

---

# 26. Remediation performed (post-inventory)

> Original Step 8 said “read-only.” After the inventory, the team applied remediations. Recorded here for honesty.

| Phase | Change | Result |
| ----- | ------ | ------ |
| 1 | `build-together.svg` → path outlines | No system script fonts |
| 2 | Redis → `7.2.16-alpine` | BSD-line pin |
| 3–4 | `NOTICE` + `THIRD_PARTY_NOTICES.md` | Attributions / MIT election |
| 5 | `exceljs>unzipper` → `0.12.3` | `buffers` gone |
| 6 | Delete `frontend/design` mocks | Unknown comps removed |
| B | Favicon/icon from erp-logo | Unknown favicon replaced |
| C | `ASSET_OWNERSHIP_ATTESTATION.md` | Form ready (unsigned) |
| D | `pnpm run license:guard` | Regression checks |

---

# 27. Cursor Audit Instructions

*(Template retained for future re-runs. Prefer read-only inventory unless the team explicitly requests remediations.)*

### Step 8 — Do Not Modify Code (inventory mode)

When running a **fresh inventory only**, do not delete/replace/change dependencies. Generate/update this report only.

### Step 9 — Final Report totals (current)

1. Third-party resources: large npm graphs + OFL fonts + Lucide + cloud services + few local assets
2. Verified: direct deps, Lucide, OFL fonts, Redis pin, unzipper/buffers mitigation, build-together paths, notices
3. Unknown: 4 auth PNGs + logo/paper-plane ownership (form pending); AI origin undeclared
4. High-risk open: **none** after remediations (ownership is medium)
5. Attribution: caniuse, OFL, Apache NOTICE hygiene — documented
6. Replacement candidates: any asset marked No on ownership form
7. Permission needed: company attestation; cloud account terms
8. Overall: **⚠️ READY WITH REVIEW**

---

# 28. Important Limitation

This audit is a technical license/asset inventory and is **not a legal opinion**.

Where ownership or licensing cannot be established confidently, items are marked:

`❓ UNKNOWN / NEEDS LEGAL REVIEW`

and permission is **not** assumed.
