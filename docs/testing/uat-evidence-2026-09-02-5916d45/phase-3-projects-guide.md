# Phase 3 — Projects Lite Browser Guide

**Date:** 2 September 2026  
**For:** Manual steps PROJECT-01 to PROJECT-03 (you do these in the browser)

---

## Before you start

| Check | Status |
|-------|--------|
| Backend `:4500` | Running |
| Frontend `:3200` | Running |
| `PROJECTS_LITE_ENABLED=true` | Yes |
| Sign in company | **Learn Fresh Company 01** / **Learn Fresh HQ 01** |

---

## Which login to use

| Step | Login | Why |
|------|-------|-----|
| PROJECT-01 (create + activate) | **Organization Owner** — `saneen577@gmail.com` or `msaneen.dev@gmail.com` | Has `projects.projects.manage` |
| PROJECT-02 (stages, tasks) | Same Org Owner (acts as Project Manager) | PM actions |
| PROJECT-02 (assignee work) | **Employee** — `learnfresh.emp01@example.test` | Has `projects.tasks.work` |
| PROJECT-03 (timesheets) | Employee submits · Org Owner approves | Submit + approve permissions |

**Do not use** `learnfresh.hr01@example.test` for project creation — HR Manager has **no** project manage permission.

---

## PROJECT-01 — Create and activate (≈20 min)

1. Sign in as **Org Owner** (`saneen577@gmail.com`).
2. Sidebar → **Project Management** → **Projects**  
   URL: `http://localhost:3200/projects/projects`
3. Open baseline **`PRJ-000001`** (`E2E Internal UAT-2828`) — read-only compare, status **DRAFT**.
4. Click **New Project** (or Create).
5. Fill in:
   - **Name:** `UAT-2026-09-02-01` (unique)
   - **Type:** Internal
   - **Branch:** Learn Fresh HQ 01
   - **Project Manager:** pick an active employee with a user link (e.g. **Mohammed Saneen V** / `msaneen.dev@gmail.com`)
6. **Save** → note the new **Project ID** and **version** from the URL or detail page.
7. Edit dates / commercial fields → save → refresh → confirm values stick.
8. **Negative tests** (expect clear errors, form keeps your data):
   - Wrong branch ID (if UI allows manual override)
   - Inactive or wrong-company manager
   - Attach Business Party on Internal project → should fail
9. **Activate** the valid project.
10. Sign in as **Employee** (`learnfresh.emp01@example.test`) → confirm you **cannot** manage stages (no PM actions).
11. Sign back in as Org Owner / PM → confirm **Activate**, **Edit**, etc. show in UI (from server `allowedActions`).

**Pass when:** One new project created, invalid inputs rejected, project activated once.

---

## PROJECT-02 — Stages, tasks, completion (≈30 min)

Use the **activated project** from PROJECT-01.

1. As **PM (Org Owner)**:
   - Create a **Stage** → activate it
   - Add **Team member** — e.g. Jamie Employee (`learnfresh.emp01@example.test`)
   - Create **Task** under the stage → assign to Jamie
2. Before start: **Unassign** task → should succeed
3. **Reassign** to another team member
4. Sign in as **Jamie Employee**:
   - **Start** the task
   - Confirm unassign is **no longer** available
5. As PM: **Reassign in-progress** task with a **reason**
6. As **former assignee**: try submit → **denied**
7. As **current assignee**: **Submit** work (text evidence if no file upload)
8. As PM: **Return** with mandatory reason
9. As Employee: fix and **resubmit**
10. As PM: **Complete** task
11. **Complete stage** → try **complete project** with unfinished work → blocked → finish work → complete project
12. Try to mutate child after project completed → **rejected**

**Pass when:** Roles enforced, reasons saved, terminal state blocks edits.

---

## PROJECT-03 — Timesheets (≈20 min)

1. As **Jamie Employee** → **My Workspace** → **Timesheets**  
   URL: `http://localhost:3200/my-workspace/timesheets`
2. Create **weekly timesheet**
3. Add lines for your project/task and work dates
4. Edit/remove draft lines
5. Try **> daily hours limit** → should fail
6. **Submit** timesheet
7. Try edit after submit → **denied**
8. As **wrong manager** (if you have one) → approve attempt → **denied**
9. As Employee → self-approve → **denied**
10. As **Org Owner** (reporting manager) → **Return** with reason
11. Employee corrects → **resubmit**
12. Org Owner **approves**
13. Open **Project Time Summary** → approved hours visible

**Pass when:** Validation works, wrong/self approval blocked, summary shows approved time only.

---

## PROJECT-04 — File upload

**Status: Blocked** — `FILE_STORAGE_V2` and `CLAMAV_HOST` not configured (ENV-04).

Skip until your lead provides S3 + ClamAV. Not a Fail.

---

## What to save for your lead

Screenshots in `docs/testing/uat-evidence-2026-09-02-5916d45/`:

- New project detail (ID + version)
- Activated project status
- Task submit/return/complete history
- Timesheet submit + approve
- Any error messages from negative tests

---

## Tell your lead when done

> “Phase 3 complete — PROJECT-01/02/03 Pass, PROJECT-04 Blocked (no file storage).”

Or if stuck:

> “Phase 3 Partial — preflight OK, blocked on [login / PM account / specific step].”
