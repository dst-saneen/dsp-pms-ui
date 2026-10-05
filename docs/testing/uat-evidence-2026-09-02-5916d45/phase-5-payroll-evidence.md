# Phase 5 — Payroll Lite Evidence (executed)

**Date:** 2 September 2026  
**Commit:** `5916d458cef64ba798fcc440ee9eff024462306c`  
**Method:** Env keys + dependency gate simulation + live API + DB preflight

---

## Execution summary

| Step | Status | Notes |
|------|--------|-------|
| PAYROLL-01 — Dependency gates | **Pass** | Simulated OFF/ON for payroll, finance, storage, jobs (5/5) |
| PAYROLL-02 — Setup + calculate | **Pass** | Preflight clear; `PR-000005` created + calculated (3 employees) |
| PAYROLL-03 — Approve + mark paid | **Partial** | Self-approve blocked; approver approve Pass; **mark-paid Fail** (see defect) |
| PAYROLL-04 — Payslips | **Blocked** | No ClamAV / scan worker configured |

**Phase 5 overall:** **Partial Pass**

---

## Environment added

| Setting | Value |
|---------|-------|
| `PAYROLL_LITE_ENABLED` | `true` |
| `PAYROLL_IDEMPOTENCY_HMAC_KEYS_JSON` | local dev v1 key (2026-09-02) |
| `WORKFORCE_JOBS_ENABLED` | `true` |
| `FILE_STORAGE_V2_ENABLED` | `true` (Learn Fresh HQ allowlist) |
| `STORAGE_S3_*` | reuses dev bucket credentials |
| `FILE_NAME_ENC_KEYS_JSON` | local dev v1 key |
| `FILE_SCAN_WORKER_ENABLED` | `false` (PAYROLL-04 Blocked) |

---

## Logins used

| Role | Email | Password |
|------|-------|----------|
| Payroll Maker | `learnfresh.hr01@example.test` | same as email |
| Payroll Approver | `faisal.approver.uat@learnfresh.test` | same as email |

---

## Key records

| Record | ID / number |
|--------|-------------|
| Payroll run (Aug 2026) | `PR-000005` / `6cff3c74-8dd4-4793-9d15-e28e97dc5683` |
| Status after run | **APPROVED** (mark-paid not completed) |
| Eligible employees | 3 |
| Net total | INR 150,000.00 |

---

## PAYROLL-03 defect — mark-paid (multi-employee)

**Symptom:** `POST /payroll/runs/{id}/mark-paid` → **409 CONFLICT** (`P2002` unique violation)

**Likely cause:** `PayrollActionEvent` has `@@unique([companyId, operationId, entityType, action])` but mark-paid records one `PENDING` payslip event per employee using the **same** `operationId`. With 3 employees, the second insert violates the unique index.

**UAT impact:** Approve flow Pass; finance expense + payslip generation cannot complete until fixed or run has a single employee.

---

## API evidence

Full log: [`phase-5-payroll-api-results.json`](./phase-5-payroll-api-results.json)

| Check | Result |
|-------|--------|
| `payrollLite` capability | **true** |
| Employee → payroll API | **403** |
| Preflight blockers | **[]** (3 eligible) |
| Create + calculate | **Pass** |
| Maker self-approve | **403 blocked** |
| Approver approve | **Pass** |
| Mark paid | **Fail** (409) |

---

## Tell your lead

> “Phase 5 Partial Pass — PAYROLL-01/02 Pass via API. PAYROLL-03 approve Pass but mark-paid Fail on 3-employee run (probable payslip action-event unique constraint bug). PAYROLL-04 Blocked — no ClamAV.”
