# Secure Documents and Signed-Offer Implementation Plan

## 1. Purpose and status

This document is the authoritative implementation plan for Developer 2. It defines the shared production file platform for Recruitment and Employee documents and the approved signed-offer workflow.

This is a plan, not evidence that the database migration, storage provider, malware scanner, API, UI, reconciliation or production acceptance has been completed. Mock storage, mocked ClamAV, metadata-only Employee document tests and unit tests are not real integration evidence.

The plan incorporates the approved walkthrough suggestion:

```text
HR sends offer
  -> Candidate accepts and uploads signed PDF
  -> Authorized HR verifies signed PDF
  -> Ready-to-Hire/Conversion becomes available
  -> Employee is created
```

The following are deliberately deferred:

- External e-signature provider integration.
- Microsoft Teams/Outlook calendar integration.
- Hiring-manager co-approval of the signed offer.

## 2. Locked product decisions

- Use a generic private S3-compatible object store.
- Production storage must support private access, TLS, presigned PUT/GET and native server-side encryption.
- Browsers upload directly to a private quarantine prefix through a short-lived signed PUT.
- All user-provided files are scanned asynchronously with ClamAV.
- Only a verified `CLEAN` object can be linked to a Recruitment or Employee document or downloaded.
- Public application submission references already-clean upload sessions; it must not commit an Application with an unscanned required CV.
- Employee document DTOs no longer accept arbitrary storage-provider/reference values.
- Candidate offer acceptance keeps the existing legal-name and declaration controls and adds a required signed PDF.
- One authorized HR actor with `recruitment.offer.verify` verifies or rejects the signed submission.
- Current `JobOfferStatus.ACCEPTED` and `JobApplicationStatus.OFFER_ACCEPTED` remain the candidate acceptance states. Signed-offer verification is represented by a dedicated `OfferSignatureSubmission`; conversion additionally requires a verified submission.
- Rejected signed files remain immutable evidence. Candidate resubmission creates another submission record.
- Recruitment-to-Employee conversion links the same clean `FileObject`; it does not copy the binary.
- Retention is configurable by Company. Automated purge runs only after an authorized Company policy has been approved.
- Legal hold overrides every scheduled deletion.

## 3. Developer ownership and integration boundary

Developer 2 owns:

- Shared FileObject, upload-session, scan, access-audit, retention and compensation models.
- S3-compatible storage adapter.
- ClamAV worker and scanner readiness.
- Public Recruitment, HR Recruitment, HR Employee and Employee self-service file APIs.
- Migration of existing `RecruitmentDocument` and `EmployeeDocument` metadata/objects.
- Signed-offer candidate submission and HR verification.
- Ready-to-Hire and conversion preflight enforcement.
- File upload/status/download/verification/operations UI.

Developer 2 must not:

- Send email directly.
- Put email addresses or action tokens into storage keys or outbox payloads.
- Call the delivery controller from backend code.
- Add a second document binary when Recruitment and Employee records can reference the same FileObject.
- Trust a client-supplied Company, Branch, bucket, object key, scan result or storage provider.

Developer 2 emits safe domain events through `OutboxEvent`. Developer 1 resolves recipients and performs delivery.

## 4. Immediate security prerequisite

Before using any current storage configuration:

1. Inspect tracked environment examples, repository history and CI logs for credential-like values.
2. Revoke/rotate any value that may be a real access key or secret.
3. Replace tracked values with placeholders.
4. Inject runtime secrets from the deployment secret manager/environment.
5. Use least-privilege credentials restricted to the HRMS environment and object prefixes.
6. Record rotation and provider-policy evidence without recording secret values.

Never print credentials in migration logs, tests, documentation or error responses.

## 5. Database contract

### 5.1 Enums

```text
FileObjectStatus:
QUARANTINED
SCANNING
CLEAN
INFECTED
SCAN_FAILED
UNREFERENCED
DELETION_PENDING
DELETED
MISSING

FileUploadSessionStatus:
ISSUED
UPLOADED
FINALIZING
CLEAN
REJECTED
EXPIRED
CANCELLED

FileOperationType:
VERIFY_UPLOAD
SCAN
PROMOTE
DELETE
RECONCILE

FileOperationStatus:
PENDING
PROCESSING
SUCCEEDED
RETRY_WAIT
DEAD_LETTER

FileRetentionClass:
PUBLIC_UPLOAD_ORPHAN
RECRUITMENT_UNSUCCESSFUL
RECRUITMENT_HIRED
EMPLOYEE_RECORD
INFECTED_OR_FAILED_SCAN

OfferSignatureSubmissionStatus:
PENDING_VERIFICATION
VERIFIED
REJECTED
SUPERSEDED
```

### 5.2 `FileObject`

Required fields:

- `id`, optimistic `version`.
- `companyId` and `branchId` ownership snapshots; Branch may be null only for an explicitly Company-level document class.
- `storageProfileCode`; this refers to server configuration and contains no credential.
- opaque current `objectKey` and optional provider object/version reference.
- `status`.
- encrypted original filename, filename-encryption key version and safe extension.
- declared MIME, detected MIME.
- expected and actual byte size.
- expected and actual SHA-256.
- ClamAV engine version, signature version, result and scan timestamp.
- server-side encryption mode and non-secret key reference.
- retention class and `retainUntil`.
- legal-hold actor, timestamp and protected reason.
- deletion-request actor, timestamp, protected reason and completed timestamp.
- creator User or public-upload context.
- creation/update timestamps.

Supporting keys and indexes:

- `@@unique([companyId, id])`.
- `@@unique([companyId, branchId, id])` when Branch is required by the relation.
- unique `(storageProfileCode, objectKey)`.
- `(status, updatedAt)` for workers/reconciliation.
- `(companyId, branchId, status, createdAt)`.
- `(retainUntil, status)` for retention scans.
- `(actualChecksumSha256)` only for integrity lookup; never use it to deduplicate across Companies.

Checks:

- `CLEAN` requires actual checksum, detected MIME, successful scan evidence and a clean-prefix object key.
- `INFECTED` requires scan timestamp/result.
- `DELETED` requires deletion-completed timestamp.
- `DELETION_PENDING` or `DELETED` is forbidden while legal hold is active.
- encrypted filename requires a recognized encryption-key version.
- no original filename, Candidate name, Employee code or email address may be embedded in `objectKey`.

### 5.3 `FileUploadSession`

Required fields:

- Company/Branch ownership.
- domain purpose: public Application, Recruitment document, Employee document, signed Offer or generated Offer.
- Job Opening/Application/Employee/Offer binding when available.
- `applicationOperationId` for a public file uploaded before Application creation.
- expected filename, extension, declared MIME, byte size and SHA-256.
- quarantine object key.
- public session-token hash when unauthenticated.
- status, expiry, upload/finalize timestamps.
- resulting FileObject ID.
- operation ID and optimistic version.

Constraints:

- Unique scoped operation ID for session creation.
- Public Application sessions require Job Opening and application operation ID.
- Signed-offer sessions require Job Offer binding and PDF metadata.
- A session can produce at most one FileObject.
- Finalize is idempotent and returns the existing FileObject/status on replay.

Indexes:

- `(status, expiresAt)`.
- `(companyId, branchId, status, createdAt)`.
- `(jobOpeningId, applicationOperationId)`.
- `(jobOfferId, status)`.

### 5.4 `FileOperationAttempt`

Fields:

- FileObject or Upload Session.
- operation type and attempt number.
- operation status.
- safe storage/scanner error class/code.
- worker correlation ID.
- start/completion/next-attempt timestamps.

Constraints:

- Unique `(fileObjectId, operationType, attemptNo)` where FileObject exists.
- Attempt rows are append-only.
- No object bytes, signed URLs or credentials are stored.

### 5.5 `FileAccessAudit`

Fields:

- FileObject ID and domain document type/ID.
- Company/Branch.
- actor User/Employee, or public offer-response context.
- access purpose and decision.
- redacted denial code when rejected.
- timestamp and request/correlation ID.

Do not store the generated signed URL or permanent storage key in the access audit.

### 5.6 `FileRetentionPolicy`

Fields:

- Company and retention class.
- retention rule/value.
- enabled state and optimistic version.
- approved actor and timestamp.
- last updated actor and timestamp.

Constraints:

- Unique `(companyId, retentionClass)`.
- A purge job can act only when the relevant policy is enabled and approved.
- Branches inherit the Company policy in this release; there is no Branch override.

### 5.7 Recruitment and Employee document relations

Add tenant snapshots and FileObject relation to both document models.

`RecruitmentDocument`:

- Add `companyId`, `branchId`, `fileObjectId` and optimistic version.
- Backfill Company/Branch through Application -> Job Opening, Offer, or Candidate/Application association.
- If multiple current associations resolve to different tenants, stop and reconcile rather than guessing.

`EmployeeDocument`:

- Add `companyId`, `branchIdAtUpload`, `fileObjectId` and optimistic version.
- Backfill from the Employee's organization at migration time.
- Access follows the authoritative Employee and document permissions; `branchIdAtUpload` remains historical evidence after a career transfer.

Public create/update DTOs must no longer accept:

- `storageProvider`.
- `storageReference`.
- `storageKey`.
- `scanStatus`.
- `fileObjectId`.
- Company/Branch ownership.

Database integrity:

- Company-qualified composite foreign keys.
- historical Company/Branch/FileObject references use `onDelete: Restrict, onUpdate: Restrict`.
- a trigger/deferred constraint rejects linking a non-CLEAN or cross-Company FileObject to a document.
- domain references restrict FileObject hard deletion; public deletion is a state transition.

## 6. S3-compatible storage contract

The provider must support:

- private bucket/container with public access disabled;
- TLS;
- presigned PUT and GET;
- HEAD/stat;
- copy/promote;
- delete;
- native AES-256 server-side encryption or a configured provider-managed KMS key;
- least-privilege credentials scoped to the application prefixes.

Fail application readiness when production storage cannot prove private access and encryption. Do not silently fall back to local disk in production.

Object keys:

```text
{environment}/{companyId}/{branchId-or-company}/quarantine/{uuid}
{environment}/{companyId}/{branchId-or-company}/clean/{uuid}
```

Rules:

- Keys are server-generated and opaque.
- Original filename is encrypted in the database and supplied only as authorized download metadata.
- Required upload headers include content length/checksum and provider encryption headers.
- Validate returned object metadata with HEAD; do not trust ETag as a SHA-256.
- Files remain private even after promotion.

## 7. Upload, scan and promotion flow

### 7.1 Create session

1. Resolve the domain record and Company/Branch server-side.
2. Validate actor/public anti-abuse authorization.
3. Validate filename extension, declared MIME, byte size and checksum format.
4. Generate opaque quarantine key and session token where public.
5. Create `FileUploadSession(ISSUED)` idempotently.
6. Return a short-lived presigned PUT URL and exact required headers.

### 7.2 Finalize and scan

1. Claim/fetch the session using the authenticated actor or public session token.
2. Lock the session and return its existing result on replay.
3. HEAD the object and validate byte size/checksum metadata.
4. Create `FileObject(QUARANTINED)` and enqueue scan work.
5. Scanner streams the object through ClamAV; it does not load arbitrary large content fully into API-worker memory.
6. Detect MIME from file bytes and compare with extension/declared MIME.
7. If clean, promote/copy to the clean prefix and mark `CLEAN` atomically with the verified metadata.
8. If infected, mark `INFECTED`, block every download/link and enqueue retention handling.
9. If the scanner fails or is unavailable, mark `SCAN_FAILED`; never treat it as clean.

### 7.3 Limits

- Recruitment CV/supporting files: 10 MB, PDF/DOC/DOCX.
- Employee documents: 25 MB, approved PDF/image/DOC/DOCX types.
- Signed offer: PDF only, using the Recruitment maximum unless product configuration sets a smaller limit.
- Generated offer PDFs use the same FileObject foundation and clean-access contract.

The server may configure stricter limits by document purpose but cannot raise them without an explicit security review.

## 8. File APIs

### 8.1 Public Recruitment upload

```http
POST /careers/openings/:openingId/upload-sessions
POST /file-upload-sessions/:id/finalize
GET  /file-upload-sessions/:id
```

Public create request:

```ts
interface CreatePublicUploadSessionRequest {
  applicationOperationId: string;
  purpose: "CV" | "SUPPORTING";
  fileName: string;
  declaredMimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  antiAbuseToken: string;
}
```

The session is bound to the Job Opening, Company/Branch and application operation ID. A later public Application submission supplies session IDs; the service requires every required session to be `CLEAN` and in the same scope.

### 8.2 Authenticated uploads

```http
POST /recruitment-documents/upload-sessions
POST /employee-documents/upload-sessions
POST /file-upload-sessions/:id/finalize
GET  /file-upload-sessions/:id
```

Authenticated create request:

```ts
interface CreateDomainUploadSessionRequest {
  domainRecordId: string;
  purpose: string;
  fileName: string;
  declaredMimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  operationId: string;
}
```

The client does not provide Company, Branch, bucket, key, provider, encryption or scan fields.

### 8.3 Session response

```ts
type UploadAllowedAction = "UPLOAD" | "FINALIZE" | "CANCEL";

interface UploadSessionResponse {
  id: string;
  version: number;
  status: string;
  upload: {
    method: "PUT";
    url: string;
    headers: Record<string, string>;
    expiresAt: string;
  } | null;
  scan: {
    status: string;
    safeErrorCode: string | null;
  };
  fileObjectId: string | null;
  allowedActions: UploadAllowedAction[];
}
```

Do not return an object key, bucket or provider credential.

### 8.4 Downloads and deletion

```http
POST /recruitment-documents/:id/download-grant
POST /employee-documents/:id/download-grant
DELETE /recruitment-documents/:id
DELETE /employee-documents/:id
```

Download sequence:

1. Resolve the domain document and actor through authoritative tenant/persona scope.
2. Verify FileObject is `CLEAN` and not deletion-pending/deleted/missing.
3. Create `FileAccessAudit`.
4. Return a five-minute presigned GET URL with authorized download filename.

Public offer document download additionally requires the valid offer-response or resubmission token. Do not accept FileObject IDs in public routes.

Deletion is logical/transactional first. It writes an outbox operation and later deletes the object only if there are no remaining document references and no legal hold.

Stable errors:

```text
FILE_NOT_FOUND
FILE_NOT_CLEAN
FILE_SCAN_PENDING
FILE_INFECTED
FILE_SCAN_FAILED
FILE_TYPE_MISMATCH
FILE_SIZE_MISMATCH
FILE_CHECKSUM_MISMATCH
UPLOAD_SESSION_EXPIRED
UPLOAD_SCOPE_MISMATCH
FILE_LEGAL_HOLD
FILE_STILL_REFERENCED
FILE_STATE_CHANGED
OPERATION_ID_REUSED
```

## 9. Signed-offer database and state contract

### 9.1 `OfferSignatureSubmission`

Fields:

- `id`, `companyId`, `branchId`.
- `jobOfferId`, `jobApplicationId`.
- `submissionNo`.
- `recruitmentDocumentId` and FileObject reached through that document.
- candidate legal name and declaration-accepted timestamp.
- `status`, optimistic `version`.
- submitted timestamp.
- verified actor/timestamp and protected verification note.
- rejected actor/timestamp and mandatory protected rejection reason.
- superseding submission pointer where applicable.
- request/correlation/audit references.
- creation/update timestamps.

Constraints:

- Unique `(jobOfferId, submissionNo)`.
- Company-qualified Offer/Application/Document references.
- Offer and Application must match each other.
- RecruitmentDocument must be `OFFER_PDF`, belong to the same Offer/Application and reference a CLEAN PDF FileObject.
- Partial unique index for one `PENDING_VERIFICATION` submission per Offer.
- Partial unique index for one `VERIFIED` submission per Offer.
- Verified status requires verifier/timestamp.
- Rejected status requires rejector/timestamp/reason.
- A verified submission cannot be changed to rejected; any correction requires explicit reversal policy outside this release.

### 9.2 Offer/Application state

Preserve existing enum states:

- Candidate acceptance sets `JobOffer.status = ACCEPTED`.
- Candidate acceptance sets `JobApplication.status = OFFER_ACCEPTED`.
- `OfferSignatureSubmission` distinguishes pending, verified and rejected evidence.
- UI labels an accepted Offer without verified signature as `Offer accepted - HR verification pending`.
- Ready-to-Hire and conversion remain unavailable until the current submission is `VERIFIED`.

This avoids rewriting existing accepted-offer history while still adding the mandatory verification gate.

## 10. Signed-offer API flow

### 10.1 Candidate submission

The existing public offer-response screen keeps legal name and declaration checkbox. It adds signed-PDF upload.

Sequence:

1. Candidate opens the current secure offer link.
2. Candidate downloads the generated Offer PDF.
3. Candidate signs it outside HRMS.
4. Candidate uploads the PDF through an Offer-bound upload session.
5. UI waits until the session is `CLEAN`.
6. Candidate submits Accept with the clean upload-session ID.
7. One transaction locks Offer/Application/session/FileObject, validates token/version/scope and creates:
   - candidate response evidence;
   - accepted Offer/Application state;
   - RecruitmentDocument linked to FileObject;
   - `OfferSignatureSubmission(PENDING_VERIFICATION)`;
   - status history, audit and `OFFER_SIGNATURE_SUBMITTED` outbox event.
8. Token replay returns the same safe accepted/submission response.

```http
POST /public/offers/:token/upload-sessions
POST /public/offers/:token/accept-with-signed-document
```

Accept request:

```ts
interface AcceptOfferWithSignedDocumentRequest {
  legalName: string;
  declarationAccepted: true;
  uploadSessionId: string;
  expectedOfferVersion: number;
  operationId: string;
}
```

Acceptance is rejected if the file is missing, pending, infected, non-PDF, expired or bound to another Offer/Company/Branch.

### 10.2 HR verification

```http
GET  /job-offers/:id/signature-submissions
GET  /job-offers/:id/signature-submissions/:submissionId
POST /job-offers/:id/signature-submissions/:submissionId/verify
POST /job-offers/:id/signature-submissions/:submissionId/reject
POST /job-offers/:id/request-signature-resubmission
```

Verify/reject request:

```ts
interface DecideOfferSignatureRequest {
  expectedOfferVersion: number;
  expectedSubmissionVersion: number;
  operationId: string;
  reason: string;
}
```

Rules:

- Requires `recruitment.offer.verify`.
- Ordinary offer-manage permission cannot verify.
- Verifier reloads and downloads the immutable clean signed file.
- Verify marks the submission `VERIFIED` and writes audit/outbox evidence.
- Reject requires a reason, marks it `REJECTED` and writes audit/outbox evidence.
- Rejection never deletes or overwrites the rejected document.
- Resubmission command creates a new secure candidate action token/event.
- Candidate uploads a new FileObject and new submission number.
- A later pending/verified submission marks the earlier rejected submission as historical, not deleted.

Stable errors:

```text
SIGNED_OFFER_REQUIRED
SIGNED_OFFER_SCAN_PENDING
SIGNED_OFFER_NOT_VERIFIED
SIGNED_OFFER_ALREADY_VERIFIED
SIGNED_OFFER_STATE_CHANGED
SIGNED_OFFER_SCOPE_MISMATCH
OFFER_VERIFICATION_PERMISSION_REQUIRED
OFFER_CONVERSION_BLOCKED
```

## 11. Ready-to-Hire and conversion gate

The shared conversion preflight must additionally require:

- the accepted Offer is current and not expired/revoked/superseded;
- current `OfferSignatureSubmission.status = VERIFIED`;
- its RecruitmentDocument and FileObject are still CLEAN and accessible;
- Offer, Application, submission, document, Company and Branch all match;
- optimistic versions remain current.

The conversion transaction revalidates these conditions after locking the Application and Offer. A preflight result is advisory; it cannot substitute for transactional revalidation.

Ready-to-Hire response adds:

```ts
interface SignedOfferReadiness {
  required: true;
  status: "NOT_SUBMITTED" | "PENDING_VERIFICATION" | "REJECTED" | "VERIFIED";
  submissionId: string | null;
  fileStatus: string | null;
  verifiedAt: string | null;
  blockingCode: string | null;
}
```

Conversion returns `OFFER_CONVERSION_BLOCKED` or `SIGNED_OFFER_NOT_VERIFIED` when the gate fails. It must not set Hired or create the Employee first and discover the failure afterward.

## 12. Recruitment-to-Employee document integration

On successful conversion:

- Link the clean CV to an Employee document type/category.
- Link the final generated Offer PDF.
- Link the VERIFIED signed Offer PDF.
- Reference the same FileObject IDs; do not copy object bytes.
- Preserve Recruitment documents and signature evidence.
- Use the Employee retention class after linking.
- Write audit/career references without exposing object keys.

If Employee document mapping is not configured, conversion preflight reports a configuration blocker rather than creating untyped Employee document rows.

Deleting a RecruitmentDocument reference must not delete a FileObject referenced by EmployeeDocument or signature evidence.

## 13. Frontend implementation

### 13.1 Reusable upload components

Add/refactor:

- `SecureFileUploadField`.
- `UploadProgress`.
- `MalwareScanStatus`.
- `DocumentDownloadAction`.
- `DocumentAccessDeniedState`.
- `FileOperationFailurePanel`.

Client states:

```text
Selecting
Uploading
Uploaded
Scanning
Clean
Rejected
Expired
Retryable failure
```

Rules:

- Do not show successful submission while scanning is pending.
- Do not calculate scan safety locally.
- Preserve selected file/input on retryable failures where browser security permits.
- Never display storage bucket/key/provider credentials.
- Render download/delete actions only from server `allowedActions`.

### 13.2 Public Application

- Upload required CV before Application submit.
- Display upload and scan progress.
- Submit only clean session IDs.
- Preserve form data while scan completes or fails.
- Infected/mismatched files show safe replacement guidance.
- Expired upload sessions can be recreated without duplicating the Application.

### 13.3 Candidate Offer response

- Preserve Offer download, legal-name and declaration controls.
- Require signed PDF upload when Accept is selected.
- Disable final Accept until upload is CLEAN.
- Show `Offer accepted - HR verification pending` after success.
- When HR rejects, show the safe rejection reason and allow the new resubmission action link to upload a replacement.
- Do not let the candidate view HR-private notes or other submissions.

### 13.4 HR Application/Offer

- Show current signature status and immutable submission history.
- View/download the signed file through a short-lived authorized grant.
- Render Verify/Reject only from `allowedActions`.
- Verify/Reject dialogs require reason and expected versions.
- On 409 preserve reason, refetch and show current decision.
- Ready-to-Hire remains blocked with the server blocking code until VERIFIED.

### 13.5 Employee documents

- Reuse the secure upload/scan/download flow in HR Employee detail and Employee self-service.
- Verification/rejection is unavailable until the file is CLEAN.
- Self-service sees only documents explicitly exposed to the Employee.
- HR access remains Company/Branch scoped.

### 13.6 Operations and policy UI

Routes:

```text
/admin/operations/files
/settings/security/document-retention
```

Operations view:

- scan failures;
- infected-file counts without exposing content;
- expired sessions;
- unreferenced objects;
- missing objects;
- deletion retries/dead letters;
- ClamAV/provider readiness.

Retention view:

- Company-level class rules.
- approval state.
- legal-hold placement/release with reason.
- next eligible purge date/count.
- no client-side authorization derivation.

## 14. Retention, deletion and compensation

Default Company-configurable policies:

- Unsubmitted or unreferenced uploads: purge after 24 hours.
- Infected or scan-failed objects: retain inaccessible for 30 days, then purge.
- Unsuccessful Candidate/Application documents: 12 months after terminal Application state.
- Hired Candidate documents linked to Employee: Employee retention applies.
- Employee records: separation date plus seven years.

Automation rules:

- Purge acts only when the Company policy is enabled and approved.
- Legal hold always wins.
- Retention computes the strongest rule across all active references.
- Domain deletion first removes/archives the reference and sets FileObject `DELETION_PENDING` only when reference count is zero.
- Storage delete runs asynchronously and writes FileOperationAttempt.
- Successful storage deletion marks `DELETED`.
- Exhausted failure becomes a dead-letter and operations alert.

Compensation cases:

- Signed PUT issued but never uploaded: expire session and remove any partial object.
- Object uploaded but finalize never called: orphan scanner removes after the grace rule.
- File promoted but domain transaction fails: mark `UNREFERENCED` and retry/clean up.
- DB says object exists but HEAD fails: mark `MISSING`, block access and alert.
- Storage object exists without DB row: inventory reconciliation quarantines/reports it before purge.
- DB link conflicts during conversion: roll back the DB transaction; do not delete a shared FileObject.

## 15. Migration and rollout

Use expand -> inventory/backfill/reconcile -> contract.

### Expand

- Add new enums/models/permissions and nullable tenant/FileObject references.
- Add signed-offer submission model.
- Deploy feature flags off.
- Preserve current clean-only Recruitment download behavior.
- Do not remove legacy Employee storage columns yet.

Flags:

- `FILE_STORAGE_V2_ENABLED`.
- server-side Company/Branch allowlist.
- `FILE_SCAN_WORKER_ENABLED`.
- `SIGNED_OFFER_VERIFICATION_ENABLED`.
- `FILE_RETENTION_PURGE_ENABLED`.

### Inventory and backfill

Recruitment:

- Derive Company/Branch from authoritative Application/Offer relationships.
- Create FileObject rows for known storage keys.
- HEAD every object and verify size/checksum.
- Re-scan or classify legacy scan evidence under an approved rule; do not assume unknown objects are clean.

Employee:

- Inventory every `storageProvider/storageReference`.
- Import recognized objects through the shared scanner.
- Mark missing/unknown/external references for reconciliation.
- Keep unknown legacy rows read-only; do not silently delete them or claim migration success.

Signed offers:

- Existing accepted/Hired records are historical and are not retroactively blocked.
- The verification gate applies to new candidate acceptances after Company/Branch enablement.
- Report accepted-but-unconverted Offers at cutover so HR can choose a controlled grandfather or request a signed upload; do not guess automatically.

Required reports:

- missing objects;
- duplicate storage references;
- cross-Company/Branch document links;
- unscanned/infected/scan-failed files;
- orphan quarantine/clean objects;
- Employee document provider references that cannot be imported;
- accepted Offers lacking verified signed submissions;
- FileObjects with conflicting retention references.

### Contract and activation

- Require FileObject for all new Recruitment/Employee documents.
- Remove public DTO support for provider/reference/key/scan fields.
- Enable signed-offer verification only where file storage and scan workers are enabled.
- Pilot one approved Company/Branch.
- Keep compatibility reads until all legacy objects are migrated or explicitly classified.
- Do not enable retention purge until policy approval and backup/restore rehearsal are complete.
- Mixed Company Group context requires selecting a uniformly enabled Company/Branch.

## 16. Test and acceptance plan

Backend unit/service:

- upload metadata/type/size validation;
- tenant-derived storage ownership;
- state transitions and `allowedActions`;
- ClamAV result mapping;
- retention/legal-hold calculation;
- signed-offer submission/verification state machine;
- Ready-to-Hire gate;
- shared FileObject reference protection.

Real PostgreSQL integration/concurrency:

- duplicate upload-session operation ID;
- concurrent finalize;
- scan result versus delete;
- document link versus orphan cleanup;
- legal hold versus retention purge;
- verify versus reject;
- resubmission versus verification;
- conversion versus verification/rejection;
- conversion linking Recruitment and Employee references atomically.

Real storage/scanner integration:

- actual S3-compatible presigned PUT/GET;
- encryption headers and private-access verification;
- HEAD/size/SHA-256 validation;
- actual ClamAV clean file;
- EICAR infected-file rejection;
- scanner outage fail-closed behavior;
- expired upload/download URL;
- promote/copy/delete failure compensation;
- inventory finding DB-without-object and object-without-DB.

API authorization:

- public session bound to correct Opening/operation;
- foreign session cannot attach to Application/Offer;
- cross-Company/Branch direct IDs return safe 404;
- Employee can access only permitted own documents;
- ordinary HR cannot verify without `recruitment.offer.verify`;
- no response leaks key, bucket, credential or permanent URL.

Real browser personas:

1. Candidate uploads clean CV and submits Application.
2. Candidate infected/mismatched upload is blocked safely.
3. Candidate accepts Offer with a clean signed PDF.
4. Candidate cannot accept while scan is pending.
5. Authorized HR verifies the signed Offer.
6. Unauthorized HR cannot verify.
7. Rejected submission remains visible to HR and Candidate resubmits through a new secure link.
8. Ready-to-Hire remains blocked until verification.
9. Conversion links CV/generated Offer/signed Offer into Employee documents.
10. Employee accesses only authorized own clean documents.
11. Other Branch/Company cannot list/download/mutate the file.
12. Operations user sees scan/orphan/delete failures without file content leakage.

Production acceptance requires private encrypted storage, real clean/infected scanning evidence, short-lived authorized downloads, zero cross-tenant leakage, verified signed-offer conversion gate, correct shared Recruitment/Employee references, reconciliation reports at zero or explicitly approved exceptions, migration rehearsal, backup/restore evidence, monitoring and technical/business sign-off on the recorded release commit.

