# Asset Management V2 — simple guide and execution plan

This explains the manager’s implementation plan in plain language and breaks the work into sections you can execute in order.

**Source contract (full detail):** [`asset-management-db-api-implementation-plan.md`](./asset-management-db-api-implementation-plan.md)
**Why we need this (product gap):** [`department-assets-gap-explained.md`](../product/department-assets-gap-explained.md)

---

## Part A — What this plan means (simple)

### Today vs V2 in one sentence

**Today:** company/branch asset cupboard — one generic form, assign to employee, employee can only view.  
**V2:** every item belongs to a **department**, with **four kinds** (general, hardware, card, software license), proper custody rules, and department custodians who manage their list.

### The four asset kinds

| Kind | Examples | How it is tracked |
|------|----------|-------------------|
| **GENERAL** | Fridge, AC, furniture | **Location** — stays in a place, not on a person |
| **HARDWARE** | Laptop, phone, monitor | **Individual** — assigned to one employee at a time |
| **CARD** | ID card, access card | **Individual** — assigned to one employee; card number is protected |
| **SOFTWARE_LICENSE** | Microsoft 365, Adobe | **Pool** — one license with many seats; allocate seats to employees |

Category and Type are still **company masters**. The **department** is on each actual Asset (the item or license pool).

### Who does what

| Person | Can do |
|--------|--------|
| **Company Admin / Asset Manager** | See and manage assets across the company (within scope) |
| **Department custodian** | Manage assets **only in departments they are granted** |
| **HR Manager** | Read broadly; approve **separation waivers**; does not assign custody |
| **Employee** | See **only own** assigned items; acknowledge receipt; **request** return / report loss / request license revoke — does not assign directly |

### Important rules (locked)

1. Every asset has **one owning department** → branch comes from that department.
2. Physical/card assignment: employee must be in the **same branch** as the asset.
3. Software seats: can go to any employee in the **same company**.
4. **No licence keys** in HRMS — only vendor/product/seats/expiry + external vault reference.
5. **Card numbers** are encrypted/masked — not shown in normal lists.
6. **Separation blocked** until all custody is closed (or HR approves a waiver).
7. **Onboarding auto-assign** is **not** in this release — only hooks for later.
8. Frontend must use **`allowedActions` from API** — do not copy lifecycle rules in the browser.

### What gets built (backend)

```text
Database (new tables, enums, constraints, triggers)
  → Fix current Asset bugs (P1)
  → Permissions + department grants
  → REST APIs (inventory, assign, license seats, transfers, requests, clearance)
  → Notifications (in-app / outbox)
  → Migrations + backfill old data
  → Tests
  → Frontend follows new API (separate UI work)
```

---

## Part B — Execution plan (sections)

Follow these sections **in order**. Do not skip Section 0 or migration preflight.

---

### Section 0 — Readiness and fix-first (P1)

**Goal:** Current Asset module is safe before V2 schema goes live.

**Do:**

- Fix category list scope in company-group context (must not fail open).
- Stop accepting `companyId` / arbitrary `status` on PATCH for Category, Type, Asset.
- Split **lifecycle** from **custody** (today `Asset.status` mixes both and can drift).
- Reject assign to **inactive / terminated** employees.
- Put Category/Type/Asset mutations + audit in **one transaction**.
- Paginate asset lists (stop loading full assignment history).
- Use **User id** for actor when admin has no Employee record.
- Add route-policy entries for new route families (see Section 7 in source plan).

**Done when:** Existing asset CRUD/assign/return works with fixes; no known P1 from plan §2.

**Rough effort:** 3–5 days.

---

### Section 1 — Contract lock (types, permissions, errors)

**Goal:** One shared contract before coding V2 tables.

**Do:**

- Add enums: `AssetKind`, `AssetTrackingMode`, `AssetLifecycleStatus`, custody/allocation/transfer/request statuses (plan §4.1).
- Document stable **error codes** (plan §11).
- Document **lifecycle transition matrix** (plan §4.15) — repair, lost, dispose, suspend pool, retire, etc.
- Add new permissions + seed roles (plan §7):
  - `assets.department.read/manage`
  - `assets.department.assignments.read/manage`
  - `assets.department-access.manage`
  - `assets.transfers.force`, `assets.clearance.waive`, sensitive card/licence permissions
  - New role: **Asset Department Custodian** (`...0008`)
- API conventions: pagination envelope, `operationId`, `expectedVersion`, date/money formats (plan §6).

**Done when:** Prisma enums + permission migration drafted; error catalog and state machine documented in code (`policies/`).

**Rough effort:** 2–3 days.

---

### Section 2 — Database expand migration

**Goal:** Add V2 columns/tables **without breaking** current app (`ASSET_V2_ENABLED=false`).

**Do:**

- New/changed columns on `asset_categories`, `asset_types`, `assets` (department, kind, tracking, lifecycle, archive, version, etc.).
- New tables (plan §4):
  - `asset_card_details`
  - `asset_software_license_details` + `software_license_allocations`
  - `asset_department_grants`
  - `asset_ownership_transfers`
  - `asset_custody_requests`
  - `asset_clearance_items` / waivers
  - `asset_domain_actions` (append-only evidence)
  - `idempotent_command_receipts`
- New indexes and **non-blocking** constraints first.
- Keep legacy `status` / `isActive` as mirrors during expand.

**Done when:** Migration applies on disposable DB; old UI still runs against legacy fields.

**Rough effort:** 5–8 days.

---

### Section 3 — Backend domain module skeleton

**Goal:** Clean architecture before wiring every endpoint.

**Do:**

Create `backend/src/modules/asset-domain/` (plan §3):

| Service | Responsibility |
|---------|----------------|
| `AssetAccessService` | Tenant + department grant scope |
| `AssetQueryService` | Lists, detail, summary, `/me/assets` |
| `AssetCommandService` | Create/update/archive/repair/dispose lifecycle |
| `AssetCustodyService` | Physical/card assign & close |
| `LicenseAllocationService` | Pool seats allocate/revoke |
| `AssetTransferService` | Move asset between departments |
| `AssetCustodyRequestService` | Employee requests |
| `AssetClearanceService` | Separation preflight & waivers |
| `AssetCapabilityService` | `allowedActions` |
| `AssetNotificationService` | Outbox events |

Wire existing controllers to delegate here gradually.

**Done when:** Module boots; access service + query pagination working on expanded schema.

**Rough effort:** 4–6 days.

---

### Section 4 — Read APIs (inventory + self-service)

**Goal:** Department-scoped **read** paths work before heavy writes.

**Do:**

- `GET /asset` — paginated, filter by department/kind/status/expiry.
- `GET /asset/summary` — KPI counts for scope.
- `GET /asset/:id`, `GET /asset/:id/history`.
- Category/Type list/detail with pagination + archive flags.
- `GET /me/assets` — employee’s custody + license seats only.
- Department grant CRUD: `asset-department-grants`.
- Every response includes **`allowedActions`**.

**Done when:** Postman/integration tests pass for read + scope isolation (cross-department denied).

**Rough effort:** 4–5 days.

---

### Section 5 — Write APIs — masters and inventory

**Goal:** Create and maintain assets with correct subtype data.

**Do:**

- Category/Type: create, patch (metadata only), archive/reactivate (no hard delete).
- Type must declare **kind + trackingMode** at create.
- `POST /asset` — creates Asset + card detail OR license detail OR hardware/location fields **atomically**.
- `PATCH /asset/:id` — metadata only (not department/kind via generic patch).
- Lifecycle commands: send-to-repair, complete-repair, mark-lost, dispose, suspend/resume/retire pool, resize license capacity.
- Protected card lookup endpoint (masked result only).

**Done when:** Can create one example of each kind under a department; lifecycle transitions match matrix.

**Rough effort:** 6–8 days.

---

### Section 6 — Custody and license allocation

**Goal:** Assign/return physical items and allocate software seats.

**Do:**

- Physical/card: assign, acknowledge, close (return/lost/damaged/waived) — plan §8.4.
- Enforce: one open custody per asset; branch match; inactive employee rejected.
- Software: allocate seat, revoke, acknowledge — plan §8.5.
- Enforce: never exceed seat capacity; pool suspended = no new allocations.
- Dual-write legacy `employee_assets.status` during expand window.

**Done when:** Integration tests for concurrent assign and capacity limits pass.

**Rough effort:** 5–7 days.

---

### Section 7 — Transfers, employee requests, clearance

**Goal:** Department moves and employee/separation flows.

**Do:**

- **Ownership transfer:** request → destination accept (or force with reason) — plan §8.7.
- **Employee requests:** return, report loss/damage, license revoke request — custodian resolves — plan §8.8.
- **Separation clearance:** preflight blocks separation if custody open; waiver needs HR approval — plan §8.9.
- Notifications via outbox (assigned, expiry reminder, request opened, clearance blocked) — plan §12.

**Done when:** Separation test persona cannot complete exit with open laptop unless waived.

**Rough effort:** 6–8 days.

---

### Section 8 — Data migration and contract migration

**Goal:** Old rows become valid V2 rows; then DB enforces rules.

**Do:**

1. **Preflight report** (plan §5.2) — list assets missing department, bad serial, drift, etc. **No PII in report.**
2. Business mapping files (approved by ops):
   - `assetId → departmentId`
   - `assetTypeId → kind + trackingMode`
   - Card/software extra fields where needed
3. **Controlled backfill** (plan §5.4) — lifecycle mapping, custody snapshots, clearance reconciliation.
4. **Contract migration** (plan §5.5) — NOT NULL, check constraints, triggers, replace wrong unique index on assignments.
5. Run **integrity SQL** from plan §14 — all queries return zero rows.

**Done when:** Preflight exceptions = 0; contract migration passes on staging copy of prod data.

**Rough effort:** 5–10 days (depends on customer data quality).

---

### Section 9 — Tests and release gates

**Goal:** Safe to pilot.

**Do:**

- Unit/service tests: scope, transitions, concurrency, idempotency (plan §15).
- Real PostgreSQL integration tests (not mocks).
- HTTP/API authorization tests (custodian vs employee vs cross-tenant).
- Migration rehearsal: empty DB + upgrade from current schema.
- Enable **`ASSET_V2_ENABLED`** for one company/branch pilot only (plan §16).

**Production gates (all must pass):**

- No P0/P1 defects.
- Every active asset has valid company/branch/department/type.
- Zero duplicate custody / license capacity drift.
- No secrets in API/logs/outbox.
- UAT sign-off on: create → assign → employee view → request return → separation clearance.

**Rough effort:** 5–7 days.

---

### Section 10 — Frontend (after API stable)

**Goal:** UI matches V2 contract; employees see only their items.

**Do:**

- Types/enums/services from new API shapes.
- Asset form **changes by kind** (general location vs hardware serial vs card vs license pool).
- **Department filter** on lists; custodian sees granted departments only.
- Hide buttons using **`allowedActions`** (fix today’s “HR sees Assign but API 403”).
- Employee My Workspace: assigned hardware + cards + license seats; request actions.
- Custodian inbox: pending requests, expiring warranties/licenses.
- Separation UI: clearance checklist from API.

**Not in this release:** onboarding task auto-assign (Section 13 in source plan — hooks only on backend).

**Rough effort:** 10–15 days (can overlap late Section 5–7 if API contract is frozen).

---

## Part C — Suggested timeline (one developer, full stack)

| Week | Focus |
|------|--------|
| 1 | Section 0 + Section 1 |
| 2 | Section 2 + Section 3 skeleton |
| 3 | Section 4 read APIs |
| 4–5 | Section 5 + 6 |
| 6 | Section 7 |
| 7 | Section 8 migration on staging |
| 8 | Section 9 tests + pilot |
| 9–10 | Section 10 frontend |

Adjust if backend-only or pair with another developer.

---

## Part D — What NOT to do

- Do not hard-delete categories/types/assets — **archive** only.
- Do not store licence keys in the database or API responses.
- Do not show full card numbers in ordinary screens.
- Do not infer department from employee or asset name in migration — use approved mapping file.
- Do not enable contract migration until preflight exceptions are zero.
- Do not implement onboarding auto-fulfil in this release.
- Do not change Recruitment conversion as part of this work (parallel is OK; coordinate migration order).

---

## Part E — Quick checklist (print this)

```text
[ ] Section 0  Fix current Asset P1 bugs
[ ] Section 1  Enums, permissions, errors, state machine locked
[ ] Section 2  Expand migration applied
[ ] Section 3  asset-domain module structure
[ ] Section 4  Read APIs + department scope
[ ] Section 5  Create/update/lifecycle commands
[ ] Section 6  Custody + license allocation
[ ] Section 7  Transfers + requests + clearance + notifications
[ ] Section 8  Preflight → backfill → contract migration
[ ] Section 9  Tests + pilot enable
[ ] Section 10 Frontend V2 screens
```

---

## Part F — Where to look in the big plan

| Your section | Manager plan sections |
|--------------|------------------------|
| 0 | §2 Existing defects |
| 1 | §4.1, §4.15, §6, §7, §11 |
| 2 | §4.2–4.13 |
| 3 | §3 Architecture |
| 4–7 | §8 REST, §10 Transactions, §12 Notifications |
| 8 | §5 Migration, §14 Integrity SQL |
| 9 | §15 Tests, §16 Release gates |
| 10 | §16 step 8 + gap doc UI needs |
| Onboarding later | §13 |

When in doubt, the manager document wins over this summary.
