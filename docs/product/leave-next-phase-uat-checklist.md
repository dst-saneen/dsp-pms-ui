# Leave next phase — UAT checklist

Date: __________  
Environment: __________ (must not be shared `dsp_erp_dev`)  
Pilot company / branch: __________ / __________  
Tester: __________  
Build / commit: __________

Mark Pass / Fail / Blocked. Attach request IDs for failures.

## Prerequisites

- [ ] Phase R pack read (`leave-next-phase-phase-r.md`)
- [ ] Backup / snapshot ID recorded
- [ ] B0 migration applied on this environment
- [ ] Pilot HR fallback exists (not Super Admin)
- [ ] Branch timezone set
- [ ] Tester roles: Employee, Reporting Manager, HR (or Company Admin)

## Workflows

| # | Workflow | Pass | Fail | Notes / request ID |
|---|----------|------|------|--------------------|
| 1 | Matrix: load pilot branch, save dirty cells, balances **not** rewritten | | | |
| 2 | Matrix stale token: second saver gets `409 STALE_POLICY_MATRIX`, reload works | | | |
| 3 | Generate **missing** balances only if asked (`dryRun` then apply). Existing used/pending unchanged | | | |
| 4 | Employee draft → submit; days reserved (pending↑, available↓) | | | |
| 5 | Manager review: approve; still SUBMITTED; reservation kept; stage HR | | | |
| 6 | HR review: final approve; consumed (used↑, pending↓) | | | |
| 7 | Reject from Manager or HR: reservation released | | | |
| 8 | Cancel submitted (before HR consume): reservation released | | | |
| 9 | Half-day charges 0.5 on a single working day | | | |
| 10 | No HR in chain: submit fails `LEAVE_APPROVER_NOT_AVAILABLE` | | | |
| 11 | Self-approval blocked | | | |
| 12 | Double approve on same step: `409 STALE_TRANSITION` | | | |
| 13 | In-flight **one-step** request still completable | | | |
| 14 | Personal calendar: click day → panel; Month / List / Balances; Apply Leave | | | |
| 15 | Authorized calendar: employee selector; filters narrow only; foreign employee 404 | | | |
| 16 | Holidays: source/mode banner; LEGACY-only edit; Business Calendar link | | | |
| 17 | ACTIVE pilot office (if enabled): leave excludes Runtime holiday; SHADOW still uses legacy duration | | | |
| 18 | Cross-company / cross-branch IDs return 404 | | | |
| 19 | Remediation A–G (`leave-review-phase-h.md` §3) | | | |

## Remediation phases (post-review)

See `leave-review-phase-h.md` §3 for detailed checks (manager eligibility, scoped HR, calendar override, LEGACY holidays, txn calc, matrix zero-day, approver notifications).

## Frontend smoke (responsive)

| Viewport | Policies matrix | Requests queues | Personal calendar | HR calendar | Holidays |
|----------|-----------------|-----------------|-------------------|-------------|----------|
| 1440 | | | | | |
| 1024 | | | | | |
| 768 | | | | | |
| 390 | | | | | |

Also verify:

- [ ] Loading / error / empty states
- [ ] Keyboard focus on sheets and calendar days
- [ ] No body-level horizontal overflow
- [ ] No fake disabled Approve for people who cannot act
- [ ] Reject comment required; confirm on **final HR** approve

## Sign-off

| Role | Name | Date | Result |
|------|------|------|--------|
| Employee | | | Pending / Pass / Fail |
| Reporting Manager | | | Pending / Pass / Fail |
| HR | | | Pending / Pass / Fail |
| Technical | | | Pending / Pass / Fail |

Production-like approval requires **technical + HR** sign-off. This checklist does not certify the full ERP.
