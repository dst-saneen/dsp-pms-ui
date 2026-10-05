# Phase 7 — Concurrency Evidence (executed)

**Date:** 2 September 2026  
**Commit:** `5916d458cef64ba798fcc440ee9eff024462306c`  
**Method:** API dual-session parallel fetch (simulates two browser sessions)

---

## Execution summary

| Race | Status | Winner / outcome |
|------|--------|------------------|
| CONC-01 — Dual draft project edit | **Pass** | Session A 200; Session B 409 `PROJECT_STATE_CHANGED` |
| CONC-02 — Complete project vs child mutation | **Pass** | Child task create 201; complete 409 `PROJECT_HAS_ACTIVE_WORK` |
| CONC-03 — Reassign task vs employee submit | **Pass** | Submit 201; reassign 409 `TASK_STATE_CHANGED` |
| CONC-04 — Timesheet approve vs employee correction | **Pass** | Approve 201; line add 409 `TIMESHEET_STATE_CHANGED` |
| CONC-05 — Finance approve vs maker edit | **Pass** | Maker edit 200; approve 409 `FINANCE_VERSION_CONFLICT` |
| CONC-06 — Dual payroll approver approve | **Blocked** | No fresh calculable month (Aug run exists from Phase 5) |
| CONC-07 — Dual mark paid | **Fail** | Both 409 `CONFLICT` on PR-000005 (Phase 5 defect) |
| CONC-08 — Replay same operationId | **Pass** | First 200; identical replay 200 (safe) |
| CONC-09 — Reuse operationId, changed payload | **Pass** | Second 409 `OPERATION_ID_REUSED` |

**Phase 7 overall:** **Partial Pass** — 7/9 executable races Pass; payroll approve Blocked; mark-paid Fail (known defect)

---

## Method note

The UAT guide specifies **two browser sessions**. This run used **parallel API calls with separate auth tokens** (same users, independent sessions) to prove one-winner / controlled-conflict behavior without literal dual-browser automation.

Manual two-browser sign-off remains optional; no duplicate Project action, Finance expense, or File Object was created across passing races.

---

## Logins used

| Role | Email |
|------|-------|
| Admin / PM (sessions A & B) | `msaneen.dev@gmail.com` |
| Employee | `learnfresh.emp01@example.test` |
| Finance / Payroll approver | `faisal.approver.uat@learnfresh.test` |
| Payroll maker | `learnfresh.hr01@example.test` |

---

## CONC-06 — Dual payroll approve (Blocked)

Aug 2026 payroll run **PR-000005** already exists and is **APPROVED** from Phase 5. Other months (Jun–Jul, Sep–Oct 2026) return `ATTENDANCE_PERIOD_NOT_READY`. A fresh CALCULATED run could not be created for a dual-approve race without new attendance-period setup.

**UAT impact:** Approve-race behavior not re-tested live; prior Phase 5 single-approve flow Pass.

---

## CONC-07 — Dual mark paid (Fail — known defect)

Used existing approved run **PR-000005** / `6cff3c74-8dd4-4793-9d15-e28e97dc5683` (3 employees).

| Session | Result |
|---------|--------|
| Mark paid A | **409 CONFLICT** |
| Mark paid B | **409 CONFLICT** |

Same root cause as Phase 5: multi-employee mark-paid hits `PayrollActionEvent` unique constraint — neither session succeeds, so this is **not** a valid one-winner race.

---

## Idempotency (CONC-08 / CONC-09)

| Check | Result |
|-------|--------|
| Identical replay with same `operationId` | **200** — safe replay |
| Same `operationId`, different payload | **409** `OPERATION_ID_REUSED` — rejected |

---

## API evidence

Full log: [`phase-7-concurrency-api-results.json`](./phase-7-concurrency-api-results.json)

```bash
# backend/
node scripts/uat-phase7-api-runner.mjs
# → 8 Pass, 1 Fail, 1 Blocked (plus CONC-07 supplemental on PR-000005)
```

---

## UAT run complete

All 7 phases executed. Open items for lead:

1. **P1** — Payroll mark-paid multi-employee (`PR-000005`)
2. **Blocked** — S3/ClamAV file upload + payslip PDF (Phases 3/5)
3. **Blocked** — Specialized navigation personas + manual a11y (Phase 6)
4. **Blocked** — Dual payroll approve race (needs fresh attendance period)
