# Phase 9 — Closure record (Leave Policy Matrix migration)

| Field | Value |
|---|---|
| Closure date | 2026-08-13 |
| Operator | `bm` (`desktop-4sr7573\bm`) |
| Git branch | `UI-SA-120826-2` |
| Git commit (baseline) | `22f195b5538d5911da1b6e37b60aeb37de2fa05d` |
| Target database / schema | `dsp_erp_dev` / `dsp_pms` |
| Migration | `20260811120000_leave_policy_matrix_and_manager_hr_approval` |
| Migration result | **PASS** (applied 2026-08-13T05:57:41Z) |
| UAT result | **PASS** (API smoke 18/18) |
| Approved for next environment | **YES — with notes** (see limits) |

---

## Evidence index (manager §15)

| Evidence | Owner | Result | Reference |
|---|---|---|---|
| Git baseline and migration checksum | Engineering | PASS | Remaining-phases Phase 1; SHA256 `0AE90224…B3BCB6` |
| Read-only duplicate and workflow assessment | Engineering | PASS | `leave-policy-matrix-migration-phase2-evidence.json` |
| Empty disposable rehearsal | Engineering | PARTIAL / incident | Script bug applied to `dsp_pms`; fixed afterward |
| Production-shaped disposable rehearsal | Engineering | NOT RUN | Needs separate disposable DB/snapshot |
| Backup evidence | Operations | NOT RECORDED | No RDS snapshot ID captured before apply |
| Shared development deployment | Engineering | PASS (unplanned timing) | Applied via migrate deploy; status up to date |
| Post-deployment SQL verification | Engineering | PASS | `leave-policy-matrix-migration-phase3-incident-verify.json` |
| Automated quality gates | Engineering | PASS | Phase 7 — 439 unit + workforce + e2e + FE build |
| Employee/Manager/HR UAT | Engineering (API) | PASS | `leave-policy-matrix-migration-phase8-api-smoke.json` |
| Technical sign-off | Engineering | PASS with limits | This document |

---

## Final result

- Deployment date: **2026-08-13**
- Target database/schema: **dsp_erp_dev / dsp_pms**
- Applied by: **bm** (via Phase 3a tool path; verified immediately)
- Git commit: **22f195b**
- Backup reference: **Not recorded** (gap — recommend ops snapshot before next env)
- Migration result: **PASS**
- UAT result: **PASS** (API)
- Approved for next environment: **YES, with limits**

### Limits / honest notes for the manager

1. Formal empty disposable rehearsal on an isolated schema was **not** cleanly proven first; a `DATABASE_SCHEMA` override bug applied B0 to shared `dsp_pms`. Post-verify showed correct objects and unchanged business counts (+1 HR workflow step only). Validator script was fixed.
2. No backup snapshot ID was recorded before apply.
3. Production-shaped disposable rehearsal still open if required by policy.
4. UAT was executed as **API smoke** with `leave.uat.*` (not browser/Playwright). Core Manager→HR path and matrix rules passed.
5. Foreign-company HR negative test was not separately automated in this smoke.

---

## What is live now on `dsp_erp_dev`

- Six B0 indexes present
- `GLOBAL:LEAVE_APPROVAL` = Reporting Manager → HR Manager
- Leave Policy Matrix + leave approval APIs behave per remediation
- Schema Prisma status: **up to date**
