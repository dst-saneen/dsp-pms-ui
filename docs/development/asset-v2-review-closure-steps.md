# Asset V2 — Step-by-step closure guide

Simple execution checklist from the manager review:

- **Source review:** [`asset-latest-code-review-and-db-completion-plan.md`](./asset-latest-code-review-and-db-completion-plan.md)
- **Full design:** [`asset-management-db-api-implementation-plan.md`](./asset-management-db-api-implementation-plan.md)
- **Earlier build guide:** [`asset-management-v2-execution-plan.md`](./asset-management-v2-execution-plan.md)

**Current verdict:** implemented foundation exists, **not production-ready**.

**Do the steps in order.** Do not run contract migrations until Step 6 is green.

---

## Quick map — what is blocking what

| Blocker | Why it matters | Step |
|---|---|---|
| Licence duplicate retry eats extra seat | Pool counts can lie | Step 1 |
| Clearance missing department scope | Custodian can see other dept data | Step 2 |
| Physical assign retry not idempotent | Onboarding/import can fail on retry | Step 3 |
| Command receipt replay incomplete | Retry may return wrong data | Step 4 |
| Waiver UI/API mismatch | Approve/reject can send wrong versions | Step 5 |
| Transfer scope/actions incomplete | Destination dept cannot act | Step 6 |
| Lint + lockfile dirty | CI / clean install fails | Step 7 |
| 33 DB preflight exceptions | Contract migration will fail | Step 8–9 |
| Pending migrations not applied | DB still in “expanded”, not “enforced” | Step 10–11 |

---

## Step 0 — Confirm baseline (30 min)

**Goal:** Know where you stand before changing anything.

**Do:**

1. Pull latest code.
2. In `backend`:
   - `pnpm install`
   - `pnpm prisma:generate`
   - `pnpm run build` (or `start:dev` compiles with 0 errors)
3. Run focused asset tests:
   - `pnpm test -- asset` (or the repo’s asset test command)
4. Note current state:
   - 97 asset tests passing, 2 skipped (per review)
   - 2 migrations **pending** on dev DB:
     - `20260817160000_asset_v2_contract_enforce`
     - `20260818170000_asset_source_command_unique`
   - Asset preflight = **33 exceptions** (20 types, 12 assets, 1 custody)

**Done when:** You can start backend locally and you have the preflight exception list exported.

**Do not:** Apply contract migration yet.

---

## Step 1 — P0: Fix licence duplicate-source seat bug

**Goal:** Same `(companyId, sourceCommandKey)` retry must never consume two seats.

**Files:**

- `backend/src/modules/asset-domain/license-allocation.service.ts`

**Problem today:**

1. Code increments `allocatedSeatCount` first.
2. Insert uses `ON CONFLICT DO NOTHING`.
3. On conflict it returns existing allocation but **does not undo** the increment.

**Fix (pick one pattern and stick to it):**

- **Option A:** Claim source idempotency key **before** changing pool capacity.
- **Option B:** Insert allocation first with deterministic source receipt; increment seats **only if a new row was created**.

**Lock order (must be consistent):**

```text
command receipt / source claim → Asset → licence detail → allocation
```

**Replay rules:**

- Same key + same hash → return original allocation; **no** version bump, audit, or outbox.
- Same key + different hash → `ASSET_SOURCE_COMMAND_CONFLICT`.

**Verify:**

1. Add integrity SQL (see Step 12).
2. Add real PostgreSQL **two-connection** test: two txs, same source key → one allocation, one seat used.
3. Re-run licence allocation tests.

**Done when:** Concurrency test passes and counter always equals active allocations.

---

## Step 2 — P0: Fix department record scope on clearance / waiver

**Goal:** Department custodian only sees clearance for departments they are granted.

**Files:**

- `backend/src/modules/asset-domain/asset-clearance.service.ts`
- Shared scope builder (create or reuse one for all asset reads/commands)

**Problem today:**

- `clearanceItemScopeWhere()` filters company/branch only.
- Does **not** intersect `department_asset_grants`.

**Fix:**

1. Build **one** record-scope helper used by:
   - inventory, custody, transfer, request, clearance, waiver
2. For department-scoped actors:
   - require active grant on asset’s owning department
3. For central asset roles:
   - keep wider company/branch scope
4. Apply same predicate to:
   - list, detail, mutation preflight, notification deep link, direct ID lookup
5. Out-of-scope ID → safe **404** (not 403)

**Verify:**

- Integration test: custodian Dept A cannot read Dept B clearance by direct ID or list filter.
- Waiver approve/reject blocked cross-department.

**Done when:** Cross-department direct-ID and list tests pass.

---

## Step 3 — P1: Fix physical custody source retry idempotency

**Goal:** Retry of same source command returns existing assignment, not `ASSET_ALREADY_ASSIGNED`.

**Files:**

- Physical assignment / `assignWithinTransaction` path in asset-domain

**Fix:**

1. Claim/replay source command **before** changing asset custody state.
2. Same key + same hash → return existing assignment.
3. Same key + different hash → `ASSET_SOURCE_COMMAND_CONFLICT`.
4. No duplicate audit/outbox on replay.

**Verify:**

- Two-connection test with identical source key on physical assign.
- Replay returns same assignment ID and versions unchanged.

**Done when:** Retry test passes.

---

## Step 4 — P1: Fix command receipt original-response replay

**Goal:** Idempotent retry returns the **same safe response**, not reloaded mutated entity.

**Files:**

- Command receipt storage + replay handler in asset-domain

**Fix:**

1. Store full **safe** response snapshot per command contract.
2. On replay:
   - revalidate actor permission + record scope
   - return stored snapshot (not live reload)
3. Never store: card secrets, vault refs, private reasons, sensitive evidence.
4. Require client `operationId` on every public mutation (no silent auto-generate for retry-safe commands).

**Verify:**

- Mutate entity after first command → replay still returns original snapshot.
- Unauthorized actor cannot replay another user’s receipt.

**Done when:** Replay integration tests pass.

---

## Step 5 — P1: Align waiver API + frontend contract

**Goal:** Waiver approve/reject/cancel always send correct versions.

**Backend:**

- Define one authoritative `AssetClearanceWaiverResponse`.
- Include exact versions:
  - waiver
  - clearance item
  - employee asset **or** licence allocation
  - asset
- Return typed `allowedActions`.

**Frontend:**

- `frontend/features/asset/components/asset-waiver-workspace.tsx`
- `frontend/features/asset/services/asset-service.ts`

**Fix:**

1. Stop expecting nested `employeeAsset` / `licenseAllocation` if API is flat (or change API to match — pick one).
2. Render buttons **only** from `allowedActions`, not from `status === 'REQUESTED'`.

**Verify:**

- Approve/reject/cancel sends all required `expected*Version` fields.
- UI hides actions when server omits them from `allowedActions`.

**Done when:** Waiver flow works end-to-end against real API.

---

## Step 6 — P1: Fix transfer visibility and actions

**Goal:** Destination department custodians can see and act on inbound transfers.

**Backend:**

- Transfer list/detail scope: source dept **or** destination dept (by action).
- Return actor-specific `allowedActions`.
- Require transfer version + asset version on mutations.
- Block cross-branch transfer while physical custody is active.
- Notify destination department grant recipients.

**Frontend:**

- `frontend/features/asset/components/asset-transfer-workspace.tsx`

**Fix:**

1. Stop rendering Accept/Reject/Cancel/Force from `PENDING` status alone.
2. Use server `allowedActions`.
3. Show source and destination queues separately if needed.

**Verify:**

- Destination custodian sees pending inbound transfer.
- Source custodian can cancel; destination can accept/reject.
- Cross-branch with active custody blocked.

**Done when:** Transfer persona tests pass for source and destination custodians.

---

## Step 7 — Repo hygiene (lint + lockfile)

**Goal:** Clean install and lint pass.

**Do:**

1. In `backend`:
   - fix real lint issues (unsafe return, unused symbols, etc.)
   - run repo formatter for mechanical fixes
2. Regenerate lockfile:
   - `pnpm install` in `backend`
   - commit updated `pnpm-lock.yaml` (when user asks to commit)
3. Verify frozen install from clean checkout:
   - `pnpm install --frozen-lockfile`

**Known issue:** `@aws-sdk/client-s3` in `package.json` but missing from lockfile graph.

**Done when:** lint + build + frozen install all green.

---

## Step 8 — Business data mapping (blocks DB migration)

**Goal:** Resolve all **33 preflight exceptions** with explicit business approval.

**You need manager/HR/asset owner input.** Do not guess from names.

### 8a. Export preflight report

Run the asset V2 preflight command/report (same one review used). Save output.

### 8b. Create mapping spreadsheets

**Asset types (20 rows)** — one row per type:

```text
assetTypeId | companyId | approvedKind | approvedTrackingMode | approvedBy | evidenceReference
```

Allowed pairs:

| Kind | Tracking mode |
|---|---|
| GENERAL | LOCATION or INDIVIDUAL |
| HARDWARE | INDIVIDUAL |
| CARD | INDIVIDUAL |
| SOFTWARE_LICENSE | POOL |

**Assets (12 rows)** — one row per asset:

```text
assetId | companyId | owningDepartmentId | derivedBranchId | approvedBy | evidenceReference
```

Rules:

- Department must belong to asset company.
- `branchId` derived from department.
- Hardware → serial required.
- Location-tracked → location required.
- Card → exactly one protected card-detail row.
- Software pool → one licence-detail row + positive seat capacity.
- Inactive rows → authoritative `archivedAt`.
- Unknown legacy statuses → stop and escalate.

**Custody (1 row)** — reconcile the one `CUSTODY_SNAPSHOT_MISSING` row:

```text
employeeAssetId | companyId | branchIdAtAssignment | departmentIdAtAssignment | custodyStatus | closedAt | actor evidence
```

Use **assignment-time** org evidence, not employee’s current department if they moved.

**Done when:** Mapping artifact is signed off by business owner.

---

## Step 9 — Controlled backfill (dev/staging first)

**Goal:** Write approved mappings into DB before contract enforce.

**Do:**

1. Run backfill in a controlled transaction or audited admin command.
2. Populate:
   - type `kind` + `trackingMode`
   - asset `departmentId`, `branchId`, `kind`, `trackingMode`
   - subtype rows (card detail, licence detail, serial, location)
   - custody snapshot columns on `employee_assets`
   - archive evidence where needed
3. Re-run preflight.

**Done when:** Preflight returns **0 exceptions**.

**Do not:** Run contract migration while preflight > 0.

---

## Step 10 — Rehearse migrations on disposable DB copy

**Goal:** Prove migration chain safe on production-shaped data.

**Do:**

1. Backup `dsp_erp_dev` (or staging).
2. Restore to disposable database.
3. Run full ordered migration chain including:
   - `20260817160000_asset_v2_contract_enforce`
   - `20260818170000_asset_source_command_unique`
4. Do **not** manually mark migrations resolved.

**If rehearsal fails:** fix data or migration, re-run from backup.

**Done when:** Rehearsal completes with zero errors.

---

## Step 11 — Apply migrations on target environment

**Goal:** Move DB from “expanded compatibility” to “enforced V2”.

**Order:**

1. Apply `20260817160000_asset_v2_contract_enforce` (only after Step 9 = 0 preflight).
2. Apply `20260818170000_asset_source_command_unique`.
3. Run post-migration integrity SQL (Step 12).

**Also add** (new reviewed migration if not already present):

- acknowledgement pair checks on `employee_assets` and `software_license_allocations`
- close/revoke date checks
- source-shape checks (MANUAL vs ONBOARDING_TASK vs IMPORT)

See section 5.3 in the source review doc for exact SQL.

**Done when:** Both migrations applied and integrity queries return zero rows.

---

## Step 12 — Post-migration verification SQL

Run these after migrations:

### Licence counter integrity (must return 0 rows)

```sql
SELECT d."assetId", d."seatCapacity", d."allocatedSeatCount",
       count(a.id) FILTER (WHERE a.status = 'ACTIVE') AS actual_active
FROM "asset_software_license_details" d
LEFT JOIN "software_license_allocations" a ON a."assetId" = d."assetId"
GROUP BY d."assetId", d."seatCapacity", d."allocatedSeatCount"
HAVING d."allocatedSeatCount" <> count(a.id) FILTER (WHERE a.status = 'ACTIVE')
    OR d."allocatedSeatCount" > d."seatCapacity";
```

### Other checks

- no open duplicate physical custody
- clearance summary cannot be cleared while live custody exists
- source-command unique indexes exist

**Done when:** All checks pass.

---

## Step 13 — Align Prisma with enforced DB

**Goal:** Prisma schema matches DB nullability after contract enforce.

**Make required in Prisma (when DB enforces NOT NULL):**

- `Asset.branchId`, `departmentId`, `kind`, `trackingMode`
- `EmployeeAsset.companyId`, `branchIdAtAssignment`, `departmentIdAtAssignment`, `custodyStatus`

**Do:**

1. Update `backend/prisma/schema.prisma`
2. `pnpm prisma:generate`
3. Fix any TypeScript fallout
4. Keep raw SQL triggers/indexes in migrations + verification tests

**Done when:** Generate + build pass with aligned schema.

---

## Step 14 — Frontend completion pass

**Goal:** UI follows server contract everywhere.

**Checklist:**

- [ ] All mutation buttons from `allowedActions` only
- [ ] Waiver versions fixed (Step 5)
- [ ] Transfer source/destination queues (Step 6)
- [ ] Employee selectors = server eligible list only
- [ ] Version conflict → preserve input, refetch, show new state
- [ ] No optimistic custody/allocation/transfer state
- [ ] Denied / empty / error states on all asset pages
- [ ] No card numbers or licence secrets in URL, localStorage, or logs

**Done when:** Manual smoke + e2e pass on real API/DB.

---

## Step 15 — Tests and evidence (required for sign-off)

### 15a. Real PostgreSQL concurrency tests

- [ ] identical source allocation (two connections)
- [ ] conflicting source allocation
- [ ] last-seat race
- [ ] allocate vs resize/revoke
- [ ] physical assign retry
- [ ] assign vs transfer race
- [ ] grant revoke vs command
- [ ] clearance vs separation completion

### 15b. API authorization personas

Test each persona against direct ID + list:

- [ ] central asset manager
- [ ] department custodian (own dept)
- [ ] department custodian (other dept) → 404
- [ ] HR read-only
- [ ] employee self-service
- [ ] another branch → 404
- [ ] another company → 404

### 15c. Browser / e2e

- [ ] inventory CRUD + archive
- [ ] physical assign / ack / return / lost
- [ ] licence allocate / ack / revoke / resize
- [ ] transfers (source + destination)
- [ ] custody requests
- [ ] clearance + waiver maker-checker
- [ ] denied deep links
- [ ] version conflict refresh

**Done when:** Tests run against real PostgreSQL, not mocks only.

---

## Step 16 — Production acceptance (final gate)

All must be true before enabling wider rollout:

- [ ] Step 1 — licence retry cannot double-count seat
- [ ] Step 3 — physical retry returns same custody
- [ ] Step 2 — department scope enforced everywhere
- [ ] Step 8–9 — 0 preflight exceptions
- [ ] Step 10–11 — contract + source-command migrations applied
- [ ] Step 13 — Prisma aligned
- [ ] Step 12 — licence counters match active allocations
- [ ] No duplicate open physical custody
- [ ] Clearance cannot bypass live custody
- [ ] UI driven by `allowedActions` only
- [ ] Lint, type-check, build, frozen install pass
- [ ] Concurrency + persona tests pass
- [ ] Backup/restore rehearsal + UAT sign-off

Only then expand `ASSET_V2_SCOPE_ALLOWLIST_JSON` beyond pilot companies.

---

## Suggested weekly plan (if doing solo)

| Week | Focus |
|---|---|
| Week 1 | Steps 0–2 (P0 code: licence + clearance scope) |
| Week 2 | Steps 3–7 (P1 code + repo hygiene) |
| Week 3 | Steps 8–9 (business mapping + backfill) — **needs business input** |
| Week 4 | Steps 10–13 (migration rehearsal + apply + Prisma) |
| Week 5 | Steps 14–16 (frontend, tests, sign-off) |

---

## What you can skip for now

If you only need **local dev / pilot UI** working:

- Steps 8–11 (migrations) can wait.
- Steps 1–2 should still be done before any real pilot with multiple departments.
- Do not enable onboarding asset fulfillment until Steps 1, 3, and 11 (source-command indexes) are done.

---

## One-line priority order

```text
P0 code fixes → P1 code fixes → lint/lockfile → business backfill → preflight zero → migration rehearsal → apply migrations → Prisma align → frontend contract → tests → production checklist
```
