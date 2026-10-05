# DSP reference staging safety and seed contract

This runbook defines the only database target authorized for automated QA
writers. It does not authorize an operator to create the schema, run a
migration, seed data, or clean up data without the normal backup and change
approval.

## Exact target

| Setting                                      | Required value       |
| -------------------------------------------- | -------------------- |
| Database                                     | `dsp_erp_dev`        |
| Database user                                | `dscape`             |
| Staging schema                               | `dsp_pms_stg`        |
| Current schema (always denied to QA writers) | `dsp_pms`            |
| Sentinel key                                 | `DSP-ERP-QA-STAGING` |

The guard validates `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_SCHEMA`, the
database and user parsed from `DATABASE_URL`, the optional URL `schema`
parameter, the explicit confirmation token, and the connected PostgreSQL
values from `current_database()`, `current_user`, and `current_schema()`.
Finally, it verifies an enabled row in the unqualified
`qa_environment_sentinel` table. A mismatch or query error fails closed before
the first business-data mutation.

## Bootstrap order

1. Obtain the required backup or restore point and record the code commit.
2. Create `dsp_pms_stg` through a reviewed structure-only copy or approved
   schema-neutral baseline. Do not copy people, tenants, files, transactions,
   or current Company settings.
3. Do not replay the six hash-pinned historical migrations that explicitly
   reference `dsp_pms` or use procedural dynamic SQL that cannot be proven
   schema-neutral. Validate the complete historical chain separately in
   disposable CI PostgreSQL. Any byte-level change invalidates its exception.
4. Set all exact target variables and the two explicit confirmation tokens in
   the operator session. Do not store credentials or tokens in a committed
   environment file.
5. Preview sentinel bootstrap (no connection):

   ```text
   pnpm qa:staging:bootstrap-sentinel
   ```

6. After approval, add `--apply`. The bootstrap opens a transaction only after
   verifying the connected database, user, and schema. It creates/upserts the
   sentinel with an exact-target check constraint.
7. Run `pnpm qa:lint-schema-neutral` before deploying new migration SQL.
   The lint rejects explicit schema qualification, `search_path` mutation,
   `set_config`, and procedural/prepared `EXECUTE`; trigger declarations using
   static `EXECUTE FUNCTION` remain permitted.

Required QA writer variables are:

```text
NODE_ENV=test
DATABASE_URL=postgresql://dscape:<secret>@<host>:5432/dsp_erp_dev?schema=dsp_pms_stg
DATABASE_NAME=dsp_erp_dev
DATABASE_USER=dscape
DATABASE_SCHEMA=dsp_pms_stg
ALLOW_DESTRUCTIVE_DB_SCRIPTS=true
QA_STAGING_SENTINEL_KEY=DSP-ERP-QA-STAGING
QA_STAGING_CONFIRMATION_TOKEN=CONFIRM-QA-WRITES:dsp_erp_dev:dsp_pms_stg
QA_STAGING_SENTINEL_BOOTSTRAP_TOKEN=BOOTSTRAP-QA-SENTINEL:dsp_erp_dev:dsp_pms_stg
```

The confirmation values are safety interlocks, not secrets. Database passwords
and provider credentials remain secret-store values.

## Connected read-only audit

Before any sentinel bootstrap, migration, seed, repair, or cleanup, run:

```text
pnpm qa:staging:audit
```

The audit accepts only the exact staging database, user, and schema. Its
PostgreSQL session enforces `default_transaction_read_only=on` and reports the
connected identity, schema privileges, table/column/index counts, migration
ledger state, exact applied migration names and checksums, sentinel state, and
structural fingerprints for both `dsp_pms_stg` and `dsp_pms`. Raw, LF, and
CRLF representations are compared separately so cross-platform line endings
do not hide an SQL content change. It cannot bootstrap, migrate, seed, or clean
data. Add `--save-evidence` to write the JSON result under
`backend/.qa-runs`.

`READY_FOR_SENTINEL_BOOTSTRAP` means the reviewed structure-only baseline and
migration ledger are present but the staging sentinel still needs the approved
bootstrap. `READY_FOR_REFERENCE_SEED` means the exact enabled sentinel is also
present. Any `BLOCKED_*` result forbids all QA writers.

After staging operations, capture the final staging structure and prove the
current schema is unchanged:

```text
pnpm qa:staging:capture-structure
pnpm qa:current:verify-unchanged -- --save-evidence
```

The second command compares a fresh read-only `dsp_pms` structure dump with
the pre-operation baseline and excludes only PostgreSQL's random
`\restrict`/`\unrestrict` guard tokens.

## Reference-data tooling

`pnpm qa:reference:plan` is connection-free. It validates the reference-data
contract and prints its SHA-256 fingerprint and counts.

`pnpm qa:reference:apply` is the guarded writer. It verifies the live sentinel,
captures the schema fingerprint before and after, and applies the complete
seedable reference baseline in one serializable transaction:

- two synthetic Company Groups;
- India, UAE, and isolation Companies;
- six Branches with country, subdivision, timezone, and reviewed working week;
- branch-owned Departments;
- Company-owned Designations; and
- normal-day and overnight shifts for both primary Companies;
- one disabled, passwordless `.invalid` QA audit actor used only where the
  schema requires `createdByUserId`;
- 23 stable persona profiles containing 22 Employees and 22 Users, including
  one disabled User, one Employee without a User, same-Company cross-Branch
  reporting lines, three least-privilege custom roles, scoped assignments, and
  one explicit Department grant;
- INR and AED financial profiles, three Finance categories per primary
  Company, two non-sensitive payment-account references per Company, and two
  fixed open 2026 QA periods per Company;
- three Business Parties total: an India Customer, an India Vendor, and a UAE
  Customer, plus three draft baseline Projects;
- exactly three Salary Components per primary Company: Basic, Allowance, and
  Deduction;
- four Leave Types per primary Company and 15 explicit Branch-level policies
  (Comp Off is credit-backed and deliberately has no annual policy);
- Company-specific Manager-then-HR Leave and Overtime approval routes for each
  primary Company; and
- an India Asset baseline with available and onboarding Laptops, an Access Card
  type, a location-tracked item, and an unallocated two-seat Software Licence
  pool; the smaller UAE sample contains one available Laptop and one
  unallocated two-seat pool.

The writer compares desired and current values before issuing an update. A
clean rerun therefore reports zero creates and zero updates. Evidence is saved
under the ignored `backend/.qa-runs` directory unless `QA_EVIDENCE_DIR` is set.
The writer fails instead of silently resetting a locked Finance period, an
activated Project, a non-available Asset, an allocated Licence pool, an
unexpected Approval step, or duplicate nullable-scope Leave Policies.

Persona apply additionally requires `QA_REFERENCE_PERSONA_PASSWORD` in the
operator process environment. Use a secret-store/session value between 12 and
128 characters; never place it in a committed environment file, command log,
workbook, or evidence manifest. The seeder hashes the value with Argon2 and
never returns the plaintext or hash. A same-password rerun verifies the stored
hash and performs no credential update. Changing the shared synthetic-persona
credential requires `pnpm qa:reference:rotate`, the exact staging interlocks,
and a stopped application. Rotation fails closed when any affected persona has
an active session, pending password reset, or pending invitation; clear those
through the application before retrying. The rotation increments each affected
User security version and must never run while authentication traffic is live.

The same contract records 23 synthetic personas, all system and
least-privilege custom roles, remaining stable master-data layers, and the
transaction types that must be created per run. `qa:reference:plan` reports
every layer as `SEEDED` or `CONTRACT_ONLY`, with deterministic item counts and
a reason for every exclusion.

The following remain contract-only by design:

- Company module entitlements: there is no entitlement model; rollout still
  uses deployment flags/allowlists. The generic Company Settings table must
  not be repurposed for unregistered keys.
- Currency catalog: no Currency model exists. The adapter uses uppercase ISO
  codes consistently across the financial profile, accounts, and Projects.
- reviewed holidays and published onboarding templates: both require their
  application validation/publication workflows, actor audit, row locking,
  outbox work, and runtime materialization/current-version handling;
- effective Employee salaries/tax profiles and Attendance/Overtime policies:
  the stable Employee personas exist, but compensation and policy rows remain
  service-owned, effective-dated workflow setup with conflict semantics;
- Timesheet, Finance, Payroll, and sensitive Asset-waiver approvals: these are
  service-owned controls rather than `ApprovalWorkflow` consumers. Timesheet
  approval uses the snapshotted reporting Manager; Finance and Payroll require
  an independent checker; Asset waiver approval must be independent of its
  requester. Exercise these through authenticated service flows with distinct
  QA personas.
- Project stages/tasks covering `OPEN`, `IN_PROGRESS`, and `WAITING_REVIEW`:
  Project command services own receipts and action events, while the latter two
  states require real assignment/submission actors. The desired stage and task
  set is contracted but not directly inserted.
- the Access Card sample: its type is seeded, but the Asset command service must
  create the sample because the detail requires an encrypted envelope and a
  versioned lookup index. The seeder never manufactures ciphertext or key
  metadata.
- secure-file purposes, recruitment mappings, and controlled files: valid
  evidence requires provider upload, scan, retention, and cleanup lifecycles.

Contract-only means planned and validated, not silently skipped. It must not be
reported as seeded in QA evidence. Published templates, files, effective-dated
Employee records, and module rollout should be created later through their
guarded application/configuration paths after the stable personas exist.

## Per-run manifests and cleanup

Create an empty exact-ID manifest before a mutable suite:

```text
pnpm qa:run:create -- --suite finance-golden-thread
```

The manifest uses `QA-<suite>-<UTC timestamp>-<nonce>`, binds the database and
schema target, code commit, and reference-contract fingerprint, and accepts
only exact created record IDs. Cleanup implementations must use
`cleanupRecordsInDependencyOrder`; they must never delete by a broad date,
prefix, Company, or tenant predicate. Stable reference records are not
run-owned and are never included in a cleanup manifest.

## Retired tooling

`e2e-uat-setup.ts` and `e2e-uat-fix.ts` are permanently rejected by the shared
guard and no longer have package-script entry points. They selected first
records, relinked identities, reset credentials, and rewrote broad payroll
state, so they are not valid reference-data or E2E setup tools.

## Promotion boundary

Never copy staging tenants, people, files, transactions, synthetic settings,
sentinel rows, or manifests into `dsp_pms`. Promotion consists only of the
exact tested code commit, schema-neutral migrations, and separately reviewed
idempotent backfills after current-target prechecks and a verified restore
point.
