# Production-fix UAT — full flow summary (for manager)

**Tenant:** ProdFix test company `PFC-20260917` (not production)
**Period:** 17–18 Sep 2026
**Result:** Module waves **Setup → W18 Pass**. Final release still **NO-GO** until named sign-off (W19) and ops items (isolated UAT / secrets / backup).

**Honesty rule we used:** If the screen shows a button, it must work — or be clearly disabled with a reason.

---

## End-to-end path (what we proved)

1. **Company & people ready** — Owner, HR, Manager, Employee can log in.
2. **Platform safe** — Feature flags / menus don’t silently break.
3. **Hire path** — Designation → employees → recruitment → onboarding.
4. **Day-to-day work** — Calendar → punch → leave/OT → assets → HR letters.
5. **Delivery of work** — Projects → timesheets.
6. **Money** — Office Finance → Payroll.
7. **Ops** — Delivery queue / files / retention (empty Delivery queue OK while Delivery V2 is off).
8. **Acceptance pack** — Defect freeze + evidence docs prepared; **human signatures still required for GO**.

---

## Wave → module → pages we covered

| Wave | Module | Main pages / menus tested | Status |
|------|--------|---------------------------|--------|
| **Setup** | Test org | Login; My Workspace smoke (4 personas) | **Pass** |
| **W0** | Production gates | Sidebar module visibility when flags on/off | Eng done* |
| **W1** | Shared UX | Forms, nav, permission gates (pattern used everywhere) | Eng done |
| **W2** | Designations | Administration → Designations (create/edit) | **Pass** |
| **W3** | Org / login land | Dashboard after login (not stuck empty) | Eng done |
| **W4** | Dashboard / My Workspace | Empty widgets honest (empty / retry / not allowed) | Eng done |
| **W5** | Admin & security | Users / roles / menus match role after re-login | Eng done |
| **W6** | Employees & documents | Employees list/detail; employee documents (Clean-only download) | Eng done |
| **W7** | Recruitment | Openings → applications → offer → convert handoff | Eng done* |
| **W8** | Onboarding | HR → Employee Onboarding; My Workspace → Onboarding | **Pass** |
| **W9** | Calendar & work schedule | Business Calendar; Shifts; Work Schedule; My calendar | **Pass** |
| **W10** | Attendance | My Workspace punch; HR Attendance / periods | **Pass** |
| **W11** | Leave & overtime | Leave types/policies/balances/requests; Overtime; Apply leave | **Pass** |
| **W12** | Assets & licences | Categories → Types → Assets → Assign; Employee acknowledge; grants | **Pass** |
| **W13** | HR ops | HR Requests; Employee Separations; My HR requests / Approvals | **Pass** |
| **W14** | Projects | Projects (stages, team, tasks); My Projects | **Pass** |
| **W15** | Timesheets | My timesheets → submit; Team timesheets → approve | **Pass** |
| **W16** | Office Finance | Setup; Transactions create/submit | **Pass** (smoke) |
| **W17** | Payroll | Components → salaries → runs / preflight | **Pass** |
| **W18** | Operations | Delivery Queue; Dead letters; Suppressions; Exceptions; File Operations; Document Retention | **Pass** |
| **W19** | Acceptance | Defect freeze + QA notes + sign-off sheet | Pack done; **SIGN pending** |

\*Live email provider / isolated production-like UAT still open for full production GO.

---

## Personas used

| Role | Who |
|------|-----|
| Organization Owner | Slot A (you) |
| HR Manager | Slot B (you) |
| Project Manager | Slot C (colleague) |
| Employee | Slot D (colleague) |

---

## Known limitations (honest)

- **Delivery V2 is off** → Operations Delivery Queue stays empty by design (LEGACY mode). Pages open; no live mail queue until V2 + keys are enabled.
- **Local file scan** may use development fallback when ClamAV is not configured; production needs a live scanner.
- **W19 GO** needs: commit/tag freeze, named signatures, and ops close (or formal accept) of isolated UAT / secrets / backup-rollback.

---

## Documents (detail)

| Doc | Use |
|-----|-----|
| [`production-fix-wave-tracker.md`](./production-fix-wave-tracker.md) | Full scoreboard + scripts |
| [`production-fix-flow-setup-through-w8.md`](./production-fix-flow-setup-through-w8.md) | Setup→W8 story |
| [`production-fix-flow-through-w13.md`](./production-fix-flow-through-w13.md) | W8→W13 day-to-day path |
| [`wave-19-acceptance-record.md`](../development/wave-19-acceptance-record.md) | Sign-off / GO criteria |

---

## One-line ask for manager

Module UAT on the test tenant is complete through **Operations (W18)**. Please review the **W19 sign-off table** and confirm whether production stays **NO-GO** until ENV/backup/signatures are done, or accept those limits in writing for a conditional pilot.
