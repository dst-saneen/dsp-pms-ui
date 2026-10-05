# Optional / Floating Holidays — Product Guide (shipped)

**Audience:** Product, HR admins, eng
**Status:** Implemented (Phases 1–8 on master)
**Source of truth for build:** [implementation plan](../superpowers/plans/2026-09-23-optional-floating-holidays.md)
**Work phases:** `docs/product/optional-floating-holidays-work-phases.md`

This document replaces the earlier “apply one date + manager approval + OH balance” draft.

---

## 1. Product rule (one screen)

```text
Company sets yearly holiday maximum (e.g. 10)
        ↓
Calendars: Mandatory (office closed) vs Optional (office open)
        ↓
Optional allowance = Max − mandatory holidays that fall on working days
        ↓
Employee picks several optional dates at once (My Workspace)
        ↓
Auto-approved immediately (no manager/HR leave queue)
        ↓
Can change picks until the holiday date starts (branch timezone)
        ↓
Only that employee is off; office stays open for others
```

---

## 2. Administrator setup order

Do these in order:

1. **Create Optional Holiday leave type**
   HR → Leave → Types → Kind = **Optional Holiday** (paid, no approval, no half-day).
   Link this type on the company holiday policy (step 2).

2. **Set company / year maximum**
   Business Calendar → **Annual holiday policy** (company + year + maximum days + Optional Holiday leave type).
   One policy per company/year — **not** duplicated per branch.

3. **Publish company and branch calendars**
   - **Mandatory** holidays: `isOptionalHoliday = false`, effect closes the office.
   - **Optional / floating** holidays: `isOptionalHoliday = true`, effect **NONE** (office stays open).
   Publish draft versions so employees can see the catalog.

4. **Employees make group selections**
   My Workspace → **Optional / floating holidays** card → multi-select → **Save selections**.

Standard leave policies still resolve **company default first**, then the most-specific branch override (unchanged).

---

## 3. Entitlement math

| Input | Rule |
|-------|------|
| Company maximum | e.g. 10 days/year |
| Mandatory count | Distinct mandatory holiday dates that fall on a **working day** (week-offs do **not** reduce allowance) |
| Optional allowance | `max(0, maximum − mandatory working-day count)` |
| Catalog | Published optional events for the employee’s company/branch (duplicate dates count once) |

Example: maximum **10**, five mandatory holidays on working days → employee may choose **5** optional dates from the remaining optional catalog.

---

## 4. Employee flow

| Step | Behavior |
|------|----------|
| Open My Workspace | Card shows Maximum / Mandatory / You can choose / Remaining |
| Select dates | Multi-select optional catalog dates only |
| Save | Creates **APPROVED** one-day leave requests linked to calendar events; **no** approval transaction |
| Swap | Change future picks before cutoff; locked dates stay selected but disabled |
| Apply Leave | Optional Holiday type is **blocked** here — use the selection card |

### Cutoff (branch timezone)

Editing is allowed through the day **before** the holiday. From **holiday date 00:00:00** in the employee’s branch timezone, that date is locked.

Example (`Asia/Kolkata`, optional date **October 10**):

- Editable through **October 9, 11:59:59 PM**
- Locked from **October 10, 12:00:00 AM**

### If they miss the cutoff

That date stays a **normal workday** for them. Recovery:

- Ordinary / emergency leave via Apply Leave, or
- HR attendance correction

Unused optional allowance stays available for later eligible dates and is **never** auto-selected.

---

## 5. Attendance and calendar

| Person / system | On an optional calendar date |
|-----------------|------------------------------|
| Employee who **selected** it | Approved leave; no check-in required; finalizer → `LEAVE` |
| Employee who did **not** select it | Normal working day; missing punch → absence |
| Office runtime | Still **WORKING** (optional events do not close the office) |
| Workforce calendar | Selector → `ON_LEAVE` + Optional Holiday type; colleagues → `AVAILABLE` / `SCHEDULED` |

Missing punches **never** invent optional leave. Only an approved `LeaveRequest` counts.

---

## 6. Notifications

Uses existing outbox + hourly workforce scheduler:

| Code | When |
|------|------|
| `OPTIONAL_HOLIDAY_SELECTION_OPENED` | Calendar publish with optional dates + holiday policy |
| `OPTIONAL_HOLIDAY_SELECTION_UPDATED` | Employee saves a changed selection |
| `OPTIONAL_HOLIDAY_TOMORROW` | Day before an **approved** selected holiday (branch TZ) |

Links go to `/my-workspace`. No daily spam for unselected candidate dates.

---

## 7. Out of scope (unchanged)

- Capacity limits (“only 10 people on Diwali”)
- Half-day optional
- Separate election table
- Changing normal leave manager/HR approval
- Auto-picking unused optional days
- Employee-target calendar events to close the office for one person

---

## 8. UAT script (concrete)

### Happy path

1. Year with **20** unique calendar holidays; company maximum **10**; **five** mandatory holidays on working days.
2. Employee card shows **five** selectable days from the remaining optional catalog.
3. Select five in one save → five APPROVED leave rows, `approvalTransactionId = null`.
4. Swap one date before its cutoff → still five approved, no manager queue.
5. On one selected date: selecting employee on leave; another employee working; office runtime still working.

### Cutoff and negatives

1. October 10 optional date, branch `Asia/Kolkata`: edit OK through Oct 9 11:59:59 PM; fail from Oct 10 00:00.
2. No selection + no punch → absence.
3. Selecting more than allowance → rejected with **no** partial writes.
4. Mandatory holiday on a week-off → does **not** reduce optional allowance.

Automated coverage: catalog, selection, publish notifications, reminders, attendance finalizer, workforce-calendar privacy tests (Phases 4–8).

---

## 9. Acceptance checklist

- [x] Company/year maximum configured once (not per branch)
- [x] Standard leave policies: company default, then branch override
- [x] Mandatory closes office; optional does not
- [x] Company + branch dates compose; duplicate dates count once
- [x] Max 10 + five mandatory working-day holidays → five optional selections
- [x] Mandatory on week-offs does not reduce allowance
- [x] Optional events and OH leave requests are single-day
- [x] Employee saves several choices / swaps future dates
- [x] Optional choices auto-approved; no approval transaction
- [x] Normal leave still uses existing approval workflow
- [x] Day-before cutoff uses branch timezone; locked dates immutable
- [x] Reminders reuse notification + scheduler infrastructure
- [x] Selected employee on leave; colleagues and office working
- [x] Missing punches never auto-select leave
- [x] No election table, capacity subsystem, or alternate approval engine

---

## 10. Related docs

- Workflow: [05 Calendar](./company-workflow-guide/05-calendar-and-work-schedule.md), [10 Leave](./company-workflow-guide/10-leave-overtime.md), [17 My Workspace](./company-workflow-guide/17-my-workspace-daily-work.md)
- Manager implementation plan: [Optional / Floating Holidays implementation plan](../superpowers/plans/2026-09-23-optional-floating-holidays.md)
