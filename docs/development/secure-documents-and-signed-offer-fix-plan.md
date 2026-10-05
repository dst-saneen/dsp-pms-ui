# Secure Documents and Signed-Offer Corrective Fix Plan

## 1. Purpose

This document converts the findings from the latest implementation review into an executable corrective plan for:

- private Recruitment and Employee document storage;
- upload sessions, malware scanning, download grants and access audit;
- candidate signed-offer submission and HR verification;
- Recruitment-to-Employee document linking;
- retention, deletion, reconciliation and operational monitoring.

The authoritative intended design remains:

- `docs/development/secure-documents-and-signed-offer-implementation-plan.md`

This document does not change the approved business flow. It describes what must be fixed before that design can be accepted as implemented.

## 2. Current reviewed baseline

Reviewed release commit: `2053d92` with feature commit `a44bfa3`.

Confirmed completed foundations:

- Prisma enums and initial storage/signature models exist.
- Migration `20260819140000_secure_file_storage_and_signed_offer` exists and is applied to `dsp_erp_dev`, schema `dsp_pms`.
- Prisma schema validation passes.
- S3 adapter, ClamAV adapter, upload-session service, download service, retention/reconciliation services and signed-offer service have initial implementations.
- Candidate signed-PDF upload UI and initial HR/operations components exist.

Confirmed release blockers:

- committed credential-shaped S3 values;
- File Storage module not mounted;
- public routes not public and new routes not classified by route policy;
- signed-offer acceptance does not update Offer/Application acceptance state;
- upload checksum, content-type, public-session and scan durability gaps;
- ineffective filename encryption;
- conversion validation/linking is not atomic;
- required DB state/tenant backstops are absent;
- Employee uploaded FileObject is not linked to EmployeeDocument;
- verification UI uses the wrong concurrency/document identifiers;
- operations endpoints/jobs are incomplete;
- backend/frontend verification gates are not green;
- no real storage, scanner, database concurrency, API or browser evidence exists.

## 3. Non-negotiable implementation rules

- Do not edit the already-applied `20260819140000_secure_file_storage_and_signed_offer` migration.
- Add a new corrective migration named with the next repository timestamp and suffix `secure_file_storage_contract_hardening`.
- Keep feature flags disabled until reconciliation and real integration checks pass.
- Never trust client Company, Branch, Employee, object key, bucket, provider, encryption, scan or verification state.
- Never mark a file `CLEAN` without verified bytes, checksum, detected content type and successful scanner evidence.
- Never accept or convert an Offer based only on an earlier preflight response.
- Never return bucket names, object keys, credentials, ciphertext internals or permanent storage URLs.
- Never delete an object while a document/signature reference or legal hold exists.
- Preserve unrelated user changes and existing Recruitment/Employee history.

## 4. Corrective implementation sequence

### 4.1 Credential and repository security

1. Revoke and rotate every credential-shaped S3 key currently present in `backend/.env.example` or Git history.
2. Replace committed values with non-secret placeholders.
3. Search the current tree, Git history, CI variables, deployment variables and logs for the exposed identifiers.
4. Keep production secrets in the approved secret manager or deployment environment only.
5. Add secret scanning to the pull-request gate.
6. Record rotation evidence without recording secret values.

Exit gate:

- the old credentials are revoked;
- repository and CI secret scans are clean;
- the application uses a least-privilege bucket-scoped identity.

### 4.2 Restore a buildable dependency baseline

1. Add the missing direct backend dependency used by source code:
   - `@aws-sdk/s3-request-presigner` pinned consistently with `@aws-sdk/client-s3`.
2. Restore the complete backend/frontend lockfile installation without generated workspace mutations.
3. Add or replace missing UI primitives used by the feature:
   - alert;
   - progress;
   - separator.
4. Remove unsupported Lucide icon props or wrap the icon with accessible text/tooltip markup.
5. Reconcile `EmployeeDocumentService` with the hardened DTO:
   - remove all reads of `dto.storageProvider` and `dto.storageReference`;
   - accept a server-resolved `uploadSessionId` for new uploads;
   - never restore arbitrary client storage-provider/reference inputs.

Exit gate:

- clean install, backend TypeScript, frontend TypeScript, lint and production builds pass from the recorded commit.

### 4.3 Mount and configure the storage domain

1. Import `FileStorageModule` into `AppModule` once.
2. Export only transaction-aware services required by Recruitment conversion and Employee documents.
3. Add typed environment fields and startup validation for:
   - `STORAGE_S3_REGION`;
   - `STORAGE_S3_BUCKET`;
   - `STORAGE_S3_ENDPOINT` when applicable;
   - provider credentials or workload identity;
   - upload/download URL TTLs;
   - `CLAMAV_HOST`, `CLAMAV_PORT`, timeout and maximum stream size;
   - filename encryption active key version and accepted read-key versions;
   - `FILE_STORAGE_V2_ENABLED`;
   - `FILE_SCAN_WORKER_ENABLED`;
   - `SIGNED_OFFER_VERIFICATION_ENABLED`;
   - `FILE_RETENTION_PURGE_ENABLED`;
   - server-side Company/Branch allowlist.
4. Fail closed when a feature is enabled but its storage, scanner, encryption key or allowlist configuration is missing.
5. Add health/readiness checks that separately report database, object storage and ClamAV readiness without exposing configuration values.

### 4.4 Route classification and permissions

Public routes:

- mark the approved careers upload routes and `/public/offers/:token/...` routes with the existing `@Public()` decorator;
- apply public anti-abuse, rate-limit and token validation before storage work;
- do not make generic session/download routes public.

Authenticated routes:

- classify Recruitment document and signature-submission routes under exact Recruitment permissions;
- classify Employee document routes under `hr.documents.read/manage` and actor-scoped self-service permissions;
- seed and enforce `recruitment.offer.verify` only for signature verify/reject/resubmission administration;
- keep ordinary `hr.recruitment.manage` insufficient for verification;
- restrict operations and retention administration to explicitly approved administrative permissions.

Every route must derive Company/Branch/Employee scope from the authenticated or token context. Cross-scope direct IDs return the same safe `404` as a missing record.

### 4.5 Replace request-internal offer-token lookup

Create a shared `PublicOfferTokenService` used by both the existing offer-response controller and the signed-offer controller.

The resolver must:

1. hash the token using the established token contract;
2. load the Offer through Prisma injection, never through `req.app.get()` or `req.prisma`;
3. validate token expiry, Offer lifecycle, Application relationship, current version and feature-allowlist scope;
4. reject revoked, superseded, expired, declined or non-current Offers;
5. return a safe typed context containing only required IDs/versions;
6. use stable public errors and never throw raw `Error` objects.

### 4.6 Correct upload-session authorization and idempotency

Use a server-generated public session bearer token distinct from the anti-abuse token.

Create-session behavior:

- claim `(companyId, operationId)` idempotently;
- hash the complete versioned canonical request;
- on exact replay, return the same session and a newly generated valid upload grant when still allowed;
- on a different request with the same operation ID, return `OPERATION_ID_REUSED`;
- bind the session to the authoritative Opening/Application/Employee/Offer and Company/Branch.

Finalize/status behavior:

- require the public session bearer token for every public finalize/status/cancel request;
- require authenticated tenant/persona authorization for every private session request;
- a missing token must fail when `publicSessionTokenHash` exists;
- compare tokens using a timing-safe comparison;
- implement optimistic version checks and a single-winner finalize transaction;
- repeated finalize returns the same FileObject/status;
- provide the documented cancel command and correct `allowedActions` for every state.

### 4.7 Correct object upload and integrity verification

1. Normalize the client SHA-256 into the encoding required by the selected S3-compatible provider.
2. Do not instruct browser JavaScript to set forbidden transport headers such as `Content-Length`.
3. Sign only headers the browser can send and the backend can later verify.
4. At finalize, HEAD the quarantine object and verify:
   - exact size;
   - provider checksum when available;
   - server-computed SHA-256 before CLEAN promotion;
   - required server-side encryption response;
   - object is in the expected private quarantine prefix.
5. Inspect magic bytes using an allowlisted content detector. Do not treat client/S3 metadata `Content-Type` as detected MIME.
6. Enforce purpose-specific extension plus detected-MIME combinations.
7. Store `detectedMimeType` and `actualChecksumSha256` only from verified bytes.
8. Delete the quarantine source only after verified clean-copy promotion; compensate safely if any step fails.

### 4.8 Make scanning durable

Replace in-request `runScanAsync()` execution with durable work claimed from the database/outbox.

Worker contract:

1. finalize creates the FileObject, scan attempt and outbox/job record atomically;
2. a worker claims due work using a lease or `FOR UPDATE SKIP LOCKED`;
3. fixed state/version predicates prevent duplicate worker completion;
4. scanner unavailable or timeout results in `SCAN_FAILED`, never CLEAN;
5. retryable failures increment attempt number and set the next attempt;
6. exhausted failures become `DEAD_LETTER` with a safe error code;
7. success records engine/signature version, computed checksum, detected MIME and scan time;
8. scan attempts are completed for clean, infected and failure outcomes;
9. startup recovery finds abandoned PENDING/RUNNING attempts.

### 4.9 Implement real filename protection

- Use AES-256-GCM or provider KMS envelope encryption.
- Store ciphertext, nonce, authentication tag and key version separately.
- Never store the data-encryption key with the ciphertext.
- Load encryption keys from secret management/runtime configuration.
- New writes use the active key version; reads support explicitly retained versions.
- Key rotation has a re-encryption/reconciliation path.
- Logs, audit and API responses use safe display names only.

### 4.10 Make candidate acceptance atomic

Create one serializable transaction-aware `acceptWithSignedDocument` command.

Canonical lock order:

1. command receipt;
2. Offer;
3. Application;
4. upload session;
5. FileObject;
6. current signature submissions;
7. RecruitmentDocument;
8. status history, audit and outbox.

Inside the transaction:

- replay/claim `(companyId, operationId)`;
- lock and validate the Offer token and expected Offer version;
- require the current Offer to be eligible for acceptance;
- require the Application/Offer/session/FileObject tenant and Branch relationship;
- require session and FileObject CLEAN, PDF by detected MIME/magic bytes, unexpired and not deletion-pending;
- set `JobOffer.status = ACCEPTED`, response timestamp, legal name and protected declaration evidence;
- set `JobApplication.status = OFFER_ACCEPTED` and accepted timestamp;
- increment Offer/Application versions as required by their state machines;
- create the immutable RecruitmentDocument and next concurrency-safe submission number;
- create `OfferSignatureSubmission(PENDING_VERIFICATION)`;
- consume or transition the response token according to the established replay contract;
- write Application status history, domain audit and `OFFER_SIGNATURE_SUBMITTED` outbox event;
- store a safe command-response snapshot.

An exact replay returns the original safe response. A conflicting payload returns `OPERATION_ID_REUSED`.

### 4.11 Fix verification, rejection and resubmission

- enforce `recruitment.offer.verify` in the backend;
- validate both `expectedOfferVersion` and `expectedSubmissionVersion`;
- lock Offer and submission before deciding;
- require current FileObject status CLEAN at decision time;
- verify/reject with expected-state writes and version increments;
- require a protected reason for rejection and resubmission;
- record actor evidence, audit and outbox events;
- make command replay idempotent;
- implement `request-signature-resubmission` with a new candidate action token;
- keep rejected/superseded submissions immutable and visible in history;
- allocate `submissionNo` using a locked aggregate/counter or retry-safe unique insert.

Do not return `objectKey`. Return `recruitmentDocumentId`, `fileStatus`, current versions and typed `allowedActions`.

### 4.12 Make Ready-to-Hire and conversion transactional

Preflight remains advisory. In the Recruitment conversion transaction:

1. lock Application and current accepted Offer;
2. lock the current verified signature submission, RecruitmentDocument and FileObject;
3. revalidate Offer/Application status and versions;
4. revalidate Company/Branch relationships;
5. require FileObject still CLEAN and accessible;
6. create/link Employee documents to the same FileObject inside the conversion transaction;
7. require configured Recruitment-kind to Employee-document-type mappings;
8. fail conversion if required mapping/linking cannot complete;
9. create career, audit and outbox evidence atomically;
10. do not swallow document-integration errors.

The conversion must never copy the binary and must not choose the first arbitrary Employee document type/category.

### 4.13 Correct Employee document integration

Change the Employee document create API to accept a clean `uploadSessionId`, not a raw FileObject/storage reference.

The service must:

- resolve the Employee and upload session inside tenant/persona scope;
- verify the session purpose, Employee target, Company/Branch and CLEAN FileObject;
- link `EmployeeDocument.fileObjectId` transactionally;
- snapshot Company/Branch from the Employee;
- make replay idempotent;
- require CLEAN at document verification time;
- include safe file status and download capability in reads;
- use logical deletion and shared-reference retention handling rather than hard deleting the object.

### 4.14 Complete retention, deletion and operations

Implement durable scheduled producers/workers for:

- expired upload-session cleanup;
- quarantine orphan discovery;
- DB-without-object and object-without-DB reconciliation;
- retention eligibility;
- logical deletion and provider delete retries;
- dead-letter monitoring.

Before deleting an object, the worker must lock/revalidate:

- FileObject version/status;
- every RecruitmentDocument reference;
- every EmployeeDocument reference;
- every signature-submission reference;
- legal hold;
- approved retention policy and `retainUntil`.

Add backend APIs consumed by:

- `/admin/operations/files`;
- `/settings/security/document-retention`.

Operations responses expose counts, safe IDs, status, timestamps and safe error codes only.

## 5. Corrective database contract

### 5.1 New migration

Create a new migration after `20260819140000_secure_file_storage_and_signed_offer`. It must be rehearsed from zero and as an upgrade with legacy data before shared-database deployment.

### 5.2 Tenant-qualified integrity

Add supporting unique keys and composite foreign keys in consistent field order:

- FileObject `(companyId, id)`;
- Branch `(companyId, id)`;
- Employee `(companyId, id)`;
- JobOffer `(companyId, branchId, id)`;
- RecruitmentDocument `(companyId, id)` after reconciliation;
- EmployeeDocument `(companyId, id)` after reconciliation.

Use composite relationships or deferred tenant guards so that:

- FileObject Branch belongs to the same Company;
- upload-session target belongs to the same Company/Branch;
- RecruitmentDocument and EmployeeDocument cannot reference a foreign FileObject;
- submission Offer, Application, RecruitmentDocument and FileObject represent the same Company/Branch and hiring aggregate.

Use `onDelete: Restrict, onUpdate: Restrict` for history and evidence references.

### 5.3 Required checks and triggers

Add named database backstops for:

- FileObject CLEAN evidence: actual size/checksum, detected MIME, scan result/time and clean object prefix are present;
- INFECTED/SCAN_FAILED evidence shape;
- encryption ciphertext/nonce/tag/key-version shape;
- legal-hold actor/time/reason shape;
- deletion-request actor/time/reason shape;
- upload-session purpose/target shape;
- exactly one applicable upload target;
- finalized session requires FileObject and finalized timestamp;
- public session requires its token hash and authoritative context;
- operation attempt references exactly one FileObject or upload session;
- attempt terminal timestamp/error shape;
- signature decision actor/time/reason shape;
- superseded submission reference shape;
- document links reference only same-tenant CLEAN FileObjects;
- a verified signature cannot reference a non-CLEAN FileObject at commit;
- legal hold/reference presence blocks deletion completion.

### 5.4 Idempotency and concurrency indexes

- Preserve unique upload session `(companyId, operationId)`.
- Add a command-receipt table unique on `(companyId, operationId)`.
- Store command type, actor/public context, canonical hash format version, HMAC key version, request digest and safe response snapshot.
- Keep partial unique indexes for one pending and one verified submission per current Offer, aligned with the resubmission state machine.
- Add worker indexes on status, next attempt and lease expiry.
- Add reconciliation/retention indexes on status, prefix/profile and retain-until.

### 5.5 Reconciliation before contract columns become required

Produce and resolve reports for:

- RecruitmentDocument missing Company/Branch/FileObject;
- EmployeeDocument missing Company/Branch/FileObject;
- missing provider objects;
- duplicate storage references;
- cross-Company/Branch links;
- unknown scan evidence;
- accepted but unconverted Offers without verified signatures at cutover;
- objects with conflicting retention classes;
- unreferenced quarantine/clean objects.

Do not fabricate Company, Branch, checksum, MIME, scan or verification evidence. Unknown legacy rows remain classified and read-only until explicitly reconciled.

## 6. Frontend corrections

### Candidate

- use the mounted public API contract;
- never set browser-forbidden headers;
- preserve form state during scan;
- show CLEAN malware result separately from HR signature verification;
- submit acceptance only after CLEAN status;
- render `Offer accepted - HR verification pending` from the server response/state;
- support rejected-signature resubmission through the new action token.

### HR Recruitment

- mount `OfferSignatureVerificationPanel` in the Offer/Application detail journey;
- consume `recruitmentDocumentId` and actual submission `version`;
- render only server `allowedActions`;
- use the authorized download-grant API;
- refresh Offer, Application, ready-to-hire and signature state after decisions;
- preserve entered reasons on version conflict and refetch current state.

### Employee documents

- mount the secure upload component in HR Employee detail and approved self-service surfaces;
- submit `uploadSessionId` to the EmployeeDocument create/replace command;
- remove legacy provider/reference controls from forms and frontend DTOs;
- show scan/file status and server `allowedActions`;
- use download grants only;
- refetch document lists and summaries after mutation.

### Operations

- connect the operations page only after its typed backend API exists;
- add loading, empty, denied, retry and dead-letter states;
- never display object keys or sensitive scanner/provider messages.

## 7. Required automated and real-system evidence

The implementation is not complete until the companion verification document passes:

- `docs/development/secure-documents-and-signed-offer-verification-checklist.md`

At minimum this includes:

- schema validation and clean builds;
- from-zero and legacy-upgrade migration rehearsal;
- real PostgreSQL concurrency tests;
- real S3-compatible PUT/HEAD/GET/copy/delete tests;
- real ClamAV clean, EICAR and outage tests;
- real API authorization tests;
- real Playwright Candidate/HR/Employee/operations personas;
- Recruitment -> accepted signed Offer -> verification -> conversion -> shared Employee documents end to end;
- reconciliation, backup/restore, monitoring and business sign-off.

## 8. Recommended commit grouping

1. `security(storage): rotate leaked credentials and validate runtime configuration`
2. `fix(file-storage): mount module and enforce route permissions`
3. `fix(file-storage): harden upload integrity and durable scanning`
4. `fix(signed-offer): make acceptance verification and resubmission atomic`
5. `fix(recruitment): enforce signed-document conversion transaction`
6. `fix(employee-documents): link clean upload sessions and shared files`
7. `db(file-storage): add tenant state and idempotency backstops`
8. `feat(file-operations): add retention reconciliation and dead-letter workers`
9. `fix(ui): wire candidate HR employee and operations journeys`
10. `test(file-storage): add real database storage scanner API and browser evidence`

Each commit must remain buildable and must not mix unrelated formatting changes.

## 9. Completion definition

This corrective plan is complete only when:

- no P0/P1 finding in this document remains;
- the applied corrective migration is verified by catalog checks;
- legacy rows are reconciled or explicitly approved as classified exceptions;
- all new file routes are mounted, scoped and authorized;
- candidate acceptance atomically updates Offer/Application and creates signed evidence;
- conversion atomically revalidates and links the shared clean FileObject;
- Employee documents no longer accept arbitrary storage references;
- retention and scan work is durable and observable;
- real storage, scanner, database, API and browser evidence passes;
- the recorded release commit receives technical, security and business approval.
