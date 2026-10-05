# Historical production-fix flow (through W13)

> **Historical evidence only.** This guide records the old synthetic
> `PFC-20260917` test wave. Its W0–W19 passes do not approve the merged
> staging architecture, and must not be used as current release evidence.

- Test company: **PFC-20260917**
- **Start here for Setup→W8 (connected story):** [`production-fix-flow-setup-through-w8.md`](./production-fix-flow-setup-through-w8.md)
- Full scoreboard: [`production-fix-wave-tracker.md`](./production-fix-wave-tracker.md)
- Acceptance: [`wave-19-acceptance-record.md`](../development/wave-19-acceptance-record.md)

---

## Why W0–W7 looked “skipped”

They were **not skipped**. On this tenant sprint:

1. **Setup + W0–W7** — mostly engineering / earlier gates (flags, UX, designation, org, admin, employees, recruitment).
2. **W8 onward** — full Owner/HR + colleague persona Pass on the same company.
3. **W19** — acceptance pack; production still **NO-GO** until SIGN-001.

Read the Setup→W8 guide above for the full chain and links.

---

## Order of work (after hire)

1. Company and people ready *(Setup, W3, W6)*
2. Onboarding *(W8 — Pass)*
3. Calendar, shifts, Work Schedule publish *(W9 — Pass)*
4. Attendance punch *(W10 — Pass)*
5. Leave / Overtime *(W11 — Pass)*
6. Assets *(W12 — Pass)*
7. HR Request / Separation *(W13 — Pass)*
8. Projects → Timesheets → Finance → Payroll → Ops → Sign-off *(W14–W19)*

---

## Status

| Wave | Status |
|------|--------|
| Setup → W7 | Done (eng / earlier Pass — see Setup→W8 guide) |
| **W8** Onboarding | **Pass** |
| **W9** Calendar + Work Schedule | **Pass** |
| **W10** Attendance | **Pass** |
| **W11** Leave + Overtime | **Pass** |
| **W12** Assets | **Pass** |
| **W13** HR Request + Separation | **Pass** |
| **W14–W18** | **Pass** (see tracker) |
| **W19** Acceptance | Engineering pack done; SIGN pending; **NO-GO** until sign-off |

---

## How each part works (W8–W13)

**Onboarding (W8)**
- HR assigns tasks
- Employee completes them
- Tasks are closed when done

**Work Schedule (W9)**
- Publish business calendar
- Create shifts
- Generate and publish Work Schedule
- Employee sees shifts on My calendar

**Attendance (W10)**
- Punch only on a published working day

**Leave / Overtime (W11)**
- Employee submits
- Approval and settle follow the leave/OT path
- Not the same as HR Request

**Assets (W12)**
- Assign asset
- Employee acknowledges
- Return / transfer / grant as needed

**HR Request (W13)**
- For letters / paperwork while still employed
- HR creates the request type once
- Employee submits → Manager Approves → HR Completes

**Separation (W13)**
- For leaving the company
- HR starts exit → clearance / assets → HR Completes

---

## Do not mix these up

| Need | Wave |
|------|------|
| Work Schedule | **W9** |
| Letter / certificate | **W13** HR Request |
| Leave / OT | **W11** |
| Leaving company | **W13** Separation |
| Project tasks / timesheets | **W14–W15** |
| Feature flags / allowlists | **W0** |
| Hire candidate → convert | **W7** then **W8** |

---

## Historical menu evidence (W8–W13)

These menu names are retained to explain the old captures. Current navigation
must be revalidated against the active workflow plan.

**Onboarding (W8)**
- Human Resources → Employee Onboarding
- My Workspace → Onboarding

**Work schedule (W9)**
- Administration → Business Calendar
- Administration → Shifts
- Human Resources → Work Schedule
- My Workspace → My calendar

**Attendance (W10)**
- My Workspace → Overview (Check in / Check out)
- Human Resources → Attendance

**Leave / Overtime (W11)**
- Human Resources → Leave / Overtime
- My Workspace → Leave form / Approvals

**Assets (W12)**
- Assets & licences section
- My Workspace → My assets & licences

**HR operations (W13)**
- Human Resources → HR Requests / Employee Separations
- My Workspace → HR requests / Approvals

**Projects (W14+)**
- Project Management → Projects / Team timesheets
- My Workspace → Projects / Timesheets
