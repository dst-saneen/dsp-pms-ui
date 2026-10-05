# Easy product brief — Calendar, Leave, Shift & what to change

**What this file is for:**  
Share this with the team so everyone understands **how the system works today**, **what feedback asked for**, and **what is missing**.  
No coding decision is final until this is reviewed and priorities are confirmed.

**Language:** Simple steps. Short sentences.

---

## Part 1 — Big picture (read this first)

The feedback wants the product to feel like this:

1. **Calendar is the center** (company → branch → holidays/events on it).  
2. **Employee calendar** shows leave + check-in / check-out.  
3. **Leave** is a clear path: apply → approve → show on calendar.  
4. **Shift** is assigned to each employee (easy in the screen — not only API).  
5. **Top admin** sees all admin menus.  
6. **Later:** work/tasks and onboarding tasks with upload → accept / reject.

**Start with:** Calendar + holidays/events.  
**Also call out clearly:** Shift assign has **no UI today** — that confuses demos.

---

## Part 2 — Calendar (what they want)

### Simple idea

```
Company
  └── Calendar (company holidays / events)
        └── Branch
              └── Calendar (branch holidays / events)
                    └── Employee personal calendar
                          (leave + login/logout + day type)
```

### What they want (easy list)

| # | Want |
|---|------|
| 1 | Company-wise calendar |
| 2 | If there are branches → branch calendar under that company |
| 3 | Holidays / vacations / events visible **on the calendar** |
| 4 | Add / update holiday preferably **from the calendar** (event style) |
| 5 | Link **public / government** holidays if possible |
| 6 | Employee calendar shows **leave** and **check-in / check-out** |

### What we have today (simple)

| Topic | Today |
|-------|--------|
| Holidays | Separate page under Leave → Holidays |
| Calendars | HR calendar + My Workspace personal calendar exist |
| Public/govt holidays | Not a clear “import / link public holidays” feature |
| Employee day detail | Leave / day type partly there; full login–logout story on calendar needs strengthening |

### Gap in one line

**Wanted:** calendar-first event/holiday management.  
**Today:** calendars + separate holiday list — not fully matching the vision.

---

## Part 3 — Leave flow (step by step)

### A) How leave works **today** (current)

Do these in order. This is the real path in the product now.

| Step | Who | Where | What happens |
|------|-----|--------|----------------|
| 1 | Admin | Leave → Types | Create leave type (example: Casual Leave) |
| 2 | Admin | Leave → Policies | Create policy for **company + branch + leave type** (rules: days per year, etc.) |
| 3 | Admin | Leave → Balances → Generate | Create **balance** for employees for the year (policy alone is not enough) |
| 4 | Admin | Employees | Set employee’s **Manager** |
| 5 | Admin | Users | Create login, **link** to employee, give **role** |
| 6 | Employee | My Workspace → Apply Leave | Choose type, dates, submit |
| 7 | System | (automatic) | Finds approval step → usually **reporting manager** |
| 8 | Manager | Leave → Requests (needs leave permission) | Approve or Reject |
| 9 | System | (automatic) | Balance updates; leave can show on calendars |

**Important today**

- Leave **type** ≠ leave **policy** ≠ leave **balance**. All three needed.  
- HR admin can often **see** requests; only the **eligible approver** (usually manager login) can approve.  
- Manager needs leave permissions (or a role that includes them) to see Leave menu.

### B) What feedback wants for leave + calendar

| Today | Wanted |
|-------|--------|
| Leave works as a form + approval path | Keep that flow |
| Leave appears in places, but calendar is not the “main story” | After approve, leave is **clearly visible on company / branch / employee calendars** |
| Holidays managed mainly as a separate list | Holidays/events managed **with the calendar** |

So: **do not throw away leave apply/approve**.  
**Improve:** how leave + holidays show and are managed on calendars.

### C) Leave flow picture (easy)

```
Admin setup
  Types → Policy → Balances → Manager link → User login
        ↓
Employee applies leave (My Workspace)
        ↓
Manager approves / rejects
        ↓
Balance updates
        ↓
Leave visible on calendars  ← feedback wants this very clear
```

---

## Part 4 — Shift & Work Schedule (this confuses people — read carefully)

### Two different things (do not mix)

| Name | Meaning | Easy example |
|------|---------|--------------|
| **Shift** | Working hours template | “General Shift 09:00–17:00” |
| **Assign shift to employee** | This person **uses** that shift | Staff → General Shift |
| **Work Schedule (roster)** | Calendar of days for a period | Generate Aug roster → Publish |

**Work Schedule does not replace “assign shift to employee.”**  
It uses the assignment after it exists.

### How shift should work (wanted / correct business order)

| Step | What | Ideal place |
|------|------|-------------|
| 1 | Create shift | Administration → Shifts **(UI exists)** |
| 2 | **Assign shift to employee** | Should be on Employee or Shift screen **(UI missing today)** |
| 3 | Generate work schedule / roster | HR → Work Schedule **(UI exists)** |
| 4 | Publish roster | Work Schedule **(UI exists)** |
| 5 | Employee sees “Today’s Shift” | My Workspace |

### What happens **today** (honest)

| Step | Today |
|------|--------|
| Create shift | ✅ In UI |
| Assign shift to employee | ❌ **No UI** — only backend API (`POST /employee-shifts`) |
| Generate / publish roster | ✅ In Work Schedule UI |
| Today’s Shift on My Workspace | Works **only if** assignment (step 2) was done |

### Why demos break

People open **Work Schedule** and expect to “give staff a shift.”  
That screen only builds the **period roster**.  
Without step 2, roster warns / days have no shift / My Workspace looks empty.

### What to tell reviewers (one sentence)

> **Missing product piece:** “Assign default shift to employee” screen. Backend exists; UI does not. This must be added so the calendar / attendance story matches feedback.

### Easy shift picture

```
✅ Create Shift (UI)
      ↓
❌ Assign Shift → Employee   ← GAP (API only today; needs UI)
      ↓
✅ Work Schedule generate + publish (UI)
      ↓
✅ Employee sees Today’s Shift / can check in
```

---

## Part 5 — Admin visibility & roles (short)

| Topic | Today | Wanted |
|-------|--------|--------|
| Menus | Shown by **permissions** | Same idea, but **top admin** must see **all** admin options |
| Roles screen | System roles locked; custom role edit needs `security.roles.manage` | Clear role packages (including Project Management style access) |
| Project / work schedule language | Mostly **shift roster** | Feedback also wants **work/task** style scheduling later |

---

## Part 6 — Later (not first): tasks & documents

Not the first build. Capture so it is not lost.

1. Department / onboarding tasks on a schedule  
2. Deadline for employee (auto-assign where possible)  
3. Employee completes by **uploading document**  
4. Manager **verifies** → **Accept** (next phase) or **Reject** (fix again)

This is separate from shift roster. Treat as a **later phase**.

---

## Part 7 — Priority (simple)

| Order | Focus | Note |
|-------|--------|------|
| **1st** | Company / branch calendar + holidays/events on calendar (+ public holidays if agreed) | Main feedback start |
| **2nd** | Employee calendar shows leave + check-in/out clearly | Completes calendar story |
| **2nd** | Top admin full menus | Demo / operations confidence |
| **Must fix for demos** | **UI to assign shift to employee** | Blocking for schedule/attendance story |
| **Later** | Work/task schedule language + doc verify phases | After calendar foundation |

---

## Part 8 — Questions for final decision

Please answer yes/no or choose:

1. For holidays v1: manage **inside calendar only**, or calendar + simple form linked to calendar — OK?  
2. Public/govt holidays: **manual select**, or **auto import**? Which country/region?  
3. Confirm: build **Assign Shift to Employee** UI as a required item with calendar work?  
4. Keep leave apply/approve flow as-is, and only improve **calendar visibility**?  
5. Task upload → accept/reject: part of **Onboarding**, new module, or later backlog only?

---

## Part 9 — One-page cheat sheet

| Area | Current | Wanted |
|------|---------|--------|
| Calendar | Exists, but holidays feel separate | Company → branch calendars; events/holidays on calendar |
| Leave | Type → policy → balance → apply → manager approve | Same flow + leave clear on calendars |
| Shift assign | API only | Proper UI step before Work Schedule |
| Work Schedule | Generate/publish roster | Keep; use after shift assign |
| Top admin | Depends on role permissions | All admin options visible |
| Tasks / docs | Partly in onboarding ideas | Later: upload → verify → accept/reject |

---

## Part 10 — Suggested next step (process only)

1. Review this file together.  
2. Confirm priority list (especially calendar + shift-assign UI).  
3. Get a **final scope update** in writing.  
4. Then create tickets / build.  

**Do not start a big rebuild until priorities are confirmed.**

---

*End of easy brief.*
