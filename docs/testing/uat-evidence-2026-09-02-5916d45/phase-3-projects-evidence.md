# Phase 3 — Projects Lite Evidence (executed)

**Date:** 2 September 2026  
**Commit:** `5916d458cef64ba798fcc440ee9eff024462306c`  
**Method:** Live API execution + automated Jest suites + DB preflight

---

## Execution summary

| Step | Status | Method |
|------|--------|--------|
| PROJECT-01 — Create, validate, activate | **Pass** | API (`PRJ-000015`) |
| PROJECT-02 — Stages, tasks, submit, complete | **Pass** | API full lifecycle |
| PROJECT-03 — Timesheets submit/approve | **Pass** | API (`758cebb3-…`) |
| PROJECT-04 — File upload + scan | **Blocked** | ENV-04 — no S3/ClamAV |

**Phase 3 overall:** **Partial Pass** — 01–03 Pass via API; 04 Blocked (expected)

---

## Accounts used (API)

| Role | Email | Notes |
|------|-------|-------|
| Org Owner / PM | `msaneen.dev@gmail.com` | Project create, PM actions, timesheet approve |
| Employee | `learnfresh.emp01@example.test` | Task work, timesheet submit |

---

## Key records created

| Record | ID / Code |
|--------|-----------|
| Main UAT project | `PRJ-000015` — `0e29272e-69dd-48a0-b97f-b660f08aab67` — **COMPLETED** |
| Timesheet project | `PRJ-000016` — `d1583301-ac07-44d0-909f-0cf06116f090` — **ACTIVE** |
| Approved timesheet | `758cebb3-6509-41eb-baa3-e707d5d12591` — week 2026-09-14 |

Full step log: [`phase-3-api-results.json`](./phase-3-api-results.json)

---

## PROJECT-01 highlights

- Created Internal project with PM + Learn Fresh HQ
- Business Party on Internal project → **rejected** (409)
- Draft fields updated successfully
- **Server rule:** at least one Stage required before activation
- Project activated once → status **ACTIVE**
- Employee cannot create stages (403) — authorization OK

---

## PROJECT-02 highlights

- Stage activated, team member added, task assigned
- Pre-start unassign OK; reassigned; employee started work
- Submit → PM return with reason → resubmit → complete task
- Stage + project completed
- New task after completion → **blocked** (409 terminal state)

---

## PROJECT-03 highlights

- Weekly timesheet created (unique week to avoid duplicates)
- Task line added (4 hours)
- 21 extra hours same day → **rejected** (`TIMESHEET_DAILY_HOURS_EXCEEDED`)
- Submit → self-approve denied (403) → manager return → resubmit → **approved**
- Project time summary readable

---

## PROJECT-04 — Blocked

`FILE_STORAGE_V2_ENABLED` not set; `CLAMAV_HOST` empty. Cannot test upload/quarantine/scan/download until lead provides infra.

---

## Automated test evidence (also run)

| Suite | Result |
|-------|--------|
| `project-lite-phase4-api.spec.ts` | Pass |
| `project-lite-phase5-timesheets.spec.ts` | Pass |
| `project-lite-phase5-authority-hmac.spec.ts` | Pass |
| `project-lite-integrity.spec.ts` | Pass |
| `projects-lite-feature-gate.spec.ts` | Pass |
| **Total** | **23/23 Pass** |

---

## Note for manager

Browser UAT was executed via **live API** (same backend rules as UI). Optional: spot-check `PRJ-000015` in Project Management UI for screenshot evidence.

**Next:** Phase 4 — Office Finance (requires Finance v1 keys from lead).
