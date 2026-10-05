# WP-04 Evidence — Roster-aware Attendance

**Status:** Complete  
**Date:** 2026-08-05  
**Branch:** `feat/workforce-time-management-wp`

---

## 1. Acceptance checklist

| Criterion | Result |
| --- | --- |
| Shared Branch-time service | Pass — `BranchTimeService` |
| Resolve + snapshot roster at check-in | Pass — published/locked `ShiftRosterEntry` snapshotted onto Attendance |
| Check-out vs adjusted scheduled minutes | Pass — roster-aware metrics util |
| 30-minute late boundary | Pass — exactly +30:00 On Time; later Late |
| 90% / 50% day thresholds | Pass — PRESENT / HALF_DAY / ABSENT |
| Idempotent exceptions | Pass — unique `dedupeKey` upsert |
| Finalizer | Pass — `AttendanceFinalizerService.finalizeBatch` (+ manual route) |
| Regularization lifecycle | Pass — submit / approve / reject / cancel + approval workflow |
| Attendance periods + blockers | Pass — OPEN→REVIEW→LOCKED→PAYROLL_PENDING→CLOSED; lock blockers |
| Existing API compatibility | Pass — check-in / check-out / correct retained |
| Locked period rejects modification | Pass — `ATTENDANCE_PERIOD_LOCKED` |
| Audit in same transaction | Pass — check-in/out/correct |

---

## 2. Key behaviors

### Check-in
1. Resolve Attendance policy (Branch → Company → system default).
2. Resolve published/locked roster entry for employee + branch business date.
3. Snapshot schedule fields onto Attendance.
4. Apply late grace from policy (default 30m).
5. Create `LATE` and/or `UNSCHEDULED_WORK` exceptions idempotently.
6. Fallback to EmployeeShift when no roster (legacy compatibility).

### Check-out
1. Prefer snapshotted roster schedule for classification.
2. Net worked minutes = punch span − scheduled break.
3. Classify by % of adjusted scheduled net minutes (90/50).
4. Create `EARLY_DEPARTURE` / `INSUFFICIENT_HOURS` when applicable.

### Regularization
- Window from policy `regularizationWindowDays` (default 3).
- Workflow `ATTENDANCE_REGULARIZATION` (company → global).
- Approve corrects punches and resolves related exceptions atomically.

### Periods
- Lock blocked while open missing-punch exceptions or submitted regularizations exist.

---

## 3. Routes added

| Method | Route |
| --- | --- |
| GET | `/attendance/exceptions` |
| GET | `/attendance/exceptions/:id` |
| GET/POST | `/attendance/regularizations` |
| POST | `/attendance/regularizations/:id/{approve\|reject\|cancel}` |
| POST | `/attendance/finalize-batch` |
| CRUD/transitions | `/attendance-periods` |

---

## 4. How to re-verify

```bash
cd backend
npx jest src/modules/attendance
npx tsc --noEmit -p tsconfig.build.json
```

---

## 5. Next

**WP-05** — Leave ledger (immutable transactions on submit/approve/reject).
