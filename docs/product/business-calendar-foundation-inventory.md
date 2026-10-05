# Business Calendar — Existing ERP foundation inventory

**Phase 0 task 0.4**  
**Purpose:** Know what we reuse vs what we must build new in Phase 1+.

---

## Already in the product (reuse / extend)

| Area | What exists today | Where | Reuse plan |
|------|-------------------|-------|------------|
| Company / Branch | Org hierarchy | Admin UI + Prisma `Company`, `Branch` | Base for calendars |
| Branch timezone | Optional `Branch.timezone` | Prisma Branch | Required & validated in Phase 1 |
| Working week | `BranchWorkingDay` (day of week, working flag, day portion) | Prisma + likely admin/branch setup | Evolve into Calendar Working Week / keep as branch default input |
| Holidays | `Holiday` (company, optional branch, date, type, day portion) | `/hr/leave/holidays` + holiday module | Migrate/extend toward Business Events; keep data if possible |
| Shifts | `Shift` | `/administration/shifts` | Used with roster in Phase 3 |
| Employee ↔ Shift assign | API `POST /employee-shifts` | **No UI** | Build UI in Phase 3 (known gap) |
| Shift Roster | Generate / publish / override | `/hr/work-schedule` | Consume business-day runtime in Phase 3 |
| Leave | Types, policies, balances, requests, approve | `/hr/leave/*`, `/me/*` | Keep module; use calendar for chargeable days + display |
| Attendance | Check-in/out, exceptions, periods | `/hr/attendance*`, `/me/attendance*` | Use calendar for expected day / holiday |
| Workforce calendar | Privacy-aware assembly; HR / team / self | `/hr/leave/calendar`, `/me/workforce-calendar` | Extend toward Company / Branch / Employee Business Calendar views |
| Permissions | Tenant roles + leave/holiday/calendar permissions | Security module | Add calendar-manage permissions for HR/Admin |
| Audit / security events | Existing auth/audit patterns | Backend | Reuse pattern for post-publish calendar edits |

---

## Missing today (must build)

| Capability | Needed for |
|------------|------------|
| Calendar Profile (e.g. India / UAE) | Multi-country company calendars |
| Calendar Version + Draft/Review/Publish | Controlled go-live |
| Edit-after-publish + audit | Client confirmation |
| Unified Business Event model (holiday + informational) | Calendar-first event UX |
| Business Day Preview (“why is this date off?”) | HR confidence before publish |
| Single Business Calendar Runtime API | Shared by Leave/Attendance/Shift |
| Import pipeline (Excel/CSV/ICS) with review | Phase 4 |
| Government holiday API (India state + Middle East) | Phase 5 |
| Assign shift to employee UI | Phase 3 demos |

---

## Suggested pilot data for Phase 1 build/demo

| Item | Suggested value | Notes |
|------|-----------------|-------|
| Company | Datascape Technology Kowdiar (`COM-000002`) | Already used in local UAT |
| Branch | Kowdiar (`BR-000002`) | Has timezone / working calendar history |
| Second branch (optional later) | Another India branch or ME branch | Tests inheritance + local holiday |
| Country profile v1 | India Calendar | Matches client “India first” |
| Middle East | Add in Phase 5 (or late Phase 1 profile shell only) | After India path works |

---

## Risk notes

1. Current `Holiday` and `BranchWorkingDay` are simpler than the full Business Calendar design — plan a **migration path**, do not delete blindly.  
2. Workforce calendar today is more “projection of leave/attendance” than “authoritative business-day engine” — Phase 1–2 add the engine; Phase 3 rewires consumers.  
3. Client editable-publish means runtime must support **live rule changes** without rewriting locked periods.

---

*End of inventory.*
