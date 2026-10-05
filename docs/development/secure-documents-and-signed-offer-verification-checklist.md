# Secure Documents and Signed-Offer Verification Checklist

## 1. Purpose

This document is the independent completion checklist for:

- `docs/development/secure-documents-and-signed-offer-implementation-plan.md`;
- `docs/development/secure-documents-and-signed-offer-fix-plan.md`.

It distinguishes source presence from production evidence. A checkbox may be marked complete only when the exact command/runtime evidence is recorded against the release commit.

Mock S3, mocked ClamAV, metadata-only tests, a successful migration status or a passing unit suite do not prove real integration or production readiness.

## 2. Evidence record

Record before starting:

```text
Release commit:
Reviewer:
Review date/time and timezone:
Backend environment:
Frontend environment:
Isolated migration database:
Real integration database:
Storage provider/profile:
ClamAV version/signature version:
Company/Branch pilot scope:
Evidence artifact location:
```

Do not record credentials, tokens, presigned URLs, candidate email addresses, object keys or document contents.

## 3. Source and secret-safety checks

- [ ] Working tree is clean or every unrelated user change is documented and preserved.
- [ ] Release commit contains only reviewed feature changes.
- [ ] No credential-shaped values exist in tracked files.
- [ ] Old exposed storage credentials are confirmed revoked/rotated.
- [ ] Current Git history and CI/deployment variables were scanned.
- [ ] Storage identity is least-privilege and bucket/prefix scoped.
- [ ] Bucket Block Public Access/private equivalent is enabled.
- [ ] Logs and test artifacts contain no tokens, URLs, keys or personal file data.

Suggested checks:

```powershell
git status --short
git show --stat --oneline HEAD
rg -n "AKIA|SECRET_ACCESS_KEY|BEGIN PRIVATE KEY|presigned|responseToken" . `
  -g "!node_modules/**" -g "!.next/**" -g "!dist/**"
```

Any match must be manually classified. Do not paste secret values into the evidence report.

## 4. Dependency, schema, type-check, lint and build gates

Run from a clean dependency installation using the committed lockfiles.

Backend:

```powershell
cd C:\DataScape\HRMS\ERP\backend
pnpm.cmd install --frozen-lockfile
pnpm.cmd exec prisma generate
pnpm.cmd exec prisma validate
pnpm.cmd exec tsc -p tsconfig.build.json --noEmit --incremental false
pnpm.cmd exec eslint "src/**/*.ts" "test/**/*.ts"
pnpm.cmd test -- --runInBand
pnpm.cmd build
```

Frontend:

```powershell
cd C:\DataScape\HRMS\ERP\frontend
pnpm.cmd install --frozen-lockfile
pnpm.cmd exec tsc --noEmit --incremental false
pnpm.cmd exec eslint .
pnpm.cmd test -- --runInBand
pnpm.cmd build
```

Record:


| Gate                | Command | Exit code | Test/file count | Evidence | Result |
| ------------------- | ------- | --------- | --------------- | -------- | ------ |
| Prisma validate     |         |           |                 |          |        |
| Backend TypeScript  |         |           |                 |          |        |
| Backend lint        |         |           |                 |          |        |
| Backend unit tests  |         |           |                 |          |        |
| Backend build       |         |           |                 |          |        |
| Frontend TypeScript |         |           |                 |          |        |
| Frontend lint       |         |           |                 |          |        |
| Frontend tests      |         |           |                 |          |        |
| Frontend build      |         |           |                 |          |        |


No gate is PASS when the command was not executed, was interrupted or used a materially different configuration.

## 5. Read-only shared database status

Read status first. Do not modify or resolve migration history merely to answer status.

```powershell
cd C:\DataScape\HRMS\ERP\backend
pnpm.cmd exec prisma migrate status
```

Record:

```text
Database/server:
Database name:
Schema:
Migration count:
Latest applied migration:
Pending migrations:
Command exit code:
```

- [ ] Status is captured without applying or resolving anything.
- [ ] The corrective migration is not applied to a shared environment before isolated rehearsal and explicit approval.

## 6. Isolated migration rehearsal

Use a disposable PostgreSQL database that is not the shared development/UAT database.

### 6.1 From-zero

- [ ] Create an empty disposable database/schema.
- [ ] Apply all migrations from zero.
- [ ] Run Prisma validation and application startup.
- [ ] Verify all new tables, enums, constraints, triggers and indexes exist.
- [ ] Insert valid examples for every FileObject/upload/signature lifecycle.
- [ ] Prove invalid tenant/state combinations are rejected by the database.

### 6.2 Production-like upgrade

Prepare legacy fixtures containing:

- Recruitment documents with and without Company/Branch;
- Employee documents with local/provider references;
- missing storage objects;
- duplicate storage references;
- accepted/Hired Offers without signature submissions;
- cross-Branch and cross-Company invalid examples;
- unknown, infected and scan-failed metadata;
- shared Recruitment/Employee references;
- legal holds and pending deletion records.

- [ ] Apply migrations up to the pre-feature version.
- [ ] Load the fixtures.
- [ ] Apply the original feature migration and new corrective migration.
- [ ] Run inventory/reconciliation.
- [ ] Confirm valid history is preserved.
- [ ] Confirm ambiguous rows are reported, not fabricated or deleted.
- [ ] Confirm contract constraints can be enabled only after required reconciliation.

### 6.3 Backup/restore rollback

- [ ] Back up the isolated upgrade database before the corrective migration.
- [ ] Apply migration and reconciliation.
- [ ] Restore the backup into a second isolated database.
- [ ] Verify row counts, checksums and critical Recruitment/Employee relationships.
- [ ] Record backup and restore command exits and catalog evidence.

Do not use migration rollback as a substitute for backup/restore evidence.

## 7. Database catalog verification

Run read-only catalog checks against the isolated migrated database and, after approval, the target environment.

Required tables:

- [ ] `file_objects`
- [ ] `file_upload_sessions`
- [ ] `file_operation_attempts`
- [ ] `file_access_audits`
- [ ] `file_retention_policies`
- [ ] `offer_signature_submissions`
- [ ] command-receipt table introduced by the corrective migration

Required catalog evidence:

- [ ] Company-qualified foreign keys.
- [ ] Branch belongs to the same Company.
- [ ] upload target/purpose checks.
- [ ] FileObject CLEAN/INFECTED/SCAN_FAILED checks.
- [ ] encryption-envelope checks.
- [ ] operation-attempt owner and terminal-state checks.
- [ ] signature decision/supersession checks.
- [ ] CLEAN same-tenant document-link triggers.
- [ ] legal-hold/reference deletion trigger.
- [ ] upload and command idempotency uniqueness.
- [ ] one current pending/verified signature indexes.
- [ ] worker, retention and reconciliation indexes.

Example read-only catalog query:

```sql
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  con.conname AS constraint_name,
  con.contype,
  pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'dsp_pms'
  AND c.relname IN (
    'file_objects',
    'file_upload_sessions',
    'file_operation_attempts',
    'file_access_audits',
    'file_retention_policies',
    'offer_signature_submissions',
    'recruitment_documents',
    'employee_documents'
  )
ORDER BY c.relname, con.conname;
```

Example index query:

```sql
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'dsp_pms'
  AND tablename IN (
    'file_objects',
    'file_upload_sessions',
    'file_operation_attempts',
    'offer_signature_submissions'
  )
ORDER BY tablename, indexname;
```

## 8. Reconciliation checks

Record counts before and after; do not overwrite history to force zero.

```sql
SELECT count(*) AS recruitment_missing_scope_or_file
FROM dsp_pms.recruitment_documents
WHERE "companyId" IS NULL OR "fileObjectId" IS NULL;

SELECT count(*) AS employee_missing_scope_or_file
FROM dsp_pms.employee_documents
WHERE "companyId" IS NULL OR "branchIdAtUpload" IS NULL OR "fileObjectId" IS NULL;

SELECT count(*) AS clean_without_required_evidence
FROM dsp_pms.file_objects
WHERE status = 'CLEAN'
  AND (
    "actualChecksumSha256" IS NULL OR
    "detectedMimeType" IS NULL OR
    "scannedAt" IS NULL OR
    "clamAvResult" IS NULL
  );

SELECT count(*) AS signatures_with_nonclean_file
FROM dsp_pms.offer_signature_submissions s
JOIN dsp_pms.file_objects f ON f.id = s."fileObjectId"
WHERE s.status = 'VERIFIED' AND f.status <> 'CLEAN';
```

- [ ] missing objects report generated;
- [ ] duplicate reference report generated;
- [ ] cross-tenant link report generated;
- [ ] scan-state report generated;
- [ ] orphan-object report generated;
- [ ] accepted-but-unconverted cutover report generated;
- [ ] retention conflict report generated;
- [ ] every non-zero exception has an owner and explicit disposition.

## 9. Backend unit and service verification

- [ ] extension, size, checksum and MIME validation;
- [ ] tenant-derived ownership;
- [ ] public/private session-token authorization;
- [ ] canonical idempotency replay and operation-ID conflict;
- [ ] upload-session state machine and `allowedActions`;
- [ ] CLEAN/INFECTED/SCAN_FAILED mapping;
- [ ] filename encryption key-version handling;
- [ ] signed acceptance state machine;
- [ ] verification/rejection/resubmission state machine;
- [ ] Ready-to-Hire and conversion gate;
- [ ] Employee document clean-session linking;
- [ ] shared reference and legal-hold protection;
- [ ] retention/deletion retry and dead-letter behavior;
- [ ] safe audit/outbox payload mappers;
- [ ] health/readiness fail-closed behavior.

## 10. Real PostgreSQL integration and concurrency

These tests must use real PostgreSQL transactions and constraints, not mocked Prisma calls.

- [ ] concurrent create-session with the same operation ID returns one session;
- [ ] same operation ID with different payload returns `OPERATION_ID_REUSED`;
- [ ] concurrent finalize creates one FileObject and one scan job;
- [ ] scan completion racing logical delete cannot expose/delete incorrectly;
- [ ] document link racing orphan cleanup preserves referenced data;
- [ ] legal hold racing purge prevents deletion;
- [ ] verify racing reject has one winning decision;
- [ ] resubmission racing verify follows the locked state machine;
- [ ] acceptance replay returns the same Offer/Application/submission response;
- [ ] conversion racing verification/rejection cannot hire against stale evidence;
- [ ] conversion links Recruitment and Employee references atomically;
- [ ] cross-Company/Branch direct SQL inserts fail at the database boundary.

Record database version, isolation level, test count and exact exit code.

## 11. Real object-storage verification

Use the configured private S3-compatible test bucket/profile.

- [ ] presigned PUT succeeds using browser-compatible signed headers;
- [ ] object is not anonymously readable;
- [ ] provider reports required server-side encryption;
- [ ] HEAD size matches expected size;
- [ ] server-computed SHA-256 matches expected checksum;
- [ ] checksum mismatch is rejected;
- [ ] clean promotion copies to the approved clean prefix;
- [ ] quarantine source is removed after successful promotion;
- [ ] presigned GET expires and is short-lived;
- [ ] copy/delete/provider failures produce retryable safe operation attempts;
- [ ] reconciliation finds DB-without-object;
- [ ] reconciliation finds object-without-DB;
- [ ] no API response exposes bucket/object key/provider credentials.

Record only safe object IDs and redacted provider request IDs.

## 12. Real ClamAV verification

- [ ] real clean PDF is detected and marked CLEAN;
- [ ] EICAR test file is detected and marked INFECTED;
- [ ] extension/MIME mismatch is rejected independently of malware result;
- [ ] scanner unavailable fails closed as SCAN_FAILED;
- [ ] timeout creates retryable attempt evidence;
- [ ] exhausted retries create a dead-letter alert;
- [ ] worker restart recovers abandoned work;
- [ ] engine and signature versions are persisted;
- [ ] infected/failed objects cannot be linked or downloaded.

EICAR must be used only in an isolated approved security-test environment.

## 13. API authorization and contract verification

Public:

- [ ] careers session is bound to the correct Opening/application operation;
- [ ] missing/wrong public session token cannot finalize or poll;
- [ ] expired/revoked/superseded Offer token is rejected safely;
- [ ] foreign Offer/session/FileObject cannot be substituted;
- [ ] public responses reveal no tenant/storage internals.

HR Recruitment:

- [ ] authorized HR can list/download signature submissions in scope;
- [ ] ordinary HR without `recruitment.offer.verify` cannot verify/reject;
- [ ] authorized verifier can verify/reject with correct versions;
- [ ] cross-Company/Branch direct IDs return safe 404;
- [ ] resubmission creates a new controlled Candidate action.

Employee documents:

- [ ] HR document permissions obey Company/Branch record scope;
- [ ] Employee self-service can access only permitted own documents;
- [ ] another Employee cannot list/download/mutate the file;
- [ ] clean upload session is required for create/replace;
- [ ] raw provider/object references are rejected or ignored by whitelist validation.

Operations:

- [ ] operations/retention endpoints require approved permissions;
- [ ] results are Company/Branch scoped;
- [ ] responses contain safe counts/codes only.

## 14. Frontend unit and component verification

- [ ] secure upload never sends `Content-Length` from browser JavaScript;
- [ ] scan polling shows pending, clean, infected, failed and expired states;
- [ ] candidate cannot accept before CLEAN;
- [ ] CLEAN message is distinct from HR signature verification;
- [ ] HR panel sends actual submission version and RecruitmentDocument ID;
- [ ] UI renders only server `allowedActions`;
- [ ] version conflict preserves entered reason and refreshes state;
- [ ] EmployeeDocument create sends `uploadSessionId`;
- [ ] legacy provider/reference inputs are absent;
- [ ] operations page consumes an existing typed endpoint;
- [ ] loading, empty, denied, retry and dead-letter states are accessible.

## 15. Real browser personas

Run Playwright without mock mode against the production-candidate API, real PostgreSQL, private test storage and real ClamAV.

1. Candidate uploads a clean CV and submits an Application.
2. Candidate infected/mismatched upload is blocked safely.
3. Candidate receives and opens the current Offer action.
4. Candidate uploads a clean signed PDF and accepts.
5. Offer shows accepted with HR verification pending.
6. Unauthorized HR cannot verify.
7. Authorized HR downloads the immutable signed PDF and verifies it.
8. Rejected signature remains in history and Candidate resubmits through a new action.
9. Ready-to-Hire remains blocked until current signature verification.
10. Conversion creates Employee/Onboarding and links the same clean FileObjects.
11. Employee accesses only authorized own documents.
12. another Department/Branch/Company cannot list, open or mutate them.
13. Operations user sees scan/orphan/delete failures without sensitive content.

Record Playwright configuration, persona IDs, test count, pass/fail count, screenshots/traces for failures and exact exit code.

## 16. End-to-end persisted-state proof

For one approved synthetic Candidate, prove:

```text
Job Opening
  -> clean Candidate CV FileObject
  -> Application
  -> current Offer
  -> clean signed Offer FileObject
  -> Offer ACCEPTED
  -> Application OFFER_ACCEPTED
  -> signature PENDING_VERIFICATION
  -> signature VERIFIED by authorized HR
  -> Ready-to-Hire eligible
  -> serializable conversion
  -> Employee + Onboarding
  -> RecruitmentDocument and EmployeeDocument reference the same FileObject IDs
  -> audit + status history + outbox evidence
```

- [ ] no duplicate FileObject binary copy;
- [ ] no partial Employee/Hired state after injected linking failure;
- [ ] no conversion after signature/file status changes;
- [ ] access audits record authorized downloads;
- [ ] outbox events contain safe payloads only.

## 17. Operational readiness

- [ ] storage and scanner health exposed to monitoring;
- [ ] scan queue age/depth monitored;
- [ ] scan/reconciliation/deletion retries monitored;
- [ ] dead letters alert approved recipients;
- [ ] orphan and missing-object reports scheduled;
- [ ] retention policies approved per Company/class;
- [ ] purge flag remains off until policy and restore approval;
- [ ] encryption key rotation/recovery runbook tested;
- [ ] incident runbook covers infected files, scanner outage, missing object and leaked URL/token;
- [ ] dashboards and alerts contain no personal/document content.

## 18. Final release decision

### Technical acceptance

- [ ] P0 findings: zero open.
- [ ] P1 findings: zero open or explicitly release-blocking exception rejected.
- [ ] migration rehearsal: PASS.
- [ ] catalog verification: PASS.
- [ ] reconciliation: zero unexplained findings.
- [ ] builds/tests: PASS.
- [ ] real PostgreSQL concurrency: PASS.
- [ ] real storage/ClamAV: PASS.
- [ ] real API/browser personas: PASS.
- [ ] backup/restore: PASS.
- [ ] monitoring/runbooks: PASS.

### Approvals

```text
Backend reviewer:
Frontend reviewer:
Database reviewer:
Security reviewer:
Infrastructure/operations reviewer:
Recruitment business owner:
HR/Employee-document business owner:
Release approver:
Approved release commit:
```

If any mandatory item lacks evidence, status remains `NO-GO`. An applied migration alone is not completion evidence.