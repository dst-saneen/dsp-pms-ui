# Asset V2 P0/P1 Remediation and Database Completion Report

## Document status

- Updated: 2026-08-19
- Implementation baseline: Git HEAD `2a372c3` plus the uncommitted remediation in this working tree
- Scope: Asset backend/API, UI evidence capture, database status, Onboarding Asset integration seam, and release verification
- Database inspected read-only: PostgreSQL `dsp_erp_dev`, schema `dsp_pms`
- Migration action performed by this remediation: **none**
- Current code decision: **the reviewed Asset P0/P1 code findings are fixed**
- Production decision: **release gates remain; do not treat code completion alone as production acceptance**

## 1. Outcome

The previously reported Asset authorization, idempotency, transfer-capability, notification, and UI-evidence defects have been corrected.

The Asset database contract already deployed through `20260819120000_asset_v2_ack_pair_and_dates` remains intact. The new pending migration shown by Prisma belongs to Onboarding Template hardening, not to Asset V2.

| Finding | Result | Primary implementation |
|---|---|---|
| Clearance preflight cross-Department disclosure | Fixed | Nested physical and licence queries now apply the authorized Asset custody predicate |
| Read-only transfer actors receiving mutation actions | Fixed | Transfer actions use manage/grant authority, not broad read authority |
| Receipt snapshot written after business commit | Fixed | Safe response snapshot is written inside the business transaction |
| Replay returning data without current record-scope validation | Fixed | Replay resolves the current scoped record before returning the original safe snapshot |
| Synthetic Company key `unknown` | Fixed | Commands resolve the authoritative Company from the target record; blank Company keys are rejected |
| Transfer notifications targeting only the current actor | Fixed | Recipients are resolved from active Department grants and workflow participants |
| Hard-coded transfer/waiver UI reasons | Fixed | UI collects and preserves an operator-entered reason |
| Internal Onboarding custody/allocation lacking evidence | Fixed | Transaction-aware Asset primitives write audit and outbox evidence in the caller transaction |
| Dependency lockfile policy failure | Fixed | `@aws-sdk/client-s3` is pinned consistently to `3.1111.0` in package and lockfiles |

## 2. Backend and API changes

### 2.1 Clearance record scope

`AssetClearanceService.preflight()` now applies `AssetAccessService.buildCustodyAssetWhere()` to the nested Asset relation for:

- active physical custody;
- active software licence allocation.

This prevents a Department-scoped custodian from learning Asset identifiers owned by another Department merely because the Employee is visible at Company or Branch level. Broad HR/Asset readers retain their intended organization-scoped view.

The waiver detail path also uses the supplied transaction client, preventing a command response from reading stale pre-transaction state.

### 2.2 Transfer capabilities

`AssetCapabilityService.getTransferAllowedActions()` no longer treats `assets.read` as write authority.

- `ACCEPT`, `REJECT`, `CANCEL`, and force actions are returned only when the same manage permission or active Department grant required by the command is present.
- Revoked grants stop producing actions.
- Read-only users retain read projections without mutation controls.

### 2.3 Transactional idempotency

Asset command receipts now follow this contract:

1. The command resolves the target record and authoritative `companyId` through the actor's current scope.
2. `(companyId, operationId)` is claimed in the business transaction.
3. The business mutation executes.
4. The full safe response snapshot is produced using that same transaction client.
5. The receipt snapshot is stored before commit.
6. Replay validates actor, command type, canonical request hash, feature scope, and current record visibility.
7. Replay returns the original safe response semantics rather than later mutable record state.

Blank or synthetic Company receipt namespaces are rejected. Transfer, clearance, custody-request, taxonomy, inventory, grant, physical-custody, and licence response readers accept an optional transaction client so newly created rows are visible before commit.

### 2.4 Transfer and waiver notifications

Transfer events now resolve recipients from:

- active source/destination Department Asset grants;
- the requester or deciding workflow actor where applicable;
- the cancellation participant set.

The notification service excludes revoked grants and inactive users. Payloads remain ID/status based and do not place private reasons in the outbox payload.

### 2.5 Internal Onboarding integration

Physical assignment and software allocation expose transaction-aware internal primitives for Onboarding Asset tasks. These primitives:

- run within the caller's transaction;
- preserve the Asset command's locking and eligibility checks;
- write source-bound custody/allocation provenance;
- write Asset audit and outbox records;
- return the created `employeeAssetId` or `softwareLicenseAllocationId`.

The public Asset commands continue to own their normal command receipt. An Onboarding command does not recursively claim a second public Asset receipt.

## 3. Frontend changes

A shared `AssetCommandReasonDialog` now collects the operator's actual reason for evidence-bearing commands.

Applied to:

- transfer reject;
- transfer cancel;
- transfer force-complete;
- clearance waiver reject.

The entered value is trimmed, validated, sent to the API, and retained when a request fails. The UI no longer submits fixed phrases such as “Rejected from transfer workspace.”

The UI still renders server-provided `allowedActions`; it does not infer transfer authority from local role names or status alone.

## 4. Database status

### 4.1 Read-only status result

Prisma reported:

- database: `dsp_erp_dev`;
- schema: `dsp_pms`;
- migrations found: `109`;
- pending migration: `20260819130000_onboarding_template_p0_p1_hardening` only.

Therefore the Asset migrations, including the following, are applied on the inspected database:

- `20260817140000_asset_v2_foundation`;
- `20260817150000_asset_v2_expand`;
- `20260817160000_asset_v2_contract_enforce`;
- subsequent Asset V2 hardening migrations through `20260819120000_asset_v2_ack_pair_and_dates`.

No migration was deployed or resolved during this implementation review.

### 4.2 Asset database contract relied upon by the code

The applied database contract provides:

- required Company/Branch/Department ownership snapshots;
- Asset kind and tracking-mode integrity;
- one open physical assignment per Asset;
- source-command uniqueness for physical custody and software allocation;
- licence capacity/state checks;
- acknowledgement timestamp/actor pairing;
- close/revoke effective-date ordering;
- Company-qualified custody and allocation keys used by Onboarding result foreign keys;
- transfer, request, clearance, action-evidence, and command-receipt structures.

### 4.3 No additional Asset migration is required by these fixes

The fixes in this remediation are service/API/UI behavior over the existing Asset V2 schema. The only newly created migration is an Onboarding Template migration that adds Onboarding result foreign keys to Asset custody/allocation records.

## 5. Verification evidence

| Gate | Result |
|---|---|
| Prisma schema validation | Pass |
| Backend TypeScript | Pass |
| Changed backend ESLint | Pass, zero errors |
| Backend production build | Pass |
| Frontend TypeScript | Pass |
| Changed frontend ESLint | Pass, zero errors; one non-blocking existing hook warning |
| Frontend unit tests | Pass: 18 files, 38 tests |
| Frontend production build | Pass |
| Focused combined Asset/Onboarding remediation tests | Pass: 16 suites, 63 tests |
| Full Asset-matching foundation tests | Pass: 26 suites, 116 tests |
| Real PostgreSQL Asset suite | Skipped by default: 1 suite, 3 tests |
| Git whitespace check | Pass |

The default-skipped PostgreSQL suite verifies live database structures when explicitly enabled. It is not evidence of two-session command concurrency because it was not executed in this run and its current cases are primarily catalog/constraint checks.

## 6. Remaining Asset release gates

These are not unresolved code findings from the reviewed P0/P1 list, but they remain mandatory production gates.

### 6.1 Business ownership mapping approval

The legacy Asset-to-Department/Type mapping must be approved by accountable business owners. A development proposal or generated CSV is not approval.

Required evidence:

- signed or otherwise traceable approval;
- zero unresolved/null mappings;
- reconciliation totals by Company, Branch, Department, kind, and tracking mode;
- explicit decisions for branchless/company-shared legacy stock.

### 6.2 Real PostgreSQL concurrency evidence

Run on an isolated UAT/disposable database, not the shared development database:

- concurrent assignment of the same physical Asset;
- concurrent licence allocation at the final seat;
- repeated identical source command;
- conflicting source payload using the same source key;
- simultaneous transfer accept/reject/cancel;
- clearance completion versus return/revoke/waiver;
- receipt replay after role or Department grant removal.

The acceptance result must prove one committed winner, deterministic replay, no double seat consumption, and no partial audit/outbox state.

### 6.3 Real API and browser personas

Complete authenticated real-API/browser journeys for:

1. central Asset manager;
2. Department custodian;
3. read-only HR user;
4. assigned Employee;
5. another Department user;
6. another Branch user;
7. another Company user;
8. clearance waiver requester and approver.

Network responses—not DOM hiding—must prove record-scope isolation.

### 6.4 Operational release controls

Before enabling Asset V2:

- run the Asset preflight and integrity scripts against the release database;
- rehearse from-zero and upgrade migrations on a disposable copy;
- verify feature-gate Company/Branch allowlists;
- verify encryption/HMAC key versions and startup fail-closed behavior;
- verify outbox retry/dead-letter monitoring;
- complete backup and restore rehearsal;
- obtain technical UAT and business sign-off.

## 7. Asset completion checklist

- [x] Reviewed Asset P0/P1 application defects fixed
- [x] Asset migrations applied on inspected development database
- [x] Prisma, TypeScript, lint, focused tests, unit tests, and builds pass
- [ ] Business ownership mapping approved
- [ ] Real PostgreSQL concurrency cases executed and signed off
- [ ] Real API/browser personas passed
- [ ] Release-database preflight and integrity reports clean
- [ ] Backup/restore and rollback rehearsal complete
- [ ] Monitoring, technical UAT, and business UAT approved

Asset development can be treated as code-complete for the reviewed defects, but production enablement remains conditional on the unchecked release gates above.
