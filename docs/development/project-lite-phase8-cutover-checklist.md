# Project Lite Phase 8 cutover checklist

Use this before setting `PROJECTS_LITE_ENABLED=true` for a pilot company.
Feature enablement is prohibited while any unsafe legacy mutation bypass remains.

## 1. Code gates (must be green)

- [ ] Legacy mutations return `PROJECTS_LEGACY_ROUTE_DISABLED`:
  - `/project-stages`, `/project-team-members`, `/project-tasks`
  - `/task-participants`, `/task-submissions`, `/task-reviews`
  - `/work-log-header`, `/work-log-line`, `/task-work-session`
- [ ] Generic Approval rejects `WORK_LOG_HEADER` with `TIMESHEET_LEGACY_APPROVAL_DISABLED`
- [ ] Nested V2 APIs are the only write path: `/projects`, `/me/project-tasks`, `/me/timesheets`, `/team/timesheets`
- [ ] Foundation tests pass:

```bash
cd backend
npm run test:foundation -- --testPathPatterns=project-lite
```

## 2. Migration rehearsal

- [ ] From-zero migrate on a clean database
- [ ] Production-like migrate on a restored backup
- [ ] Preflight report reviewed (`pnpm run migration:projects:preflight`)
- [ ] Mapping template completed for every Client Project (`pnpm run migration:projects:mapping-template`)
- [ ] Backfill dry-run then apply (`pnpm run migration:projects:backfill`)
- [ ] Integrity checks green (`pnpm run migration:projects:integrity`)

## 3. Catalog / permissions

- [ ] Permissions seeded: `projects.projects.read|manage`, `projects.tasks.work`, `projects.timesheets.submit|approve`
- [ ] Pilot roles include only the needed codes
- [ ] Route policy still prefers `/projects`, `/me/project-tasks`, `/me|team/timesheets` before generic `/me`

## 4. API / browser personas (non-mock)

1. Organization Owner sees Projects only for an enabled Company
2. Project Manager creates Client/Internal Project, stages, team, tasks
3. Assigned Employee starts work, submits review, logs time
4. Another Employee cannot mutate that task
5. Project Manager returns/completes task work
6. Employee submits a weekly timesheet
7. Correct reporting manager approves; wrong manager / self-approval denied
8. Project detail time summary consistent; Finance Summary shows `enabled: false` until Office Finance
9. Another Company cannot list/open/mutate records or files

## 5. Secure files and notifications

- [ ] Upload → quarantine → CLEAN → link via project attachment API
- [ ] Non-CLEAN / cross-company FileObject link denied
- [ ] Outbox events fire for lifecycle, team, task, timesheet (handlerKind `PROJECT`)

## 6. Enablement (operator)

Keep disabled until sections 1–5 pass:

```env
PROJECTS_LITE_ENABLED=false
PROJECTS_LITE_COMPANY_IDS=
```

Pilot enablement (production must list companies; empty allowlist = all companies, dev only):

```env
PROJECTS_LITE_ENABLED=true
PROJECTS_LITE_COMPANY_IDS=<pilot-company-uuid>
```

- [ ] Backup/restore rehearsal recorded
- [ ] Lint / type-check / build / test evidence attached
- [ ] Monitoring alerts reviewed
- [ ] Technical sign-off
- [ ] Business sign-off
- [ ] Add next companies to the allowlist only after pilot acceptance

## 7. Explicit non-goals at this cutover

- Resource heatmap (`/projects/resources`) remains deferred
- Office Finance profit/margin fields remain absent (`enabled: false` stub)
- No `NEXT_PUBLIC_PROJECTS_LITE_*` flag — UI uses permissions + server `allowedActions`
