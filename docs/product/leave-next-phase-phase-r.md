# Phase R — Rollout pack (WO §16–17)

Recorded: 2026-08-11  
Branch: `UI-SA-100826`  
HEAD at pack time: `30c5966ecc9b8a58df6525e33c6b22917af8a02a` (`business calendar complete`)  
Working tree: **uncommitted** Block A–T leave work (not on origin yet)  
Work order: `leave-next-phase-development-work-order.md` v1.0

> This pack is the Phase R deliverable. Cutover is an **ops execution** of these steps with backup evidence.  
> This session did **not** run `prisma migrate deploy`, did **not** query AWS RDS / `dsp_erp_dev`, and did **not** flip any office to `ACTIVE`.

**Suggested pilot (same as Business Calendar Stage 10):** COM-000002 / BR-000002 Kowdiar (`Asia/Kolkata`). Replace if HR names a different office.

| Field | Value |
|-------|--------|
| Approved deploy SHA | __________ (commit the A–T working tree first) |
| Target database | __________ (`dsp_pms` schema). **Never** `dsp_erp_dev` unless it is explicitly the disposable/UAT name in the release record |
| Backup / snapshot ID | __________ |
| Pilot company / branch | __________ / __________ |
| On-call / HR | __________ |

---

## 0. Preconditions (must all be true)

- [ ] Block A baseline: `leave-next-phase-block-a-baseline.md`
- [ ] B0 SQL reviewed: `leave-next-phase-block-b0-dry-run.md` + this pack §1
- [ ] Phase T evidence: `leave-next-phase-phase-t.md` (unit gates green)
- [ ] Duplicate-policy queries **empty** on the **target** (B0 § Queries)
- [ ] Customized `LEAVE_APPROVAL` workflows listed for owner review
- [ ] Pilot branch has at least one eligible HR fallback (this pack §2)
- [ ] Database backup evidence attached
- [ ] B0 applied **twice** on disposable DBs (empty + snapshot) — still **open** (see §8)

Do **not** start §3 until the duplicate queries are empty and backup ID is filled.

---

## 1. SQL review (B0 migration)

File: `backend/prisma/migrations/20260811120000_leave_policy_matrix_and_manager_hr_approval/migration.sql`

| Check | Finding |
|-------|---------|
| New tables / columns | **None** |
| Row rewrites | **None** on `leave_policies`, `leave_requests`, `employee_leave_balances`, `approval_transactions` |
| Idempotent | `IF NOT EXISTS` indexes; `NOT EXISTS` before inserting step 2 |
| Partial unique indexes | Four active-policy scopes. Prisma schema cannot express `WHERE` partial uniques; they live in this SQL only |
| Workflow upgrade | Global `GLOBAL:LEAVE_APPROVAL` + **uncustomized** company copies (exactly one `REPORTING_MANAGER` step) get step 2 `ROLE` / `HR_MANAGER` |
| Customized company workflows | **Not** updated. List them with the B0 customized query and send to the owner |
| In-flight approvals | **Not** rewritten. One-step transactions stay one-step until they complete |
| Failure mode | `CREATE UNIQUE INDEX` **fails** if duplicate active policies exist at a scope |

Application submit (B2) already snapshots Manager then HR even if the template is still one-step. The migration is still required for uniqueness + template consistency + queue indexes.

**Apply rules** (unchanged from B0):

1. Review this SQL.  
2. Apply only on empty or snapshot **disposable** DBs with schema `dsp_pms`, then on the named UAT/pilot target after backup.  
3. Confirm objects land in `dsp_pms`.  
4. Re-run must not duplicate steps/indexes.  
5. Row counts on policies / requests / balances / transactions unchanged (workflow **steps** may increase by +1 on uncustomized leave workflows only).  
6. **Do not** `migrate deploy` to shared `dsp_erp_dev`.

---

## 2. HR assignments and customized workflows (read-only on target)

Run on the **named target** after backup, or on disposable/UAT. Do **not** run against `dsp_erp_dev` from this workspace.

### 2.1 Customized company workflows (owner review — not auto-upgraded)

Same query as B0 dry-run (`COMPANY:%:LEAVE_APPROVAL` with anything other than a single Reporting Manager step). Record `scopeKey` / `companyId` here:

| scopeKey | companyId | Owner decision |
|----------|-----------|----------------|
| | | leave as-is / manual step-2 / other |

### 2.2 Eligible HR for the pilot branch

Submit fails with `LEAVE_APPROVER_NOT_AVAILABLE` if none of these exist (and Super Admin is **never** used):

1. `HR_MANAGER` assigned to the **branch**  
2. `HR_MANAGER` assigned to the **company** (`branchId` null)  
3. `HR_MANAGER` assigned to the **company group**  
4. `COMPANY_ADMINISTRATOR` on the company  
5. `ORGANIZATION_OWNER` on the group (or company if no group)

```sql
-- Replace :companyId :branchId :companyGroupId
SELECT r.code, ura."branchId", ura."companyId", ura."companyGroupId",
       u."employeeId", e."firstName", e."lastName"
FROM "user_role_assignments" ura
JOIN "roles" r ON r."id" = ura."roleId"
JOIN "users" u ON u."id" = ura."userId"
LEFT JOIN "employees" e ON e."id" = u."employeeId"
WHERE ura."isActive"
  AND r."isActive"
  AND r.code IN (
    'HR_MANAGER',
    'COMPANY_ADMINISTRATOR',
    'ORGANIZATION_OWNER'
  )
  AND (
    (r.code = 'HR_MANAGER' AND ura."branchId" = :branchId)
    OR (r.code = 'HR_MANAGER' AND ura."companyId" = :companyId AND ura."branchId" IS NULL)
    OR (r.code = 'HR_MANAGER' AND ura."companyGroupId" = :companyGroupId)
    OR (r.code = 'COMPANY_ADMINISTRATOR' AND ura."companyId" = :companyId)
    OR (r.code = 'ORGANIZATION_OWNER' AND ura."companyGroupId" = :companyGroupId)
  )
ORDER BY r.code, ura."branchId" NULLS LAST;
```

Expect **at least one** row whose `employeeId` is not the pilot test employee. `SUPER_ADMINISTRATOR` must not appear.

### 2.3 In-flight one-step leave (informational)

```sql
SELECT COUNT(*) AS in_flight_one_step
FROM "approval_transactions" t
JOIN "leave_requests" lr ON lr."approvalTransactionId" = t."id"
WHERE lr."status" IN ('SUBMITTED', 'PENDING')
  AND (SELECT COUNT(*) FROM "approval_transaction_steps" s WHERE s."transactionId" = t."id") = 1;
```

These complete as one-step. New submits after backend deploy become two-step.

---

## 3. Deploy order (named target only)

Commit SHA first. Then:

1. **Backup** — attach snapshot ID above.  
2. **Duplicate + customized + HR queries** — §2 and B0. Stop if unique-index queries are non-empty.  
3. **Migrate** (additive):

```powershell
cd backend
pnpm exec prisma migrate status
pnpm exec prisma migrate deploy
pnpm exec prisma migrate status
```

Confirm `20260811120000_leave_policy_matrix_and_manager_hr_approval` is applied and schema is `dsp_pms`.

4. **Backend** deploy (this working tree).  
5. **Smoke API** (pilot tenant token): health, `GET /leave-policies/matrix?branchId=…`, `GET /workforce-calendar/employee-options`, `GET /holidays/source`.  
6. **Frontend** deploy.  
7. **Business Calendar `ACTIVE`** — only for **pilot offices**, and only if Stage 10 SHADOW parity already passed. Do **not** auto-ACTIVE from this deploy. Leave duration uses Runtime only when the office is `ACTIVE`; otherwise LEGACY holidays.

```http
POST /business-calendar/runtime/mode
{ "companyId": "…", "branchId": "…", "mode": "ACTIVE" }
```

Requires `LEGACY → SHADOW → ACTIVE`. Rollback that office with `LEGACY` / `SHADOW` (Stage 10 runbook).

---

## 4. Pilot UAT (one branch)

Checklist form: `leave-next-phase-uat-checklist.md`

Order:

1. Open **Leave → Policies** (matrix). Select the **pilot branch**. Save dirty cells only; confirm “balances were not auto-updated”.  
2. Stale save: second tab, save, first tab save → `409 STALE_POLICY_MATRIX`, reload.  
3. Generate **missing** balances **only if asked**. Dry-run first:

```http
POST /employee-leave-balances/generate
{ "year": 2026, "branchId": "<pilot>", "dryRun": true }
```

Then the same body without `dryRun`. Existing used/pending rows are **retained**; nothing is rewritten.  
4. Employee: draft → submit one leave (full day). Reservation moves to pending.  
5. **Leave → Requests → Manager review**: manager approve. Reservation **stays**. Stage → HR.  
6. **HR review**: HR approve (confirm final). Reservation **consumed**.  
7. Repeat once for reject (release) and once for half-day `0.5`.  
8. Calendars: My Workspace click-day + balances tab; authorized employee selector (foreign id → 404); holidays banner + Business Calendar link.  
9. Viewports 1440 / 1024 / 768 / 390.  
10. Sign the UAT checklist (Manager + HR + Employee).

UAT runner (`backend/scripts/uat-remaining-runner.mjs`) mutates **only** `dsp_erp_uat` / `dsp_pms` (`current_database()` / `current_schema()` guard). Passwords from `UAT_RUNNER_PASSWORD` / `UAT_INVITE_PASSWORD`.

---

## 5. Rollback (WO §17)

### Before two-step traffic (no new Manager→HR transactions)

1. Do not deploy frontend, or hide Leave matrix / new queues via permissions if already deployed.  
2. Roll backend to the previous release.  
3. Office calendar: `POST /business-calendar/runtime/mode` → `SHADOW` or `LEGACY` (never drop Runtime tables).  
4. B0 objects are additive. Leaving indexes in place is safe. **Do not** delete inserted workflow step 2 if any environment already created two-step snapshots.  
5. Restore from backup **only** if migrate deploy corrupted the catalog.

### After two-step traffic exists

1. **Do not drop** `approval_workflow_steps`, `approval_transaction_steps`, ledger, or outbox history.  
2. **Do not** rewrite approved leave calendar days.  
3. Forward-fix in code. Hide UI if needed (`hr.leave.*` / `hr.team.approve`).  
4. Keep legacy `holidays` until offices are off LEGACY (B5).

---

## 6. Smoke after deploy

| # | Check | Pass? |
|---|--------|-------|
| S1 | `migrate status` shows B0 applied on the named target | |
| S2 | Matrix GET/PUT for pilot branch; foreign branch 404 | |
| S3 | New submit creates Manager + HR steps; no HR → `LEAVE_APPROVER_NOT_AVAILABLE` | |
| S4 | Manager approve does not consume; HR approve consumes once | |
| S5 | In-flight one-step still completable | |
| S6 | Personal calendar click-day; employee-options 404 on foreign id | |
| S7 | `GET /holidays/source` labels LEGACY vs BUSINESS_CALENDAR; CRUD blocked off LEGACY | |
| S8 | ACTIVE office (if enabled): duration uses one range consumer call, not `holidays` | |

---

## 7. Known limits (WO out of scope)

Payroll, country-specific entitlements, sandwich leave, auto salary/leave cut, new approval engine, government holiday provider, optional holidays, delegation/escalation, leave emails, unrelated UI redesign.

Also not claimed in this pack:

- Playwright / browser CI (none in repo)  
- `test:e2e` (`backend/test/jest-e2e.json` missing)  
- Disposable WO §13 twelve scenarios (no disposable DB in this session)  
- Full ERP production certification

---

## 8. Closure checklist (WO §18)

| Item | Status |
|------|--------|
| Baseline / handoff | `leave-next-phase-block-a-baseline.md` |
| A1 evidence | Implemented on this branch (UAT env+DB guard, employee-shift 404, `RequireAnyPermissions`, role/user audit) |
| Migration SQL | Reviewed in B0 + §1. **Unapplied** on shared RDS |
| Two disposable applies | **Open** — blocked on disposable DB |
| Automated tests | Phase T: workforce 121, foundation 152, lints clean |
| Two-tenant security | Unit/scope specs; live two-tenant UAT still on checklist |
| Browser / a11y | Checklist only — no Playwright |
| ACTIVE / SHADOW compare | Use Stage 10 compare; do not skip SHADOW |
| Manager / HR / Employee UAT | `leave-next-phase-uat-checklist.md` — unsigned |
| Backup + rollback | Rollback written (§5). Backup ID **pending ops** |
| Known limits | §7 |
| Technical closure | **Release-candidate eligible after** disposable applies + backup + signed UAT. **Not** production certification |

---

## What this session did not do

- `prisma migrate deploy`  
- Any query or write to AWS RDS / `dsp_erp_dev`  
- Generate leave balances  
- `POST /business-calendar/runtime/mode`  
- Commit or push
