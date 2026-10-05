# Business Calendar — Accepted decisions (one-pager)

**Status:** Phase 0 locked — client confirmed  
**Date:** 2026-08-07  
**Product:** Group ERP  

Use this page when anyone asks “what did the client approve?”

---

## Approved design (short)

1. **Company calendar** is the main calendar.  
2. If the company has **no branch**, use the company calendar only.  
3. Each **branch/office** has its own calendar that **inherits** the company calendar.  
4. Branch can add **own holidays** and working-day overrides.  
5. Priority: **Branch override → Company calendar → Working week**.  
6. **Branch timezone** controls Leave, Attendance, Shift, and calendar dates.  
7. Flow: **Draft → Review → Publish → Active** (retire later as needed).  
8. **Published calendar is editable** (holidays may change later) with **audit trail**.  
9. Editing the calendar does **not** auto-change locked Attendance / Leave / Payroll history.  
10. Holiday is a special event type (affects business days). Meetings/celebrations usually display only.  
11. **Leave** stays in the Leave module; it is only **shown** on calendars.  
12. Calendar is used by Leave, Attendance, Shift Roster, Employee Workspace; later Payroll and Projects.  
13. Imports (Excel/CSV/ICS/API) always need **HR review** before going live.  
14. Government holidays: start with **India (national + state)** and **Middle East**; more countries later.  
15. Operators: **HR and Admin**.

---

## Important change from first draft proposal

| First draft | Client decision |
|-------------|-----------------|
| Published version locked; fix only via new version | Published calendar **must stay editable** |

---

## Build order (reminder)

0 Docs (done) → 1 Foundation → 2 Events/publish/edit → 3 Leave/Attendance/Employee views → 4 Imports → 5 Gov API  

**MVP** = Phases 1–3.

---

## Related files

- Full proposal: `business-calendar-client-proposal.md`  
- Task plan: `docs/product/business-calendar-task-plan.md`  
- Confirmed talk notes: `docs/product/business-calendar-client-talk-script.md`  
- Foundation inventory: `docs/product/business-calendar-foundation-inventory.md`
