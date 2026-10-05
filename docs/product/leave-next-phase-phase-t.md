# Phase T — Test evidence (required before rollout)

Recorded: 2026-08-11  
Branch: `UI-SA-100826`  
Work order: `leave-next-phase-development-work-order.md` v1.0  
Plan: `leave-next-phase-execution-plan.md` Phase T

**Phase R pack:** `leave-next-phase-phase-r.md` (runbook only — migration not applied).  
**Not applied:** B0 migration `20260811120000_leave_policy_matrix_and_manager_hr_approval` — still dry-run only.  
**Not touched:** AWS RDS / `dsp_erp_dev`.

---

## Quality commands (WO §15)

| Command | Result |
|---------|--------|
| `pnpm exec prisma validate` (backend) | Pass — schema valid |
| `pnpm run lint:check` (backend) | 0 errors / 0 warnings |
| `pnpm run lint` (frontend) | Pass |
| Historical focused workforce suite (now covered by `pnpm run test`) | **19 suites, 121 tests** passed at the recorded commit |
| `pnpm run test:foundation` | **24 suites, 152 tests** pass |
| `pnpm run test:e2e` | **Not run at the recorded commit** — the current repository contains `backend/test/jest-e2e.json` |
| Playwright | **Not run** — no Playwright dependency or suite in this repo |
| Disposable DB WO §13 | **Not run** — no disposable database; never against AWS RDS / `dsp_erp_dev` |

The former focused workforce glob included holiday, workforce-calendar,
reporting-team-scope, and business-calendar consumer specs. These are now
covered by the canonical full backend `test` gate.

---

## Coverage matrix

| Layer | Required | Where it is covered | Status |
|-------|----------|---------------------|--------|
| Policy/matrix | 4-level precedence | `leave-policy-resolver.service.spec.ts`, `leave-policy-specificity.spec.ts` | Pass |
| Policy/matrix | Foreign IDs → 404 | `leave-policy-matrix.service.spec.ts` (branch out of scope) | Pass |
| Policy/matrix | Duplicates / same specificity | resolver conflict + matrix unique-cell tests | Pass |
| Policy/matrix | Stale snapshot `409 STALE_POLICY_MATRIX` | matrix spec | Pass |
| Policy/matrix | Concurrent save | advisory lock + serializable transaction in service; stale-token test | Pass (unit) |
| Policy/matrix | No balance rewrite on save | matrix spec `balancesNotUpdated` | Pass |
| Policy/matrix | Audit failure rollback | matrix spec | Pass |
| Approvers | Manager then HR | `workforce-approval-resolver.service.spec.ts`, leave-request submit/approve | Pass |
| Approvers | Skip ineligible manager | resolver spec | Pass |
| Approvers | Fallbacks Branch HR → Company HR → Group HR → Company Admin → Org Owner | resolver spec (branch preference, Group HR, Admin/Owner chain) | Pass |
| Approvers | Super Admin never auto-HR | resolver spec role-code assertion | Pass |
| Approvers | Same-actor / self-ban | resolver `assertCurrentStepActor` + leave-request self-approval | Pass |
| Approvers | No-approver rollback | resolver `LEAVE_APPROVER_NOT_AVAILABLE`; submit does not reserve when chain fails | Pass |
| Approvers | Snapshot freeze | steps written on submit; in-flight one-step stays one-step (B2) | Pass |
| Transitions | Draft / submit / manager / HR / reject / cancel | `leave-request.service.spec.ts` | Pass |
| Transitions | 409 on double approve | leave-request spec + resolver `STALE_TRANSITION` | Pass |
| Transitions | Ledger once (reserve submit, consume HR only) | leave-request spec | Pass |
| Transitions | Audit failure rollback | leave-request submit spec | Pass |
| Calendar | Holidays + source/mode | `holiday.service.spec.ts` | Pass |
| Calendar | Branch holiday override | resolver half-day test asserts `OR: company-wide OR this branch` | Pass |
| Calendar | Half-day duration 0.5 | resolver spec (LEGACY); consumer `summarizeLeaveDays` 1.5 for mixed ACTIVE days | Pass |
| Calendar | Modes LEGACY / SHADOW / ACTIVE | holiday source labels; resolver `LEGACY_OR_SHADOW` vs `ACTIVE` | Pass |
| Calendar | Range parity (one range call) | resolver ACTIVE `resolveConsumerDays` once; `business-calendar-consumer.service.spec.ts` | Pass |
| Calendar | No history rewrite | matrix/leave services never recalculate approved rows | Pass (unit) |
| Security | Two groups | `employee-domain-scope.service.spec.ts` COMPANY_GROUP holiday/leave/policy filters | Pass |
| Security | Two companies | company-scoped `holidayWhere` / `leaveRequestWhere`; holiday `listSources` uses `companyWhere`; foreign holiday 404 | Pass |
| Security | Two branches | branch-scoped employee/holiday filters; calendar employee-options foreign branch 404 | Pass |
| Security | Manager team | `reporting-team-scope.service.spec.ts`, workforce-calendar employee-options | Pass |
| Security | Employee self | calendar privacy spec; personal calendar self-only | Pass |
| Disposable DB | WO §13 twelve scenarios | Not executed (see below) | Skipped |
| Browser | Matrix / queues / calendars / viewports / a11y | No Playwright in repo | Skipped |

---

## Tests added in Phase T

- HR fallback: Group HR when branch and company HR are missing.
- HR fallback: Company Admin then Org Owner; collected role codes never include `SUPER_ADMINISTRATOR`.
- LEGACY half-day charges `0.5` on a single working day; holiday query includes company-wide and branch rows.
- ACTIVE duration uses one `resolveConsumerDays` call for the full from/to range.
- Leave approve returns `409 STALE_TRANSITION` when the current step was already decided.
- Leave submit rolls back (mocked transaction) when `AuditService.log` fails.
- Holiday `listSources` applies `companyWhere`; `findOne` 404s outside `holidayWhere`.
- Company-group scope includes `holidayWhere` / `leaveRequestWhere` / `leavePolicyWhere`.

---

## Disposable DB (WO §13) — explicitly not run

Pre-apply SQL lives in `leave-next-phase-block-b0-dry-run.md`. It must run on a **disposable** database only.

Do **not**:

- apply the B0 migration to `dsp_erp_dev`
- run the twelve WO §13 scenarios against AWS RDS
- generate missing balances on shared data unless a human asks after a successful disposable apply

When a disposable DB exists: apply B0 there twice (as the closure pack requires), run the twelve scenarios, then record results here.

---

## Browser / a11y — checklist only (no suite)

There is no Playwright (or other browser) suite in this monorepo. Manual UAT before Phase R should cover:

1. Matrix save (dirty cells only) and stale-token reload.
2. Employee submit → Manager queue → HR queue.
3. Personal calendar click-day + Apply Leave.
4. Authorized employee-selector calendar (foreign employee 404).
5. Leave → Holidays source/mode banner; Business Calendar link; LEGACY-only edit.
6. Viewports 1440 / 1024 / 768 / 390 and basic keyboard/a11y on those screens.

---

## Gaps that are not blockers for starting Phase R planning

| Gap | Why it is not a silent pass |
|-----|-----------------------------|
| Missing `jest-e2e.json` | HTTP e2e-specs under `test/foundation` already run via `test:foundation`. Do not invent a new e2e harness in Phase T. |
| No Playwright | Browser proof is UAT, not CI, until a suite is added as its own work. |
| Disposable §13 | Blocked on environment, not on product code. |

---

## Next

Ops executes `leave-next-phase-phase-r.md` on a named target (backup → disposable applies → migrate → smoke → pilot UAT). Do not apply B0 to shared `dsp_erp_dev` from this workspace.
