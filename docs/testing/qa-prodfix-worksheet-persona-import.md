# Prodfix worksheet persona staging import

`backend/scripts/qa/import-prodfix-worksheet-personas.ts` is a one-purpose staging importer. It accepts no person selector on the command line. Its fixed contract is the four reviewed `prodfix.*.20260917@example.test` users, their PFG/PFC/PFB/PFD organization closure, the five scoped assignments, the completed owner onboarding context, and the manager's active department-asset grant.

It never copies transactions, settings, files, sessions, invitations, reset challenges, security events, roles, or permissions. Existing records must be equivalent; the tool never updates, relinks, revokes, resets, or deletes records.

## Review a plan

The tool derives a separately opened source connection from the guarded canonical `DATABASE_URL`; it does not accept a second source URL. The source transaction is repeatable-read/read-only with an effective `dsp_pms` search path. The isolated target is always `dsp_erp_dev/dsp_pms_stg`, while the source runtime identity must be `dsp_erp_dev/dsp_pms`.

From `backend`:

```powershell
pnpm qa:prodfix:worksheet-personas
```

The default is plan-only. Review the emitted `planDigest`, `sourceDigest`, target fingerprint, action list, and credential states. Neither digest nor plan output contains source IDs, credential hashes, or plaintext passwords.

## Apply the reviewed plan

Apply additionally needs the existing staging guard environment, including `ALLOW_DESTRUCTIVE_DB_SCRIPTS=true`, exact staging target variables, `QA_STAGING_SENTINEL_KEY`, and `QA_STAGING_CONFIRMATION_TOKEN`. It also needs the separate exact import acknowledgement:

```powershell
$env:QA_PRODFIX_WORKSHEET_PERSONA_IMPORT_CONFIRMATION = 'IMPORT-EXACTLY-FOUR-PRODFIX-WORKSHEET-QA-PERSONAS:dsp_pms_stg'
pnpm qa:prodfix:worksheet-personas --apply --plan-digest=<reviewed-planDigest>
```

For a normal-mode apply, supply `QA_PRODFIX_WORKSHEET_PERSONA_PASSWORD` through the environment. It is used only in memory, never logged, and is verified against every existing exact target user; a passwordless, malformed, locked, failed-login, or mismatched account fails rather than being reset.

For the explicitly approved worksheet-login compatibility path, add `--preserve-credential-hashes` and set `QA_PRODFIX_WORKSHEET_PERSONA_CREDENTIAL_HASH_CONFIRMATION` to `PRESERVE-EXACTLY-FOUR-PRODFIX-WORKSHEET-QA-CREDENTIAL-HASHES`. That mode reads and preserves only the four exact source hashes. Their opaque, non-reversible commitments bind the reviewed plan, but no hash is emitted. It never prints them, never queries unrelated credentials, and fails rather than changing a divergent target credential.

The plan digest intentionally omits the visible `PLAN_ONLY`/`APPLY` mode, so a reviewed plan can bind its later apply. Credential mode, the checked-in contract version, and any preservation commitments remain bound to the digest.

The importer fails closed if a selected pre-existing user has an active authentication session; revoke the session and require a new login before proceeding. After a durable apply commit, it opens a fresh read-only guarded target connection, requires an all-noop replay plan, verifies credentials, onboarding, the five role assignments, the manager grant, required entitlements, and the unchanged schema fingerprint, then writes safe digest/count evidence under ignored `backend/.qa-runs`. If that final verification cannot complete, output and best-effort evidence are marked `COMMITTED_UNVERIFIED`; do not retry apply before completing bounded read-only verification.
