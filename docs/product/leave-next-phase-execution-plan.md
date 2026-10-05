# Leave next phase — execution plan

**Source of truth:** `leave-next-phase-development-work-order.md` (APPROVED, v1.0, 2026-08-11)  
**Rule:** **Block A first. Block B only after Block A exit gate.**  
**Do not:** apply stashes, merge unrelated branches, edit applied migrations, hit AWS RDS / `dsp_erp_dev` with destructive tests.

---

## How to read this

The manager work order is two blocks:

```
Block A  Stabilize what we already shipped (security, calendar runtime, quality)
   ↓  exit gate (builds, lint, tests, no secrets)
Block B  Leave next phase (matrix, Manager→HR, calendars)
   ↓  UAT + controlled rollout
```

Leave UI/features from the boss discussion are **Block B**. They must not start while A1–A3 are open.

---

## Locked decisions (do not invent new rules)

| Topic | Locked meaning |
|-------|----------------|
| “Role-wise leave” | **Designation** (job), not RBAC role |
| Policy pick order | 1) Branch+Dept+Designation 2) Branch+Designation 3) Branch+Dept 4) Branch default |
| Approval | **Sequential:** Manager, then **HR is always required**. Skip Manager only if ineligible. Same person cannot do both steps. |
| Balances | Draft = no change. Submit = **reserve**. Manager approve = keep reserve. HR approve = **consume**. Reject/cancel before HR = **release**. |
| Holidays | **Business Calendar runtime** is source of truth. Leave must not interpret raw events. |
| Calendar privacy | Self = own details. Manager = team. HR/Admin = scoped. Colleagues = status only. |
| History | Never auto-recalculate approved leave |

---

## What is already in this repo (so we extend, not rebuild)

| Piece | Today | Work order still needs |
|-------|--------|------------------------|
| Leave types / policies / generate balances | Yes | Designation **matrix** UI + APIs; Branch+Designation resolver tier |
| Policy resolver | 3 tiers (default, dept, dept+designation) | Add **Branch+Designation**; scores 1–4 as specified |
| Apply leave + ledger reserve/consume | Yes | One transaction with Manager skip + HR resolve + audit/outbox as specified |
| Approve permission | `hr.leave.manage` only | Also allow **`hr.team.approve`** (any-permission), still check current step |
| Approval workflow | Exists; often 1-step / manager-or-HR | **2 sequential steps**; customized company workflows not auto-overwritten |
| Personal calendar | My Workspace month grid + leave name | Click-day drawer, list view, balance tab |
| HR calendar | Team month + day list | Employee selector + authorized personal calendar |
| Holidays | Leave → Holidays **and** Business Calendar | Point Leave at Business Calendar; legacy page only in LEGACY mode |
| UAT runner | Hardcoded passwords in `backend/scripts/uat-remaining-runner.mjs` | Env vars + `dsp_erp_uat` / `dsp_pms` guard |
| Employee shifts | Module exists | Tenant scope + 404 on foreign IDs |
| Calendar range for leave | Personal calendar holiday load was sped up | Leave **duration** must use **one range call**, not per-day preview |

---

# BLOCK A — Stabilize first

## Phase 0 — Read-only baseline (no code)

**Goal:** Prove we understand the current checkout before changing it.

1. Record branch + commit SHA in the release notes.
2. Read the other developer’s handoff; list what is done vs open.
3. Dry-inspect (no mutation): leave workflows (global vs company), pending leave, managers missing, duplicate policies.
4. Confirm no stash apply / merge is part of this order.

**Exit:** Short baseline note: commit, open blockers, “ready for A1”.

---

## Phase A1 — Security and tenant isolation

**Goal:** Close confirmed release blockers.

### A1.1 UAT credentials

- Remove the historical embedded runner and invitation password literals from
  `backend/scripts/uat-remaining-runner.mjs`.
- Use `UAT_RUNNER_PASSWORD`, `UAT_INVITE_PASSWORD`.
- Before any mutating UAT action: `current_database() = 'dsp_erp_uat'` and `current_schema() = 'dsp_pms'`; abort otherwise.
- Never log passwords/tokens. Credential rotation happens **outside** git.

### A1.2 Employee Shift scope

- Create / list / detail (and update/end if exposed) must use Company Group / Company / Branch scope.
- Employee visible in scope; Shift same company as Employee.
- Foreign IDs → **404**. No org context → empty list.
- Tests for group / company / branch separation.

### A1.3 Reporting-manager approve permission

- Leave / regularization / overtime approve: **`hr.leave.manage` OR `hr.team.approve`** (explicit any-permission).
- Service still checks: current step owner, no self-approval, tenant team, **409** on concurrent/repeat.

### A1.4 Role-admin audit

- Role catalog + assignment mutations: mutation + `securityVersion` + session revoke + **business audit** in **one transaction**.
- Redis invalidate **after** commit.
- Audit failure rolls back the role change.

**A1 exit:** No password literals in tracked source; shift cannot leak tenants; manager can approve with `hr.team.approve`; role changes audited.

---

## Phase A2 — Business Calendar runtime (for Leave)

**Goal:** Leave uses the **authoritative runtime**, not raw events / per-day preview loops.

- Company calendar = base; branch inherits + may override.
- Branch timezone owns the business date.
- Only **Holiday-type** events change working/non-working; info events display only.
- Modes: ACTIVE / SHADOW / LEGACY, **per office**, mixed tenants OK.
- **Range/batch resolver** for leave duration (one call per request, not a loop of `previewDay`).
- Cache only with invalidation on publish/correct.
- Tests listed in WO §4 (company-only, inherit, regional holiday, half-day, version boundary, timezone, modes, tenant, batch = preview).

**A2 exit:** Runtime tests pass; leave duration path does not N+1 preview.

---

## Phase A3 — Quality gate

- Fix stale leave test mocks / Prisma fixtures.
- Drop `toBeDefined`-only scaffold asserts.
- Default `npm test` includes source + foundation/security specs.
- Lint **0 errors / 0 warnings** on changed files.
- Frontend production build not broken by stale `.next` types.
- `git diff --check` clean; no generated/secret files in worktree.

**Commands:** WO §5 (backend prisma/lint/build/test; frontend lint/tsc/build; git check).

**Block A exit gate (must all be true):**

- Handoff reviewed and documented  
- A1 blockers closed  
- A2 tests pass  
- Backend + frontend build  
- Lint gate  
- Applicable automated tests pass  
- Clean worktree  

**Only then Block B.**

---

# BLOCK B — Leave next phase

## Phase B0 — Migration + workflow config (no product UI yet)

**Migration name:** `leave_policy_matrix_and_manager_hr_approval`  
**Schema:** `dsp_pms`  
**Strategy:** Additive. **No new tables/columns unless inspection proves a relation is missing.** Prefer constraints, indexes, workflow rows, safe backfill.

### Before SQL

Produce a **dry-run report** (read-only): duplicate policies, cross-company refs, workflows, pending approvals, HR/admin assignments, missing managers.

### Then

1. Partial unique indexes for active policies at the four nullable scopes.
2. Index for pending approvals (approver, status, step, company/branch, submittedAt).
3. Global workflow: Step 1 Reporting Manager, Step 2 HR.
4. Upgrade **uncustomized one-step company** workflows idempotently; **do not overwrite customized**; list those for owner review.
5. Do **not** rewrite existing approval transactions.

### Verify on disposable DBs only

- Empty DB + production-shaped snapshot.  
- Objects under `dsp_pms`.  
- No change to existing leave/balance rows.  
- Re-run does not duplicate steps/indexes.  
- Review generated SQL before any shared deploy.

---

## Phase B1 — Designation entitlement matrix

**Backend**

- Resolver scores: default=1, +dept=2, +designation=3, +dept+designation=4.
- `GET /leave-policies/matrix` — branch required; optional dept; snapshot token.
- `PUT /leave-policies/matrix` — max 1000 cells; tenant checks; stale → `409 STALE_POLICY_MATRIX`; serializable/advisory lock; one audit; **does not change existing balances**.
- Impact preview (read-only): who lacks a balance / whose entitlement differs.
- Generate missing balances remains a **separate** explicit action.

**Frontend (B1)**

- HR page: Branch (scoped) + optional Department.
- Rows = designations, columns = leave types, cell = on/off + days.
- Search, sticky headers, skeleton/empty/error, unsaved warning, Save + reason, stale reload.
- After save: “balances were **not** auto-updated” + impact summary.

---

## Phase B2 — Sequential Manager → HR

**Backend**

- Submit in **one transaction** (lock request → policy + calendar duration → balance → resolve Manager+HR → snapshot steps → skip ineligible manager → pending first step → reserve ledger → audit → outbox → commit). Failure = full rollback.
- Manager approve: complete Manager step, open HR, **keep reservation**.
- HR approve: consume reservation (used↑).
- Reject either step: release reservation.
- Same actor cannot be both steps. No self-approval. No HR → fail submit with `LEAVE_APPROVER_NOT_AVAILABLE`.
- HR fallback order: Branch HR → Company HR → Group HR → Company Admin → Org Owner. Super Admin is **not** auto HR.
- Queues: “My Approvals” = current actionable steps only. Manager = reportees. HR = HR steps in scope.
- Optional `approvalProgress` on leave detail (no internal IDs).
- Stable error codes from WO §10.7.

**Frontend (B2)**

- Views: Manager Review | HR Review | Completed by Me.
- Drawer: identity, type, dates, portion, business days, stage, previous step, balance before/after.
- Approve/Reject only if current approver. Reject comment required. Confirm on **final HR** approve.
- No fake disabled buttons for people who cannot act.

---

## Phase B3 — Employee personal leave calendar

- Own leave + status, holidays, working/non-working, existing shift/attendance overlays.
- Month + accessible list.
- **Click day → side panel** (type, half/full, status, holiday, balance for that type).
- **Balance tab** next to calendar (existing numbers, new placement).
- Link to existing Apply Leave.
- No colleague private data.

---

## Phase B4 — Authorized employee calendar (manager / HR / admin)

- `GET /workforce-calendar/employee-options` — self / reportees / scoped employees; foreign → 404.
- Selector + branch/dept filters that **narrow** only.
- Same calendar look as personal; privacy by role.
- Extend calendar payload optionally: `leaveTypeId/Name`, `leaveStatus`, `dayPortion`, `holidayName`, `approvalStage`. Never reason/attachments in colleague mode.

---

## Phase B5 — Holiday navigation

- Leave calendar / holiday views **link to Business Calendar**.
- No second editable holiday master in Leave.
- Old Leave → Holidays only while office is **LEGACY**; label source/mode.

---

## Phase T — Tests (required, not optional)

Run as each phase lands; full suite before rollout.

| Layer | Must cover |
|-------|------------|
| Policy/matrix | 4-level precedence, foreign IDs, duplicates, stale snapshot, concurrent save, no balance rewrite, audit rollback |
| Approvers | Manager then HR, skip manager, fallbacks, same-actor ban, self-ban, no-approver rollback, snapshot freeze |
| Transitions | Draft/submit/manager/HR/reject/cancel, 409 on double approve, ledger once, audit failure rollback |
| Calendar | Holidays, branch override, half-day duration, modes, range parity, no history rewrite |
| Security | Two groups, two companies, two branches, manager team, employee self |
| Disposable DB | WO §13 twelve scenarios — **never** AWS RDS / `dsp_erp_dev` |
| Browser | Matrix save, stale reload, submit, manager queue, HR queue, calendars, 1440/1024/768/390, a11y |

**Quality commands:** WO §15 (`test`, `test:e2e`, Playwright).

---

## Phase R — Rollout (after T)

Follow WO §16–17 exactly:

1. Backup evidence, review SQL, check HR assignments and customized workflows.  
2. Migrate → backend → smoke → frontend → enable ACTIVE only for **pilot offices**.  
3. Pilot: one branch matrix → generate **missing** balances only if asked → one leave → Manager then HR → calendars → UAT sign-off.  
4. Rollback: before two-step traffic, flags + SHADOW/LEGACY + code rollback. After traffic exists: **do not drop** workflow/ledger history; forward-fix.

---

# Suggested calendar (order of work)

| Week-style slice | Phase | Output |
|------------------|-------|--------|
| 1 | 0 + A1 | Baseline note + security/tenant/approve/audit |
| 2 | A2 + A3 | Calendar range for leave + quality gate green → **Block A closed** |
| 3 | B0 | Dry-run report + migration on disposable DBs |
| 4 | B1 | Matrix API + HR matrix page |
| 5 | B2 | Two-step submit/approve + Manager/HR queues |
| 6 | B3 + B4 + B5 | Personal click-day + employee selector calendar + holiday links |
| 7 | T + R | Full gates, pilot UAT, closure pack |

Adjust dates; **do not reorder Block A after Block B.**

---

# What we will not do (WO out of scope)

Payroll, country-specific entitlements, sandwich leave, auto salary/leave cut for late, new approval engine, government holiday provider, optional holidays, delegation/escalation, leave emails, unrelated UI redesign.

---

# Closure checklist (WO §18)

Work is not “done” until the release record has: baseline/handoff, A1 evidence, migration SQL + two disposable applies, automated tests, two-tenant security, browser/a11y, ACTIVE/SHADOW compare, Manager/HR/Employee UAT, backup + rollback notes, known limits, technical closure.

Completion = **release-candidate eligible**. It is **not** full ERP production certification.

---

# Start command

When you say **start**, begin **Phase 0** (record commit + handoff review), then **A1.1** (UAT passwords + DB guard). Do not open matrix/approval UI until Block A exit gate is green.
