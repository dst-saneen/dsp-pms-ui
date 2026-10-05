# Leave Policy Matrix Migration — Remaining Work (Easy Phase Plan)

| Field | Value |
|---|---|
| Based on | `leave-policy-matrix-migration-deployment-plan 1.md` (manager, 2026-08-13) |
| Repo check date | 2026-08-13 |
| Git HEAD checked | `22f195b` on `UI-SA-120826-2` |
| What manager means by “not finished” | **Database migration + ops proof + UAT**, not “build the matrix UI again” |
| Phase 1 status | **PASS** (2026-08-13) — see evidence below |
| Phase 2 status | **PASS** (2026-08-13) — see evidence below |
| Phase 3 status | **PARTIAL / INCIDENT** — empty rehearsal misfired onto `dsp_pms`; see below |
| Shared DB migration B0 | **APPLIED** on `dsp_erp_dev.dsp_pms` (2026-08-13) — verified OK |
| Phase 6 status | **PASS** (post-apply SQL verify) |
| Phase 7 status | **PASS** (2026-08-13) — see evidence below |
| Phase 8 status | **PASS** (2026-08-13 API smoke — 18/18) |
| Phase 9 status | **PASS** (closure pack written — see limits) |

---

## Phase 1 evidence — Freeze & baseline

| Item | Result |
|---|---|
| Date / time | 2026-08-13 11:13 +05:30 |
| Operator | `desktop-4sr7573\bm` |
| Branch | `UI-SA-120826-2` |
| Commit | `22f195b5538d5911da1b6e37b60aeb37de2fa05d` |
| Worktree | Clean of code changes; 2 untracked docs only: this remaining-phases MD + manager plan MD |
| Migration SQL SHA256 | `0AE90224F7CE604BA044B4A0B1CEC5335F74F7CB9A088053997C99A9D2B3BCB6` |
| `pnpm run prisma:validate` | **PASS** — schema valid |
| `pnpm run migration:leave-policy:preflight` | **PASS** — partial unique indexes, queue index, global HR step, idempotent guards |
| `pnpm run prisma:migrate:status` | Connected to PostgreSQL `dsp_erp_dev` / schema `dsp_pms` (RDS). **95** migrations found. **Only pending:** `20260811120000_leave_policy_matrix_and_manager_hr_approval` |
| Database write | **None** (status/validate/preflight only; no `migrate deploy`) |

**Exit criteria:** Met. Safe to proceed to **Phase 2** (read-only duplicate/workflow assessment). Do **not** run `migrate deploy` yet.

---

## Phase 2 evidence — Read-only target assessment

| Item | Result |
|---|---|
| Date / time (UTC) | 2026-08-13T05:52:46Z |
| Operator | `bm` |
| Script | `backend/scripts/leave-b0-phase2-readonly-assess.mjs` (SELECT only) |
| Raw JSON | `docs/product/leave-policy-matrix-migration-phase2-evidence.json` |
| Database | `dsp_erp_dev` |
| Schema / search_path | `dsp_pms` |
| Connected user | `dscape` (identity only; no password logged) |
| Duplicate policies (4 scopes) | **0 rows** each — PASS |
| Leave workflows found | 1: `GLOBAL:LEAVE_APPROVAL` (active, step `1:REPORTING_MANAGER` only) |
| Company Leave workflows | **None** |
| Customized Company workflows | **None** |
| Expected HR steps migration will add | **1** (global Step 2 `ROLE/HR_MANAGER`) |
| Existing leave workflow step IDs | `e0fe85da-4a8c-4b15-aef4-3b3ff0a63e1a` (step 1 only) |
| Baseline counts | policies **6**, requests **10**, balances **10**, approval_transactions **5**, approval_workflow_steps **3** |
| Leave request statuses | APPROVED 4, DRAFT 5, SUBMITTED 1 |
| Active HR-capable users (HR_MANAGER / COMPANY_ADMINISTRATOR / ORGANIZATION_OWNER) | **7** |
| Companies getting a new company HR step with no eligible HR | **None** (only global workflow changes) |
| Database write | **None** |

**Exit criteria:** Met. Safe to proceed to **Phase 3** (disposable rehearsal). Do **not** run `migrate deploy` on shared RDS yet.

**Note for UAT later:** After migrate, new leave requests using the global workflow will require an eligible scoped HR for Step 2. HR assignments already exist for at least two companies plus org owners.

---

## Phase 3 evidence — Disposable rehearsal (incident + verify)

### What we intended

Empty disposable rehearsal on an isolated schema (same RDS host, not touching `dsp_pms`), because no separate disposable database URL / Docker was available.

### What actually happened

1. Wrapper set `B0_VALIDATE_DATABASE_URL` and created schema `leave_b0_disposable_msr3wgap`.
2. `prisma migrate deploy` still used `DATABASE_SCHEMA=dsp_pms` from `.env` via `prisma.config.ts`, so **B0 was applied to shared `dsp_pms`**, not the disposable schema.
3. Disposable schema was dropped afterward (empty; unused).
4. Immediate post-check: migration history, 6 indexes, global HR step, and row counts all match expectations.

### Post-apply verification (PASS)

| Item | Result |
|---|---|
| Prisma migrate status | **Database schema is up to date!** |
| Migration history row | `20260811120000_leave_policy_matrix_and_manager_hr_approval` finished; not rolled back |
| Indexes under `dsp_pms` | **6 / 6** present |
| `GLOBAL:LEAVE_APPROVAL` | `1:REPORTING_MANAGER, 2:ROLE:HR_MANAGER` |
| Counts vs Phase 2 baseline | policies 6, requests 10, balances 10, approval_transactions 5 unchanged; workflow_steps **3 → 4** (+1 HR step) |
| Evidence JSON | `docs/product/leave-policy-matrix-migration-phase3-incident-verify.json` |

### Fix applied in repo

`backend/scripts/leave-b0-disposable-validate.mjs` now passes `DATABASE_SCHEMA=<disposable>` into `prisma migrate deploy` so this cannot recur.

### Still open for Phase 3

- **Phase 3b production-shaped disposable copy** — not run (needs separate disposable DB / snapshot).
- Treat shared apply as **done ahead of formal Phase 4/5** — continue with Phase 6-style sign-off, quality gates, and UAT. Tell the manager about the tool bug and that verify passed.

---

## Phase 7 evidence — Automated quality gates

| Gate | Result |
|---|---|
| Date | 2026-08-13 |
| Backend `prisma:validate` | **PASS** |
| Backend `lint:check` | **PASS** (fixed prettier / unused var / unsafe-any in specs first) |
| Backend `build` | **PASS** |
| Backend `test` | **PASS** — 73 suites, 439 tests |
| Historical focused workforce suite (now covered by `test`) | **PASS** — 20 suites, 148 tests |
| Backend `test:e2e` | **PASS** — 2 suites, 11 tests |
| Frontend `lint` | **PASS** (1 pre-existing warning in leave-type dialog) |
| Frontend `tsc --noEmit` | **PASS** |
| Frontend `build` | **PASS** |

**Exit criteria:** Met. Next is **Phase 8** signed Employee / Manager / HR UAT.

---

## Phase 8 — UAT readiness + API smoke

| Item | Result |
|---|---|
| Date (UTC) | 2026-08-13 |
| Engineering readiness | **PASS** |
| API smoke | **PASS** — 18 checks, 0 fail (`leave-policy-matrix-migration-phase8-api-smoke.json`) |
| Flow proven | Matrix zero-reject + save · Employee submit · Self-approve blocked · Manager approve → still SUBMITTED · Double approve blocked · HR final → APPROVED · Calendar loads |
| Sample request | `65e72e45-6a26-4a11-b1ec-a7b2893dc3ba` on `2026-09-08` |
| Accounts | `leave.uat.emp` · `leave.uat.mgr` · `leave.uat.hr` |
| UI browser sign-off | Optional follow-up (Playwright not in repo); API path covers manager plan H minimum |

---

## Plain English summary

| Area | Status |
|---|---|
| Leave Policy Matrix UI (frontend) | **Done** in code |
| Matrix / leave / approval APIs (backend) | **Done** in code |
| Migration SQL file in repo | **Done** |
| Migration applied on shared DB `dsp_erp_dev` | **Done** (2026-08-13; verified) |
| Disposable empty rehearsal (correct isolated schema) | **Not cleanly proven** (script bug; fixed afterward) |
| Production-shaped disposable rehearsal | **Not done** |
| Signed Employee / Manager / HR UAT | **PASS** (API smoke 2026-08-13; UI optional) |

**Bottom line:** Migration work order is **closed for shared dev** with limits documented in Phase 9. B0 applied + verified; gates PASS; API UAT PASS. Tell manager about the Phase 3 tool-bug incident, missing backup ID, and optional browser UAT / prod-shaped rehearsal.

---

## What is already done (do not rebuild)

These exist in the codebase today:

- Migration folder: `backend/prisma/migrations/20260811120000_leave_policy_matrix_and_manager_hr_approval/`
- Unique indexes + HR Step 2 workflow SQL (additive; does not rewrite leave history)
- Disposable apply/validator: `pnpm run migration:leave-policy:apply`
- Preflight: `pnpm run migration:leave-policy:preflight`
- Matrix UI: `frontend/features/leave-policy/components/leave-policy-matrix-workspace.tsx`
- Matrix API: `backend/src/modules/leave-policy/leave-policy-matrix.service.ts`
- Manager → HR approval behavior in leave/approval services
- UAT checklist docs under `docs/product/`

---

## Remaining work — phase by phase

### Phase 1 — Freeze & record baseline (no DB writes) ✅

**Goal:** Prove we know exactly what we will deploy.

1. Record branch, commit, operator name.
2. Confirm worktree is clean (or list unrelated files).
3. Hash the migration SQL file.
4. Run from `backend`:
   - `pnpm run prisma:validate`
   - `pnpm run migration:leave-policy:preflight`
   - `pnpm run prisma:migrate:status`
5. Confirm the **only** expected pending migration is  
   `20260811120000_leave_policy_matrix_and_manager_hr_approval`.

**Exit:** Baseline note saved. Schema validates. Preflight passes. No DB write. **Done 2026-08-13.**

**Stop if:** Extra unknown pending migrations appear.

---

### Phase 2 — Read-only check on target DB ✅

**Goal:** Make sure the shared DB is safe to migrate.

Target must be exactly: database `dsp_erp_dev`, schema `dsp_pms`.

1. Confirm DB identity (`current_database`, `search_path`).
2. Run the **four duplicate active policy** queries from  
   `docs/product/leave-next-phase-block-b0-dry-run.md`  
   → must return **zero rows**.
3. Inventory Leave approval workflows (global vs company; customized vs not).
4. Record baseline row counts (policies, requests, balances, approvals, steps).
5. Confirm each company that will get HR Step 2 has an eligible scoped HR user.

**Exit:** Identity OK. No duplicates. Workflow change list written. Counts saved. **Done 2026-08-13.**

**Stop if:** Any duplicate policy row exists, or wrong DB/schema.

---

### Phase 3 — Disposable rehearsal (practice deploy) ⚠️ PARTIAL

**Goal:** Prove the migration works twice on a throwaway DB (not shared RDS).

1. Empty disposable DB rehearsal:  
   `B0_VALIDATE_DATABASE_URL=... pnpm run migration:leave-policy:apply`
2. Production-shaped disposable copy rehearsal (real-ish leave data).
3. Capture evidence: indexes exist, HR steps added, second deploy idempotent, row counts stable, disposable cleaned up.

**Exit:** Both rehearsals pass.

**Stop if:** Either rehearsal fails. Do **not** set `B0_ALLOW_SHARED_DEV=1` for normal rehearsal.

**2026-08-13 outcome:** Attempted empty rehearsal on isolated schema; tool bug applied B0 to shared `dsp_pms` instead. Post-verify **PASS** (indexes, HR step, counts). Script fixed. Phase 3b still open. Shared migrate is already applied — do not re-run deploy.

---

### Phase 4 — Go / No-Go meeting

**Goal:** Explicit approval before touching shared `dsp_erp_dev`.

Bring:

- Phase 1–3 evidence
- Duplicate = zero
- HR approver coverage
- Backup owner + low-traffic window
- Compatible backend build ready

**Go only if** all of the above are true.  
**No-go if** duplicates, missing backup, wrong target, extra migrations, failed rehearsal, or no HR for sequential companies.

---

### Phase 5 — Backup + deploy (shared dev)

**Goal:** Apply the one migration safely.

1. Drain / pause mutation traffic if required.
2. Take RDS snapshot / logical backup; record ID + owner + time.
3. Final duplicate check + migrate status.
4. Deploy:
   - `pnpm run prisma:migrate:status`
   - `pnpm run prisma:migrate:deploy`
   - `pnpm run prisma:migrate:status` → expect up to date
5. Do **not** use `migrate resolve --applied` as a shortcut.

**Exit:** Prisma says schema is up to date. No partial failure.

**Stop if:** Wrong DB, other pending migration, lock timeout, duplicate-index failure.

---

### Phase 6 — SQL verification after deploy ✅

**Goal:** Prove objects and data match expectations.

1. `_prisma_migrations` has one successful finished row for this migration.
2. All **six** indexes exist under `dsp_pms`.
3. Global + uncustomized company workflows have Step 2 HR; customized unchanged.
4. Business counts: policies / requests / balances / transactions unchanged; workflow steps increased only by expected HR steps.

**Exit:** All four checks match the pre-calculated expectations. **Done 2026-08-13** (incident verify JSON).

---

### Phase 7 — Automated quality gates ✅

**Goal:** Code still builds and tests on the released stack.

From `backend`: validate, lint, build, unit/workforce/e2e tests.  
From `frontend`: lint, `tsc --noEmit`, build.

Use a **disposable** DB for any suite that writes data — never shared `dsp_erp_dev` for destructive fixtures.

**Exit:** All commands pass. **Done 2026-08-13.**

---

### Phase 8 — Functional UAT (Employee / Manager / HR) ✅

**Goal:** Signed smoke proof on non-prod data.

Use checklists:

- `docs/product/leave-next-phase-uat-checklist.md`
- `docs/product/leave-review-phase-h.md`
- **Run sheet:** `docs/product/leave-policy-matrix-migration-phase8-run-sheet.md`
- **API smoke evidence:** `docs/product/leave-policy-matrix-migration-phase8-api-smoke.json`

Minimum paths:

1. **Employee** — see own balances, draft, submit; cannot self-approve.
2. **Manager** — see team queue, approve once, advances to HR; conflict on double approve.
3. **HR** — see manager-approved item, approve once; foreign company/branch blocked.
4. **Matrix** — save entitlement, reject zero/negative, no duplicate on re-save, omit/replace behavior OK.
5. **Calendar** — holiday excluded; working-day override not a holiday; LEGACY branch still sees company holidays when mixed.

**Exit:** Signed PASS for personas + negative isolation tests.  
**2026-08-13:** API smoke **18/18 PASS** (request `65e72e45-6a26-4a11-b1ec-a7b2893dc3ba`). Browser UI sign-off optional.

---

### Phase 9 — Closure pack ✅

**Goal:** Fill the manager plan §15 table so the work order can close.

See **Phase 9 evidence** section above / `docs/product/leave-policy-matrix-migration-phase9-closure.md`.

---

## Suggested owners

| Phase | Owner |
|---|---|
| 1 Freeze | Engineering |
| 2 Read-only assess | Engineering + DBA |
| 3 Disposable rehearsal | Engineering |
| 4 Go/No-Go | Tech lead + HR/Product + Ops |
| 5 Deploy | Ops / Engineering (named operator) |
| 6 SQL verify | DBA / Engineering |
| 7 Quality gates | Engineering |
| 8 UAT | HR/Product + Engineering support |
| 9 Closure | Tech lead |

---

## Hard rules (always)

- Do **not** run `prisma migrate dev` / `reset` / cleanup SQL against AWS RDS.
- Do **not** apply to `dsp_erp_dev` before Phases 1–3 + Phase 4 Go.
- Do **not** auto-delete duplicate policies — business owner decides.
- Do **not** put DB passwords or employee leave data in evidence logs.
- Prefer forward app fix after a successful migrate; rollback only via reviewed restore path.

---

## One-line status for the manager

> Leave Policy Matrix + Manager→HR migration is **applied and verified** on `dsp_erp_dev.dsp_pms`. Automated gates PASS. API UAT PASS. Closure pack: `leave-policy-matrix-migration-phase9-closure.md` (includes incident/limits).
