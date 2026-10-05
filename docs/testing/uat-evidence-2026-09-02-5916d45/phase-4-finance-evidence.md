# Phase 4 — Office Finance Evidence (retry with keys)

**Date:** 2 September 2026  
**Commit:** `5916d458cef64ba798fcc440ee9eff024462306c`  
**Method:** Env keys added + live API (FINANCE-01/02/03) + Jest finance suites

---

## Execution summary

| Step | Status | Notes |
|------|--------|-------|
| FINANCE-01 — Setup + expense draft | **Pass** | `FT-000009` created, edited, bad date rejected, persist verified |
| FINANCE-02 — Maker-checker + reverse | **Pass** | Submit → self-approve blocked → return → resubmit → approve → reverse → idempotent replay |
| FINANCE-03 — Scope + access control | **Pass** | Module ON for authorized; employee/HR 403 |

**Phase 4 overall:** **Pass** — 21/21 API steps

---

## Environment (added locally)

| Setting | Value |
|---------|-------|
| `OFFICE_FINANCE_LITE_ENABLED` | `true` |
| `FINANCE_IDEMPOTENCY_HMAC_ACTIVE_VERSION` | `v1` |
| `FINANCE_IDEMPOTENCY_HMAC_KEYS_JSON` | generated local dev key (2026-09-02) |
| `FINANCE_BANK_REFERENCE_ENC_ACTIVE_VERSION` | `v1` |
| `FINANCE_BANK_REFERENCE_ENC_KEYS_JSON` | generated local dev key (2026-09-02) |

**Note:** Keys were generated for local UAT because approved secret-store values were not in repo. Existing DB receipts (45) used prior v1 material; new transactions use the configured keys. Pre-existing encrypted bank references may not decrypt with new enc key — petty-cash accounts used for create flow.

---

## Logins used

| Role | Email | Password |
|------|-------|----------|
| Maker | `msaneen.dev@gmail.com` | same as email |
| Approver | `faisal.approver.uat@learnfresh.test` | set via `e2e:uat-fix` (= email) |

---

## Key records

| Record | ID |
|--------|-----|
| Expense draft (latest run) | `FT-000009` / `b04b89a3-dfd7-4679-8413-e93fd2c2ac97` |
| Baseline (read test) | `FT-000006` / `f5d33da3-18f2-491d-852a-0402a709d3ea` |
| Open finance period | Aug 2026 — use transaction dates in Aug 2026 |

---

## FINANCE-03 — Live API (module ON)

| Check | Result |
|-------|--------|
| `officeFinanceLite` | **true** |
| `officeFinanceNav` | **true** |
| Finance user → list | **200** |
| Finance user → baseline ID | **200** |
| Employee → direct ID | **403** |
| HR Manager → direct ID | **403** |

Full log: [`phase-4-finance-api-results.json`](./phase-4-finance-api-results.json)

---

## Automated Jest evidence

| Suite | Result |
|-------|--------|
| `finance-capability.service.spec.ts` | Pass |
| `finance-command-receipt.hmac.spec.ts` | Pass |
| `office-finance-periods.service.spec.ts` | Pass |
| `finance-transaction-validator.shape.spec.ts` | Pass |
| `office-finance-payroll-catalog.spec.ts` | Pass |
| **Total** | **14/14 Pass** |

---

## Tell your lead

> “Phase 4 Pass — Finance enabled with local v1 keys. FINANCE-01/02/03 complete via live API (21 steps). Maker-checker, self-approval block, return/resubmit, approve, reverse all verified.”
