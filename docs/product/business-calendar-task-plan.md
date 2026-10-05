# Business Calendar — Beginner guide (maps to manager work order)

**Important:** This file is only a **simple explanation**.  
**Real build plan to follow:** `business-calendar-development-work-order.md` (from delivery lead).

Do **not** invent a second stage list. When coding, open the work order stage section and do those tasks.

---

## Which document is which?

| File | What it is | Follow for coding? |
|------|------------|--------------------|
| `business-calendar-client-proposal 1.md` | **Confirmed client baseline** (what the client agreed) | For **rules**, not for day-to-day coding steps |
| `business-calendar-development-work-order.md` | **Manager engineering plan** (DB, APIs, stages 0–10, tests, rollout) | **YES — primary** |
| This file (`docs/product/business-calendar-task-plan.md`) | Easy map so you understand the work order | Support only |
| Older Phase 0–5 plan we wrote earlier | Superseded by the manager work order | **Do not use for build** |

### About the proposal file you asked about

`business-calendar-client-proposal 1.md` is the **updated / confirmed** proposal:

- Section **20** has the real client answers (including **published calendars stay editable** + amendment history).
- Section **6** still has an **old line**: “published version is immutable.”  
  That old line is **overridden** by Section 20 and by the manager work order.

**How editable publish really works (manager plan):**  
User can edit a published calendar, but the system creates an **amendment revision** (history kept). It does not secretly overwrite the past evidence. Locked Attendance/Payroll still not auto-changed.

---

## Client rules (must always keep)

From proposal §20 + work order §1:

1. Every office needs an effective calendar.  
2. Company calendar = main office.  
3. No branch → use company calendar.  
4. Branch calendar inherits company + can add own holidays/overrides.  
5. Branch timezone is authoritative.  
6. Imports need HR/Admin review before live.  
7. Published calendars stay **editable** via **amendments** (history kept).  
8. Support all countries later; first focus **India + Middle East**; India **state-wise**.  
9. HR and Admin create / review / publish / amend.  
10. Leave, Attendance, Shift, Payroll stay separate modules — they **consume** calendar results.  
11. Meetings etc. usually do not change business-day unless explicitly allowed.

---

## Manager stages (easy map)

Use this to understand. Details = work order sections 11–21.

```
0  Baseline / compatibility audit
1  Database + permissions foundation
2  Calendar admin APIs + tenant security
3  Versions, Working Week, Event editor
4  Publish + amendments + Runtime + Preview
5  Legacy backfill + shadow compare (old holidays/working days)
6  Connect Leave / Attendance / Shift / Workforce Calendar
7  Imports (Excel/CSV/ICS) + India/ME geographic packs
8  Complete frontend
9  Testing + UAT
10 Controlled production rollout
```

| Stage | In one sentence | Done when (simple) |
|-------|-----------------|---------------------|
| **0** | Check what already exists and how Leave/Attendance use holidays today | Inventory + risks written; no breaking changes yet |
| **1** | Create new calendar tables + permissions (additive) | Migration ready; Prisma client generated; tables exist after approved deploy |
| **2** | APIs to create Company/Branch calendars safely | HR/Admin can create/read calendars in scope |
| **3** | Working week + events on a version (draft) | Can edit week and holiday events in draft |
| **4** | Publish, edit-via-amendment, Runtime, Preview | Preview answers “is this day working?”; publish + amend works |
| **5** | Copy old holidays/working days into new model; compare old vs new | Shadow mode shows matching results |
| **6** | Leave/Attendance/Shift start using Runtime (carefully) | Consumers use new calendar without breaking locked history |
| **7** | Import files + India/ME packs with review | Imports stay draft until HR approves |
| **8** | Finish all screens | Full UI flows work |
| **9** | Test + UAT | Sign-off checklist passed |
| **10** | Go live carefully | Production rollout with rollback plan |

**MVP for a working calendar product** ≈ Stages **0–6** (foundation through consumers).  
Imports/gov packs = Stage **7**. Full polish/UAT/prod = **8–10**.

---

## Our old plan vs manager plan

| Our old phases | Closest manager stages | Note |
|----------------|------------------------|------|
| Phase 0 docs | Stage 0 (+ proposal confirm) | Similar |
| Phase 1 foundation + preview | Stages **1–4** (split much finer) | Manager is more detailed |
| Phase 2 events + publish + edit | Stages **3–4** | Edit = **amendments**, not free overwrite |
| Phase 3 Leave/Attendance/Employee views | Stage **6** (+ Stage 5 first) | Shadow before switch |
| Phase 4 imports | Stage **7** | Same idea |
| Phase 5 gov API India/ME | Stage **7** geographic packs | Same idea |
| (missing in our plan) | Stages **8–10** UI completion, UAT, prod | Manager includes these |

**Verdict:** Manager plan is the correct one to execute. It matches client confirmation and is more complete (shadow mode, amendments, rollout).

---

## What I recommend

1. **Follow** `business-calendar-development-work-order.md` for all implementation.  
2. **Keep** this short beginner map (updated) so you understand stages.  
3. **Do not** run a separate “our Phase 1” that conflicts with manager Stage 1–4.  
4. Use `business-calendar-client-proposal 1.md` when you need **what the client approved**.  
5. Ignore old “published immutable” wording in proposal §6; use §20 + work order §4.4.

---

## How we work from now

1. You say: **Start Stage 0** (or Stage 1, etc.).  
2. I open the matching section in `business-calendar-development-work-order.md`.  
3. We complete that stage’s tasks and exit gate only.  
4. Then move to the next stage.

### Progress

| Stage | Status | Evidence |
|-------|--------|----------|
| 0 Baseline audit | **DONE** | `docs/product/business-calendar-stage-0-baseline.md` |
| 1 DB + permissions | **DONE** (migration applied on shared RDS) | `docs/product/business-calendar-stage-1-foundation.md` |
| 2 Calendar admin + tenant security | **DONE** | `docs/product/business-calendar-stage-2-admin.md` |
| 3 Versions + working week + events | **DONE** | `docs/product/business-calendar-stage-3-versions.md` |
| 4 Publish + amendments + runtime | **DONE** | `docs/product/business-calendar-stage-4-publish-runtime.md` |
| 5 Legacy backfill + shadow | **DONE** (tooling; HR activation per office) | `docs/product/business-calendar-stage-5-backfill-shadow.md` |
| 6 Consumers (Leave/Roster/Attendance/WF Calendar) | **DONE** (ACTIVE gate; UAT after all stages) | `docs/product/business-calendar-stage-6-consumers.md` |
| 7 Imports + India/ME geographic packs | **DONE** (API + fixtures; UI polish in Stage 8) | `docs/product/business-calendar-stage-7-imports.md` |
| 8 Complete frontend | **DONE** (routes + tabs; UAT in Stage 9) | `docs/product/business-calendar-stage-8-frontend.md` |
| 9 Testing + UAT package | **DONE** (tech suite green; business checklist ready) | `docs/product/business-calendar-stage-9-testing-uat.md` |
| 10 Controlled production rollout | **DONE** (runbook + CLIs; ops cutover gated) | `docs/product/business-calendar-stage-10-rollout.md` |

---

## Optional cleanup (when you want)

- Keep `docs/product/business-calendar-accepted-decisions.md` as a one-pager, or merge into this file later.  
- Root copy of the work order is fine; if lead expects it under `docs/development/`, we can copy/move later without changing content.

---

*End of beginner map. Source of truth for build: `business-calendar-development-work-order.md`.*
