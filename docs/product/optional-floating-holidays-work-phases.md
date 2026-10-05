# Optional / Floating Holidays — Work Phases

**Source of truth (manager final):** [implementation plan](../superpowers/plans/2026-09-23-optional-floating-holidays.md)
**Older draft (superseded where they disagree):** `docs/product/optional-floating-holidays-plan.md`
**Branch baseline for this work:** `master` (current menus / leave / calendar)
**How we work:** Say **“start Phase N”** → we implement only that phase → then a short beginner “what changed” summary. Do not start the next phase until you say so.

---

## Final product (one screen)

```text
Company sets yearly holiday max (e.g. 10)
        ↓
Calendars: Mandatory (office closed) vs Optional (office open)
        ↓
Optional days = Max − mandatory holidays on working days
        ↓
Employee picks several optional dates at once (My Workspace)
        ↓
Auto-approved immediately (no manager/HR leave queue)
        ↓
Can change picks until end of day before that holiday
        ↓
Only that employee is off; office stays open for others
```

---

## What already exists (do not rebuild)

| Area | Today on master |
|------|-----------------|
| Business Calendar HOLIDAY events | Create/publish; `paidHoliday`; `businessDayEffect`; single-date UX for holidays |
| Holidays directory | Read-only list of published BC holidays |
| Leave types / policies / apply / approve | STANDARD, UNPAID, COMP_OFF + manager→HR workflow |
| Attendance / workforce calendar | Uses approved leave and office open/closed |
| Notifications + workforce jobs | Outbox + hourly scheduler |

## What is new (manager final)

| Piece | Status |
|-------|--------|
| `isOptionalHoliday` on calendar events | Done (Phase 3) |
| `CompanyHolidayPolicy` (max days / year / OH leave type) | Done (Phase 3) |
| `OPTIONAL_HOLIDAY` leave type category | Done (Phase 3) |
| `LeaveRequest.optionalHolidayEventId` | Done (Phase 1 / 5) |
| Company-default leave policy (`branchId` optional) | Done (Phase 2) |
| Catalog entitlement math | Done (Phase 4) |
| Group select + auto-approve + day-before lock | Done (Phase 5) |
| My Workspace selection card | Done (Phase 6) |
| Reminders (opened / saved / tomorrow) | Done (Phase 7) |
| Attendance respects approved optional leave only | Done (Phase 8) |

## Vs our earlier plan (important changes)

| Earlier draft | Final manager plan |
|---------------|-------------------|
| Apply leave one date + normal approval | **Group select** + **auto-approve** (no approval transaction) |
| Optional allowance from leave policy entitlement | Allowance from **company max − mandatory count** only |
| Balance ledger for OH | **No** OH balance sync; count approved OH leave requests |
| Cutoff “day before” (vague) | Locked from **holiday date 00:00** in **branch timezone** |
| Optional via Apply Leave picker | Dedicated **My Workspace** card; block OH from normal apply |

---

## Phase map (say “start Phase N”)

| Phase | Manager tasks | Outcome (beginner) |
|------:|---------------|--------------------|
| **1** | Task 1 | Database ready for optional holidays |
| **2** | Task 2 | Leave policies can be “all branches” |
| **3** | Task 3 | HR can mark Optional holidays + set yearly max |
| **4** | Task 4 | System can calculate “you may choose N days” |
| **5** | Task 5 | Employee save creates auto-approved leave rows |
| **6** | Task 6 | My Workspace multi-select UI |
| **7** | Task 7 | Reminders when dates open / saved / tomorrow |
| **8** | Task 8 | Attendance treats selected day as leave for that person |
| **9** | Task 9 | Docs + full test/UAT pass |

---

## Phase 1 — Data model + migration

**Status:** Done (2026-09-23)

**Goal:** Add tables/columns only; no user-facing behavior yet.

**Build:**
- `LeaveTypeCategory.OPTIONAL_HOLIDAY`
- `BusinessCalendarEvent.isOptionalHoliday` (default false)
- `CompanyHolidayPolicy`
- `LeaveRequest.optionalHolidayEventId`
- Nullable `LeavePolicy.branchId` + company-default constraints
- Unique indexes for active OH selections and company-default policies

**Done when:** `prisma:validate` + `prisma:generate` OK; migrate applied on your local/target schema.

**Beginner “what changed” (after done):**
The database can store optional holidays and company holiday limits. Screens do not use this yet.

**Delivered:**
- `backend/prisma/schema.prisma` updated
- `backend/prisma/migrations/20260923090000_optional_floating_holidays/migration.sql`
- Client regenerated; migration deployed to configured `DATABASE_SCHEMA`

---

## Phase 2 — Company-default leave policies

**Status:** Done (2026-09-23)

**Goal:** Ordinary leave policies support company-wide default + branch overrides.

**Build:** Resolver tiers + form “All branches (company default)”; department/designation only when a branch is set.

**Done when:** Leave-policy unit tests + form typecheck pass.

**Beginner “what changed”:**
HR can set one leave policy for the whole company, and still override per branch/role.

**Delivered:**
- `COMPANY_DEFAULT` specificity tier (0) below all branch tiers
- Resolver matches `branchId` null company defaults plus the employee’s branch policies
- Create/update reject department/designation when branch is unset
- Leave policy form: optional branch labeled “All branches (company default)”; table shows “Company default”

---

## Phase 3 — Calendar flag + company holiday policy UI/API

**Status:** Done (2026-09-23)

**Goal:** HR setup for Mandatory vs Optional and yearly max.

**Build:**
- Event rules for optional (HOLIDAY, one day, effect NONE, not paid at calendar)
- Leave type category OPTIONAL_HOLIDAY (paid, no approval, no half-day)
- Policy API + Annual holiday policy card
- Badges Mandatory / Optional on calendar + Holidays list

**Done when:** Event + leave-type tests pass; admin can save policy and optional events on a draft.

**Beginner “what changed”:**
HR can mark floating holidays and set “max 10 holidays this year,” and link the Optional Holiday leave type.

**Delivered:**
- `isOptionalHoliday` validation + persistence on calendar events
- `GET/PUT /company-holiday-policies` (`calendar.business.manage`)
- Leave type `OPTIONAL_HOLIDAY` normalization
- Annual holiday policy card on Business Calendar workspace
- Mandatory / Optional badges in event lists and Holidays directory

---

## Phase 4 — Catalog + entitlement math

**Status:** Done (2026-09-23)

**Goal:** Per employee/branch: how many optional days and which dates are eligible.

**Build:** Compose company+branch published calendars; mandatory wins; week-offs; allowance = max − mandatory working days; lock flag by branch local date.

**Done when:** Catalog service tests pass (including 10 − 5 = 5).

**Beginner “what changed”:**
The system can answer: “You may choose 5 floating days from this list.”

**Delivered:**
- `OptionalHolidayCatalogService.getCatalog` (company + branch published versions)
- Allowance = `maximumHolidayDays − mandatoryWorkingDayCount` (e.g. 10 − 5 = 5)
- Mandatory wins over optional; Sunday mandatory ignored; week-off optionals omitted
- Lock via branch-local date (`editableUntil` = day before 23:59:59)
- `HOLIDAY_POLICY_MAX_BELOW_MANDATORY` when max &lt; mandatory count

---

## Phase 5 — Group selection API (auto-approve)

**Status:** Done (2026-09-23)

**Goal:** Employee saves a set of dates; leave rows created/cancelled atomically.

**Build:**
- `GET /me/optional-holidays?year=`
- `PUT /me/optional-holiday-selections/:year` with `{ eventIds }`
- Direct `APPROVED` leave requests (no approval transaction)
- Block OPTIONAL_HOLIDAY from normal Apply Leave
- Day-before lock; no partial updates

**Done when:** Selection + leave-request regression tests pass.

**Beginner “what changed”:**
Backend can save several floating picks at once, auto-approve them, and allow safe swaps before the cutoff.

**Delivered:**
- `OptionalHolidaySelectionService` Serializable reconcile (create APPROVED / cancel removals)
- `GET /me/optional-holidays`, `PUT /me/optional-holiday-selections/:year`
- Apply Leave rejects `OPTIONAL_HOLIDAY` (`OPTIONAL_HOLIDAY_USE_SELECTION`); picker hides that category

---

## Phase 6 — My Workspace selection UI

**Status:** Done (2026-09-23)

**Goal:** Employee-facing multi-select card.

**Build:** Summary (max / mandatory / can choose / remaining), multi-select, Save, locked dates disabled.

**Done when:** Vitest for the card + frontend typecheck pass.

**Beginner “what changed”:**
Employees pick and change floating holidays in My Workspace (not via normal Apply Leave).

**Delivered:**
- `OptionalHolidaySelectionCard` on My Workspace
- `GET/PUT` client via `OptionalHolidayService` + `API_ENDPOINTS.me.optionalHolidays*`
- Locked dates stay checked but disabled; one Save sends the full desired set

---

## Phase 7 — Notifications

**Status:** Done (2026-09-23)

**Goal:** Light reminders only.

**Build:** Selection opened (on publish), selection updated, tomorrow reminder; reuse outbox/scheduler; no spam for unselected dates.

**Done when:** Reminder/publish/scheduler tests pass.

**Beginner “what changed”:**
People get a notice when floating dates are available, when they save, and the day before a chosen holiday.

**Delivered:**
- Notification codes + `/my-workspace` hrefs for OPENED / UPDATED / TOMORROW
- Publish emits OPENED when version has optional dates + company holiday policy
- Selection save emits UPDATED only when the set changed
- Hourly `runOptionalHolidayReminders` with branch-timezone “tomorrow” + outbox dedupe


## Phase 8 — Attendance + calendar consumers

**Status:** Done (2026-09-23)

**Goal:** Approved selection = leave for that employee only.

**Build:** Finalizer/check-in respect approved full-day leave; no inferring leave from missing punches; workforce calendar shows ON_LEAVE for selector only.

**Done when:** Attendance + workforce-calendar tests pass.

**Beginner “what changed”:**
If you selected the floating day, you are on leave with no punch needed; if you did not, missing punch is still absence.

**Delivered:**
- Finalizer sets `LEAVE` + `FINALIZED_APPROVED_LEAVE` when an approved full-day leave covers the date (no missing-punch exception)
- Self-service check-in blocked with `ATTENDANCE_APPROVED_LEAVE_EXISTS` + My Workspace copy
- Workforce calendar: approved optional leave (no approval transaction) → `ON_LEAVE` for selector only

---

## Phase 9 — Docs + full verification

**Status:** Done (2026-09-23)

**Goal:** Guides match the final flow; release checks + UAT example.

**Build:** Update `optional-floating-holidays-plan.md` and workflow guides 05/10; run backend/frontend gates; run the concrete UAT from the manager plan.

**Done when:** Acceptance checklist in the manager MD is checked off.

**Beginner “what changed”:**
Docs and tests match the live floating-holiday product.

**Delivered:**
- Rewrote `optional-floating-holidays-plan.md` to the shipped group-select / auto-approve flow
- Updated workflow guides 05, 10, and 17
- Manager acceptance checklist marked complete
- Gates: backend `prisma:validate` + `typecheck:ts6` + OH-focused Jest (62) + `build` passed; frontend `typecheck:ts6` + OH Vitest + `build` passed
- Note: full-repo `lint:check` / `typecheck:test:ts6` still report pre-existing debt outside this feature; graphify CLI not installed (skipped)
- Concrete UAT script documented in the product plan for live environment walkthrough

---

## Suggested start order

1. Confirm on **master**, DB schema matches master (`pnpm run prisma:generate` after switch).
2. Say **start Phase 1**.
3. After each phase: quick manual smoke if UI exists; then next phase on your command.

## Out of scope (do not build)

- Capacity limits (“only 10 people on Diwali”)
- Half-day optional
- Separate election table
- Changing normal leave manager/HR approval
- Auto-picking unused optional days
- Employee-target calendar events to close the office for one person

---

## Command cheat sheet

| You say | We do |
|---------|--------|
| `start Phase 1` | Schema + migration only |
| `start Phase 2` | Company-default leave policies |
| `start Phase 3` | Optional flag + company holiday policy setup |
| `start Phase 4` | Catalog / entitlement |
| `start Phase 5` | Selection API |
| `start Phase 6` | My Workspace UI |
| `start Phase 7` | Reminders |
| `start Phase 8` | Attendance wiring |
| `start Phase 9` | Docs + full UAT |
| `status` | Which phase is done / next |
