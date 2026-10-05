# WP-05 Baseline

Date: 2026-08-05

## Scope

Implemented the immutable leave ledger for Workforce Time Management.

Delivered:

- Added `LeaveBalanceLedgerService` to centralize immutable leave balance transactions.
- Updated yearly leave balance generation to create ledger-backed entitlement and carry-forward entries.
- Updated leave submit to reserve balance through the ledger.
- Updated leave approval to consume the reservation through the ledger.
- Updated leave rejection and cancellation flows to release or reverse ledger amounts without mutating prior rows.
- Preserved existing leave request response fields and state-machine behavior.

## Key behaviors

- Every balance mutation now writes `leave_balance_transactions` before the aggregate balance is finalized.
- Aggregate `employee_leave_balances` rows are recalculated from ledger after-values on each mutation.
- Reservation moves days from available balance to pending.
- Consumption converts pending days to used days without double-consuming balance.
- Rejection and submitted cancellation release reserved days back to available balance.
- Approved cancellation reverses used days back to available balance.
- Generation creates separate carry-forward and entitlement entries where applicable.

## Verification

Focused backend verification completed:

```text
npx tsc --noEmit -p tsconfig.build.json
npx jest src/modules/employee-leave-balance src/modules/leave-request/leave-request.service.spec.ts --passWithNoTests
```

Result:

- TypeScript build check passed.
- Focused Jest suites passed: `3` suites, `22` tests.

## Acceptance mapping

- Ledger equals aggregate balance: enforced by ledger reconciliation before commit.
- Concurrent approval cannot consume twice: existing serializable transactions remain in place; consumption is now idempotency-keyed per request action.
- Audit failure rolls back balance and request: ledger writes occur inside the same transaction as request state changes and audit logging.
