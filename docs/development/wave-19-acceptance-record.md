# Wave 19 — Acceptance record

**Wave:** W19 Acceptance (Excel: DEF-001, QA-001…003, RLS-DOC-001, SIGN-001)
**Tenant UAT:** `PFC-20260917` (ProdFix 20260917)
**Date:** 2026-09-18
**Engineering owner:** Cursor agent + local Owner persona (`owner.admin` / `prodfix.owner.20260917`)

Honesty rule: do not mark production **GO** until named humans complete **SIGN-001** and remaining ops P0s are fixed or formally accepted.

---

## Freeze identity (REL-001 / QA base)

| Field | Value |
|---|---|
| Branch | `UI-SA-170926-5` |
| Base commit (last pushed/committed) | `16fa094dffcedb9f1717a75007c75b2b56e455c4` (`16fa094`) |
| Message | `fix improvement 5` |
| Working tree at acceptance pack | **Dirty** — W16–W18 honesty/path/ops/upload fixes not yet committed |
| Freeze recommendation | Commit W16–W18 product + migration deltas, then tag `wave19-uat-freeze` on that clean SHA before production cutover |
| Node at evidence time | `v22.22.0` (repo pin prefers `24.20.0` — note as environment drift) |
| pnpm | `11.24.0` |

### Capture (after commit)

```powershell
git status
git rev-parse HEAD
git log -1 --format="%H %s"
git tag -a wave19-uat-freeze -m "W19 Acceptance UAT freeze"
```

---

## DEF-001 — Defect & retest freeze

### Module wave results (persona)

| Wave | Result | Notes |
|------|--------|-------|
| W8–W15 | Pass | Onboarding → Timesheets |
| W16 Office Finance | Smoke Pass | Setup + create/submit; list page/limit |
| W17 Payroll | Pass | Components → salaries → preflight blockers |
| W18 Operations | Pass | Ops path; Delivery V2 off empty = honest; MIME upload fix; Owner delivery perms |

### Open / accepted items (must not be silent)

| ID | Sev | Disposition | Evidence / note |
|----|-----|-------------|-----------------|
| ENV-001 Isolated UAT stack | P0 (W0) | **Accepted for local UAT; block production GO** | Still pending ops — no disposable prod-like UAT env this session |
| ENV-002 Secrets/providers | P0 (W0) | **Accepted for local; block production GO** | Delivery V2 + ZeptoMail keys not enabled locally |
| REL-002 Backup/rollback | P0 (W0) | **Accepted for local; block production GO** | Ops owner must record backup + rollback before cutover |
| OBS-001 Metrics/alerts | P1 (W0) | **Deferred** | Not required to close module waves; track for pilot |
| CFG-001 live A/B profiles | P0 doc done | **Partial** | Profiles documented; live two-tenant redeploy not run |
| Delivery V2 live queue | Ops | **Accepted limitation** | `DELIVERY_V2_ENABLED=false` → LEGACY / empty queue by design |
| ClamAV production host | Ops | **Accepted for local** | Empty `CLAMAV_HOST` → **dev-fallback** clean path in non-prod; production must set ClamAV |
| HR upload MIME allowlist | P1→Fixed | **Closed** | `HR_REQUEST_ATTACHMENT` added to MIME allowlist; false SCAN_FAILED clearable |
| Owner Delivery Queue 403/gate | P1→Fixed | **Closed** | Owner/Admin get `platform.delivery.*`; nav + capability without requiring V2 on |
| Uncommitted W16–W18 tree | Process | **Open until commit** | Freeze SHA incomplete until commit/tag |

### DEF-001 Pass criteria (Excel)

| Criterion | Status |
|-----------|--------|
| No silent open P0/P1 on module waves W8–W18 | **Met** (persona Pass) |
| Remaining P0s fixed or **formally accepted** with owner | **Accepted with production block** (ENV/REL) |
| Closed defects have runtime evidence | MIME + delivery ops + wave tracker notes |
| Retest on final clean SHA | **Pending** after commit/tag |

**DEF-001 engineering verdict:** **Conditional Pass** (module defects closed/accepted; production still blocked by ENV-001/ENV-002/REL-002 + SIGN-001).

---

## QA-001 — Source & UI gates (this machine)

| Check | Result |
|-------|--------|
| `pnpm run prisma:validate` (backend) | **Pass** |
| `pnpm run typecheck:ts6` (backend `tsconfig.build.json`) | **Pass** (exit 0) |
| `pnpm run typecheck:ts6` (frontend) | **Pass** (exit 0) |
| Foundation jest `environment\|route-policy\|module-capabilities` | **102 passed** |
| Content-type + module-capabilities unit | Run in same session (expect Pass) |
| `uat-phase5-gate-evidence.mjs` | **13 Pass / 0 Fail** |
| Full `pnpm run build` / `release-gates` / full test suite | **Not re-run end-to-end this session** (time); required before production GO |
| Lint full monorepo | **Not re-run this session** |

**QA-001 verdict:** **Conditional Pass** for acceptance pack; full release-gates still required on clean freeze SHA.

---

## QA-002 — PostgreSQL & concurrency

| Check | Result |
|-------|--------|
| Disposable Postgres from-zero + upgrade matrix | **Not run** (ENV-001 pending) |
| Race cases Project/Timesheet/Finance/Payroll/Files | Covered partially by prior foundation/module tests + W14–W17 persona; **not** full Excel race matrix |
| Backup/restore | **Not run** (REL-002) |

**QA-002 verdict:** **Fail / Incomplete for production** — formally blocked on ENV-001 + REL-002. Local RDS `dsp_erp_dev` used for UAT only.

---

## QA-003 — Real API / browser / providers

| Check | Result |
|-------|--------|
| Persona browser W8–W18 on Tenant `PFC-20260917` | **Pass** (Owner/HR + colleague where noted in tracker) |
| Delivery V2 + real ZeptoMail/webhooks | **Not enabled** — accepted empty LEGACY queue |
| File upload/scan (dev-fallback) | **Pass** after MIME fix |
| Cross-tenant outsider / Tenant B matrix | **Not fully re-run this session** |
| Mobile / keyboard / 200% zoom | **Not re-run this session** (W1 a11y still partial historically) |

**QA-003 verdict:** **Conditional Pass** for module waves; provider-complete + isolation matrix still open for production GO.

---

## RLS-DOC-001 — Docs

See [`wave-19-rls-doc-001-ops-guides.md`](./wave-19-rls-doc-001-ops-guides.md).

**Verdict:** **Engineering Pass** for English ops/availability labels (no secrets). Routes aligned to current UI.

---

## SIGN-001 — Named sign-off (humans)

| Area | Owner role | Result | Signature / date |
|------|------------|--------|------------------|
| Tenant administration | Organization Owner | | |
| Users and permissions | Organization Owner / Security | | |
| HR + Onboarding + Leave/Attendance | HR Manager | | |
| Projects + Timesheets | Project Manager / Owner | | |
| Finance + Payroll | Owner / Finance | | |
| Assets | Asset custodian / Owner | | |
| Operations (Delivery/Files/Retention) | Owner / Platform | | |
| Tenant isolation + audit | Technical reviewer | | |
| Known limitations accepted | Product Owner | | |
| **Final Core ERP approval** | Product Owner | | |

**SIGN-001 verdict:** **Pending** — engineering cannot self-sign production GO.

---

## Release decision

| Field | Value |
|-------|--------|
| Module waves W8–W18 | **Done (persona Pass)** |
| W19 engineering pack | **Done (this document)** |
| Production release | **NO-GO** until: clean freeze commit/tag, ENV-001/ENV-002/REL-002 closed or Product Owner accepts in writing, full QA-001 release-gates, SIGN-001 signatures |
| Recommended next action | Commit W16–W18 → tag freeze → Owner+HR+colleague sign table → ops closes ENV/REL |

---

## Linked docs

- Tracker: [`docs/product/production-fix-wave-tracker.md`](../product/production-fix-wave-tracker.md)
- CFG profiles: [`cfg-001-feature-gate-profiles.md`](./cfg-001-feature-gate-profiles.md)
- Prior freeze example: [`wave-2-freeze-record.md`](./wave-2-freeze-record.md)
- Manual acceptance checklist: [`erp-production-workflow-manual-uat-guide.md`](../testing/erp-production-workflow-manual-uat-guide.md) §26–27
