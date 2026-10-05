# WP-06 Baseline

Date: 2026-08-05

## Scope

Implemented Overtime eligibility, request lifecycle, Comp-off credit settlement, and FIFO leave allocation for Workforce Time Management.

Delivered:

- Overtime eligibility calculator with early-arrival exclusion, late-makeup exclusion, holiday/week-off net-work eligibility, and 15-minute round-down + 30-minute minimum.
- `OvertimeRequestService` lifecycle: CALCULATED (from attendance checkout/correct) → SUBMITTED → APPROVED/SETTLED or REJECTED; CALCULATED/SUBMITTED → CANCELLED.
- Fresh eligibility recalculation on submit and approve.
- Comp-off credit creation on COMP_OFF settlement (240→0.5 day, 480→1 day, max 1 day/source, 90-day expiry).
- PAYROLL_PENDING preserves approved minutes without monetary calculation.
- FIFO Comp-off reservation/consumption/release wired into Leave submit/approve/reject/cancel.
- Comp-off revoke (unused/unreserved only) and hourly expiry evaluator method.
- Overtime policy CRUD routes and Comp-off credit read/revoke routes.
- Self-service `GET/POST /me/overtime*` and `GET /me/comp-off`.

## Key routes

- `GET|POST /overtime-policies`, `GET|PATCH /overtime-policies/:id`
- `GET /overtime-requests`, `GET /overtime-requests/:id`
- `POST /overtime-requests/:id/submit|approve|reject|cancel`
- `GET /comp-off-credits`, `GET /comp-off-credits/:id`, `POST /comp-off-credits/:id/revoke`
- `GET /me/overtime`, `POST /me/overtime/:id/submit|cancel`, `GET /me/comp-off`

## Verification

```text
npx tsc --noEmit -p tsconfig.build.json
npx jest src/modules/overtime-request src/modules/comp-off src/modules/leave-request/leave-request.service.spec.ts src/modules/attendance/attendance.service.spec.ts --passWithNoTests
```

Result:

- TypeScript build check passed.
- Focused Jest suites passed: `4` suites, `33` tests.

## Acceptance mapping

- 29/30/44/45-minute boundaries: covered by eligibility unit tests (round-down then minimum).
- One concurrent approval/credit creation wins: `updateMany` status guards + unique `overtimeRequestId` on credits.
- FIFO, expiry and cancellation: allocation service FIFO order; expiry evaluator idempotent; leave cancel restores only unexpired consumed credits.
