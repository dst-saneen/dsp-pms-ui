# Production Fix Wave Tracker

> **Historical evidence only.** This tracker records the earlier workbook wave
> and is not the current execution plan. The active baseline is the DSP ERP
> Reference Data, Workflow, Navigation, and Full QA Plan, using `dsp_pms_stg`
> and the canonical `DSP Reference Group QA` dataset. Historical pass claims
> below apply only to the recorded commits and must be revalidated after merge.

Source: [production-fix improvement workbook](../reference/production-fix-improvement-plan-2026-09-09.xlsx)
Planning baseline: `fc36dbd` (Excel)
Execution start SHA: `25f2155` (2026-09-17)
Prior engineering freeze (W2): `93eeeb1` — see [`docs/development/wave-2-freeze-record.md`](../development/wave-2-freeze-record.md)
Release decision: **NO-GO** (W19 engineering pack done; SIGN-001 + ENV/REL ops still open)

Honesty rule: if the UI shows enable / select / click, it must have a reason and must work (or be clearly disabled with why).

**Story guides (read these first if waves feel disconnected):**
- **Manager one-pager (W0→W19):** [`production-fix-manager-summary-w0-w19.md`](./production-fix-manager-summary-w0-w19.md)
- Setup → W8: [`production-fix-flow-setup-through-w8.md`](./production-fix-flow-setup-through-w8.md)
- W8 → W13 menus: [`production-fix-flow-through-w13.md`](./production-fix-flow-through-w13.md)
- W19 acceptance: [`wave-19-acceptance-record.md`](../development/wave-19-acceptance-record.md)

---

## Scoreboard

| Wave | Focus | Tasks | P0 | Status | Last SHA | Notes |
|------|-------|------:|--:|--------|----------|-------|
| Setup | Test org + personas | — | — | **Done + colleague Pass** | 25f2155 | Tenant `PFC-20260917` |
| W0 | Production gates | 20 | 5 | **Engineering done** | 25f2155 | W0-11 deferred; ENV/OBS process pending ops |
| W1 | Shared UX | 6 | 0 | **Engineering done** | 25f2155 | Pattern + primitives shipped |
| W2 | Designation | 7 | 0 | **Done (persona Pass)** | 93eeeb1 | You create Pass; Manager no Templates = correct |
| W3 | Entry and organization | 5 | 0 | **Engineering done** | — | Persona click-check pending |
| W4 | Dashboard and workspace | 4 | 0 | **Engineering done** | — | Persona click-check pending |
| W5 | Administration and security | 7 | 0 | **Engineering done** | — | See wave-5-exit-record |
| W6 | Employees and documents | 6 | 1 | **Engineering done** | — | See wave-6-exit-record |
| W7 | Recruitment | 8 | 4 | **Engineering done** | — | See wave-7-exit-record; live providers pending |
| W8 | Onboarding | 8 | 5 | **Done (persona + eng Pass)** | 25f2155 | ONB-001…008 closed 2026-09-17 |
| W9 | Workforce setup | 5 | 2 | **Done (persona Pass)** | 25f2155 | Calendar + roster + holiday import; Sep 21 holiday regen Pass |
| W10 | Attendance | 5 | 3 | **Done (persona Pass)** | 78db1d7 | Punch readiness + labels; filters; periods |
| W11 | Leave and overtime | 7 | 3 | **Done (persona + OT Pass)** | 78db1d7 | Leave Pass; OT Payroll SETTLED |
| W12 | Assets | 7 | 5 | **Done (persona Pass)** | — | Assign + ack + grant/custodian; UAT 2026-09-17 |
| W13 | HR operations | 7 | 4 | **Done (persona Pass)** | — | HR request path Pass; types visible to Employee |
| W14 | Projects | 7 | 0 | **Done (persona Pass)** | — | Projects path + Client customer; UAT 2026-09-18 |
| W15 | Timesheets | 5 | 0 | **Done (persona Pass)** | — | Jamie submit → Alex Approve Pass 2026-09-18 |
| W16 | Office Finance | 5 | 0 | **Done (persona smoke Pass)** | 16fa094 | Setup + create/submit smoke; list page/limit fix |
| W17 | Payroll | 8 | 1 | **Done (persona Pass)** | — | Components → salaries → preflight blockers cleared; UAT 2026-09-18 |
| W18 | Operations | 5 | 0 | **Done (persona Pass)** | 16fa094+ | Owner ops path; V2 off empty = honest; MIME/upload fix |
| W19 | Acceptance | 6 | 5 | **Engineering pack done — SIGN pending** | 16fa094+ | Pack in wave-19-acceptance-record; production still **NO-GO** |

**Wave cycle:** pick tasks → fix → update this file → you (Admin/HR) test → colleague (Manager/Employee) test → both Pass → mark Done → next wave.

**Historical wave next action:** Complete **SIGN-001** (named signatures),
commit/tag freeze, and close or formally accept ENV-001 / ENV-002 / REL-002.
Those W0–W19 results remain historical evidence only.

**Current next action:** Revalidate the merged application against the current
full workflow plan; do not advance release status from this historical tracker.

---

## Test organization checklist (Phase 0) — superseded

The four-person mini-tenant below was useful as historical wave evidence, but
it is not the canonical workflow baseline. Current testing uses the guarded,
idempotent `DSP Reference Group QA` organization in `dsp_pms_stg`, with India,
UAE, and tenant-isolation personas.

From `backend/`, preview and then apply the canonical reference-data contract:

```powershell
pnpm run qa:staging:audit
pnpm run qa:reference:plan
pnpm run qa:reference:apply
```

All QA writers require the exact staging schema and staging sentinel. They
refuse to write when `current_schema()` is `dsp_pms`. Credentials are supplied
through the guarded QA process and are never printed or committed. The
one-off `setup-production-fix-tenant.ts` utility was removed and is not a
supported baseline-creation command.

The historical setup evidence remains valid only for the commit and routes
recorded above; it must not be used as proof for the current merged code.

---

## Standard colleague script template

> Wave Wx done on SHA ____.
> Log in as **Manager** / **Employee**.
> Go to: **route list**.
> Do: **3–5 click steps**.
> Expect: **result**.
> Reply Pass/Fail + screenshot if Fail.
> Do not use production.

---

## W0 — Production gates

- Status: **Engineering done** (persona/ops evidence still open)
- Started: prior waves; tracker sync 2026-09-17 + SHA `25f2155`
- Tasks: CFG-001…CFG-004, ENV-001, ENV-002, OBS-001, REL-001, REL-002, W0-01…W0-11
- What we fixed (plain English):
  - Empty allowlist = all companies for Projects/Finance/Payroll/Onboarding/Assets/File Storage
  - Delivery empty allowlist fail-closed (boot + claim)
  - Payroll scope must be ⊆ Finance at startup
  - Designation create permission vs onboarding section honesty
  - Onboarding feature gate on link path; atomic create+link; Branch before department
  - Reminder worker keyset paging; File Storage UAT script matches runtime
- Files / areas: `backend/src/config`, module-capabilities, Delivery claim, designation/onboarding, `backend/scripts/uat-phase5-gate-evidence.mjs`
- Evidence today: `node scripts/uat-phase5-gate-evidence.mjs` → **13 Pass / 0 Fail** (CFG-004 / W0-10)
- Docs: [`cfg-001-feature-gate-profiles.md`](../development/cfg-001-feature-gate-profiles.md), [`wave-0-to-wave-2-execution-plan.md`](../development/wave-0-to-wave-2-execution-plan.md)
- UI places to click-check:
  - Sidebar menus for gated modules
  - `/administration/designations`, `/hr/onboarding-templates`
- What I (you) must verify: flags OFF hide module; visible buttons work or clear block
- What to tell colleague:

> Wave W0 engineering done on SHA `25f2155`.
> Log in as **Employee** (`prodfix.emp…`) then **Manager** (`prodfix.mgr…`).
> If a module is OFF, you must **not** see it.
> If you see a button, click it — it must work **or** show a clear blocked message (no silent fail).
> Reply Pass/Fail for menus you can see.

- Pass / Fail notes: Code + script Pass; live two-tenant ENV-001 still pending ops
- Next wave unlock: Colleague menu honesty Pass (already unlocked for engineering W1+)

### W0 task checklist

| ID | Prio | Focus | Status |
|----|------|-------|--------|
| CFG-001 | P0 | Feature gate profiles | **Doc done**; live A/B UAT pending |
| CFG-002 | P1 | Delivery non-empty allowlist + dry-run | **Code done** |
| CFG-003 | P1 | Payroll ⊆ Finance validation | **Code done** |
| CFG-004 | P2 | UAT evidence script allowlist | **Pass** (2026-09-17) |
| ENV-001 | P0 | Isolated UAT | **Pending ops** |
| ENV-002 | P0 | Secrets/providers | **Pending ops** |
| OBS-001 | P1 | Safe metrics/alerts | **Pending** |
| REL-001 | P0 | Freeze SHA | **Done** for W2 freeze `93eeeb1` |
| REL-002 | P0 | Backup/rollback | **Pending ops** |
| W0-01 | P1 | Config matrix | **Doc done** |
| W0-02 | P1 | Delivery fail-closed | **Code done** |
| W0-03 | P1 | Designation permission contract | **Code done** |
| W0-04 | P1 | Onboarding feature gate | **Code done** |
| W0-05 | P2 | Atomic designation + onboarding | **Code done** |
| W0-06 | P2 | Branch before department | **Code done** |
| W0-07 | P2 | Inactive designation linkage | **Code done** |
| W0-08 | P2 | Payroll/Finance semantics | **Code done** |
| W0-09 | P2 | Reminder fair paging | **Code done** |
| W0-10 | P2 | Evidence script File Storage | **Pass** |
| W0-11 | P1 | One scope resolver per module | **Deferred** |

---

## W1 — Shared UX

- Status: **Engineering done**
- Started: prior; docs in `docs/development/wave-1-*.md`
- Tasks: UX-01 … UX-06
- What we fixed: page vs dialog rule, navKind daily-before-config, entity breadcrumbs, PermissionGate / ModuleCapabilityGate, EntityFormPage + unsaved changes, a11y checklist
- Files / areas: `frontend/config/navigation.ts`, shared form shell, authz gates
- UI places: `/administration/designations/new` (pilot consumer)
- What I verify: URL works, refresh keeps form, Cancel returns to list
- What to tell colleague:

> Wave W1 done.
> Log in as Manager/Employee.
> Open Administration → Designations → New (if visible).
> Refresh — form should still make sense. Main create is a **page**, not only a drawer.
> Reply Pass/Fail.

- Pass / Fail notes: Engineering Pass; colleague browser pending
- Next wave unlock: already consumed by W2 Designation pilot

### W1 task checklist

| ID | Prio | Focus | Status |
|----|------|-------|--------|
| UX-01 | P1 | Major forms → dedicated pages (pattern) | **Done** |
| UX-02 | P2 | Sidebar regroup | **Done** |
| UX-03 | P2 | Breadcrumbs | **Done** |
| UX-04 | P1 | Capability + permission guards | **Done** |
| UX-05 | P2 | Form chrome | **Done** |
| UX-06 | P1 | A11y checklist | **Done** |

---

## W2 — Designation

- Status: **Done (persona Pass 2026-09-17)** — Owner create Pass; Manager no Onboarding Templates = correct
- Tasks: DES-01 … DES-07
- Routes: `/administration/designations/new`, `/administration/designations/[id]/edit`
- Checklist: [`wave-2-designation-pilot-uat.md`](../development/wave-2-designation-pilot-uat.md)
- You: create with/without onboarding department as Owner/HR — **Pass**
- Tell colleague:

> Wave W2 UAT on Tenant ProdFix.
> Log in as **Manager** (Slot C).
> Open Onboarding Templates if visible.
> You must **not** get a fake Create Designation that fails later.
> Reply Pass/Fail.

- Unlock for new work: **Unlocked** → W8 Onboarding
- Pass / Fail notes: Owner Designation New Pass; Manager Templates hidden Pass (2026-09-17)

---

## W3 — Entry and organization

- Status: **Engineering done**
- Tasks: AUTH-01, ORG-01 … ORG-04
- Tell colleague:

> After invite/password (when we invite a 5th user later): land on intended page, not a random empty screen.
> For now: Owner/HR login must reach Dashboard without stuck `/onboarding`.

---

## W4 — Dashboard and workspace

- Status: **Engineering done**
- Tasks: DASH-01, DASH-02, MY-01, MY-02
- Tell colleague:

> Log in as Employee and Manager.
> My Workspace: empty widgets must say empty / Retry / Not authorized — not a silent blank error.
> Reply Pass/Fail.

---

## W5 — Administration and security

- Status: **Engineering done** — [`wave-5-exit-record.md`](../development/wave-5-exit-record.md)
- Tasks: ADM-01 … ADM-04, SEC-01 … SEC-03
- Tell colleague:

> After I change your role, log out and in. Confirm menus match. Reply Pass/Fail.

---

## W6 — Employees and documents

- Status: **Engineering done** — [`wave-6-exit-record.md`](../development/wave-6-exit-record.md)
- Tasks: DOC-001 … DOC-003, EMP-001 … EMP-003
- Tell colleague:

> Open your employee profile Documents. Only Clean files should download. Reply Pass/Fail.

---

## W7 — Recruitment

- Status: **Engineering done** — [`wave-7-exit-record.md`](../development/wave-7-exit-record.md)
- Tasks: REC-001 … REC-008
- Tell colleague: follow opening URL posted in chat when we run recruitment UAT on this tenant.

---

## W8 — Onboarding (DONE)

- Status: **Done**
- Started: 2026-09-17 + SHA `25f2155` (working tree)
- Tasks: ONB-001 … ONB-008
- What we fixed (this slice):
  - **ONB-007:** My Workspace Onboarding tabs only from server capabilities
  - **ONB-004:** Inactive designations stay visible with Owner-only activate path
  - **ONB-006:** Start Onboarding full page + preflight honesty
  - **ONB-005:** Template task editor Basic/Advanced honesty
  - **ONB-002:** Atomic designation update; HR correctly blocked from structure edit
  - **ONB-008:** Reminder keyset paging + in-app copy/links; assign via Department Queue; overdue helper script
- Pass / Fail notes: ONB-006/005/002 **Pass**. Assign path **Pass** (you + colleague). Reminder plumbing **engineering Pass** (unit tests + overdue script verified on live task `test` → `prodfix.emp…`). Live bell wait not required for W8 close — reminders are **in-app notification (bell)**, not calendar; email only if email provider is configured.
- Next wave unlock: **W9**

---

## W9 — Workforce setup (DONE)

- Status: **Done (persona Pass 2026-09-17)**
- Started: 2026-09-17
- Tasks: CAL-001 … CAL-003, SCH-001, SCH-002
- What we fixed (this slice):
  - **CAL-001:** Setup-order readiness on Business Calendar offices page; Create disabled with reason until Company selected
  - **CAL-002:** Send for review / Publish disabled titles when validation not ready
  - **SCH-001:** Shift form overnight + break + default-shift honesty copy
  - **SCH-002:** Cannot publish roster with WORKING days missing shifts (API + UI); Generate needs branch with reason; Draft vs Published messaging; publish confirm explains “live for employees”
  - **Employee view:** `/my-workspace/calendar` mounts personal calendar; nav + Today’s Shift link
  - **Holiday → roster:** generation uses published business-calendar runtime even in LEGACY mode; regenerate creates draft (not overwrite published); Excel/CSV import templates + format guide
- What I (you / Owner-HR) must verify:
  1. Administration → Business Calendar → create/open company calendar → draft → publish when ready
  2. Administration → Shifts → create a default day (and optional night) shift
  3. HR → Work Schedule → select branch → Generate → fix missing shifts → Publish
  4. HR → Leave → Calendar shows published pattern
- What to tell colleague:

> Wave W9 workforce calendar.
> Log in as **Manager** / **Employee**.
> Open **My Workspace → My calendar**.
> Confirm holidays / week-offs / shifts match what HR published (or “no published shift” is clear).
> Reply Pass/Fail.

- Pass / Fail notes: Holiday Sep 21 + regenerate/publish roster + employee calendar **Pass**. CSV import template **Pass**; Excel template download fixed.
- Next wave unlock: **W10**

---

## W10 — Attendance (DONE)

- Status: **Done (persona Pass 2026-09-17)**
- Started: 2026-09-17
- Tasks: ATT-001 … ATT-005
- What we fixed (this slice):
  - **ATT-002:** My Workspace punch readiness (disable Check in without published WORKING day; titles; business date; success toasts; link to My calendar)
  - **ATT-001:** Server filters + paging (company/branch/date/search); branch-local Today; Correct only with `hr.attendance.manage`
  - **ATT-003:** Correction sheet shows current punches; reason still required
  - **ATT-004:** Exception filters use Company/Branch/Employee lookups (no raw IDs); reject requires reason; deep-link from period lock
  - **ATT-005:** Period filters + create use scoped selectors; lock blockers link to Exceptions
  - Labels: HALF_DAY / UNSCHEDULED friendlier; roster published-entry fallback
- Pass / Fail notes: You + colleague **Pass**
- Next wave unlock: **W11**

---

## W11 — Leave and overtime (DONE)

- Status: **Done (persona Pass 2026-09-17)**
- Started: 2026-09-17 · SHA `78db1d7` (working tree)
- Tasks: CO-001, LEV-001 … LEV-005, OVT-001
- Routes (bookmark these):
  | Who | Screen | Route |
  |-----|--------|-------|
  | HR | Types | `/hr/leave/types` |
  | HR | Policies (days/year) | `/hr/leave/policies` |
  | HR | Generate balances | `/hr/leave/balances` |
  | HR | Requests (Manager / HR queues) | `/hr/leave` |
  | HR | Leave calendar | `/hr/leave/calendar` |
  | HR | Comp-off credits | `/hr/leave/comp-off` |
  | HR | Holidays (source = Business Calendar) | `/hr/leave/holidays` |
  | HR | Overtime | `/hr/overtime` |
  | Employee | My leave (balances, history, apply preview) | `/my-workspace/leave` |
  | Employee | My calendar | `/my-workspace/calendar` |
- What we fixed (this slice):
  - **LEV-004:** Server-same-path leave preview (`POST /me/leave-previews`); Apply sheet shows working days, skipped holidays/offs, balance after submit, and block reasons from the canonical My leave workspace
  - **LEV-001/002/003:** Setup path banners Types → Policies → Balances → Requests → Calendar; matrix save impact links to Generate; generate sheet states dry-run vs write
  - **LEV-005:** Process sheet shows Waiting on Manager/HR, stage ownership, final-approve consumes once, reject releases; links to Leave calendar + My calendar
  - **OVT-001:** Approve capped at eligible minutes; settlement Comp-off vs Payroll pending explained; reject/cancel = no credit
  - **CO-001:** Comp-off page honesty + revoke reason; links from Overtime
- Pass / Fail notes: You + colleague **Pass** (leave). OT: employee submit UI + HR override; Payroll pending approve **SETTLED** for Jamie 165 min (2026-09-17). Comp-off optional (≥240 min).
- Next wave unlock: **W12 Assets**

---

## W12 — Assets (DONE)

- Status: **Done (persona Pass)**
- Started: 2026-09-17
- Closed: 2026-09-17
- Tasks: AST-001 … AST-007
- Prerequisite: `ASSET_V2_ENABLED=true` and company on allowlist (or empty allowlist = all). Sidebar section **Assets & licences** must be visible for Owner/HR.
- Routes (sidebar labels):
  | Sidebar label | Path |
  |---------------|------|
  | Categories | `/asset-management/asset-categories` |
  | Types | `/asset-management/asset-types` |
  | Assets | `/asset-management/assets` |
  | Licences | `/asset-management/licenses` |
  | Department grants | `/asset-management/department-grants` |
  | Assigned to employees | `/asset-management/employee-assets` |
  | Custodian Inbox | `/asset-management/inbox` |
  | Transfers | `/asset-management/transfers` |
  | Clearance waivers | `/asset-management/waivers` |
  | Employee ack | `/my-workspace` → card **My assets & licences** |
- What we fixed:
  - **AST-004:** User picker (no raw User ID) + reason on create/revoke/regrant; eligible-users API (no security.users.read); grant ensures Custodian role
  - **AST-005:** Inbox Approve/Reject require real notes (no hardcoded text)
  - **AST-006:** Licence resize/revoke require reasons; seat used/remaining; allocate blocked when full
  - **AST-007:** Transfer reject/cancel/force + waiver reject/cancel require reasons; links to inventory
  - **AST-003:** History shows readable events (not JSON blob)
  - **AST-002:** Setup path banners on all asset pages + empty Category/Type links from create forms
  - **AST-001:** Clearer disabled message when assetNav is off
  - Assign sheet: employee-first (no circular disabled dropdowns)
  - My Workspace: **My assets & licences** via `assetSelfNav` for employees
- Pass / Fail notes: You + colleague **Pass** (2026-09-17). Category→Type→Asset→Assign; Employee Acknowledge; Owner grant + Manager custodian path clarified.
- Next wave unlock: **W13 HR operations**

---

## W13 — HR operations (DONE)

- Status: **Done (persona Pass)** — 2026-09-17
- Tasks: HRQ-001 … HRQ-004, SEP-001 … SEP-003
- Routes:
  | Who | Screen | Path |
  |-----|--------|------|
  | HR | HR requests (ops + type setup) | `/hr/hr-requests` |
  | Employee | My HR requests | `/my-workspace/hr-requests` |
  | Approver | Approvals & clearance | `/my-workspace/approvals` |
  | HR | Employee separations | `/hr/employee-separations` |
  | HR | Separation detail | `/hr/employee-separations/[id]` |
- What we fixed:
  - **HRQ-001:** Type config labeled as setup (separate from ops queue)
  - **HRQ-002/004:** Path banner; New request disabled-with-why; Reject/Cancel reason ≥3 (FE+BE); Waiting on column; toast grammar
  - Employee can list active request types (`hr.self.read` on types GET)
  - Default approval path simplified: Manager Approves → HR Completes
  - **SEP-001…003:** Separation reasons, clearance, complete preflight, asset links
- Pass / Fail notes: HR request type setup → Jamie submit → Manager Approve → HR Complete **Pass**. Request-type dropdown for Employee fixed.
- Next wave unlock: **W14 Projects**

---

## W14 — Projects (DONE)

- Status: **Done (persona Pass)** — 2026-09-18
- Tasks: PRJ-001 … PRJ-007 (+ timesheet smoke)
- Pass / Fail notes: Projects create → Stages → Team → Tasks → Activate; Client customer; Jamie Start/Submit; timesheet path clarified (reporting manager). **Pass**.
- Next wave unlock: **W15** (completed same day)

---

## W15 — Timesheets (DONE)

- Status: **Done (persona Pass)** — 2026-09-18
- Tasks: TSH-001 … TSH-005
- Routes:
  | Who | Screen | Path |
  |-----|--------|------|
  | Employee | My timesheets | `/my-workspace/timesheets` |
  | Manager | Team timesheets | `/team/timesheets` |
- Pass / Fail notes: Jamie create week → Add line → Submit; Alex Approve. Team timesheets empty for PM/HR when not reporting manager = correct. EMPLOYEE approve menu cleaned. **Pass**.
- Next wave unlock: **W16 Office Finance**

---

## W16 — Office Finance (DONE)

- Status: **Done (persona smoke Pass)** — 2026-09-18
- Tasks: FIN-001 … FIN-005 (+ create/submit smoke)
- Pass / Fail notes: Path banner + Setup flow; transaction list page/limit fix; create + submit FT-000001. Full maker-checker approve (FIN-008) optional / needs second finance user.
- Next wave unlock: **W17 Payroll**

---

## W17 — Payroll (DONE)

- Status: **Done (persona Pass)** — 2026-09-18
- Tasks: PAY-001 … PAY-008
- Pass / Fail notes: Path banner; component code auto-gen; employee picker fix; preflight blockers (OF payroll category + attendance period) cleared; Create run path understood. **Pass**.
- Next wave unlock: **W18 Operations**

---

## W18 — Operations (DONE)

- Status: **Done (persona Pass)** — 2026-09-18
- Tasks: DEL-001 … DEL-003, FILE-001, RET-001 (+ OPS path)
- Pass / Fail notes: Owner sees Delivery Queue + File Ops + Retention; empty queue with Delivery V2 off is honest; MIME allowlist + clear false scan failures; ClamAV dev-fallback honesty. **Pass**.
- Next wave unlock: **W19 Acceptance**

---

## W19 — Acceptance (engineering pack done — SIGN pending)

- Status: **Engineering pack done** — production release remains **NO-GO** until SIGN-001 + ops P0s
- Tasks:
  - **DEF-001** — Conditional Pass (module P0/P1 closed/accepted; ENV-001/ENV-002/REL-002 formally block GO)
  - **QA-001** — Conditional Pass (prisma validate, BE/FE typecheck, 102 foundation tests, phase5 13/0, health/ready ok)
  - **QA-002** — Incomplete for production (needs disposable Postgres / backup — ENV-001 / REL-002)
  - **QA-003** — Conditional Pass (W8–W18 persona); Delivery V2 provider + full Tenant B matrix open
  - **RLS-DOC-001** — Pass — [`wave-19-rls-doc-001-ops-guides.md`](../development/wave-19-rls-doc-001-ops-guides.md)
  - **SIGN-001** — **Pending human signatures**
- Master record: [`wave-19-acceptance-record.md`](../development/wave-19-acceptance-record.md)
- Freeze: base `16fa094` + **uncommitted** W16–W18 tree — commit and tag `wave19-uat-freeze` before GO
- What you must do next:
  1. Ask engineering to **commit** W16–W18 (or review PR) and tag freeze
  2. Fill SIGN-001 table in the acceptance record (Owner / HR / Manager / Employee / Product)
  3. Ops: ENV-001 isolated UAT, ENV-002 secrets, REL-002 backup/rollback — or Product Owner accepts limitations in writing
  4. Only then flip tracker release decision to **GO**

---

## Honesty checklist (every screen)

1. Why is this control here?
2. What does choosing it change?
3. If I click it, does it work — or is it hidden/disabled with reason?
4. If it fails, is the message actionable?

If any answer is no/unclear → defect for that wave.

---

## Wave loop operating procedure (W8 → W19)

1. Open Excel Master Tasks for the wave IDs.
2. Implement honesty fixes only for that wave.
3. Update this tracker: Status, SHA, files, UI checks, colleague script.
4. You test Slot A/B on Tenant `PFC-20260917`.
5. Send colleague the wave script (Slot C/D).
6. Both Pass → mark wave Done → start next wave.
7. Do not skip to W19 until P0/P1 are closed or formally accepted.
