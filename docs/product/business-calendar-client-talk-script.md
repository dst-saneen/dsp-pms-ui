# Business Calendar — Client confirmed decisions + simple plan

**Status:** Client replied to confirmation questions  
**Date noted:** 2026-08-07  
**Use this file for:** internal alignment and next client follow-up  
**Related design doc:** `business-calendar-client-proposal.md` (original proposal — one rule changed)

---

## 1. What I think (simple)

Most of the original proposal **matches** what the client wants.

**One important change from the proposal:**

| Original proposal | Client decision |
|-------------------|-----------------|
| Published calendar is **locked** (cannot edit). Fixes need a **new version**. | Published calendar must stay **editable**. Holidays may change later. |

So we should **update the design**: keep Draft → Review → Publish for control, but allow **controlled editing of published calendars** (with audit: who changed what and when).  
Do **not** auto-change already locked Attendance / Leave / Payroll history when a holiday is edited later.

Everything else from the client is **aligned** with the proposal (company/branch inheritance, overrides, timezone, HR review on imports, India + Middle East, HR + Admin roles).

---

## 2. Client answers (mapped clearly)

| # | Question we asked | Client answer | Meaning in simple words |
|---|-------------------|---------------|-------------------------|
| 1 | Multiple Calendar Profiles? | Each office needs a calendar. If no branch → use **company calendar**. Branches **inherit** company calendar and update if required. | Company has a main calendar. Branches copy/inherit it and can change locally. Profiles for countries (India / Middle East) still fit. |
| 2 | Every Branch one Calendar Profile? | Each office needs own calendar with **inherited main office** calendar. | Yes — branch calendar = inherit company + local changes. |
| 3 | Branch override company holidays? | Branch will have **their own holidays**. | Yes — branch can add/change regional holidays. |
| 4 | Branch timezone final? | **Yes** | Leave / Attendance / Shift / calendars use branch timezone. |
| 5 | Imports need HR review? | **Yes** | Excel/CSV/ICS/API holidays stay draft until HR reviews. |
| 6 | Published locked from editing? | **No** — published must be editable; holidays may change later. | **Design change** — allow edit after publish (with audit). |
| 7 | Government holidays countries? | **All countries** eventually; **for now India + Middle East**; **India state-wise** holidays needed. | Stage government import for India (national + state) and Middle East first. |
| 8 | Who create / review / publish? | **HR and Admin** | HR prepares; Admin (Company Admin / Org Owner) can publish; both involved as agreed. |

**Extra client line at top:** “Published calendar make it editable.”  
→ Same as answer 6. Treat as **confirmed requirement**.

---

## 3. Confirmed design (what we build toward)

### Structure (client language)

```
Company (main office calendar)
  └── If no branches → use Company calendar only
  └── If branches exist
        └── Each Branch calendar
              ├── Inherits Company calendar
              └── Can add / update own holidays and working-day exceptions
```

### Country profiles (still useful)

For India / Middle East (and later more countries), keep **Calendar Profiles** so different regions can have different base rules, then assign to branches.

### Rules confirmed

1. Branch inherits company calendar, then can customize.  
2. Priority stays: **Branch override → Company → Working week**.  
3. Branch timezone controls calculations.  
4. Working week supports full / half / non-working days.  
5. Holiday is a protected event type (affects Leave & Attendance).  
6. Meetings / celebrations / training show on calendar but normally do **not** change working-day result.  
7. Leave stays in Leave module; only **displayed** on calendars.  
8. Published calendar feeds Leave, Attendance, Shift, Employee Workspace; later Payroll & Projects.  
9. Editing a published calendar must **not** auto-recalculate locked historical Attendance / Leave / Payroll.  
10. Imports always need HR review before going live.  
11. Roles: **HR and Admin** create / review / publish (exact maker-checker can be refined).

### Changed rule (vs original proposal)

**Published calendars are editable.**

Recommended safe approach (for next internal design):

- Allow edit of holidays/events on a published calendar.  
- Log every change (who / when / old value / new value).  
- Optionally ask for a reason when changing a holiday.  
- Future dates update for new leave/attendance calculations.  
- Past **locked** periods stay as they were (no silent reopen).

*(Original “immutable published version only” is replaced by this client rule.)*

---

## 4. Plan (what to do next — staged)

### Stage 0 — Align docs (**DONE — Phase 0**)

- [x] Capture client answers in this file  
- [x] Update formal proposal: published = editable + audit  
- [x] Accepted decisions one-pager  
- [x] Foundation inventory  
- [x] Pilot: Datascape / Kowdiar; India profile first  

**Artifacts:** `docs/product/business-calendar-accepted-decisions.md`, `docs/product/business-calendar-foundation-inventory.md`, updated `business-calendar-client-proposal.md`
### Stage 1 — Calendar foundation

- Company calendar  
- Branch calendar inherits company  
- Branch can add own holidays / overrides  
- Working week (full / half / off)  
- Branch timezone validation  
- Business day preview (“what is this date for Kochi?”)

### Stage 2 — Events + editable publish

- Calendar Draft → Review → Publish flow  
- **Edit after publish** (with audit trail)  
- Holiday fields: business-day impact, Paid Holiday, full/half, override, company/branch scope  
- Informational events (meeting/celebration/training)

### Stage 3 — Connect workforce

- Leave uses calendar for chargeable days + show on employee calendar  
- Attendance uses working/holiday rules  
- Shift roster uses business day + shift  
- Company / Branch / Employee calendar views

### Stage 4 — Imports

- Excel / CSV / ICS  
- Always HR review before live  
- Then Government API: **India (national + state)** and **Middle East** first

### Stage 5 — Later

- More countries  
- Payroll / Projects consumers  
- Advanced reporting  

---

## 5. Easy talk script (updated — after client confirmation)

Use this when explaining the **agreed** direction.

### Opening

> “Thank you for the confirmation.  
> We will build the Business Calendar as agreed.  
> One main company calendar; each office/branch inherits it and can add local holidays.  
> Published calendars stay editable when holidays change later, with proper tracking.  
> We will build in stages.”

### Point-by-point (agreed)

1. **Company calendar** is the main calendar. If there is no branch, use company calendar only.  
2. **Each branch/office** gets its own calendar that **inherits** the main company calendar.  
3. **Branch can add its own holidays** and working-day exceptions.  
4. **Branch timezone** is used for Leave, Attendance, Shift, and calendars.  
5. **Imported holidays** always need **HR review** before going live.  
6. **Published calendar can be edited** (holidays may change later). Changes are tracked; locked history is not auto-changed.  
7. **Government holidays:** start with **India (including state-wise)** and **Middle East**; expand to more countries later.  
8. **HR and Admin** can create, review, and publish.  
9. **Leave** stays in Leave module and only shows on calendars.  
10. Calendar is used by Leave, Attendance, Shift, Employee Workspace; later Payroll and Projects.

### Closing

> “Next we will prepare the Stage 1 build plan based on this confirmation.  
> We will come back with timeline and first delivery scope.”

---

## 6. Open points (optional to clarify later — not blocking)

These were not fully answered; fine to decide internally or ask later:

- Exact maker-checker: can the same HR user publish, or must Admin always publish?  
- When editing a published holiday that already affected open leave requests — warn only, or block?  
- Middle East: which countries first (UAE, Qatar, Saudi, others)?  
- India: which states in phase 1?

---

## 7. One-line summary for chat

> Client confirmed company→branch inheritance, branch holidays, branch timezone, HR review on imports, HR+Admin roles, India+Middle East (state-wise India). **Change:** published calendars must remain **editable** (not locked). Build in stages; do not auto-change locked history.

---

*End of confirmed decisions + plan.*
