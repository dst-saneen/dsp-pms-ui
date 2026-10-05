# WP-10 Release Runbook — Workforce Time Management

Date: 2026-08-05  
Default posture: **jobs disabled until pilot policies verified**.

## 1. Pre-deployment

1. Merge only after quality gates in `wp-10-baseline.md` pass.
2. Capture reviewed migration SQL:
   - `backend/prisma/migrations/20260805120000_workforce_time_management_foundation/`
   - `backend/prisma/migrations/20260805140000_workforce_permissions_and_approval_resolution/`
3. Capture database backup evidence (managed RDS snapshot or equivalent).
4. Confirm target database name and schema `dsp_pms`.
5. Confirm Branch timezone + working calendar readiness for pilot Branch.
6. Ensure environment:

```env
WORKFORCE_JOBS_ENABLED=false
WORKFORCE_JOB_BATCH_SIZE=100
ATTENDANCE_FINALIZER_INTERVAL_MINUTES=15
WORKFORCE_OUTBOX_INTERVAL_SECONDS=60
COMP_OFF_EXPIRY_INTERVAL_MINUTES=60
WORKFORCE_OUTBOX_LOCK_TIMEOUT_SECONDS=300
```

7. Stop conflicting migration/deployment activity.

## 2. Deployment (controlled)

```powershell
cd backend
pnpm.cmd exec prisma migrate status
pnpm.cmd exec prisma migrate deploy
pnpm.cmd exec prisma migrate status
```

Then:

1. Deploy backend with workers disabled (`WORKFORCE_JOBS_ENABLED=false`).
2. Deploy frontend (permission-controlled navigation).
3. Verify Company/Branch attendance and overtime policies.
4. Verify global and Company approval workflows:
   - `LEAVE_APPROVAL`
   - `ATTENDANCE_REGULARIZATION`
   - `OVERTIME_APPROVAL`
5. Dry-run first roster for pilot Branch.
6. Publish controlled pilot roster.
7. Enable workforce jobs only after smoke:

```env
WORKFORCE_JOBS_ENABLED=true
```

8. Confirm `GET /workforce-jobs/health` and idempotent outbox processing.

**Do not** run `migrate reset`, destructive suites, or payroll money calculation against production.

## 3. Post-deployment smoke

- Roster list / dry-run / publish
- Employee Shift display
- Check-in / check-out
- Attendance exception + regularization approval
- Leave balance reconciliation
- Overtime calculation
- Comp-off credit
- Workforce calendar privacy
- Period review blockers
- Request-ID + audit correlation
- Job idempotency + safe logging (no leave reasons in stdout)

## 4. Initial rollout boundary

Activate **one** reviewed Company/Branch pilot first.  
Keep approved Overtime in `PAYROLL_PENDING` until a later payroll work order.

## 5. Rollback summary

- Before business data: disable workers, roll back app, reviewed down script only if new tables empty.
- After business data: disable jobs, hide navigation if needed, forward-fix only — do **not** drop roster/ledger/OT/comp-off/outbox history.

## 6. Sign-off holders

| Gate | Owner | Status |
| --- | --- | --- |
| Technical sign-off | Engineering | Pending after pilot smoke |
| Business UAT sign-off | HR / Product | Pending (`wp-10-uat-checklist.md`) |
| Jobs enable approval | Engineering + HR | Pending |
