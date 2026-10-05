# Wave 6 — Exit record (Employees and documents)

Engineering exit for Excel **W6 Employees and documents** (EMP-001…003, DOC-001…003), executed **2026-09-15**.

**Plan:** `docs/development/wave-6-execution-plan.md`  
**Prior:** Waves 0–5 engineering Conditional Pass (`wave-5-exit-record.md`)

---

## Identity

| Field | Value |
|---|---|
| Branch | `UI-SA-140926-3` |
| Wave 2 freeze | `93eeeb126d5b1a0137dbeb88d58731d602cfe8ca` (`wave2-uat-freeze`) |
| Wave 6 product SHA | **Pending commit** — backfill after commit; optional tag `wave6-engineering-exit` |
| Exit date | 2026-09-15 |
| Filled by | Engineering (Phase L–R) |

---

## Environment smoke

| Check | Result |
|---|---|
| `GET /health/ready` | Recorded at gate (local API) |
| `GET /login` | Recorded at gate (local FE) |
| Frontend `tsc --noEmit` | **Pass** |
| Backend `tsc -p tsconfig.build.json --noEmit` | **Pass** |
| Real S3 + ClamAV (ENV-002) | **Your deploy** — UI states wired; production scan proof pending deploy |

---

## EMP checklist

| ID | Check | Result |
|---|---|---|
| EMP-001 | Server search/paging/sort; Company/Branch/Department/status filters; URL persistence | **Pass (engineering)** — `GET /employees` → `{items,total,page,limit}`; directory URL sync |
| EMP-002 | No preview drawer; row → detail; Edit → `/edit`; Back keeps list filters | **Pass (engineering)** |
| EMP-003 | EntityFormPage, unsaved warn, cascade clear, save summary, PermissionGate | **Pass (engineering)** |

---

## DOC checklist

| ID | Check | Result |
|---|---|---|
| DOC-001 | Category/Type/Document `/new` + `/[id]/edit`; readiness Category → Type → Documents | **Pass (engineering)** |
| DOC-002 | Scan lifecycle labels; Clean-only download; Retry without duplicate; outage blocked | **Pass (engineering)** — deploy-time S3/ClamAV proof pending you |
| DOC-003 | `/hr/employee-documents/[id]` detail; real reject reason; history; authz actions | **Pass (engineering)** |

---

## Decision

| Field | Value |
|---|---|
| Engineering W6 result | **Conditional Pass** |
| Proceed to W7+ | **Yes (engineering)** when you ask |
| Hold | Commit W6 SHA; live ENV-002 upload/scan UAT on your deploy; browser persona UAT |

---

## Simple “what’s new” (frontend)

1. Employees list pages with filters in the URL and server paging.  
2. Click employee → full profile (no side drawer).  
3. Add/Edit employee = full form page with save summary and leave warning.  
4. Document Category / Type / Document = full pages + setup checklist.  
5. Upload shows clear scan states; download only when Clean.  
6. Verify/reject document on a detail page with a real rejection reason.
