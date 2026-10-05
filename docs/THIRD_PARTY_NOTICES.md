# Third-party notices — DSP PMS / Group ERP

This product is proprietary software. It incorporates open-source and third-party
components. This file records attribution and license elections required for
compliance. It is **not** a legal opinion.

Full inventory: `docs/LICENSE_AUDIT.md`

---

## Application

Copyright (c) Datascapetek / Group ERP project contributors.

The application source in this repository is proprietary. The backend
`package.json` declares `"license": "UNLICENSED"` (not an OSI open-source
license). Redistribution of the application itself requires company permission.

---

## License elections

### JSZip (via exceljs)

`jszip` is dual-licensed under the **MIT License** or **GPL-3.0-or-later**.

For this proprietary product, we elect to use **JSZip under the MIT License**
only.

Upstream: https://github.com/Stuk/jszip

### unzipper (via exceljs) — buffers license mitigation

`exceljs@4.4.0` historically depended on `unzipper@0.10.x`, which pulled
`buffers@0.1.1` (no declared license on the published npm package).

This repository forces **`exceljs>unzipper` → `0.12.3`** via
`backend/pnpm-workspace.yaml` `overrides`. `unzipper@0.12.3` is **MIT** and
no longer depends on `buffers` (see exceljs#2866 / unzipper#293).

Do not remove that override without re-checking the dependency tree.

**Regression check (Phase D):** from `backend/` run:

```bash
pnpm run license:guard
```

This verifies Redis stays on 7.2.x-alpine, the unzipper override remains, and `buffers` is absent.
---

## Fonts (SIL Open Font License 1.1)

The web app loads these fonts via `next/font/google`. Font software remains
under the SIL Open Font License, Version 1.1. Documents created using the fonts
are not required to be OFL.

### Figtree

Copyright 2022 The Figtree Project Authors
https://github.com/erikdkennedy/figtree
OFL: https://github.com/google/fonts/blob/main/ofl/figtree/OFL.txt

### Geist Mono

Copyright 2024 The Geist Project Authors
https://github.com/vercel/geist-font
OFL: https://github.com/google/fonts/blob/main/ofl/geistmono/OFL.txt

### Dancing Script (SVG path outlines only)

`frontend/public/images/build-together.svg` contains **vector path outlines**
generated from Dancing Script. The font binary is **not** redistributed in this
repository.

Copyright The Dancing Script Project Authors
https://github.com/google/fonts/tree/main/ofl/dancingscript
OFL: https://github.com/google/fonts/blob/main/ofl/dancingscript/OFL.txt

---

### Brand mark / favicon

`frontend/public/images/erp-logo.svg` is the product mark used in the UI.

`frontend/app/icon.svg` and `frontend/app/favicon.ico` are derived from that same
geometry (favicon rebuilt via `frontend/scripts/build-favicon.mjs`). They are not
third-party stock icons.

---

## caniuse-lite (CC BY 4.0)

Browser compatibility data from caniuse-lite may be used by frontend tooling
(browserslist / Autoprefixer / related build steps).

License: Creative Commons Attribution 4.0 International
Source attribution: **caniuse.com**
https://github.com/browserslist/caniuse-lite
https://creativecommons.org/licenses/by/4.0/

---

## Icons

### Lucide (`lucide-react`)

ISC License — Copyright (c) Lucide Icons and Contributors
https://lucide.dev

---

## UI / frameworks (summary)

Direct dependencies are predominantly permissive open-source licenses.
Notable stacks include:

| Component | Typical license |
| --------- | --------------- |
| Next.js, React | MIT |
| NestJS | MIT |
| Prisma | Apache-2.0 |
| Tailwind CSS, shadcn/ui patterns, Radix UI | MIT |
| AWS SDK (S3) | Apache-2.0 |
| TypeScript | Apache-2.0 |

Apache-2.0 components: preserve copyright and NOTICE text from upstream packages
as required when redistributing binaries that include those works.

---

## Local Redis (Docker)

`docker-compose.yml` pins **`redis:7.2.16-alpine`**.

Redis **7.2.x and earlier** are licensed under **BSD-3-Clause**.
Do **not** retarget the compose file to floating tags `redis:7` / `redis:7-alpine`
(those may resolve to Redis 7.4+, dual RSALv2 / SSPL).

https://redis.io/legal/licenses/

---

## SaaS / cloud services (terms apply separately)

Usage of the following is governed by the customer’s account agreements, not
by this NOTICE:

- Amazon Web Services (RDS, S3, etc.)
- Zoho ZeptoMail
- Cloudflare Turnstile (when enabled)

---

## How to update this file

When adding a dependency that is GPL/AGPL/LGPL/SSPL/BUSL/EPL/MPL/CC-BY, dual-licensed,
or has no declared license, update `docs/LICENSE_AUDIT.md` and this NOTICE before
production release.
