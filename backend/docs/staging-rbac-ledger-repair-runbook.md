# Staging RBAC ledger repair (one-time atomic exception)

`qa:staging:repair-rbac-ledger` is a deliberately closed repair for one known
staging lineage gap. It is not a replacement for `qa:staging:migrate:deploy`,
and it does not relax or alter that deploy guard.

It can target only `dsp_erp_dev` / `dscape` / `dsp_pms_stg`; it never accepts a
database, schema, migration-name, checksum, or SQL override. The current
`dsp_pms` schema remains rejected by the existing write guard.

## Fixed scope

The initial preflight requires all of the following:

- Exactly 160 repository migrations.
- Exactly 156 complete, unique staging ledger rows.
- Exactly four missing names, with the checked-in SHA-256 values:
  - `20260918093000_hr_manager_projects_permissions` — `a64cb1d53e855d4d99ac382bc013b51e400afcc67ca47014747d03050830a4cc`
  - `20260918104500_hr_manager_finance_settings` — `9e89cef2337838653b698b6f906c95c5afc2ad0b00d480b688055a74ce824168`
  - `20260918113000_employee_projects_permissions_cleanup` — `59d4212d79ad32634902a9af72a421847088973b924064062c2872189ff3627e`
  - `20260918140000_owner_delivery_ops_permissions` — `f9ad224832010813091eb157d17e15c1de220f9aff49953dfa8ef66e6b386e6f`
- No incomplete, rolled-back, duplicate, unexpected, or checksum-mismatched
  ledger rows.
- Every role and permission referenced by the four static migration files
  exists exactly once.

The default command is a connection-free plan:

```powershell
pnpm qa:staging:repair-rbac-ledger
```

## Approved apply window

Only during an approved staging maintenance window, set the existing guarded
QA environment values (including `ALLOW_DESTRUCTIVE_DB_SCRIPTS=true` and the
existing QA staging confirmation token), then use the operation-specific
confirmation:

```powershell
pnpm qa:staging:repair-rbac-ledger --apply --confirm-rbac-ledger-repair
```

The command runs in one PostgreSQL transaction. It acquires the fixed advisory
lock, locks the ledger/RBAC tables, rechecks the staging sentinel and the exact
156-row state, executes only the four source-hash-verified SQL files, proves
the ten expected grants and three expected removals, and inserts only the four
matching Prisma 7.9.1 successful-deploy ledger rows. Each inserted row uses a
UUID v4, its exact SHA-256 checksum, `logs = NULL`, `rolled_back_at = NULL`, a
shared started/finished timestamp, and `applied_steps_count = 1`.

Before commit it proves the exact 160-row lineage and policy state under the
same locks. After commit it opens a fresh guarded connection, reruns the
normal staging deploy ledger preflight plus the pinned checks, and writes a
non-sensitive evidence JSON file under the ignored `.qa-runs/` directory. The
evidence contains target identity, timestamps, names/checksum modes, and
schema fingerprints—never a database URL, credentials, tenant records, or
role-assignment data.

## Fail closed

The transaction means a 157-159-row partial repair is not a supported recovery
state. If that state exists, do not insert, delete, or resolve migration rows
manually, and do not weaken the standard deploy guard. Preserve the evidence
and investigate the unexpected external mutation before any further staging
work.
