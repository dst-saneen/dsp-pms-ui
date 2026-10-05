# Project Lite Phase 0 — Containment record

**Recorded:** 2026-08-21  
**Database:** `dsp_erp_dev` / schema `dsp_pms` (shared AWS RDS)  
**Action taken:** read-only `prisma migrate status` only — **no migrate deploy**

## Feature flag

| Setting | Value |
|---------|--------|
| `PROJECTS_LITE_ENABLED` | `false` |
| `PROJECTS_LITE_COMPANY_IDS` | empty (no pilot companies) |
| Code default (`environment.ts`) | `false` |
| `.env.example` | `false` |

Restart the backend after changing `.env` so the gate reloads.

## Migration ledger (read-only)

Last common migration with DB:

- `20260820170000_delivery_p0_p1_hardening`

**Pending locally (Project Lite — do not apply to shared DB yet):**

1. `20260820170500_projects_lite_permissions`
2. `20260820180000_project_lite_expand`
3. `20260820181000_project_lite_reconcile`
4. `20260820182000_project_lite_contract`
5. `20260821120000_project_lite_file_session_binding`

**Present on shared DB but missing from this local checkout** (Office Finance / ERP Lite — owned elsewhere):

- `20260821120000_erp_lite_shared_foundation`
- `20260821130000_office_finance_lite_expand`
- `20260821131000_office_finance_lite_reconcile`
- `20260821132000_office_finance_lite_contract`
- `20260821140000_payroll_lite_expand`
- `20260821141000_payroll_lite_reconcile`
- `20260821142000_payroll_lite_contract`
- `20260821150000_erp_lite_contract_hardening`

**Implication:** Project migration timestamps collide with Office Finance history on the shared DB (`20260821120000_*`). Phase 1+ must use a **new corrective migration after the full shared chain is reconciled** (pull Office Finance migrations into this branch or rename Project Lite folders so they sort after `20260821150000_erp_lite_contract_hardening`). Do not `migrate deploy` Project Lite onto shared RDS until that ordering is fixed and Phase 1 receipt/scope fixes exist.

## API traffic

With `PROJECTS_LITE_ENABLED=false`, `ProjectsLiteEnabledGuard` blocks canonical and scaffolding Project routes. No Project Lite API traffic should be enabled for any Company until remediation Phase 8 sign-off.

## Phase 0 exit

- [x] Feature disabled everywhere in local `.env`
- [x] Allowlist empty
- [x] Migration status recorded; no shared apply
- [x] Divergence with Office Finance migrations noted for Phase 1 planning
