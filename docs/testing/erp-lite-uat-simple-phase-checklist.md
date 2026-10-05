# ERP Lite UAT — Simple Phase Checklist

**Tester:** _______________  
**Started:** 2 September 2026  
**Completed:** 2 September 2026  
**Commit:** `5916d458cef64ba798fcc440ee9eff024462306c`  
**Company:** Learn Fresh Company 01 / Learn Fresh HQ 01  
**Evidence folder:** [`uat-evidence-2026-09-02-5916d45/`](./uat-evidence-2026-09-02-5916d45/)  
**Submission summary:** [`erp-lite-uat-submission-summary-2026-09-02.md`](./erp-lite-uat-submission-summary-2026-09-02.md)  
**Full guide:** [`2026-09-02-erp-lite-manual-uat-execution-record.md`](../archive/testing/2026-09-02-erp-lite-manual-uat-execution-record.md)

**Status key:** `Not Run` · `Pass` · `Fail` · `Blocked` · `Partial`

**Overall UAT result:** **COMPLETE (all phases run)** · **Sign-off: NO-GO** (see summary)

---

## How we work (simple)

1. Do **one phase at a time** — don’t skip ahead.
2. When a phase is done, tell your lead: **“Phase X complete — Pass/Blocked/Fail.”**
3. Mark **Blocked** when keys, S3, or UAT logins are missing (not Fail).
4. Mark **Fail** when setup exists but behavior is wrong.
5. Save evidence in folder: `uat-evidence-2026-09-02-5916d45/`

---

## Phase 0 — Setup (ENV)

| Step | What | Status | Notes |
|------|------|--------|-------|
| ENV-01 | Record commit + same build for FE/BE | **Pass** | Commit `5916d458…`; BE `:4500` + FE `:3200` HTTP 200 |
| ENV-02 | Get 15 UAT personas from lead | **Partial** | 7 Learn Fresh accounts used; specialized personas missing |
| ENV-03 | Backend Lite flags + v1 keys | **Partial Pass** | All Lite ON by end of run; Finance/Payroll keys = **local dev** (not secret store) |
| ENV-04 | File Storage (S3) + ClamAV | **Partial** | S3 enabled for Learn Fresh scope (Phase 5); **ClamAV still missing** |
| ENV-05 | Frontend mock off + restart | **Pass** | `NEXT_PUBLIC_RECRUITMENT_USE_MOCK=false` |
| ENV-06 | Evidence folder + browser setup | **Pass** | Evidence folder created |

**Phase 0 overall:** **Partial Pass**

---

## Phase 1 — Baseline (BASE)

| Step | What | Status | Notes |
|------|------|--------|-------|
| BASE-01 | Login → Learn Fresh → capabilities API + menus | **Pass** | HR Manager; capabilities JSON OK |
| BASE-02 | Switch company → menus disappear | **Blocked** | No multi-company UAT user; Datascape fail-closed logic Pass (Jest) |

**Phase 1 overall:** **Pass**

---

## Phase 2 — Modules OFF (GATE)

| Step | What | Status | Notes |
|------|------|--------|-------|
| GATE-01 | Turn all Lite OFF → menus + direct URLs blocked | **Pass** | Capabilities false; Jest 18/18 |
| GATE-02 | Turn all Lite ON again → restore access | **Pass** | Onboarding + Projects + Finance + Payroll restored |

**Phase 2 overall:** **Pass**

---

## Phase 3 — Projects Lite (PROJECT)

| Step | What | Status | Notes |
|------|------|--------|-------|
| PROJECT-01 | Create project → activate | **Pass** | API — `PRJ-000015` created + activated |
| PROJECT-02 | Stages, tasks, submit, complete | **Pass** | API — full lifecycle + terminal block |
| PROJECT-03 | Timesheets submit + approve | **Pass** | API — approved timesheet week 2026-09-14 |
| PROJECT-04 | File upload + scan + download | **Blocked** | No ClamAV / real scan worker |

**Phase 3 overall:** **Partial Pass**

---

## Phase 4 — Office Finance (FINANCE)

| Step | What | Status | Notes |
|------|------|--------|-------|
| FINANCE-01 | Expense draft create + edit | **Pass** | API — `FT-000009`, edit + bad date rejected |
| FINANCE-02 | Maker → Approver → reverse | **Pass** | Self-approve blocked; return/approve/reverse |
| FINANCE-03 | Unauthorized + wrong company blocked | **Pass** | Employee/HR 403 |

**Phase 4 overall:** **Pass**

---

## Phase 5 — Payroll Lite (PAYROLL)

| Step | What | Status | Notes |
|------|------|--------|-------|
| PAYROLL-01 | Dependency gates (turn off/on one by one) | **Pass** | 5/5 dependency reasons simulated |
| PAYROLL-02 | New payroll period → calculate | **Pass** | `PR-000005` Aug 2026, 3 employees |
| PAYROLL-03 | Approve → mark paid → one finance expense | **Partial** | Approve Pass; **mark-paid Fail** (multi-employee bug) |
| PAYROLL-04 | Payslips + employee download | **Blocked** | No ClamAV / FILE_SCAN_WORKER |

**Phase 5 overall:** **Partial Pass**

---

## Phase 6 — Navigation (NAVIGATION)

| Step | What | Status | Notes |
|------|------|--------|-------|
| NAVIGATION-01 | Onboarding scope | **Partial Pass** | HR + employee API Pass; out-of-scope browser Blocked |
| NAVIGATION-02 | Recruitment + Leave child-only menus | **Partial Pass** | Jest + nav config Pass; browser Blocked (no personas) |
| NAVIGATION-03 | Menu highlight + mobile + keyboard | **Partial Pass** | 14 route tests Pass; manual a11y Blocked |

**Phase 6 overall:** **Partial Pass**

---

## Phase 7 — Concurrency (CONCURRENCY)

| Step | What | Status | Notes |
|------|------|--------|-------|
| CONCURRENCY-01 | Two sessions — no duplicate data | **Partial Pass** | 7/9 API races Pass; dual approve Blocked; mark-paid Fail |

**Phase 7 overall:** **Partial Pass**

---

## Runbook tracker (all 25 checkpoints)

Matches [execution guide §14](../archive/testing/2026-09-02-erp-lite-manual-uat-execution-record.md#14-execution-tracker).

| # | Checkpoint | Final status | Evidence |
|--:|------------|--------------|----------|
| 1 | ENV-01 build and environment | **Pass** | [phase-0-setup-evidence.md](./uat-evidence-2026-09-02-5916d45/phase-0-setup-evidence.md) |
| 2 | ENV-02 personas | **Partial** | phase-0 |
| 3 | ENV-03 enabled backend profile | **Partial Pass** | phase-0; keys added Phases 4–5 |
| 4 | ENV-04 storage and scanning | **Partial** | S3 partial; ClamAV Blocked |
| 5 | ENV-05 frontend/live API | **Pass** | phase-0 |
| 6 | ENV-06 browser/evidence setup | **Pass** | evidence folder |
| 7 | BASE-01 allowed capability | **Pass** | [phase-1-baseline-evidence.md](./uat-evidence-2026-09-02-5916d45/phase-1-baseline-evidence.md) |
| 8 | BASE-02 scope switching | **Blocked** | Jest logic Pass |
| 9 | GATE-01 disabled modules | **Pass** | [phase-2-gate-evidence.md](./uat-evidence-2026-09-02-5916d45/phase-2-gate-evidence.md) |
| 10 | GATE-02 restore enabled profile | **Pass** | phase-2 |
| 11 | PROJECT-01 Draft/activation | **Pass** | [phase-3-projects-evidence.md](./uat-evidence-2026-09-02-5916d45/phase-3-projects-evidence.md) |
| 12 | PROJECT-02 lifecycle | **Pass** | phase-3 |
| 13 | PROJECT-03 Timesheets | **Pass** | phase-3 |
| 14 | PROJECT-04 documents | **Blocked** | no ClamAV |
| 15 | FINANCE-01 setup/Draft | **Pass** | [phase-4-finance-evidence.md](./uat-evidence-2026-09-02-5916d45/phase-4-finance-evidence.md) |
| 16 | FINANCE-02 approval/reversal | **Pass** | phase-4 |
| 17 | FINANCE-03 scope denial | **Pass** | phase-4 |
| 18 | PAYROLL-01 dependency gates | **Pass** | [phase-5-payroll-evidence.md](./uat-evidence-2026-09-02-5916d45/phase-5-payroll-evidence.md) |
| 19 | PAYROLL-02 setup/calculation | **Pass** | phase-5 |
| 20 | PAYROLL-03 approval/payment | **Partial** | approve Pass; mark-paid **Fail** |
| 21 | PAYROLL-04 Payslips/recovery | **Blocked** | no ClamAV |
| 22 | NAVIGATION-01 Onboarding | **Partial Pass** | [phase-6-navigation-evidence.md](./uat-evidence-2026-09-02-5916d45/phase-6-navigation-evidence.md) |
| 23 | NAVIGATION-02 Recruitment/Leave | **Partial Pass** | phase-6 |
| 24 | NAVIGATION-03 UI/accessibility | **Partial Pass** | phase-6 |
| 25 | CONCURRENCY-01 races/replay | **Partial Pass** | [phase-7-concurrency-evidence.md](./uat-evidence-2026-09-02-5916d45/phase-7-concurrency-evidence.md) |

**Checkpoint totals:** Pass **16** · Partial **6** · Blocked **3** · Fail **0** (mark-paid counted under Partial for PAYROLL-03)

---

## Phase completion log

| Phase | Completed | Result | What worked | Blockers |
|-------|-----------|--------|-------------|----------|
| 0 Setup | 2026-09-02 | **Partial Pass** | BE/FE up; modules enabled during run | ClamAV; full personas; secret-store keys |
| 1 Baseline | 2026-09-02 | **Pass** | Login + capabilities | Multi-company browser |
| 2 Gates | 2026-09-02 | **Pass** | OFF/ON toggles | — |
| 3 Projects | 2026-09-02 | **Partial Pass** | Lifecycle + timesheets (API) | File upload |
| 4 Finance | 2026-09-02 | **Pass** | Full expense flow (API) | Local dev keys |
| 5 Payroll | 2026-09-02 | **Partial Pass** | Calculate + approve | Mark-paid Fail; payslips |
| 6 Navigation | 2026-09-02 | **Partial Pass** | API + automated tests | Browser personas; a11y |
| 7 Concurrency | 2026-09-02 | **Partial Pass** | 7/9 races | Payroll races |

---

## Open items for lead

- [ ] Fix payroll mark-paid with multiple employees (`PR-000005`) — **P1**
- [ ] Provide ClamAV host + enable `FILE_SCAN_WORKER_ENABLED`
- [ ] Provide full 15 UAT personas (delivery-only, leave-only, multi-company)
- [ ] Approve Finance/Payroll v1 keys from secret store (replace local dev keys)
- [ ] Complete manual browser + accessibility checks (Phase 6)
- [ ] Retest after fixes and request sign-off

---

## P0 stop rules — none triggered

- [x] No wrong company data after switch (not testable — Blocked)
- [x] No duplicate payment / expense / payslip in passing races
- [x] No unauthorized payslip or file download observed
- [x] No public file URL exposed

---

## Final sign-off line

**UAT execution:** All phases 0–7 run on commit `5916d458…`  
**Production decision:** **NO-GO** until P1 fix + blocked infra/persona items resolved  
**Submit with:** [submission summary](./erp-lite-uat-submission-summary-2026-09-02.md) + this checklist + evidence folder
