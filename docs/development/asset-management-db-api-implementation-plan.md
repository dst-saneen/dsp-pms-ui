# Asset Management V2 — Database and API Implementation Plan

## Document status

- Type: implementation and production-readiness plan
- Status: planned; this document does not claim Asset V2 is implemented
- Scope: PostgreSQL/Prisma schema, migrations, backend services, REST APIs, authorization, transactions, integrations, tests, and release gates
- Current product status: [Overall Product Development Status](./overall-product-development-status.md)
- Onboarding boundary: [Onboarding Department Flow](../product/onboarding-department-flow-gap-explained.md)
- Review basis: current repository schema/services/routes, the repository Onboarding Department Flow, and the two user-provided explanatory gap drafts. The drafts are requirements/reference material; this plan is the implementation contract.

This document is the source of truth for the Asset V2 database contract, API contract, permissions, state transitions, concurrency rules, and error codes. The frontend must consume server responses and `allowedActions`; it must not reproduce authorization or lifecycle rules locally.

Asset implementation may proceed while Recruitment P0/P1 remediation is in progress because this plan does not change Recruitment conversion. One migration owner must keep the migration chain ordered. Asset-to-Onboarding automation and Onboarding production acceptance remain blocked until Recruitment conversion is atomic and retry-safe.

## 1. Locked product decisions

1. Every Asset and software-license pool has one mandatory owning Department.
2. A Department is Branch-bound, so the owning Branch is derived from the owning Department and stored on the Asset for scoped querying.
3. Categories and Asset Types are reusable Company-level masters. Actual Assets/pools carry Department ownership.
4. Supported kinds are `GENERAL`, `HARDWARE`, `CARD`, and `SOFTWARE_LICENSE`.
5. Asset Type also fixes its tracking behavior:
   - `LOCATION`: AC, fridge, furniture, and other location-managed equipment.
   - `INDIVIDUAL`: laptop, phone, card, and other employee-custodied items.
   - `POOL`: software licence with capacity and multiple employee allocations.
6. Department custodians are explicitly granted Departments. Company Owner, Company Admin, and central Asset Manager retain broader scoped access.
7. Physical/card custody is limited to an Employee in the Asset's owning Branch. The Employee may belong to another Department in that Branch.
8. Software seats may be allocated to any eligible Employee in the same Company.
9. Ownership transfer uses source request and destination acceptance. A central Asset Manager can force completion only with a recorded reason.
10. HRMS stores software commercial metadata and an external vault reference. It never stores or returns the actual licence key.
11. Employees see only their own custody, acknowledge receipt, request return, and report loss/damage or request licence revocation. Employees never mutate authoritative custody directly.
12. Separation is blocked until custody is closed. A waiver requires a custodian request and independent HR/Company Admin approval.
13. Asset reminders use the existing in-app notification and transactional outbox foundation. Email is optional and only used when a provider is configured.
14. Automatic Onboarding fulfilment is not part of this Asset release. Asset custody records will include a future-safe source reference so Onboarding can integrate without schema redesign.

## 2. Existing implementation and fix-first defects

The current module already provides:

- `asset_categories`, `asset_types`, `assets`, and `employee_assets` tables.
- Category, Type, Asset, assignment, return, lost, and damaged service flows.
- A partial unique index preventing two open physical assignments for the same Asset.
- Existing permission codes for Asset masters and assignments.
- `/me/assets` read-only self-service output.
- Audit, notification, outbox, and number-series foundations.

The following defects are P1 prerequisites and must be corrected before Asset V2 is enabled:

- Category list/detail queries can fail open in Company Group context instead of applying the existing safe scope filter.
- Category, Type, and Asset update DTOs inherit `companyId`; Asset update also accepts arbitrary `status`.
- Company, Branch, Department, Type, lifecycle, and active-state changes can currently be mixed into generic edit operations.
- Category/Type/Asset mutation and audit writes are not consistently in one transaction.
- Assignment does not reject inactive or terminal Employees.
- Asset lists are unpaginated and load full assignment history.
- Current `Asset.status` mixes lifecycle and custody and can drift from `EmployeeAsset`.
- Existing actor fields depend on Employee IDs even though administrators can have a User without an Employee.
- UI mutation controls are not consistently hidden for read-only users; API authorization must remain the final control.

## 3. Implementation architecture

Use the following backend layers:

```text
Controller
  -> PermissionGuard (coarse permission)
  -> AssetAccessService (tenant + Department record scope)
  -> Query or Command Service
  -> PostgreSQL transaction / row locks / constraints
  -> AuditLog + OutboxEvent in the same transaction
  -> Response mapper with allowedActions
```

Create or separate these services:

- `AssetAccessService`: broad versus Department-granted record scope.
- `AssetQueryService`: paginated lists, detail, summary, and self-service projections.
- `AssetCommandService`: create, metadata update, archive/reactivate, repair, disposal, suspension, and retirement.
- `AssetCustodyService`: physical/card assignment and closure.
- `LicenseAllocationService`: pool capacity, allocation, revocation, and acknowledgement.
- `AssetTransferService`: Department/Branch transfer workflow.
- `AssetCustodyRequestService`: Employee requests and custodian resolution.
- `AssetClearanceService`: separation preflight, clearance items, and waiver decisions.
- `AssetCapabilityService`: server-side `allowedActions` calculation.
- `AssetNotificationService`: safe outbox events and recipient resolution.
- `AssetSensitiveIdentifierService`: protect card identifiers; never handle licence secrets.

Controllers must not update lifecycle fields directly. All state changes go through the relevant command service.

Target backend layout:

```text
backend/src/modules/asset-domain/
  asset-domain.module.ts
  asset-access.service.ts
  asset-query.service.ts
  asset-command.service.ts
  asset-custody.service.ts
  license-allocation.service.ts
  asset-transfer.service.ts
  asset-custody-request.service.ts
  asset-clearance.service.ts
  asset-capability.service.ts
  asset-response.mapper.ts
  asset-audit.mapper.ts
  asset-notification.service.ts
  asset-sensitive-identifier.service.ts
  dto/
  errors/
  policies/

backend/src/modules/asset-license-allocation/
backend/src/modules/asset-transfer/
backend/src/modules/asset-custody-request/
backend/src/modules/asset-department-grant/
backend/src/modules/asset-reminder/
```

Keep the existing Category, Type, Asset, EmployeeAsset, `/me/assets`, and EmployeeClearance controllers as route owners, but move business logic into `AssetDomainModule`. New route families get thin modules/controllers that import it. `AssetDomainModule` exports narrow transaction-aware services to Employee career/separation and later Onboarding code; it must not depend back on those feature modules, preventing circular imports.

## 4. Database contract

Identifier and date conventions:

- Preserve the repository's existing identifier representation: Prisma `String @default(uuid())`, stored in PostgreSQL as text. “UUID” in the field tables below means a UUID-formatted Prisma String; do not convert the Asset domain to PostgreSQL native `uuid` in this migration.
- Preserve existing timestamp column types during the compatibility migration. New day-only subtype fields may use Prisma `DateTime @db.Date`; API business dates remain `YYYY-MM-DD`.
- Existing table/column naming and `@map` conventions remain authoritative.

### 4.1 New enums

Add Prisma/PostgreSQL enums with these exact values:

```prisma
enum AssetKind {
  GENERAL
  HARDWARE
  CARD
  SOFTWARE_LICENSE
}

enum AssetTrackingMode {
  LOCATION
  INDIVIDUAL
  POOL
}

enum AssetLifecycleStatus {
  ACTIVE
  IN_REPAIR
  LOST
  DISPOSED
  SUSPENDED
  RETIRED
}

enum AssetActionType {
  CATEGORY_ARCHIVED
  CATEGORY_REACTIVATED
  TYPE_ARCHIVED
  TYPE_REACTIVATED
  ARCHIVED
  REACTIVATED
  SENT_TO_REPAIR
  REPAIR_COMPLETED
  MARKED_LOST
  DISPOSED
  SUSPENDED
  RESUMED
  RETIRED
  LICENSE_CAPACITY_RESIZED
  LICENSE_ALLOCATION_REVOKED
  IDENTIFIER_CORRECTED
  DEPARTMENT_GRANT_CREATED
  DEPARTMENT_GRANT_REVOKED
  DEPARTMENT_GRANT_REACTIVATED
}

enum AssetActionEntityType {
  CATEGORY
  TYPE
  ASSET
  LICENSE_ALLOCATION
  DEPARTMENT_GRANT
}

enum EmployeeAssetStatus {
  ASSIGNED
  RETURNED
  DAMAGED
  LOST
  WAIVED
}

enum LicenseAllocationStatus {
  ACTIVE
  REVOKED
  WAIVED
}

enum AssetTransferStatus {
  PENDING
  ACCEPTED
  REJECTED
  CANCELLED
  FORCED
}

enum AssetCustodyTargetType {
  EMPLOYEE_ASSET
  LICENSE_ALLOCATION
}

enum AssetCustodyRequestType {
  RETURN
  REPORT_DAMAGED
  REPORT_LOST
  REVOKE_LICENSE
}

enum AssetCustodyRequestStatus {
  SUBMITTED
  IN_REVIEW
  COMPLETED
  REJECTED
  CANCELLED
}

enum AssetClearanceItemStatus {
  OPEN
  RESOLVED
  WAIVED
}

enum AssetClearanceResolutionType {
  RETURNED
  DAMAGED
  LOST
  REVOKED
  WAIVED
}

enum AssetClearanceWaiverStatus {
  REQUESTED
  APPROVED
  REJECTED
  CANCELLED
}

enum AssetClearanceWaiverReasonCode {
  ASSET_NOT_RECOVERABLE
  EMPLOYEE_UNAVAILABLE
  COST_RECOVERY_APPROVED
  LEGAL_OR_SECURITY_HOLD
  MANAGEMENT_EXCEPTION
  OTHER
}

enum AssetSourceType {
  MANUAL
  IMPORT
  ONBOARDING_TASK
}

enum AssetReminderDispatchStatus {
  PENDING
  ENQUEUED
  SUPPRESSED
  FAILED
}
```

`EXPIRED` is not stored as a manually editable lifecycle status. Card, warranty, and licence expiry are computed from dates so records cannot remain falsely active because a scheduled transition was missed.

### 4.2 Asset Category changes

Retain the existing Company-level category table and add:

| Field | Type | Rule |
|---|---|---|
| `version` | `Int` | Default `1`; increment on every mutation |
| `archivedAt` | `DateTime?` | Set only through archive action |
| `archivedByUserId` | `String?` | User FK, `onDelete: SetNull` |

Keep the existing Company-scoped unique code and name constraints. `companyId` is immutable. `isActive` remains as a compatibility field during rollout and must equal `archivedAt == null`; it is not accepted by generic update DTOs.

Add `@@unique([companyId, id])` so Asset Type can use a composite Company-integrity foreign key.

### 4.3 Asset Type changes

Add:

| Field | Type | Rule |
|---|---|---|
| `kind` | `AssetKind` | Required after backfill |
| `trackingMode` | `AssetTrackingMode` | Required after backfill |
| `version` | `Int` | Default `1` |
| `archivedAt` | `DateTime?` | Dedicated action only |
| `archivedByUserId` | `String?` | User FK |

Database checks must allow only:

```text
GENERAL          -> LOCATION or INDIVIDUAL
HARDWARE         -> INDIVIDUAL
CARD             -> INDIVIDUAL
SOFTWARE_LICENSE -> POOL
```

Use a composite relation from `(companyId, assetCategoryId)` to `AssetCategory(companyId, id)`. Add `@@unique([companyId, id, kind, trackingMode])` so an Asset can snapshot and enforce the Type's classification.

Rules:

- `companyId` never changes.
- Category may change only before any Asset uses the Type.
- Kind/tracking mode may change only before any Asset uses the Type.
- Archive is blocked while an active Asset references the Type.
- Department custodians can read the Company taxonomy but cannot create or mutate it.

### 4.4 Asset changes

Extend `Asset` as follows:

| Field | Type | Required | Rule |
|---|---|---:|---|
| `departmentId` | `String` | Yes after backfill | Owning Department |
| `branchId` | `String` | Yes after backfill | Derived from Department |
| `kind` | `AssetKind` | Yes after backfill | Immutable snapshot of Type |
| `trackingMode` | `AssetTrackingMode` | Yes after backfill | Immutable snapshot of Type |
| `lifecycleStatus` | `AssetLifecycleStatus` | Yes | Default `ACTIVE` |
| `version` | `Int` | Yes | Default `1` |
| `serialNumberNormalized` | `String?` | No | Trimmed, upper-case canonical serial |
| `archivedAt` | `DateTime?` | No | Dedicated archive action |
| `archivedByUserId` | `String?` | No | User FK |

Keep the existing code, name, purchase, manufacturer, model, warranty, currency, location, and remarks fields. Apply these validations:

- `purchaseCost >= 0`.
- Currency is an upper-case three-character ISO code when cost is present.
- Warranty expiry cannot precede purchase date.
- `HARDWARE + INDIVIDUAL` requires a serial number.
- `GENERAL + LOCATION` requires a location.
- `CARD` requires one card-detail row.
- `SOFTWARE_LICENSE` requires one licence-detail row.

Use these composite foreign keys:

- `(companyId, branchId, departmentId) -> Department(companyId, branchId, id)`.
- `(companyId, assetTypeId, kind, trackingMode) -> AssetType(companyId, id, kind, trackingMode)`.
- `(companyId, branchId) -> Branch(companyId, id)`.

Add the supporting unique keys to Department and Branch even though `id` is already the primary key.

The current string `status` column remains during compatibility rollout but is no longer authoritative. New code derives availability from `lifecycleStatus`, tracking mode, open custody, and expiry. Remove direct DTO access immediately; physical removal of the legacy column belongs to a later cleanup migration after all consumers are verified.

### 4.5 Card details

Create `asset_card_details`:

| Field | Type | Rule |
|---|---|---|
| `assetId` | UUID PK/FK | One-to-one with Asset |
| `companyId` | UUID | Tenant and uniqueness scope |
| `cardNumberCiphertext` | `Bytes` | Encrypted identifier, never returned directly |
| `encryptionNonce` | `Bytes` | Unique 96-bit AES-GCM nonce for this ciphertext |
| `encryptionAuthTag` | `Bytes` | Authentication tag stored separately from ciphertext |
| `wrappedDataKey` | `Bytes` | Per-record DEK wrapped by configured KEK/KMS |
| `maskedCardNumber` | `String` | Safe display generated by masking rule |
| `keyEncryptionKeyVersion` | `String` | KEK/KMS key version used to wrap DEK |
| `encryptionFormatVersion` | `Int` | Cipher/AAD envelope format version |
| `issuer` | `String?` | Card issuer/system |
| `accessZone` | `String?` | Non-secret descriptive zone |
| `issuedDate` | `DateTime` | Required |
| `expiryDate` | `DateTime?` | Must not precede issue date |
| `createdAt`, `updatedAt` | timestamps | Standard audit timestamps |

Create `asset_card_lookup_indexes`:

| Field | Rule |
|---|---|
| `id` | UUID-formatted String primary key |
| `companyId`, `assetId` | Company-qualified relation to Card Asset |
| `lookupKeyVersion` | Accepted HMAC lookup-key version |
| `digest` | `HMAC-SHA-256(lookupKey, companyId || '|' || normalizedIdentifier)` |
| `createdAt` | Standard timestamp |

Use unique `(companyId, lookupKeyVersion, digest)` and `(companyId, assetId, lookupKeyVersion)` indexes. Normalize with one tested function (`NFKC`, trim, upper-case, and remove configured display separators). Generate a random 256-bit DEK per card record, encrypt the normalized identifier with AES-256-GCM and a fresh nonce, bind `asset-card:v{encryptionFormatVersion}|companyId|assetId` as AAD, then wrap the DEK with the configured KEK/KMS key. Decryption always rebuilds AAD from the row's stored format version. If encryption, wrapping, or any accepted lookup key is unavailable, create/update/exact lookup fails; plaintext must never be logged, audited, cached, stored as fallback, or included in an exception. Never collect a PIN or access credential.

KEK rotation rewraps the per-record DEK without changing ciphertext, nonce, authentication tag, or format version. DEK rotation decrypts/re-encrypts under a row lock with a new DEK/nonce/tag while preserving `encryptionFormatVersion`; it is a key change, not a wire-format change. Only an explicit envelope-format migration increments `encryptionFormatVersion`, re-encrypts with AAD derived from the new stored version, and commits the envelope plus audit together. Lookup-key rotation temporarily accepts old+new versions: new writes create both digests, reads compute/search both, and a resumable backfill adds the new digest to old rows. Remove the old digest/key only after verification reports every Card has the new version and zero uniqueness conflicts. This prevents lookup gaps and duplicate creation during mixed-version rotation.

Masking never reveals a complete short identifier: length at least 8 shows last four, length 5–7 shows last two, and length at most 4 shows no original character. Store only that masked-safe suffix/display value.

Ordinary list/detail APIs return only a masked identifier. Exact card-number search hashes the supplied value server-side and never performs substring search over protected data.

### 4.6 Software licence details and allocations

Create `asset_software_license_details`:

| Field | Type | Rule |
|---|---|---|
| `assetId` | UUID PK/FK | Asset must be `SOFTWARE_LICENSE + POOL` |
| `companyId` | UUID | Tenant scope |
| `vendorName` | `String` | Required |
| `productName` | `String` | Required |
| `contractReference` | `String?` | Commercial reference only |
| `vaultReference` | `String?` | Pointer to external secret vault; not a secret |
| `startsOn` | `DateTime?` | Optional |
| `expiresOn` | `DateTime?` | Optional; not before start |
| `renewsOn` | `DateTime?` | Optional |
| `seatCapacity` | `Int` | Greater than zero |
| `allocatedSeatCount` | `Int` | Default zero; between zero and capacity |

Create `software_license_allocations`:

| Field | Type | Rule |
|---|---|---|
| `id` | UUID PK | Standard identifier |
| `companyId` | UUID | Same as pool and Employee |
| `assetId` | UUID FK | Licence-pool Asset |
| `employeeId` | UUID FK | Allocated Employee |
| `status` | `LicenseAllocationStatus` | Default `ACTIVE` |
| `allocatedAt` | `DateTime` | Required business timestamp |
| `allocatedByUserId` | UUID FK | Acting User |
| `revokedAt` | `DateTime?` | Required for terminal status |
| `revokedByUserId` | UUID FK? | Acting User |
| `acknowledgedAt` | `DateTime?` | Employee acknowledgement |
| `acknowledgedByUserId` | UUID FK? | Must map to allocated Employee |
| `sourceType` | `AssetSourceType` | Default `MANUAL` |
| `sourceId` | UUID? | Future Onboarding/import source |
| `sourceCommandKey` | `String?` | Stable internal idempotency key |
| `sourceCommandHash` | `String?` | SHA-256 of the non-secret canonical internal command |
| `version` | `Int` | Default `1` |
| `remarks` | `String?` | Never copied to notification payload |

Add:

- Composite Company foreign keys from allocation to Asset and Employee.
- Partial unique index on `(assetId, employeeId)` where status is `ACTIVE`.
- Indexes on `(employeeId, status)`, `(assetId, status)`, and `(companyId, status)`.
- Status/date check: `ACTIVE` has no revocation fields; `REVOKED`/`WAIVED` has both revocation fields.
- Source-command check: `sourceCommandKey` and `sourceCommandHash` are either both null or both non-null.

Capacity is enforced by the allocation transaction plus the authoritative database trigger. `Asset.version` is the single pool aggregate version returned to clients; the licence-detail row does not carry a second public concurrency token. Inserting an active allocation locks the licence-detail row, checks `allocatedSeatCount < seatCapacity`, and increments the counter. Moving an active allocation to `REVOKED` or `WAIVED` decrements it exactly once. The application never edits the counter directly. Every allocate, revoke, waiver, resize, suspend, resume, transfer, or metadata command conditionally increments `Asset.version`. A reconciliation query compares the counter with actual active rows.

### 4.7 Physical/card custody changes

Extend `employee_assets`. Keep the existing free-string `status` as a compatibility mirror and add `custodyStatus` as the new authoritative enum so the expand migration does not break an older application instance during deployment:

| Field | Type | Rule |
|---|---|---|
| `companyId` | UUID | Same as Asset and Employee |
| `branchIdAtAssignment` | UUID | Historical Branch snapshot |
| `departmentIdAtAssignment` | UUID | Owning Department snapshot |
| `custodyStatus` | `EmployeeAssetStatus` | New authoritative typed status |
| `assignedByUserId` | UUID FK? | Nullable only for unmappable legacy rows; required for every new assignment |
| `closedAt` | `DateTime?` | Terminal custody timestamp |
| `closedByUserId` | UUID FK? | Terminal actor |
| `acknowledgedAt` | `DateTime?` | Employee receipt evidence |
| `acknowledgedByUserId` | UUID FK? | Must map to assigned Employee |
| `conditionOnReturn` | `String?` | Safe operational condition |
| `sourceType` | `AssetSourceType` | Default `MANUAL` |
| `sourceId` | UUID? | Future Onboarding/import link |
| `sourceCommandKey` | `String?` | Stable internal idempotency key |
| `sourceCommandHash` | `String?` | SHA-256 of the non-secret canonical internal command |
| `version` | `Int` | Default `1` |

Keep legacy `status`, `assignedById`, `returnedById`, and `returnedDate` during compatibility. Backfill `custodyStatus` from `status` and `closedAt` from `returnedDate`; new code dual-writes the legacy status mirror until all old readers are removed. `returnedDate` is populated only for a real physical return, while `closedAt` is used for every terminal outcome. Make `custodyStatus` non-null only in the contract migration after every writer has moved to the new field. A trigger rejects a new assignment without `assignedByUserId`, while preserving null only on rows marked as migrated legacy history.

Add a source-command check to `employee_assets` as well: `sourceCommandKey` and `sourceCommandHash` are either both null or both non-null.

Retain and adapt the existing partial unique index:

```sql
CREATE UNIQUE INDEX employee_assets_one_active_assignment_per_asset_idx
ON employee_assets ("assetId")
WHERE "custodyStatus" = 'ASSIGNED' AND "closedAt" IS NULL;
```

Keep the current legacy-status partial index during the expand/dual-write window. Replace it with the `custodyStatus` index only after the new field is backfilled and all writers populate it.

Add status/date checks and a database trigger that rejects a new active custody row when:

- Asset and Employee Company differ.
- Asset and Employee Branch differ.
- Asset is not `INDIVIDUAL`.
- Asset is archived or not in `ACTIVE` lifecycle.
- Card expiry has passed.
- Employee has a non-terminal Separation/Clearance aggregate.

The service performs the same validation before the insert to return a stable domain error; the trigger is the final race-safe backstop. Clearance creation and custody creation both lock Employee first, so either the custody is included in the new clearance snapshot or the later custody command is rejected.

### 4.8 Department custodian grants

Create `department_asset_grants`:

| Field | Type | Rule |
|---|---|---|
| `id` | UUID PK | Standard identifier |
| `companyId` | UUID | Must match Department |
| `branchId` | UUID | Must match Department |
| `departmentId` | UUID FK | Granted Department |
| `userId` | UUID FK | Granted User |
| `grantedByUserId` | UUID FK | Owner/Admin actor |
| `grantedAt` | `DateTime` | Create/re-grant timestamp |
| `revokedAt` | `DateTime?` | Null means active |
| `revokedByUserId` | UUID FK? | Revoking actor |
| `version` | `Int` | Default `1`; required for revoke/regrant concurrency |
| `createdAt`, `updatedAt` | timestamps | Standard timestamps |

Use `@@unique([userId, departmentId])`; a re-grant reactivates the same row and remains visible through AuditLog. A grant supplies record scope only. It never grants a permission by itself.

### 4.9 Ownership transfers

Create `asset_ownership_transfers`:

| Field | Type | Rule |
|---|---|---|
| `id` | UUID PK | Standard identifier |
| `companyId` | UUID | Asset Company; immutable |
| `assetId` | UUID FK | Transferred Asset |
| `fromBranchId`, `fromDepartmentId` | UUID | Source snapshot |
| `toBranchId`, `toDepartmentId` | UUID | Destination; same Company |
| `status` | `AssetTransferStatus` | Default `PENDING` |
| `reason` | `String` | Required; not placed in outbox |
| `requestedByUserId`, `requestedAt` | actor/time | Required |
| `decidedByUserId`, `decidedAt` | actor/time | Required for accepted/rejected |
| `decisionNote` | `String?` | Optional |
| `cancelledByUserId`, `cancelledAt`, `cancelReason` | actor/time/text | Required for `CANCELLED` |
| `forcedByUserId`, `forcedAt`, `forceReason` | actor/time/text | Required for `FORCED` |
| `assetVersionAtRequest` | `Int` | Post-request Asset version used by accept/force |
| `version` | `Int` | Transfer concurrency version |

Add a partial unique index allowing only one `PENDING` transfer per Asset.

Rules:

- Source custodian or broad Asset Manager requests.
- Destination custodian accepts/rejects.
- Requester cannot accept as destination custodian unless the actor also has broad Company-level Asset authority.
- Same-Branch transfer may retain active employee custody; accepted transfer changes the owning Department only.
- Cross-Branch transfer for location/individual Assets requires no active custody, no open employee request, and `ACTIVE` lifecycle.
- Licence pools may transfer with active same-Company allocations.
- Force action requires `assets.transfers.force` and a reason.

The request command compares client `expectedAssetVersion=N`, conditionally increments the Asset to `N+1`, and stores `assetVersionAtRequest=N+1` on the new transfer. Accept/force requires the current Asset version and the DTO's expected Asset version to equal that stored value, then increments the Asset again after ownership changes. Reject/cancel also accept `expectedAssetVersion`, lock Asset before transfer, compare it to the current Asset version, close the pending transfer, and increment Asset version; they do not require ownership to remain equal to the request snapshot because they do not apply the transfer.

### 4.9.1 Append-only Asset-domain action evidence

Create `asset_domain_action_events` so required Category/Type/Asset/grant command context is not discarded:

| Field | Type | Rule |
|---|---|---|
| `id` | UUID PK | Internal identifier |
| `companyId` | UUID | Required Company scope |
| `branchId`, `departmentId` | UUID? | Organization snapshot when the target is Branch/Department-owned |
| `entityType` | `AssetActionEntityType` | CATEGORY, TYPE, ASSET, LICENSE_ALLOCATION, or DEPARTMENT_GRANT |
| `assetCategoryId`, `assetTypeId`, `assetId`, `licenseAllocationId`, `departmentGrantId` | UUID FK? | Exactly one target matching `entityType` |
| `action` | `AssetActionType` | Immutable command action |
| `effectiveDate` | Date? | Calendar date supplied by the command, when applicable |
| `privateReason` | String? | Trimmed command reason; protected history only |
| `privateNote` | String? | Trimmed action context such as repair condition; protected history only |
| `actorUserId` | UUID FK | Required acting User |
| `operationId` | UUID | Links evidence to idempotent command |
| `versionBefore`, `versionAfter` | Int | Non-negative before value and exactly next positive version; create uses `0 -> 1` |
| `createdAt` | timestamp | Server action timestamp |

Add Company-qualified target foreign keys and Company/Branch/Department snapshot keys with `onDelete/onUpdate: Restrict`, a check that exactly one target is present and matches `entityType`, unique `(companyId, operationId, action)`, target/date indexes, and `(companyId, action, createdAt)`. A trigger rejects UPDATE/DELETE, requires `versionBefore >= 0`, and requires `versionAfter = versionBefore + 1`. Category/Type archive/reactivate, Asset lifecycle/identifier/capacity, licence-allocation revoke, and Department-grant create/revoke/reactivate commands insert this row with the domain mutation, receipt, AuditLog, and OutboxEvent in one transaction. `CompleteAssetRepairRequest.conditionNote` is stored as the `REPAIR_COMPLETED` event's `privateNote`; grant-create `reason` is stored on `DEPARTMENT_GRANT_CREATED`. Audit/outbox remain redacted; the action row is the authoritative private “when/why” evidence.

### 4.10 Employee custody requests

Create `asset_custody_requests`:

| Field | Type | Rule |
|---|---|---|
| `id` | UUID PK | Standard identifier |
| `companyId`, `branchId`, `departmentId` | UUID | Owning scope snapshot |
| `employeeId` | UUID FK | Requesting Employee |
| `targetType` | `AssetCustodyTargetType` | Physical/card or licence |
| `employeeAssetId` | UUID FK? | Exactly one target must be set |
| `licenseAllocationId` | UUID FK? | Exactly one target must be set |
| `requestType` | `AssetCustodyRequestType` | Must match target type |
| `status` | `AssetCustodyRequestStatus` | Default `SUBMITTED` |
| `occurredOn` | `DateTime? @db.Date` | Damage/loss occurrence date only |
| `employeeNote` | `String?` | Private operational note |
| `requestedAt` | `DateTime` | Required |
| `reviewedByUserId`, `reviewedAt` | actor/time | Optional |
| `resolvedByUserId`, `resolvedAt` | actor/time | Terminal decision |
| `resolutionNote` | `String?` | Not placed in outbox |
| `version` | `Int` | Default `1` |

Add:

- A check that exactly one target FK is non-null.
- Composite FK/check ensuring the target belongs to `employeeId`.
- Partial unique indexes permitting only one `SUBMITTED`/`IN_REVIEW` request per target.
- Status/timestamp consistency checks.

Completing a request must call the normal custody or licence command in the same transaction. The request itself never changes Asset state independently.

### 4.11 Separation clearance and waivers

Create `asset_clearance_items` linked to the existing `EmployeeClearance`:

| Field | Type | Rule |
|---|---|---|
| `id` | UUID PK | Standard identifier |
| `companyId` | UUID | Immutable custody Company snapshot |
| `clearanceId` | UUID FK | Employee clearance |
| `clearanceSummaryItemId` | UUID FK | Existing generic `ASSET` clearance summary row |
| `employeeId` | UUID FK | Separating Employee |
| `employeeAssetId` | UUID FK? | Physical/card target |
| `licenseAllocationId` | UUID FK? | Licence target |
| `status` | `AssetClearanceItemStatus` | `OPEN`, `RESOLVED`, or `WAIVED` |
| `resolvedAt` | `DateTime?` | Custody closure time |
| `resolutionType` | `AssetClearanceResolutionType?` | Must match target and status |
| `version` | `Int` | Default `1` |
| `createdAt`, `updatedAt` | timestamps | Standard timestamps |

Exactly one custody target is required. Prevent duplicate clearance items for the same clearance and target with two partial unique indexes.

`EmployeeClearance` remains the aggregate. Its one existing `EmployeeClearanceItem(clearanceType='ASSET')` becomes a derived summary and cannot be manually cleared. `asset_clearance_items` are the authoritative per-custody details. The generic clear-item command returns `409 ASSET_CLEARANCE_MANAGED` for the ASSET summary. Only `AssetClearanceService` marks that summary `CLEARED`, after every child is `RESOLVED` or `WAIVED` and a live custody query finds no open assignment/allocation.

Clearance creation locks Employee, then Separation/Clearance, creates or reuses exactly one generic ASSET summary, snapshots every live physical custody and licence allocation into child rows, and writes audit in one transaction. If there is no live custody, the summary is immediately derived as `CLEARED`; otherwise it remains `PENDING`. Later custody closure updates the matching child and recomputes the summary in the same custody transaction.

Create `asset_clearance_waivers`:

| Field | Type | Rule |
|---|---|---|
| `id` | UUID PK | Standard identifier |
| `assetClearanceItemId` | UUID FK | Clearance item |
| `status` | `AssetClearanceWaiverStatus` | Default `REQUESTED` |
| `reasonCode` | `AssetClearanceWaiverReasonCode` | Controlled reason code |
| `reason` | `String` | Required private explanation |
| `evidenceReference` | `String?` | Private document/case reference; never raw upload content |
| `requestedByUserId`, `requestedAt` | actor/time | Custodian or broad Asset Manager |
| `decidedByUserId`, `decidedAt` | actor/time | HR/Company Admin only |
| `decisionNote` | `String?` | Private decision note |
| `cancelledByUserId`, `cancelledAt`, `cancelReason` | actor/time/text | Original requester cancellation |
| `version` | `Int` | Default `1` |

Add a partial unique index allowing one requested waiver per clearance item and a check that an approved waiver's requester and approver differ.

Approval behavior is authoritative:

- Physical/card: close `EmployeeAsset` as `WAIVED`, set `closedAt`, and move Asset lifecycle to `LOST`; a card is no longer assignable.
- Licence: close allocation as `WAIVED` and decrement the pool's allocated-seat count.
- Mark clearance item `WAIVED` only in the same transaction.
- Rejected waiver returns the clearance item to `OPEN`.
- Separation completion always performs a live custody query in its transaction; it does not trust the original clearance snapshot alone.

Create one transaction-aware `SeparationCompletionService.complete(tx, separationId, actorUserId)` and make both the current `EmployeeSeparationService.complete()` and `EmployeeClearanceService.complete()` delegate to it. The finalizer discovers IDs without locks, then locks Employee, Separation/Clearance, Assets, subtype rows, and open custody in canonical order; validates Asset children plus all non-Asset clearance items; then updates Employee, Clearance, Separation, AuditLog, and OutboxEvent in that same transaction. Direct Employee deactivation calls the same finalizer/preflight. No other service may write a terminal Separation/Clearance state.

This guarantees that a terminal Employee never retains an active custody row.

### 4.12 Idempotent command receipt

Create `asset_command_receipts` for retry-safe mutations:

| Field | Type | Rule |
|---|---|---|
| `id` | UUID PK | Internal identifier |
| `companyId` | UUID | Tenant scope |
| `operationId` | UUID | Client-generated command key |
| `actorUserId` | UUID FK | Authenticated actor |
| `commandType` | `String` | Stable command name |
| `requestHash` | `String` | Keyed digest of the full canonical command |
| `requestHashKeyVersion` | `String` | Identifies idempotency HMAC key |
| `requestHashFormatVersion` | `Int` | Identifies the immutable command canonicalization format |
| `resultEntityType` | `String?` | Created/changed entity type |
| `resultEntityId` | UUID? | Result identifier |
| `safeResultSnapshot` | `Json?` | Allowlisted original command response without capabilities/private data |
| `createdAt` | timestamp | Standard timestamp |

Use a unique constraint on `(companyId, operationId)`. Claim the receipt using `INSERT ... ON CONFLICT DO NOTHING` inside the business transaction:

- Build a command-specific canonical object after DTO validation/transforms. Prefix it with an immutable format version; use fixed recursively sorted keys, normalized lower-case UUIDs, `YYYY-MM-DD` dates, canonical UTC timestamps, canonical decimal strings, trimmed/normalized strings as defined by that DTO, explicit nulls preserved, and absent optional fields omitted. Encode the canonical JSON as UTF-8 and store lowercase hexadecimal HMAC-SHA-256 over Company, actor, command type, and that object. Sensitive values participate in the HMAC but are never stored in plaintext. Replay selects the serializer by `requestHashFormatVersion`; a new DTO representation adds a new serializer version and never changes an existing one.
- New receipts use the configured active idempotency HMAC key version. Replay loads the existing receipt first and recomputes with that receipt's stored key version; it does not compare using only the current key.
- V2 does not purge command receipts. Key rotation makes a new version active, and every verification key referenced by any receipt remains available. A future purge/retirement policy requires a separate audited design and migration. Idempotency keys use a separate key domain from card lookup HMAC keys.
- Same operation ID and same request hash returns the stored safe command response, so a later entity mutation cannot change replay semantics.
- Same operation ID with a different hash returns `409 IDEMPOTENCY_KEY_REUSED`.
- A failed transaction leaves no receipt.
- `safeResultSnapshot` uses a command-specific allowlist and contains no `allowedActions`, card plaintext/ciphertext/hash, vault reference, private note, reason, or remarks.

### 4.13 Required raw PostgreSQL constraints/indexes

Prisma schema relations are not sufficient for partial uniqueness, functional uniqueness, and cross-row rules. Migration SQL must add at least:

#### Supporting Prisma keys and relation contract

Add these supporting keys in the exact referenced order:

```prisma
Branch                    @@unique([companyId, id])
Department                @@unique([companyId, branchId, id])
AssetCategory             @@unique([companyId, id])
AssetType                 @@unique([companyId, id])
AssetType                 @@unique([companyId, id, kind, trackingMode])
Asset                     @@unique([companyId, id])
Asset                     @@unique([companyId, branchId, id])
Employee                  @@unique([companyId, id])
EmployeeAsset             @@unique([companyId, id, employeeId])
SoftwareLicenseAllocation @@unique([companyId, id, employeeId])
SoftwareLicenseAllocation @@unique([companyId, id])
EmployeeClearanceItem     @@unique([clearanceId, id])
DepartmentAssetGrant      @@unique([companyId, id])
```

Required relations and backstops:

| Child | Company-safe relation |
|---|---|
| Asset | `(companyId, branchId) -> Branch(companyId, id)` |
| Asset | `(companyId, branchId, departmentId) -> Department(companyId, branchId, id)` |
| Asset Type | `(companyId, assetCategoryId) -> AssetCategory(companyId, id)` |
| Asset | `(companyId, assetTypeId, kind, trackingMode) -> AssetType(companyId, id, kind, trackingMode)` |
| Card/licence detail | `(companyId, assetId) -> Asset(companyId, id)` |
| Card lookup index | `(companyId, assetId) -> Asset(companyId, id)` |
| Employee custody | `(companyId, assetId) -> Asset(companyId, id)`, `(companyId, employeeId) -> Employee(companyId, id)`, `(companyId, branchIdAtAssignment) -> Branch(companyId, id)`, and `(companyId, branchIdAtAssignment, departmentIdAtAssignment) -> Department(companyId, branchId, id)` |
| Licence allocation | `(companyId, assetId) -> Asset(companyId, id)` and `(companyId, employeeId) -> Employee(companyId, id)` |
| Department grant | `(companyId, branchId, departmentId) -> Department(companyId, branchId, id)` |
| Transfer | Company-qualified Asset plus Company/Branch/Department-qualified source and destination |
| Action evidence | Exactly one Company-qualified Category, Type, Asset, licence allocation, or Department grant plus applicable organization snapshot |
| Custody request | `(companyId, targetId, employeeId)` to the applicable custody/allocation composite key |
| Clearance detail | `(clearanceId, clearanceSummaryItemId) -> EmployeeClearanceItem(clearanceId, id)` plus Company-qualified custody/allocation target |

`Employee.companyId` is immutable after Employee creation; moving a person to another Company uses separation plus a new Company Employee record. `branchId` and `departmentId` may change only through the existing `POST /hr/employees/:employeeId/career/transfer` command implemented by `EmployeeCareerService.recordTransfer()`, extended as described below. Branch/Department snapshots on terminal custody history remain immutable and are not cascaded when an Employee later moves.

Use explicit Prisma relation names for every repeated relation: `AssetCardAsset`, `AssetCardLookupAsset`, `AssetSoftwareLicenseAsset`, `LicenseAllocationAsset`, `LicenseAllocationEmployee`, `EmployeeAssetAssignedByUser`, `EmployeeAssetClosedByUser`, `EmployeeAssetAcknowledgedByUser`, `DepartmentAssetGrantDepartment`, `DepartmentAssetGrantUser`, `AssetTransferAsset`, `AssetTransferFromDepartment`, `AssetTransferToDepartment`, `AssetCustodyRequestEmployeeAsset`, `AssetCustodyRequestLicenseAllocation`, `AssetClearanceItemEmployeeAsset`, `AssetClearanceItemLicenseAllocation`, `AssetActionCategory`, `AssetActionTypeTarget`, `AssetActionAsset`, `AssetActionLicenseAllocation`, `AssetActionDepartmentGrant`, `AssetActionActor`, and separate requested/decided actor relations. Add matching inverse arrays in `AssetCategory`, `AssetType`, `Asset`, `SoftwareLicenseAllocation`, `DepartmentAssetGrant`, `Employee`, `Department`, `User`, `EmployeeClearance`, and `EmployeeClearanceItem`.

Organization, taxonomy, Asset, Employee, custody, allocation, transfer, request, and clearance-history relations use `onDelete: Restrict, onUpdate: Restrict`. Every actor required as state/evidence uses `onDelete: Restrict` even when a physical-custody actor column is nullable for unmappable legacy rows: assignment/closure, allocation/revocation, grant/revoke, transfer request/decision/cancel/force, request review/resolution, waiver request/decision/cancel, and acknowledgement actors. User accounts are deactivated, not hard-deleted, while such evidence exists. `onDelete: SetNull` is limited to non-authoritative display metadata such as `archivedByUserId`; AuditLog remains the authoritative archive evidence. Public APIs never hard-delete Asset domain records.

```sql
ALTER TABLE asset_types
ADD CONSTRAINT asset_types_kind_tracking_check
CHECK (
  (kind = 'GENERAL' AND "trackingMode" IN ('LOCATION', 'INDIVIDUAL')) OR
  (kind = 'HARDWARE' AND "trackingMode" = 'INDIVIDUAL') OR
  (kind = 'CARD' AND "trackingMode" = 'INDIVIDUAL') OR
  (kind = 'SOFTWARE_LICENSE' AND "trackingMode" = 'POOL')
);

ALTER TABLE assets
ADD CONSTRAINT assets_kind_tracking_check
CHECK (
  (kind = 'GENERAL' AND "trackingMode" IN ('LOCATION', 'INDIVIDUAL')) OR
  (kind = 'HARDWARE' AND "trackingMode" = 'INDIVIDUAL') OR
  (kind = 'CARD' AND "trackingMode" = 'INDIVIDUAL') OR
  (kind = 'SOFTWARE_LICENSE' AND "trackingMode" = 'POOL')
),
ADD CONSTRAINT assets_tracking_lifecycle_check
CHECK (
  ("trackingMode" = 'POOL' AND "lifecycleStatus" IN ('ACTIVE', 'SUSPENDED', 'RETIRED')) OR
  ("trackingMode" IN ('LOCATION', 'INDIVIDUAL')
    AND "lifecycleStatus" IN ('ACTIVE', 'IN_REPAIR', 'LOST', 'DISPOSED'))
),
ADD CONSTRAINT assets_purchase_cost_check
CHECK ("purchaseCost" IS NULL OR "purchaseCost" >= 0),
ADD CONSTRAINT assets_currency_check
CHECK ("currency" IS NULL OR "currency" ~ '^[A-Z]{3}$'),
ADD CONSTRAINT assets_warranty_date_check
CHECK (
  "warrantyExpiry" IS NULL OR
  "purchaseDate" IS NULL OR
  "warrantyExpiry" >= "purchaseDate"
);

CREATE UNIQUE INDEX assets_company_serial_normalized_key
ON assets ("companyId", "serialNumberNormalized")
WHERE "serialNumberNormalized" IS NOT NULL;

CREATE UNIQUE INDEX asset_card_lookup_company_version_digest_key
ON asset_card_lookup_indexes ("companyId", "lookupKeyVersion", digest);

CREATE UNIQUE INDEX asset_card_lookup_asset_version_key
ON asset_card_lookup_indexes ("companyId", "assetId", "lookupKeyVersion");

ALTER TABLE asset_card_details
ADD CONSTRAINT asset_card_details_date_check
CHECK (
  "expiryDate" IS NULL OR
  "issuedDate" IS NULL OR
  "expiryDate" >= "issuedDate"
);

ALTER TABLE asset_software_license_details
ADD CONSTRAINT asset_software_license_capacity_check
CHECK (
  "seatCapacity" > 0 AND
  "allocatedSeatCount" >= 0 AND
  "allocatedSeatCount" <= "seatCapacity"
),
ADD CONSTRAINT asset_software_license_dates_check
CHECK (
  "expiresOn" IS NULL OR
  "startsOn" IS NULL OR
  "expiresOn" >= "startsOn"
);

ALTER TABLE employee_assets
ADD CONSTRAINT employee_assets_close_state_check
CHECK (
  ("custodyStatus" = 'ASSIGNED' AND "closedAt" IS NULL) OR
  ("custodyStatus" IN ('RETURNED', 'DAMAGED', 'LOST', 'WAIVED') AND "closedAt" IS NOT NULL)
),
ADD CONSTRAINT employee_assets_ack_date_check
CHECK ("acknowledgedAt" IS NULL OR "acknowledgedAt" >= "assignedDate"),
ADD CONSTRAINT employee_assets_ack_actor_pair_check
CHECK (num_nonnulls("acknowledgedAt", "acknowledgedByUserId") IN (0, 2)),
ADD CONSTRAINT employee_assets_close_date_order_check
CHECK ("closedAt" IS NULL OR "closedAt" >= "assignedDate");

ALTER TABLE software_license_allocations
ADD CONSTRAINT software_license_allocations_state_check
CHECK (
  (status = 'ACTIVE' AND "revokedAt" IS NULL AND "revokedByUserId" IS NULL) OR
  (status IN ('REVOKED', 'WAIVED')
    AND "revokedAt" IS NOT NULL
    AND "revokedByUserId" IS NOT NULL)
),
ADD CONSTRAINT software_license_allocations_ack_date_check
CHECK ("acknowledgedAt" IS NULL OR "acknowledgedAt" >= "allocatedAt"),
ADD CONSTRAINT software_license_allocations_ack_actor_pair_check
CHECK (num_nonnulls("acknowledgedAt", "acknowledgedByUserId") IN (0, 2)),
ADD CONSTRAINT software_license_allocations_revoke_date_order_check
CHECK ("revokedAt" IS NULL OR "revokedAt" >= "allocatedAt");

ALTER TABLE asset_custody_requests
ADD CONSTRAINT asset_custody_requests_one_target_check
CHECK (num_nonnulls("employeeAssetId", "licenseAllocationId") = 1),
ADD CONSTRAINT asset_custody_request_type_check
CHECK (
  ("targetType" = 'EMPLOYEE_ASSET'
    AND "employeeAssetId" IS NOT NULL
    AND "licenseAllocationId" IS NULL
    AND "requestType" IN ('RETURN', 'REPORT_DAMAGED', 'REPORT_LOST')
    AND (
      ("requestType" = 'RETURN' AND "occurredOn" IS NULL) OR
      ("requestType" IN ('REPORT_DAMAGED', 'REPORT_LOST')
        AND "occurredOn" IS NOT NULL
        AND coalesce(length(trim("employeeNote")), 0) > 0)
    )) OR
  ("targetType" = 'LICENSE_ALLOCATION'
    AND "licenseAllocationId" IS NOT NULL
    AND "employeeAssetId" IS NULL
    AND "requestType" = 'REVOKE_LICENSE'
    AND "occurredOn" IS NULL)
);

ALTER TABLE asset_clearance_items
ADD CONSTRAINT asset_clearance_items_one_target_check
CHECK (num_nonnulls("employeeAssetId", "licenseAllocationId") = 1);

ALTER TABLE asset_clearance_waivers
ADD CONSTRAINT asset_clearance_waiver_actor_check
CHECK (
  "decidedByUserId" IS NULL OR
  "requestedByUserId" <> "decidedByUserId"
),
ADD CONSTRAINT asset_clearance_waiver_state_check
CHECK (
  coalesce(length(trim(reason)), 0) > 0 AND (
  (status = 'REQUESTED'
    AND "decidedByUserId" IS NULL AND "decidedAt" IS NULL
    AND "cancelledByUserId" IS NULL AND "cancelledAt" IS NULL) OR
  (status IN ('APPROVED', 'REJECTED')
    AND "decidedByUserId" IS NOT NULL AND "decidedAt" IS NOT NULL
    AND "cancelledByUserId" IS NULL AND "cancelledAt" IS NULL) OR
  (status = 'CANCELLED'
    AND "cancelledByUserId" IS NOT NULL AND "cancelledAt" IS NOT NULL
    AND coalesce(length(trim("cancelReason")), 0) > 0
    AND "decidedByUserId" IS NULL AND "decidedAt" IS NULL)
  )
);

ALTER TABLE asset_ownership_transfers
ADD CONSTRAINT asset_ownership_transfer_state_check
CHECK (
  coalesce(length(trim(reason)), 0) > 0 AND (
  (status = 'PENDING'
    AND "decidedByUserId" IS NULL AND "decidedAt" IS NULL
    AND "cancelledByUserId" IS NULL AND "cancelledAt" IS NULL
    AND "forcedByUserId" IS NULL AND "forcedAt" IS NULL) OR
  (status IN ('ACCEPTED', 'REJECTED')
    AND "decidedByUserId" IS NOT NULL AND "decidedAt" IS NOT NULL
    AND "cancelledByUserId" IS NULL AND "cancelledAt" IS NULL
    AND "forcedByUserId" IS NULL AND "forcedAt" IS NULL) OR
  (status = 'CANCELLED'
    AND "cancelledByUserId" IS NOT NULL AND "cancelledAt" IS NOT NULL
    AND coalesce(length(trim("cancelReason")), 0) > 0
    AND "decidedByUserId" IS NULL AND "decidedAt" IS NULL
    AND "forcedByUserId" IS NULL AND "forcedAt" IS NULL) OR
  (status = 'FORCED'
    AND "forcedByUserId" IS NOT NULL AND "forcedAt" IS NOT NULL
    AND coalesce(length(trim("forceReason")), 0) > 0
    AND "decidedByUserId" IS NULL AND "decidedAt" IS NULL
    AND "cancelledByUserId" IS NULL AND "cancelledAt" IS NULL)
  )
);

ALTER TABLE asset_custody_requests
ADD CONSTRAINT asset_custody_request_state_check
CHECK (
  (status = 'SUBMITTED'
    AND "reviewedByUserId" IS NULL AND "reviewedAt" IS NULL
    AND "resolvedByUserId" IS NULL AND "resolvedAt" IS NULL) OR
  (status = 'IN_REVIEW'
    AND "reviewedByUserId" IS NOT NULL AND "reviewedAt" IS NOT NULL
    AND "resolvedByUserId" IS NULL AND "resolvedAt" IS NULL) OR
  (status IN ('COMPLETED', 'REJECTED', 'CANCELLED')
    AND "resolvedByUserId" IS NOT NULL AND "resolvedAt" IS NOT NULL)
);

ALTER TABLE asset_clearance_items
ADD CONSTRAINT asset_clearance_item_state_check
CHECK (
  (status = 'OPEN' AND "resolvedAt" IS NULL AND "resolutionType" IS NULL) OR
  (status = 'RESOLVED' AND "resolvedAt" IS NOT NULL
    AND "resolutionType" IS NOT NULL AND (
    ("employeeAssetId" IS NOT NULL
      AND "resolutionType" IN ('RETURNED', 'DAMAGED', 'LOST')) OR
    ("licenseAllocationId" IS NOT NULL AND "resolutionType" = 'REVOKED')
  )) OR
  (status = 'WAIVED'
    AND "resolvedAt" IS NOT NULL
    AND "resolutionType" IS NOT NULL
    AND "resolutionType" = 'WAIVED')
);

-- One active physical/card custody per Asset.
CREATE UNIQUE INDEX employee_assets_one_active_assignment_per_asset_idx
ON employee_assets ("assetId")
WHERE "custodyStatus" = 'ASSIGNED' AND "closedAt" IS NULL;

-- One active allocation for the same Employee in the same pool.
CREATE UNIQUE INDEX software_license_allocations_one_active_employee_idx
ON software_license_allocations ("assetId", "employeeId")
WHERE status = 'ACTIVE';

CREATE UNIQUE INDEX employee_assets_source_command_key_idx
ON employee_assets ("companyId", "sourceCommandKey")
WHERE "sourceCommandKey" IS NOT NULL;

CREATE UNIQUE INDEX software_license_allocations_source_command_key_idx
ON software_license_allocations ("companyId", "sourceCommandKey")
WHERE "sourceCommandKey" IS NOT NULL;

ALTER TABLE employee_assets
ADD CONSTRAINT employee_assets_source_command_pair_check
CHECK (num_nonnulls("sourceCommandKey", "sourceCommandHash") IN (0, 2)),
ADD CONSTRAINT employee_assets_source_shape_check
CHECK (
  ("sourceType" = 'MANUAL'
    AND num_nonnulls("sourceId", "sourceCommandKey", "sourceCommandHash") = 0) OR
  ("sourceType" IN ('IMPORT', 'ONBOARDING_TASK')
    AND num_nonnulls("sourceId", "sourceCommandKey", "sourceCommandHash") = 3)
);

ALTER TABLE software_license_allocations
ADD CONSTRAINT software_license_allocations_source_command_pair_check
CHECK (num_nonnulls("sourceCommandKey", "sourceCommandHash") IN (0, 2)),
ADD CONSTRAINT software_license_allocations_source_shape_check
CHECK (
  ("sourceType" = 'MANUAL'
    AND num_nonnulls("sourceId", "sourceCommandKey", "sourceCommandHash") = 0) OR
  ("sourceType" IN ('IMPORT', 'ONBOARDING_TASK')
    AND num_nonnulls("sourceId", "sourceCommandKey", "sourceCommandHash") = 3)
);

-- One pending ownership transfer per Asset.
CREATE UNIQUE INDEX asset_ownership_transfers_one_pending_idx
ON asset_ownership_transfers ("assetId")
WHERE status = 'PENDING';

-- One open request per physical custody target.
CREATE UNIQUE INDEX asset_custody_requests_one_open_employee_asset_idx
ON asset_custody_requests ("employeeAssetId")
WHERE "employeeAssetId" IS NOT NULL
  AND status IN ('SUBMITTED', 'IN_REVIEW');

-- One open request per licence allocation target.
CREATE UNIQUE INDEX asset_custody_requests_one_open_license_idx
ON asset_custody_requests ("licenseAllocationId")
WHERE "licenseAllocationId" IS NOT NULL
  AND status IN ('SUBMITTED', 'IN_REVIEW');

-- One pending clearance waiver per item.
CREATE UNIQUE INDEX asset_clearance_waivers_one_requested_idx
ON asset_clearance_waivers ("assetClearanceItemId")
WHERE status = 'REQUESTED';

-- One generic ASSET summary per Employee Clearance.
CREATE UNIQUE INDEX employee_clearance_items_one_asset_summary_idx
ON employee_clearance_items ("clearanceId")
WHERE "clearanceType" = 'ASSET';

-- One child per physical target in one clearance.
CREATE UNIQUE INDEX asset_clearance_items_employee_asset_target_idx
ON asset_clearance_items ("clearanceId", "employeeAssetId")
WHERE "employeeAssetId" IS NOT NULL;

-- One child per licence target in one clearance.
CREATE UNIQUE INDEX asset_clearance_items_license_target_idx
ON asset_clearance_items ("clearanceId", "licenseAllocationId")
WHERE "licenseAllocationId" IS NOT NULL;

CREATE UNIQUE INDEX asset_reminder_dispatches_dedupe_key
ON asset_reminder_dispatches ("dedupeKey");

CREATE UNIQUE INDEX asset_reminder_dispatches_outbox_key
ON asset_reminder_dispatches ("outboxEventId")
WHERE "outboxEventId" IS NOT NULL;

CREATE INDEX asset_reminder_dispatches_claim_idx
ON asset_reminder_dispatches (status, "lockedAt", "createdAt")
WHERE status = 'PENDING';

ALTER TABLE asset_reminder_dispatches
ADD CONSTRAINT asset_reminder_dispatch_state_check
CHECK (
  num_nonnulls("sourceDueDate", "sourceVersion") = 1 AND
  num_nonnulls("lockedAt", "lockedBy") IN (0, 2) AND
  ((status = 'ENQUEUED' AND "outboxEventId" IS NOT NULL) OR
   (status <> 'ENQUEUED' AND "outboxEventId" IS NULL)) AND
  (status = 'PENDING' OR ("lockedAt" IS NULL AND "lockedBy" IS NULL)) AND
  (status <> 'SUPPRESSED' OR "suppressionCode" IS NOT NULL)
);
```

Add composite Company-safe foreign keys only after their referenced supporting unique constraints exist. Create them `NOT VALID` during expand where necessary, validate after backfill, and then apply required `NOT NULL` constraints.

### 4.14 Required database triggers

Use migration-defined functions for invariants that ordinary row checks cannot enforce. Application services must perform the same checks first to provide stable domain errors; triggers are the direct-SQL and race-safety backstop.

1. `asset_type_classification_guard`
   - Runs before changing Asset Type category, kind, or tracking mode.
   - Rejects the change when any Asset references the Type.
2. Deferred `asset_shape_guard`
   - Runs at transaction commit for Asset and subtype-detail changes.
   - Requires nonblank location for `LOCATION` Assets.
   - Requires normalized serial for Hardware.
   - Requires exactly one card-detail row for Card and none for other kinds.
   - Requires exactly one software-detail row for Software Licence and none for other kinds.
3. `employee_asset_eligibility_guard`
   - Resolves related IDs, then locks Employee, any active Separation/Clearance, and Asset for a new open assignment.
   - Rejects new custody while a non-terminal Separation/Clearance exists, so its Asset summary cannot become stale.
   - Requires `INDIVIDUAL`, non-software, active/unarchived/unexpired Asset.
   - Requires active Employee in the same Company and Branch.
   - Rejects hard deletion of custody history.
4. `software_license_allocation_guard`
   - On transition into `ACTIVE`, resolves and locks Employee, any active Separation/Clearance, then Asset and the licence-detail row.
   - Rejects new allocation while a non-terminal Separation/Clearance exists.
   - Revalidates Employee as active/non-terminal and same Company, verifies pool lifecycle/archive/expiry/capacity, and increments `allocatedSeatCount`.
   - On `ACTIVE -> REVOKED/WAIVED`, locks and decrements exactly once.
   - On acknowledgement, requires the acting User's Employee link to equal the allocated Employee.
   - Rejects hard deletion of allocation history.
   - The application does not independently increment/decrement the counter; the trigger is authoritative.
5. `asset_cross_branch_transfer_guard`
   - Rejects changing Asset Branch while open physical/card custody exists.
   - Allows same-Branch Department change and Company-wide licence-pool ownership transfer subject to the command workflow.
6. `employee_asset_actor_guard`
   - Requires `assignedByUserId` for new assignments and `closedByUserId` on a new terminal transition.
   - Prevents actor fields from being cleared or replaced after they are set.
   - On acknowledgement, requires the acting User's Employee link to equal the custody Employee.
7. `employee_organization_custody_guard`
   - Rejects direct Employee Company changes; Company is immutable after creation.
   - Rejects a Branch change while open physical/card custody remains in the old Branch.
   - Rejects terminal employment status or `isActive=false` while any physical custody or licence allocation remains active.
   - Allows a same-Branch Department change because Asset ownership does not follow the Employee.
8. `organization_reparent_guard`
   - Rejects changing a Branch's Company or a Department's Company/Branch through direct SQL.
   - Organization update DTOs omit these fields; a future reorganization requires a separate audited workflow.
9. Deferred `asset_clearance_link_guard`
   - Requires the summary item to belong to the same Clearance and have `clearanceType='ASSET'`.
   - Requires detail `employeeId` to equal `clearance -> separation -> employeeId` and the selected custody/allocation Employee.
   - Requires physical targets to use `RETURNED`, `DAMAGED`, `LOST`, or `WAIVED`; licence targets use `REVOKED` or `WAIVED`.
   - At commit, a `RESOLVED` child must match the target's actual terminal custody/allocation status and closure timestamp.
   - At commit, a `WAIVED` child requires target status `WAIVED` plus one linked `APPROVED` maker-checker waiver. Conversely, an approved waiver requires its child and target to be `WAIVED`, with matching resolution/decision evidence.
10. `asset_operational_state_guard`
    - Rejects archive/dispose/repair/retire or incompatible ownership change while active custody/allocation, open request, or pending transfer violates the lifecycle matrix.
    - Rejects subtype/classification changes that make existing operational rows invalid.
11. `asset_domain_action_event_guard`
    - Requires exactly one target matching `entityType`, Company/organization snapshot consistency, and consecutive versions.
    - Allows `LICENSE_ALLOCATION_REVOKED` only with the Company-qualified licence-allocation target; Category/Type/Asset/grant actions likewise require their matching target class.
    - For Asset lifecycle actions, rejects a future/out-of-order effective date and requires repair completion not to precede the latest send-to-repair event.
    - Rejects every UPDATE or DELETE so private action evidence is append-only.

Every trigger must be exercised by real PostgreSQL integration tests; mocked Prisma tests cannot prove these rules.

### 4.15 Lifecycle transition matrix

Archive state is orthogonal to lifecycle. Reactivating an archived record never revives a disposed, lost, or retired Asset.

| Tracking | From | Command | To | Guard |
|---|---|---|---|---|
| `LOCATION`/`INDIVIDUAL` | `ACTIVE` | Send to repair | `IN_REPAIR` | No open custody/request |
| `LOCATION`/`INDIVIDUAL` | `IN_REPAIR` | Complete repair | `ACTIVE` | Completion details present |
| `INDIVIDUAL` | `ACTIVE` | Close custody as lost / approve waiver | `LOST` | Custody closes in same transaction |
| `LOCATION`/unassigned `INDIVIDUAL` | `ACTIVE` | Mark lost | `LOST` | No open custody |
| `LOCATION`/`INDIVIDUAL` | `ACTIVE`, `IN_REPAIR`, or `LOST` | Dispose | `DISPOSED` | Broad permission; no open custody/request |
| `POOL` | `ACTIVE` | Suspend | `SUSPENDED` | Existing allocations remain; new allocation blocked |
| `POOL` | `SUSPENDED` | Resume | `ACTIVE` | Not archived/expired |
| `POOL` | `ACTIVE` or `SUSPENDED` | Retire | `RETIRED` | No active allocations/open requests |

`DISPOSED` and `RETIRED` are terminal. `LOST` can only move to `DISPOSED` after an audited write-off decision. Any transition not listed returns `ASSET_INVALID_STATE_TRANSITION`; the database shape check and capability mapper use this same matrix.

## 5. Migration implementation

### 5.1 Migration ordering rule

Asset migrations must be created after the accepted Recruitment migration chain. Do not edit, rename, or reorder a migration that has been applied in any shared environment. Use one migration owner to resolve branch ordering before merge.

### 5.2 Preflight report

Before schema enforcement, produce a read-only JSON/CSV report containing counts and identifiers for:

- Assets without Branch.
- Assets requiring Department mapping.
- Existing Type rows requiring kind/tracking mapping.
- Assets mapped to Hardware without normalized serial, Location without location, Card without protected card data, or Software Licence without pool data.
- Open custody whose mapped Asset Branch differs from the Employee Branch.
- Open custody on an Asset mapped to `LOCATION` or `POOL`.
- Inactive Category/Type/Asset rows requiring `archivedAt` evidence.
- Invalid Category -> Type -> Asset Company relationships.
- Duplicate normalized serial/card identifiers.
- More than one open assignment per Asset.
- Asset `status` versus open-assignment drift.
- Terminal/inactive Employees with open custody.
- Return dates before assignment dates.
- Unrecognized status strings.

The report must not contain employee personal data, card numbers, licence references, remarks, or reasons.

### 5.3 Expand migration

1. Add enums.
2. Add new Asset/Type/Category columns as nullable or compatibility-safe.
3. Add new tables, foreign keys that are already safe, and non-blocking indexes.
4. Add new permissions and seed them to approved system roles.
5. Keep existing routes and columns operational.
6. Deploy code capable of dual-reading/dual-writing old rows and new rows while `ASSET_V2_ENABLED=false`.
7. Expose version fields and accept V2 command metadata in compatibility mode before making them mandatory.

### 5.4 Controlled business backfill

Use approved mapping inputs:

- `assetId -> departmentId`.
- `assetTypeId -> kind + trackingMode`.
- `assetId -> required subtype data` for every Card or Software Licence mapping.
- `assetId -> serialNumber` for mapped Hardware rows missing serial.
- `assetId -> location` for mapped Location rows missing location.
- `entityType + entityId -> archivedAt` for every legacy `isActive=false` Category, Type, or Asset.

Validation rules:

- Department must belong to the Asset Company.
- Asset Branch becomes the Department Branch.
- Do not infer ownership from current assignee, Asset name, category name, or Type name.
- Do not create a hard-coded “General” Department in a migration.
- If an organization lacks an appropriate Department, create it through the Organization module before running the mapping.
- An Asset with open physical custody must map to `INDIVIDUAL` and to the Employee's current Branch; otherwise stop and resolve custody/mapping first.
- Card mapping requires the real identifier and issue date through the protected importer so encryption/HMAC occurs in application memory. Never place card plaintext in migration SQL, source control, the preflight report, or ordinary CSV evidence.
- Software Licence mapping requires vendor, product, positive seat capacity, and approved expiry/renewal metadata; active allocation mappings cannot exceed capacity.
- Do not manufacture placeholder serials, locations, card values, vendors, or licence capacities to satisfy constraints.
- For `isActive=false`, use the approved archive timestamp input. Do not silently substitute migration time or `updatedAt`; an unresolved timestamp blocks contract migration.
- Record mapping-file checksum, expected row count, updated count, rejected count, and exceptions.

Backfill lifecycle:

```text
legacy AVAILABLE or ASSIGNED -> lifecycle ACTIVE
legacy REPAIR                -> lifecycle IN_REPAIR
legacy LOST                  -> lifecycle LOST
legacy DISPOSED              -> lifecycle DISPOSED
```

Backfill `EmployeeAsset.closedAt` from terminal `returnedDate`, populate Company/Branch/Department snapshots, and leave historical actor User fields null when no safe mapping exists.

Reconcile existing clearance aggregates before enabling V2:

- Preflight every non-terminal Separation/EmployeeClearance for missing or duplicate generic `ASSET` summary rows and every terminal aggregate for live custody contradictions. Duplicate summaries or a completed/terminal aggregate with live custody stop the migration for approved business correction; do not rewrite completed history silently.
- For each non-terminal Clearance, create or reuse exactly one `EmployeeClearanceItem(clearanceType='ASSET')` and idempotently insert one `asset_clearance_items` child for every currently open physical custody or active licence allocation. Use the target partial unique indexes so reruns do not duplicate children.
- Derive the generic ASSET summary from the reconciled children plus a live custody query: `PENDING` when any target remains open and `CLEARED` only when no live target remains. Never preserve a legacy `CLEARED` summary that conflicts with live custody.
- Record aggregate IDs, child counts, status changes, contradictions, and mapping checksum in the controlled backfill evidence without private notes or identifiers.

Backfill the new custody enum without changing the legacy string during the expand window:

```sql
UPDATE "employee_assets"
SET "custodyStatus" = CASE status
  WHEN 'ASSIGNED' THEN 'ASSIGNED'::"EmployeeAssetStatus"
  WHEN 'RETURNED' THEN 'RETURNED'::"EmployeeAssetStatus"
  WHEN 'DAMAGED'  THEN 'DAMAGED'::"EmployeeAssetStatus"
  WHEN 'LOST'     THEN 'LOST'::"EmployeeAssetStatus"
END
WHERE "custodyStatus" IS NULL;

UPDATE "employee_assets"
SET "closedAt" = "returnedDate"
WHERE "closedAt" IS NULL
  AND "custodyStatus" IN ('RETURNED', 'DAMAGED', 'LOST')
  AND "returnedDate" IS NOT NULL;
```

Stop if any row has an unknown legacy status, a null `custodyStatus`, a null Company/Branch/Department assignment snapshot, a snapshot that does not resolve through the same Company/Branch hierarchy, an open row with terminal status, or a terminal row without an approved `closedAt`; do not invent a closure date or ownership snapshot.

### 5.5 Contract migration

Apply only when all preflight exceptions are resolved:

1. Make Asset Department/Branch/kind/tracking non-null.
2. Make Type kind/tracking non-null.
3. Add composite Company/Branch/Department foreign keys.
4. Add check constraints and partial unique indexes.
5. Add trigger functions for active-assignment scope enforcement.
6. Validate all constraints after creation.
7. Keep legacy `assets.status` and `isActive` only as compatibility mirrors; application services no longer read them as authoritative state.

Replace the existing assignment index only after all application writers dual-write `custodyStatus`. The current index already exists under the final name and uses legacy `status + returnedDate`, so a second `CREATE ... IF NOT EXISTS` would silently preserve the wrong predicate. Execute the replacement under a write-blocking table lock:

```sql
LOCK TABLE "employee_assets" IN SHARE ROW EXCLUSIVE MODE;

ALTER TABLE "employee_assets"
  DROP CONSTRAINT IF EXISTS "employee_assets_close_state_check",
  DROP CONSTRAINT IF EXISTS "employee_assets_ack_date_check";

ALTER TABLE "employee_assets"
  ALTER COLUMN "companyId" SET NOT NULL,
  ALTER COLUMN "branchIdAtAssignment" SET NOT NULL,
  ALTER COLUMN "departmentIdAtAssignment" SET NOT NULL,
  ALTER COLUMN "custodyStatus" SET NOT NULL,
  ADD CONSTRAINT "employee_assets_assignment_branch_fkey"
    FOREIGN KEY ("companyId", "branchIdAtAssignment")
    REFERENCES "branches" ("companyId", "id")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "employee_assets_assignment_department_fkey"
    FOREIGN KEY ("companyId", "branchIdAtAssignment", "departmentIdAtAssignment")
    REFERENCES "departments" ("companyId", "branchId", "id")
    ON DELETE RESTRICT ON UPDATE RESTRICT;

DROP INDEX IF EXISTS "employee_assets_one_active_assignment_per_asset_idx";

CREATE UNIQUE INDEX "employee_assets_one_active_assignment_per_asset_idx"
ON "employee_assets" ("assetId")
WHERE "custodyStatus" = 'ASSIGNED' AND "closedAt" IS NULL;

ALTER TABLE "employee_assets"
  ADD CONSTRAINT "employee_assets_close_state_check"
  CHECK (
    ("custodyStatus" = 'ASSIGNED' AND "closedAt" IS NULL) OR
    ("custodyStatus" IN ('RETURNED', 'DAMAGED', 'LOST', 'WAIVED')
      AND "closedAt" IS NOT NULL)
  ),
  ADD CONSTRAINT "employee_assets_ack_date_check"
  CHECK ("acknowledgedAt" IS NULL OR "acknowledgedAt" >= "assignedDate");
```

Retain the existing `employee_assets_status_check` while the legacy string is dual-written. New `WAIVED` custody maps to legacy `LOST`, so the old constraint remains valid. Drop that constraint only in the later cleanup migration that removes the legacy `status` column.

Compatibility mirrors are written in every V2 transaction:

| Authoritative state | Legacy mirror |
|---|---|
| Category/Type `archivedAt` null/non-null | Their legacy `isActive = true/false` |
| Asset `ACTIVE + INDIVIDUAL` with open custody | `assets.status = ASSIGNED` |
| Asset `ACTIVE` otherwise | `assets.status = AVAILABLE` |
| Asset `IN_REPAIR` or pool `SUSPENDED` | `assets.status = REPAIR` |
| Asset `LOST` | `assets.status = LOST` |
| Asset `DISPOSED` or `RETIRED` | `assets.status = DISPOSED` |
| `archivedAt` null/non-null | `assets.isActive = true/false` |
| Custody `ASSIGNED/RETURNED/DAMAGED/LOST` | Same legacy `employee_assets.status` value |
| Custody `WAIVED` | Legacy `employee_assets.status = LOST` |

New services never read these mirrors for authorization, availability, expiry, or lifecycle decisions. Repository-wide consumer search and API/UI verification are required before the cleanup migration removes them.

### 5.6 Migration rehearsal

Required evidence:

- From-zero migration on an empty disposable PostgreSQL database.
- Upgrade migration using representative available, assigned, returned, damaged, lost, repair, and disposed data.
- Backfill dry-run and apply evidence with equal expected/actual counts.
- Re-running `prisma migrate deploy` produces no change.
- Migration status is clean on the approved target.
- Database snapshot and restore rehearsal succeeds.

## 6. API-wide conventions

### 6.1 Authentication and tenancy

- Every route except authenticated self-service uses the existing Auth and Permission guards.
- Broad permissions permit records inside the active organization context.
- Department permissions require both the permission and an active Department grant.
- Reads at Company Group scope remain group-filtered. Writes require an active Company.
- Foreign or out-of-scope identifiers return the same `404` as missing records.
- Controllers never trust `companyId`, `branchId`, `departmentId`, or Employee scope supplied by the client without server validation.

### 6.2 Dates, money, versioning, and idempotency

- Calendar dates use `YYYY-MM-DD` DTO strings and are parsed with the repository's calendar-date helper.
- Event timestamps are returned in UTC ISO-8601.
- Assignment, allocation, closure, revocation, and lifecycle effective dates cannot be later than the owning Branch's current business date. Closure/revocation cannot precede assignment/allocation. An Asset action cannot predate Asset creation or the latest effective lifecycle action, and `REPAIR_COMPLETED` cannot precede its latest `SENT_TO_REPAIR`. Application validation supplies the safe error; database date-order checks and the action-event trigger are the backstop.
- Monetary amounts are serialized as decimal strings, not JavaScript floating-point numbers.
- Currency is an ISO three-character code.
- Every update/transition DTO requires `expectedVersion`.
- Every V2 create/transition command requires client-generated `operationId`.
- A stale version returns `409 ASSET_VERSION_CONFLICT` with the current safe version.

### 6.3 List envelope

All Asset V2 lists return:

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "limit": 10
}
```

Use the existing common `PaginationDto`: default `page=1`, default `limit=10`, and maximum `limit=100`. Sorting uses an allowlist and always adds `id` as a deterministic tie-breaker. The current Asset frontend must move from array responses to this envelope in the same compatibility release.

Avoid a rolling-deployment response break: first deploy frontend query adapters that accept both the legacy array and the V2 envelope; then switch backend list responses to the envelope; finally remove the array fallback after browser/API evidence confirms no old consumer remains. The backend never returns two shapes for the same request once `ASSET_V2_ENABLED=true`.

Self-service needs its own compatibility adapter because current `/me/assets` returns `{assignedCount, items}` while V2 returns `MyAssetsResponse`. Deploy a frontend/server adapter that reads both shapes before switching the public response. `/me/workspace` must call an internal `findCurrentByEmployee(employeeId)` projection that returns a bounded in-memory current-custody array; it must not call a public paginated method and then run legacy `.filter()`/`.slice()` logic on `PageResponse`.

### 6.4 Error envelope

Use the repository's domain exception mapping and return:

```json
{
  "success": false,
  "statusCode": 409,
  "error": "Conflict",
  "code": "ASSET_ALREADY_ASSIGNED",
  "message": "Asset is no longer available.",
  "details": [
    {
      "field": "expectedAssetVersion",
      "code": "STALE_VERSION",
      "currentVersion": 7
    }
  ],
  "requestId": "request-correlation-id",
  "timestamp": "2026-08-17T00:00:00.000Z",
  "path": "/employee-assets",
  "method": "POST"
}
```

Do not include foreign identifiers, SQL details, secret references, private notes, or stack traces.

Extend the common domain-error DTO/filter and `DomainConflictException` with optional allowlisted `details[]`. A stale-version detail contains only `field`, `code='STALE_VERSION'`, and numeric `currentVersion`, and is added only after a scoped re-read confirms the actor can still read the record. Otherwise return safe Not Found without a version.

Register static controller routes such as `/summary` before `/:id`, validate every path ID with `ParseUUIDPipe`, and decorate Asset V2 handlers with explicit `@RequirePermissions` or `@RequireAnyPermissions` instead of depending only on inferred route policy.

### 6.5 Shared command DTOs

```ts
interface OperationCommandDto {
  operationId: string; // UUID v4
}

interface VersionedCommandDto extends OperationCommandDto {
  expectedVersion: number; // integer >= 1
}

interface VersionedReasonCommandDto extends VersionedCommandDto {
  reason: string; // trimmed, 1..500
}

interface VersionedEffectiveDateCommandDto
  extends VersionedReasonCommandDto {
  effectiveDate: string; // YYYY-MM-DD
}
```

Use `@IsUUID('4')` for operation IDs, numeric transformation plus `@IsInt()`/`@Min(1)` for versions, and the repository calendar-date parser after the DTO format check. Omitted metadata means no change; explicit `null` clears a nullable field. Do not derive update DTOs from create DTOs where that would reintroduce Company, Branch, Department, lifecycle, kind, tracking, actor, status, code, or archive fields. Actors, timestamps, source references, derived Branch, generated codes, and state are server-owned.

An accepted replay returns the stored safe original response and `X-Idempotent-Replay: true`; it does not execute business writes again. Before returning, require the same actor, revalidate current coarse permission, active organization context, current result-record scope, current Asset owning-Department grant, and any response-field permission. Lost coarse permission returns the normal `403`; lost record scope returns the same safe `404` as a direct read. Recompute `allowedActions` from current capability state instead of storing/replaying old actions.

Mutation endpoints return the command-safe resource mapper used by `safeResultSnapshot`: identifiers, versions, classification, lifecycle, masked card display, safe dates/counts, and references, but no remarks, vault pointer, request/transfer/waiver text, or action context. The client can follow with an authorized detail GET. This keeps first execution and replay representations identical apart from freshly computed `allowedActions` and the replay header.

Deprecated `DELETE` aliases are the only compatibility exception. They accept no body. When the resolved server-side record scope is outside the V2 allowlist and `ASSET_LEGACY_DELETE_ALIAS_ENABLED=true`, they scoped-load and lock the current row, create an internal operation key from the request ID, use reason code `LEGACY_DELETE_ALIAS`, and call the compatibility archive service against the locked current version. They return deprecation headers and never hard-delete. For an allowlisted V2 record/context the alias always returns `410 ASSET_LEGACY_ALIAS_DISABLED`; V2 clients use the explicit archive DTO with operation ID, expected version, and reason. Coexistence is mutually exclusive per resolved scope, not through a global client flag.

### 6.6 Query and sorting contract

Every list query extends `SearchQueryDto` and uses `keyword`, `includeInactive`, `page`, `limit`, `sortBy`, and `sortOrder`. Resource-specific filters are added explicitly. Allowed sorts:

| Resource | `sortBy` allowlist | Default |
|---|---|---|
| Category | `assetCategoryName`, `createdAt`, `updatedAt` | name ascending |
| Type | `assetTypeName`, `kind`, `createdAt`, `updatedAt` | name ascending |
| Asset | `assetCode`, `assetName`, `warrantyExpiry`, `createdAt`, `updatedAt` | created descending |
| Physical custody | `assignedDate`, `closedAt`, `createdAt`, `updatedAt` | assigned descending |
| Licence allocation | `allocatedAt`, `revokedAt`, `createdAt`, `updatedAt` | allocated descending |
| Ownership transfer | `requestedAt`, `decidedAt`, `updatedAt` | requested descending |
| Custody request | `requestedAt`, `reviewedAt`, `resolvedAt`, `updatedAt` | requested descending |
| Clearance item | `createdAt`, `resolvedAt`, `updatedAt` | created descending |
| Clearance waiver | `requestedAt`, `decidedAt`, `updatedAt` | requested descending |

The service maps the accepted value to a fixed Prisma property and appends `id` as the tie-breaker. Arbitrary client property names never reach Prisma. `includeInactive` applies to archived/revoked master and inventory rows; terminal operational history is controlled by explicit status filters.

## 7. Permissions and record-scope contract

Retain broad permissions and add Department/command permissions:

| Permission | Meaning |
|---|---|
| `assets.assets.read` | Broad inventory/master read in organization scope |
| `assets.assets.manage` | Broad master and Asset management |
| `assets.assignments.read` | Broad custody/allocation read |
| `assets.assignments.manage` | Broad custody/allocation management |
| `assets.department.read` | Read granted Departments only |
| `assets.department.manage` | Manage Assets in granted Departments |
| `assets.department.assignments.read` | Read custody for granted Departments |
| `assets.department.assignments.manage` | Manage custody for granted Departments |
| `assets.department-access.manage` | Grant/revoke Department custodian scope |
| `assets.transfers.force` | Force an ownership transfer with reason |
| `assets.clearance.waive` | Independently approve/reject clearance waivers |
| `assets.cards.sensitive.lookup` | Protected exact card-identifier lookup; never returns plaintext |
| `assets.sensitive-metadata.read` | View licence vault pointer on authorized detail only |
| `assets.private-history.read` | View private lifecycle reasons and request/transfer/waiver notes in detail history |

System-role defaults:

- Organization Owner and Company Admin: all permissions above.
- Asset Manager: broad read/manage, force-transfer, card lookup, sensitive metadata, and private history; cannot approve its own waiver request.
- HR Manager: broad read plus `assets.clearance.waive`; no normal custody mutation.
- Department Custodian role: Department read/manage/assignment permissions; requires grants.
- Employee: `/me/assets` through self-service permission only.

Permission/role seed contract:

- Insert permissions with deterministic `md5('permission:' || code)` IDs and `ON CONFLICT (code) DO UPDATE` for name/description only.
- Set `isTenantAssignable=true` only for the four `assets.department.*` operational permissions. Keep Department-grant administration, force, waiver, sensitive lookup/metadata, and private history as protected system permissions.
- Add system role ID `00000000-0000-4000-8000-000000000008`, code `ASSET_DEPARTMENT_CUSTODIAN`, name `Asset Department Custodian`. ID `...0007` is already `ORGANIZATION_OWNER` and must not be reused.
- Seed that role with organization Company/Branch/structure read and the four Department Asset permissions. Do not give it broad Employee read, broad Asset, grant-administration, force, waiver, or sensitive permissions; Asset-specific employee pickers return only safe references.
- Permit this role only on `COMPANY` or `BRANCH` `UserRoleAssignment`; the active Department grant narrows it further. Update role-assignment validation explicitly because `RoleScope` has no `DEPARTMENT` value.
- Seed protected permissions to the existing `ORGANIZATION_OWNER`, `COMPANY_ADMINISTRATOR`, `ASSET_MANAGER`, and `HR_MANAGER` roles exactly as described above. Do not rewrite existing user assignments.
- Department grants can be created only by a different authorized administrator for a User whose active role scope already contains the Department. Grant/revoke endpoints reject self-grant, self-expansion, foreign scope, inactive User, and inactive Department.

The RBAC migration preflight must fail if role ID `...0008` is occupied by another code or if `ASSET_DEPARTMENT_CUSTODIAN` exists under another ID; reconcile that conflict explicitly before seeding. Never overwrite an existing role by ID.

Use `@RequireAnyPermissions` on Asset/assignment endpoints that support both broad and Department access. Category/Type mutations remain broad-only. After the coarse guard passes, `AssetAccessService` must add the record predicate or assert the target Department grant.

Department record scope follows the Asset's current owning `departmentId`, not the assigned Employee's Department and not the historical assignment snapshot. The same rule applies to active licence allocations through their pool. Employee Department is available only as an explicit filter. A same-Branch ownership transfer therefore moves the active custody queue to the destination custodian while preserving assignment-time snapshots for audit. Self-service is the only path scoped by the authenticated Employee instead of Asset ownership.

Add explicit route-policy entries for `asset-license-allocations`, `asset-transfers`, `asset-custody-requests`, `asset-department-grants`, `asset-clearance-items`, and `asset-clearance-waivers` before the generic Asset rule. Handler decorators remain authoritative where broad-or-Department permission is an OR decision.

## 8. REST endpoint contract

### 8.1 Categories

| Method | Route | Permission | Behavior |
|---|---|---|---|
| `GET` | `/asset-categories` | Broad read or Department read | Paginated Company catalog |
| `POST` | `/asset-categories` | `assets.assets.manage` | Create active category |
| `GET` | `/asset-categories/:id` | Broad read or Department read | Scoped detail |
| `PATCH` | `/asset-categories/:id` | `assets.assets.manage` | Name/description only |
| `POST` | `/asset-categories/:id/archive` | `assets.assets.manage` | Block if active Types exist |
| `POST` | `/asset-categories/:id/reactivate` | `assets.assets.manage` | Restore archived row |
| `DELETE` | `/asset-categories/:id` | `assets.assets.manage` | Deprecated compatibility alias that calls archive; never hard-deletes |

`CreateAssetCategoryRequest`:

```ts
{
  operationId: string;
  companyId: string;
  assetCategoryName: string;
  description?: string;
}
```

```ts
interface UpdateAssetCategoryRequest extends OperationCommandDto {
  expectedVersion: number;
  assetCategoryName?: string;
  description?: string | null;
}
```

Archive uses `VersionedReasonCommandDto`; reactivate uses `VersionedCommandDto`. Company, generated code, active/archive fields, and actor are never accepted.

### 8.2 Asset Types

| Method | Route | Permission | Behavior |
|---|---|---|---|
| `GET` | `/asset-types` | Broad read or Department read | Filter by Company/category/kind/tracking/includeInactive |
| `POST` | `/asset-types` | `assets.assets.manage` | Create Type |
| `GET` | `/asset-types/:id` | Broad read or Department read | Detail and usage count |
| `PATCH` | `/asset-types/:id` | `assets.assets.manage` | Metadata; classification only when unused |
| `POST` | `/asset-types/:id/archive` | `assets.assets.manage` | Block if active Assets exist |
| `POST` | `/asset-types/:id/reactivate` | `assets.assets.manage` | Restore |
| `DELETE` | `/asset-types/:id` | `assets.assets.manage` | Deprecated compatibility alias that calls archive; never hard-deletes |

`CreateAssetTypeRequest`:

```ts
{
  operationId: string;
  companyId: string;
  assetCategoryId: string;
  assetTypeName: string;
  description?: string;
  kind: "GENERAL" | "HARDWARE" | "CARD" | "SOFTWARE_LICENSE";
  trackingMode: "LOCATION" | "INDIVIDUAL" | "POOL";
}
```

```ts
interface UpdateAssetTypeRequest extends OperationCommandDto {
  expectedVersion: number;
  assetCategoryId?: string;
  assetTypeName?: string;
  description?: string | null;
  kind?: AssetKind;
  trackingMode?: AssetTrackingMode;
}
```

Category/kind/tracking changes are accepted only while usage count is zero and are committed with the Type audit. Archive uses `VersionedReasonCommandDto`; reactivate uses `VersionedCommandDto`. Company, generated code, and active/archive fields are excluded.

### 8.3 Asset inventory

| Method | Route | Permission | Behavior |
|---|---|---|---|
| `GET` | `/asset` | Broad or Department read | Paginated scoped inventory |
| `GET` | `/asset/summary` | Broad or Department read | Scoped KPI counts |
| `GET` | `/asset/eligible-for-assignment` | Broad or Department assignment read | Employee-aware available physical/card picker |
| `GET` | `/asset/eligible-employees` | Broad or Department assignment manage | Asset-aware safe Employee picker |
| `POST` | `/asset/cards/exact-lookup` | `assets.cards.sensitive.lookup` | Protected exact match; returns masked Asset summary |
| `POST` | `/asset` | Broad or Department manage | Create Asset and subtype detail atomically |
| `GET` | `/asset/:id` | Broad or Department read | Detail, current custody summary, capabilities |
| `GET` | `/asset/:id/history` | Broad or Department read | Paginated lifecycle/custody/transfer history |
| `PATCH` | `/asset/:id` | Broad or Department manage | Mutable metadata only |
| `POST` | `/asset/:id/correct-identifier` | `assets.assets.manage` | Correct serial/card ID when no active custody; reason required |
| `POST` | `/asset/:id/archive` | Broad or Department manage | No active custody/allocation/open request |
| `POST` | `/asset/:id/reactivate` | Broad or Department manage | Restore valid archived Asset |
| `POST` | `/asset/:id/send-to-repair` | Broad or Department manage | Location/individual only |
| `POST` | `/asset/:id/complete-repair` | Broad or Department manage | `IN_REPAIR -> ACTIVE` |
| `POST` | `/asset/:id/mark-lost` | Broad or Department manage | Unassigned physical/location Asset only |
| `POST` | `/asset/:id/dispose` | Broad Asset manage | Physical/location terminal action |
| `POST` | `/asset/:id/suspend` | Broad or Department manage | Licence pool only |
| `POST` | `/asset/:id/resume` | Broad or Department manage | Licence pool only |
| `POST` | `/asset/:id/retire` | Broad Asset manage | Pool retirement; no active allocations |
| `POST` | `/asset/:id/license-capacity` | Broad or Department manage | Resize pool; never below active allocations |
| `DELETE` | `/asset/:id` | Broad or Department manage | Deprecated compatibility alias that calls archive; never hard-deletes |

Inventory query parameters:

```text
page, limit, keyword, companyId, branchId, departmentId,
assetCategoryId, assetTypeId, kind, trackingMode, lifecycleStatus,
availabilityStatus, includeInactive, expiringBefore, sortBy, sortOrder
```

Asset query DTOs extend the existing `SearchQueryDto`. Do not introduce aliases such as `search`, `archived`, or `sortDirection`. `keyword` is trimmed and capped at 100 characters. It searches code, name, normalized serial, manufacturer, model, Type name, and Department name; it never scans card crypto fields or vault references. `sortBy` maps through a fixed per-resource allowlist and always appends `id` in the same `sortOrder` as a deterministic tie-breaker.

`POST /asset/cards/exact-lookup` accepts `{ cardNumber: string, purposeCode: "INVENTORY_VERIFY" | "ASSIGNMENT_VERIFY" | "SECURITY_RECONCILIATION" }` in the request body, never in the URL. The request logger and tracing middleware redact the body before serialization. The service derives Company scope, computes one digest in memory for every accepted lookup-key version, searches all accepted versions, records the purpose in the redacted access audit, and returns either the normal masked `AssetSummaryResponse` or the same safe `404 ASSET_NOT_FOUND` used for missing/out-of-scope records. It never decrypts or returns the stored identifier.

`CreateAssetRequest`:

```ts
{
  operationId: string;
  companyId: string;
  departmentId: string;       // branch is derived server-side
  assetTypeId: string;        // kind/tracking are derived and snapshotted
  assetName: string;
  serialNumber?: string;
  manufacturer?: string;
  modelNumber?: string;
  purchaseDate?: string;
  purchaseCost?: string;
  currency?: string;
  warrantyExpiry?: string;
  location?: string;
  remarks?: string;
  card?: {
    cardNumber: string;
    issuer?: string;
    accessZone?: string;
    issuedDate: string;
    expiryDate?: string;
  };
  softwareLicense?: {
    vendorName: string;
    productName: string;
    contractReference?: string;
    vaultReference?: string;
    startsOn?: string;
    expiresOn?: string;
    renewsOn?: string;
    seatCapacity: number;
  };
}
```

Server validation rejects subtype payloads that do not match the selected Type. `branchId`, kind, tracking mode, code, lifecycle, version, and active state are never caller-controlled.

`GET /asset/eligible-for-assignment` requires `employeeId`. It returns only unarchived, unexpired, `INDIVIDUAL` Assets in that Employee's Branch with lifecycle `ACTIVE` and no open assignment. Optional filters are Type, kind, owning Department, keyword, page, and limit.

`GET /asset/eligible-employees` requires `assetId`. For physical/card Assets it returns only safe Employee references in that Asset's Branch; for licence pools it returns eligible Employees in the same Company. It never returns email, mobile, salary, documents, or unrelated HR fields and therefore does not require broad `hr.employees.read`.

`UpdateAssetMetadataRequest`:

```ts
{
  operationId: string;
  expectedVersion: number;
  assetName?: string;
  manufacturer?: string;
  modelNumber?: string;
  purchaseDate?: string | null;
  purchaseCost?: string | null;
  currency?: string | null;
  warrantyExpiry?: string | null;
  location?: string | null;
  remarks?: string | null;
  cardMetadata?: {
    issuer?: string | null;
    accessZone?: string | null;
    expiryDate?: string | null;
  };
  licenseMetadata?: {
    vendorName?: string;
    productName?: string;
    contractReference?: string | null;
    vaultReference?: string | null;
    startsOn?: string | null;
    expiresOn?: string | null;
    renewsOn?: string | null;
  };
}
```

Lifecycle/identifier/capacity request contracts:

```ts
interface CorrectAssetIdentifierRequest extends OperationCommandDto {
  expectedVersion: number;
  serialNumber?: string;
  cardNumber?: string;
  reason: string;
}

interface CompleteAssetRepairRequest extends OperationCommandDto {
  expectedVersion: number;
  effectiveDate: string;
  location?: string;
  conditionNote?: string;
}

interface ResizeLicensePoolRequest extends OperationCommandDto {
  expectedVersion: number; // Asset.version
  seatCapacity: number;
  reason: string;
}
```

Mark-lost, dispose, and retire use `VersionedEffectiveDateCommandDto`. Archive, suspend, and resume use `VersionedReasonCommandDto`. Reactivate uses `VersionedCommandDto`; send-to-repair uses `VersionedEffectiveDateCommandDto`; complete-repair uses its named DTO above. Identifier correction requires exactly the serial field for Hardware/serial-tracked General or the card field for Card; the request logger redacts `cardNumber`, and the command is rejected while custody is open. Pool capacity cannot be reduced below active allocations.

Card correction locks Asset then Card detail and lookup-index rows. It normalizes once, calculates every accepted lookup-key digest, checks uniqueness, and atomically replaces ciphertext, nonce, authentication tag, wrapped DEK, KEK version, masked display, and the complete accepted-version lookup-index set. It preserves the envelope format unless the command is an explicit format migration. Audit, receipt, version increment, and outbox commit in the same transaction; any crypto, digest, uniqueness, audit, or outbox failure rolls the entire correction back to the previously valid envelope and indexes.

### 8.4 Physical/card assignments

| Method | Route | Permission | Behavior |
|---|---|---|---|
| `GET` | `/employee-assets` | Broad or Department assignment read | Paginated custody list |
| `POST` | `/employee-assets` | Broad or Department assignment manage | Assign available individual Asset |
| `GET` | `/employee-assets/:id` | Broad or Department assignment read | Scoped custody detail |
| `GET` | `/employee-assets/employee/:employeeId` | Broad or Department assignment read | Authorized employee history |
| `GET` | `/employee-assets/asset/:assetId` | Broad or Department assignment read | Authorized Asset history |
| `PATCH` | `/employee-assets/:id/return` | Broad or Department assignment manage | Close as returned/damaged/lost |

`AssignEmployeeAssetRequest`:

```ts
{
  operationId: string;
  employeeId: string;
  assetId: string;
  assignedDate: string;
  expectedAssetVersion: number;
  remarks?: string;
}
```

`CloseEmployeeAssetRequest`:

```ts
{
  operationId: string;
  expectedAssignmentVersion: number;
  expectedAssetVersion: number;
  outcome: "RETURNED" | "DAMAGED" | "LOST";
  effectiveDate: string;
  conditionOnReturn?: string;
  reason?: string;
}
```

`reason` is required for `DAMAGED` and `LOST`. `WAIVED` is internal to clearance approval and is not accepted on this endpoint.

Eligible Employee means `isActive=true` and an allowed employment status (`PENDING_ONBOARDING`, `PROBATION`, `ACTIVE`, or `NOTICE`) with no non-terminal Separation/Clearance. A `NOTICE` Employee is eligible only before clearance has started. `RESIGNED`, `TERMINATED`, inactive, unknown, foreign-scope, or active-clearance Employees are rejected. Physical/card custody additionally requires the Asset Branch to equal the Employee Branch; licence allocation requires Company equality only.

Assignment-list filters are `employeeId`, `assetId`, `companyId`, `branchId`, `owningDepartmentId`, `employeeDepartmentId`, `custodyStatus`, `assignedFrom`, `assignedTo`, `closedFrom`, `closedTo`, `keyword`, plus common pagination/sort fields.

### 8.5 Software allocations

| Method | Route | Permission | Behavior |
|---|---|---|---|
| `GET` | `/asset/:assetId/license-allocations` | Broad or Department assignment read | Paginated pool allocations |
| `POST` | `/asset/:assetId/license-allocations` | Broad or Department assignment manage | Allocate one seat |
| `GET` | `/asset-license-allocations` | Broad or Department assignment read | Cross-pool paginated allocation register |
| `GET` | `/asset-license-allocations/:id` | Broad or Department assignment read | Scoped allocation detail |
| `PATCH` | `/asset-license-allocations/:id/revoke` | Broad or Department assignment manage | Revoke one active seat |

`AllocateLicenseRequest`:

```ts
{
  operationId: string;
  employeeId: string;
  allocatedDate: string;
  expectedPoolVersion: number;
  remarks?: string;
}
```

Allocation-list filters are `companyId`, `employeeBranchId`, `owningDepartmentId`, `employeeDepartmentId`, `employeeId`, `assetId`, `status`, `allocatedFrom`, `allocatedTo`, `revokedFrom`, `revokedTo`, `keyword`, plus common pagination/sort fields.

`RevokeLicenseRequest`:

```ts
{
  operationId: string;
  expectedAllocationVersion: number;
  expectedPoolVersion: number; // Asset.version
  revokedDate: string;
  reason: string;
}
```

`revokedDate` cannot precede the allocation date or exceed the owning Branch business date. The same rule applies to physical `effectiveDate` relative to `assignedDate`.

### 8.6 Department grants

| Method | Route | Permission | Behavior |
|---|---|---|---|
| `GET` | `/asset-department-grants` | `assets.department-access.manage` | List grants by Company/Branch/Department/User |
| `POST` | `/asset-department-grants` | `assets.department-access.manage` | Create a new grant |
| `PATCH` | `/asset-department-grants/:id/reactivate` | `assets.department-access.manage` | Versioned reactivation of a revoked grant |
| `PATCH` | `/asset-department-grants/:id/revoke` | `assets.department-access.manage` | Revoke grant |
| `GET` | `/me/asset-departments` | Any Department Asset permission | Current actor's active granted Departments |

The server validates that the User already has an applicable Company/Branch role assignment containing the Department permission. A grant cannot be used to bypass organization scope.

```ts
interface CreateDepartmentAssetGrantRequest extends OperationCommandDto {
  userId: string;
  departmentId: string;
  reason?: string;
}

interface RevokeDepartmentAssetGrantRequest
  extends VersionedReasonCommandDto {}

interface ReactivateDepartmentAssetGrantRequest
  extends VersionedReasonCommandDto {}
```

Create inserts version `1` only. If the natural-key row is active, return `ASSET_DEPARTMENT_GRANT_ALREADY_ACTIVE`; if it is revoked, return `ASSET_DEPARTMENT_GRANT_REACTIVATION_REQUIRED` and require the explicit reactivation route with its current expected version. Actor, Company, and Branch are derived. Reactivation locks the grant, compares version, clears prior revocation fields, increments version, and preserves the earlier lifecycle in AuditLog.

Grant-list filters are `companyId`, `branchId`, `departmentId`, `userId`, and `includeInactive`, plus common pagination/sort fields.

### 8.7 Ownership transfers

| Method | Route | Permission | Behavior |
|---|---|---|---|
| `GET` | `/asset-transfers` | Broad or Department read | Source/destination queue |
| `POST` | `/asset/:assetId/transfers` | Broad or Department manage | Request transfer |
| `GET` | `/asset-transfers/:id` | Broad or source/destination Department read | Scoped transfer detail |
| `POST` | `/asset-transfers/:id/accept` | Destination broad/Department manage | Accept and change owner atomically |
| `POST` | `/asset-transfers/:id/reject` | Destination broad/Department manage | Reject |
| `POST` | `/asset-transfers/:id/cancel` | Requester or broad manage | Cancel pending request |
| `POST` | `/asset-transfers/:id/force` | `assets.transfers.force` | Force with mandatory reason |

`RequestAssetTransferRequest`:

```ts
{
  operationId: string;
  toDepartmentId: string;
  reason: string;
  expectedAssetVersion: number;
}
```

Destination Branch is derived from `toDepartmentId`.

```ts
interface AcceptAssetTransferRequest extends OperationCommandDto {
  expectedTransferVersion: number;
  expectedAssetVersion: number;
  decisionNote?: string;
}

interface RejectAssetTransferRequest extends OperationCommandDto {
  expectedTransferVersion: number;
  expectedAssetVersion: number;
  decisionNote: string;
}

interface CancelAssetTransferRequest extends OperationCommandDto {
  expectedTransferVersion: number;
  expectedAssetVersion: number;
  reason: string;
}

interface ForceAssetTransferRequest extends OperationCommandDto {
  expectedTransferVersion: number;
  expectedAssetVersion: number;
  forceReason: string;
}
```

Decision/reason text is trimmed and limited to 500 characters. No request accepts Branch, status, requester, deciding actor, or timestamps.

Transfer-list filters are `assetId`, source/destination Branch/Department, status, requester, requested date range, and decision date range, plus common pagination/sort fields.

### 8.8 Employee self-service and custody requests

| Method | Route | Permission | Behavior |
|---|---|---|---|
| `GET` | `/me/assets` | `hr.self.read` | Current personal custody and active allocations only |
| `GET` | `/me/assets/requests` | `hr.self.read` | Employee's own request history |
| `POST` | `/me/assets/assignments/:id/acknowledge` | `hr.self.manage` | Idempotent personal acknowledgement |
| `POST` | `/me/assets/allocations/:id/acknowledge` | `hr.self.manage` | Idempotent personal acknowledgement |
| `POST` | `/me/assets/requests` | `hr.self.manage` | Submit personal request |
| `POST` | `/me/assets/requests/:id/cancel` | `hr.self.manage` | Cancel while still submitted |

`CreateMyAssetRequest`:

```ts
{
  operationId: string;
  targetType: "EMPLOYEE_ASSET" | "LICENSE_ALLOCATION";
  targetId: string;
  requestType: "RETURN" | "REPORT_DAMAGED" | "REPORT_LOST" | "REVOKE_LICENSE";
  expectedTargetVersion: number;
  occurredOn?: string;
  employeeNote?: string;
}
```

Employee identity is derived from the authenticated User. The client never supplies `employeeId`.

Cross-field rules: physical custody permits return/damaged/lost; a licence allocation permits revoke only. `occurredOn` is accepted only for damage/loss and cannot be future. `employeeNote` is required for damage/loss and capped at 1,000 characters.

Operational request queue:

| Method | Route | Permission | Behavior |
|---|---|---|---|
| `GET` | `/asset-custody-requests` | Broad or Department assignment read | Scoped queue |
| `GET` | `/asset-custody-requests/:id` | Broad or Department assignment read | Scoped request detail |
| `POST` | `/asset-custody-requests/:id/start-review` | Broad or Department assignment manage | Claim/review |
| `POST` | `/asset-custody-requests/:id/complete` | Broad or Department assignment manage | Execute authoritative custody action |
| `POST` | `/asset-custody-requests/:id/reject` | Broad or Department assignment manage | Reject with note |

```ts
interface AcknowledgeCustodyRequest extends OperationCommandDto {
  expectedVersion: number;
}

interface CancelMyCustodyRequest extends OperationCommandDto {
  expectedRequestVersion: number;
  reason?: string;
}

interface StartCustodyRequestReview extends OperationCommandDto {
  expectedRequestVersion: number;
}

interface CompleteCustodyRequest extends OperationCommandDto {
  expectedRequestVersion: number;
  expectedTargetVersion: number;
  expectedAssetVersion: number;
  effectiveDate: string;
  conditionOnReturn?: string;
  resolutionNote?: string;
}

interface RejectCustodyRequest extends OperationCommandDto {
  expectedRequestVersion: number;
  resolutionNote: string;
}
```

Acknowledgement uses server time and is target-idempotent. If the target is already acknowledged by its linked Employee, any later valid acknowledgement request returns the current safe target response without changing its timestamp, actor, or version, even when it carries a new `operationId`. A foreign Employee/User still receives `ASSET_ACKNOWLEDGEMENT_ACTOR_MISMATCH`. Request completion infers the custody outcome from the submitted request type and invokes the ordinary return/lost/damaged/revoke command inside the same transaction; the custodian cannot change the requested outcome.

Operational request-list filters are target type, request type, status, Employee, owning Branch/Department, requested date range, and reviewer, plus common pagination/sort fields. `/me/assets/requests` ignores all Employee filters and always binds to the authenticated Employee.

### 8.9 Separation clearance

| Method | Route | Permission | Behavior |
|---|---|---|---|
| `GET` | `/employees/:employeeId/asset-clearance-preflight` | Assignment read or `hr.employees.manage` | Live outstanding custody |
| `GET` | `/employee-clearance/:clearanceId/assets` | Assignment read or `hr.employees.manage` | Asset clearance items |
| `GET` | `/asset-clearance-waivers` | `assets.clearance.waive` | Scoped pending/history decision queue |
| `GET` | `/asset-clearance-waivers/:id` | Approver permission or workflow participant | Scoped decision detail with current versions |
| `POST` | `/asset-clearance-items/:id/waiver-requests` | Custodian/broad assignment manage | Request waiver |
| `POST` | `/asset-clearance-waivers/:id/approve` | `assets.clearance.waive` | Independent approval and custody closure |
| `POST` | `/asset-clearance-waivers/:id/reject` | `assets.clearance.waive` | Reject waiver |
| `POST` | `/asset-clearance-waivers/:id/cancel` | Original requester or broad Asset manage | Cancel pending waiver; item stays open |

Employee-separation completion must call `AssetClearanceService.assertResolved()` inside its own final transaction. Direct Employee deactivation must call the same preflight.

The two read handlers use `@RequireAnyPermissions('assets.assignments.read', 'assets.department.assignments.read', 'hr.employees.manage')`, followed by Employee/Asset record-scope enforcement. No undefined “separation manage” permission is introduced.

The waiver queue supports status, Employee, owning Company/Branch/Department, requester, and requested-date filters plus the common pagination/sort contract. Approvers receive `AssetClearanceWaiverResponse`; the requester can read only their own waiver detail through the participant-safe mapper. Both paths return current waiver, clearance-item, target, and Asset versions required by the decision DTOs, while private reason/evidence follows the active-workflow visibility rule.

```ts
type AssetClearanceWaiverReasonCode =
  | "ASSET_NOT_RECOVERABLE"
  | "EMPLOYEE_UNAVAILABLE"
  | "COST_RECOVERY_APPROVED"
  | "LEGAL_OR_SECURITY_HOLD"
  | "MANAGEMENT_EXCEPTION"
  | "OTHER";

interface RequestAssetClearanceWaiver extends OperationCommandDto {
  expectedClearanceItemVersion: number;
  expectedTargetVersion: number;
  reasonCode: AssetClearanceWaiverReasonCode;
  reason: string;
  evidenceReference?: string; // max 255
}

interface ApproveAssetClearanceWaiver extends OperationCommandDto {
  expectedWaiverVersion: number;
  expectedClearanceItemVersion: number;
  expectedTargetVersion: number;
  expectedAssetVersion: number;
  decisionNote?: string;
}

interface RejectAssetClearanceWaiver extends OperationCommandDto {
  expectedWaiverVersion: number;
  expectedClearanceItemVersion: number;
  decisionNote: string;
}

interface CancelAssetClearanceWaiver extends OperationCommandDto {
  expectedWaiverVersion: number;
  expectedClearanceItemVersion: number;
  reason: string;
}
```

Requester/approver, status, timestamps, Employee, and organization fields are server-owned. Approval first performs a scoped non-locking discovery read, then locks Employee, parent Separation/Clearance, Asset, subtype, custody/allocation, detail item, and Waiver in canonical order before rechecking the live target and maker-checker rule.

## 9. Response models

### 9.1 Shared and master responses

```ts
interface NamedReference {
  id: string;
  code?: string;
  name: string;
}

interface SafeUserReference {
  id: string;
  displayName: string;
}

interface SafeEmployeeReference {
  id: string;
  employeeCode: string;
  displayName: string;
  employmentStatus: string;
  company: NamedReference;
  branch: NamedReference;
  department: NamedReference;
}

interface PageResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

type AssetAvailabilityStatus =
  | "IN_SERVICE"
  | "AVAILABLE"
  | "ASSIGNED"
  | "SEATS_AVAILABLE"
  | "FULLY_ALLOCATED"
  | "UNAVAILABLE";

type AssetExpiryState =
  | "NOT_APPLICABLE"
  | "VALID"
  | "EXPIRING"
  | "EXPIRED";

interface AssetCategoryResponse {
  id: string;
  company: NamedReference;
  assetCategoryCode: string;
  assetCategoryName: string;
  description?: string;
  version: number;
  archived: boolean;
  assetTypeCount: number;
  allowedActions: Array<"EDIT" | "ARCHIVE" | "REACTIVATE">;
  createdAt: string;
  updatedAt: string;
}

interface AssetTypeResponse {
  id: string;
  company: NamedReference;
  category: NamedReference;
  assetTypeCode: string;
  assetTypeName: string;
  description?: string;
  kind: AssetKind;
  trackingMode: AssetTrackingMode;
  version: number;
  archived: boolean;
  assetCount: number;
  classificationMutable: boolean;
  allowedActions: Array<"EDIT" | "ARCHIVE" | "REACTIVATE">;
  createdAt: string;
  updatedAt: string;
}

interface AssetDashboardSummaryResponse {
  total: number;
  locationInService: number;
  physicalAvailable: number;
  physicalAssigned: number;
  inRepair: number;
  lost: number;
  disposed: number;
  expiring: number;
  expired: number;
  licensePools: number;
  licenseSeatsTotal: number;
  licenseSeatsAllocated: number;
  licenseSeatsAvailable: number;
  pendingEmployeeRequests: number;
  pendingTransfers: number;
  openClearanceItems: number;
}
```

List DTOs never expose Employee email/mobile, User roles, private notes/reasons, card crypto, or vault references.

### 9.2 Asset detail

```ts
interface AssetDetailResponse {
  id: string;
  assetCode: string;
  assetName: string;
  version: number;
  archived: boolean;
  lifecycleStatus: AssetLifecycleStatus;
  availabilityStatus: AssetAvailabilityStatus;
  expiryState: AssetExpiryState;
  ownership: {
    company: { id: string; name: string };
    branch: { id: string; name: string };
    department: { id: string; name: string };
  };
  classification: {
    category: { id: string; name: string };
    type: { id: string; name: string };
    kind: AssetKind;
    trackingMode: AssetTrackingMode;
  };
  serialNumber?: string;
  manufacturer?: string;
  modelNumber?: string;
  purchaseDate?: string;
  purchaseCost?: string; // decimal string
  currency?: string;
  warrantyExpiry?: string;
  location?: string;
  remarks?: string;
  cardDetails?: {
    maskedCardNumber: string;
    issuer?: string;
    accessZone?: string;
    issuedDate: string;
    expiryDate?: string;
  };
  licenseDetails?: {
    vendorName: string;
    productName: string;
    contractReference?: string;
    vaultReference?: string; // detail only + assets.sensitive-metadata.read
    seatCapacity: number;
    allocatedSeatCount: number;
    availableSeatCount: number;
    startsOn?: string;
    expiresOn?: string;
    renewsOn?: string;
  };
  currentCustody?: EmployeeAssetResponse;
  allowedActions: AssetAllowedAction[];
}
```

Lists return current summaries only. Full custody, transfer, request, and audit history is loaded through detail endpoints or explicitly paginated nested endpoints.

List and self-service mappers always omit `vaultReference`. Asset detail includes it only when the actor has `assets.sensitive-metadata.read` and valid record scope. Generic broad/Department read is insufficient.

### 9.3 Allowed actions

Exact capability unions:

```ts
type AssetAllowedAction =
  | "EDIT_METADATA" | "CORRECT_IDENTIFIER" | "ASSIGN" | "ALLOCATE_LICENSE"
  | "MARK_LOST" | "SEND_TO_REPAIR" | "COMPLETE_REPAIR"
  | "SUSPEND" | "RESUME" | "RESIZE_POOL" | "TRANSFER"
  | "ARCHIVE" | "REACTIVATE" | "DISPOSE" | "RETIRE";

type EmployeeAssetAllowedAction =
  | "RETURN" | "CLOSE_DAMAGED" | "CLOSE_LOST"
  | "ACKNOWLEDGE" | "REQUEST_RETURN" | "REPORT_DAMAGED" | "REPORT_LOST";

type LicenseAllocationAllowedAction =
  | "REVOKE" | "ACKNOWLEDGE" | "REQUEST_LICENSE_REVOKE";

type CustodyRequestAllowedAction = "START_REVIEW" | "COMPLETE" | "REJECT" | "CANCEL";
```

`AssetCapabilityService` calculates actions from permission, Department grant, lifecycle, tracking mode, expiry, open custody, active requests, pending transfer, and version. The frontend only renders returned actions.

### 9.4 Operational responses

```ts
interface AssetSummaryResponse {
  id: string;
  assetCode: string;
  assetName: string;
  version: number;
  kind: AssetKind;
  trackingMode: AssetTrackingMode;
  lifecycleStatus: AssetLifecycleStatus;
  availabilityStatus: AssetAvailabilityStatus;
  expiryState: AssetExpiryState;
  company: NamedReference;
  branch: NamedReference;
  department: NamedReference;
  assetType: NamedReference;
  maskedCardNumber?: string;
  seatCapacity?: number;
  allocatedSeatCount?: number;
  warrantyExpiry?: string;
  expiresOn?: string;
  allowedActions: AssetAllowedAction[];
}

interface AssetHistoryEventResponse {
  id: string;
  eventType: string;
  occurredAt: string;
  actor?: SafeUserReference;
  lifecycleStatus?: AssetLifecycleStatus;
  custodyStatus?: EmployeeAssetStatus | LicenseAllocationStatus;
  fromDepartment?: NamedReference;
  toDepartment?: NamedReference;
  changedFields?: string[];
  relatedEntity?: { type: string; id: string };
  action?: AssetActionType;
  effectiveDate?: string;
  actionContext?: { reason?: string; note?: string }; // only with assets.private-history.read + record scope
}

interface EmployeeAssetResponse {
  id: string;
  version: number;
  custodyStatus: EmployeeAssetStatus;
  employee: SafeEmployeeReference;
  asset: AssetSummaryResponse;
  assignedDate: string;
  assignedBy?: SafeUserReference; // null on unmappable legacy history only
  branchAtAssignment: NamedReference;
  departmentAtAssignment: NamedReference;
  closedAt?: string;
  closedBy?: SafeUserReference;
  conditionOnReturn?: string;
  acknowledgedAt?: string;
  sourceType: AssetSourceType;
  sourceId?: string;
  allowedActions: EmployeeAssetAllowedAction[];
  createdAt: string;
  updatedAt: string;
}

interface LicenseAllocationResponse {
  id: string;
  version: number;
  status: LicenseAllocationStatus;
  employee: SafeEmployeeReference;
  pool: AssetSummaryResponse; // pool.version is the public aggregate token
  allocatedAt: string;
  allocatedBy: SafeUserReference;
  revokedAt?: string;
  revokedBy?: SafeUserReference;
  acknowledgedAt?: string;
  sourceType: AssetSourceType;
  sourceId?: string;
  allowedActions: LicenseAllocationAllowedAction[];
  createdAt: string;
  updatedAt: string;
}

interface DepartmentAssetGrantResponse {
  id: string;
  version: number;
  user: SafeUserReference;
  company: NamedReference;
  branch: NamedReference;
  department: NamedReference;
  active: boolean;
  grantedBy: SafeUserReference;
  grantedAt: string;
  revokedAt?: string;
  revokedBy?: SafeUserReference;
  allowedActions: Array<"REVOKE">;
}

interface AssetTransferResponse {
  id: string;
  version: number;
  status: AssetTransferStatus;
  asset: AssetSummaryResponse;
  fromBranch: NamedReference;
  fromDepartment: NamedReference;
  toBranch: NamedReference;
  toDepartment: NamedReference;
  requestedBy: SafeUserReference;
  requestedAt: string;
  decidedBy?: SafeUserReference;
  decidedAt?: string;
  cancelledBy?: SafeUserReference;
  cancelledAt?: string;
  forcedBy?: SafeUserReference;
  forcedAt?: string;
  assetVersionAtRequest: number;
  actionContext?: { reason: string; decisionNote?: string };
  allowedActions: Array<"ACCEPT" | "REJECT" | "CANCEL" | "FORCE">;
}

interface AssetCustodyRequestResponse {
  id: string;
  version: number;
  requestType: AssetCustodyRequestType;
  status: AssetCustodyRequestStatus;
  target: {
    type: AssetCustodyTargetType;
    id: string;
    version: number;
  };
  employee: SafeEmployeeReference;
  asset: AssetSummaryResponse;
  requestedAt: string;
  reviewedBy?: SafeUserReference;
  reviewedAt?: string;
  resolvedBy?: SafeUserReference;
  resolvedAt?: string;
  actionContext?: {
    occurredOn?: string;
    employeeNote?: string;
    resolutionNote?: string;
  };
  allowedActions: Array<"START_REVIEW" | "COMPLETE" | "REJECT" | "CANCEL">;
}

interface AssetClearancePreflightResponse {
  employee: SafeEmployeeReference;
  canComplete: boolean;
  physicalOutstandingCount: number;
  licenseOutstandingCount: number;
  physicalCustody: Array<{
    assignmentId: string;
    assignmentVersion: number;
    asset: AssetSummaryResponse;
  }>;
  licenseAllocations: Array<{
    allocationId: string;
    allocationVersion: number;
    pool: AssetSummaryResponse;
  }>;
}

interface AssetClearanceItemResponse {
  id: string;
  version: number;
  status: AssetClearanceItemStatus;
  employee: SafeEmployeeReference;
  asset: AssetSummaryResponse;
  target: {
    type: AssetCustodyTargetType;
    id: string;
    version: number;
  };
  resolutionType?: AssetClearanceResolutionType;
  resolvedAt?: string;
  activeWaiver?: AssetClearanceWaiverResponse;
  allowedActions: Array<"REQUEST_WAIVER">;
}

interface AssetClearanceWaiverResponse {
  id: string;
  version: number;
  status: AssetClearanceWaiverStatus;
  clearanceItemId: string;
  clearanceItemVersion: number;
  target: {
    type: AssetCustodyTargetType;
    id: string;
    version: number;
    assetVersion: number;
  };
  reasonCode: AssetClearanceWaiverReasonCode;
  requestedBy: SafeUserReference;
  requestedAt: string;
  decidedBy?: SafeUserReference;
  decidedAt?: string;
  cancelledBy?: SafeUserReference;
  cancelledAt?: string;
  actionContext?: {
    reason: string;
    evidenceReference?: string;
    decisionNote?: string;
  };
  allowedActions: Array<"APPROVE" | "REJECT" | "CANCEL">;
}

interface MyAssetsResponse {
  summary: {
    physicalAssigned: number;
    activeLicenses: number;
    acknowledgementPending: number;
    openRequests: number;
  };
  physicalAssignments: EmployeeAssetResponse[];
  licenseAllocations: LicenseAllocationResponse[];
}
```

Current workflow participants receive only the private context required for an available action: source/destination transfer custodians receive the active transfer reason; the Employee and handling custodian receive that Employee's active request note; the waiver requester and authorized independent approver receive the active waiver reason/evidence. The mapper sets `actionContext` only after participant, record-scope, and `allowedActions` checks. Unrelated or historical private text still requires `assets.private-history.read`. Lists, notifications, ordinary history, and other Employees omit it. `GET /me/assets` maps only the authenticated Employee's active records.

## 10. Transaction and concurrency implementation

### 10.1 Standard command transaction

Every command follows this order:

1. Validate authentication and coarse permission.
2. Resolve tenant and Department record scope.
3. Begin PostgreSQL transaction.
4. Claim `operationId` in `asset_command_receipts`.
5. Lock every required Department grant in ID order; broad-authority commands have no grant row to lock.
6. Lock aggregate rows in the canonical order below using `SELECT ... FOR UPDATE` or a conditional version update.
7. Revalidate permission, active grant, scope, and business state inside the transaction.
8. Perform conditional writes.
9. Increment version.
10. Write AuditLog using the transaction client.
11. Write sanitized OutboxEvent using the transaction client.
12. Store command-result reference.
13. Commit and return the mapped response.

Serialization/deadlock conflicts use a bounded retry at the service boundary. Unique/conditional-write failures are translated into stable domain conflicts.

Category, Type, and Asset create commands allocate their generated codes through the existing Company-scoped `NumberSeries` inside this same transaction. The idempotency receipt is claimed first, then the series row is locked/incremented. A rollback consumes no committed code and a replay returns the stored result instead of allocating again. Generated codes are immutable.

Every numbered command flow below starts after the receipt and all applicable source/destination Department grant rows have been locked. Permission and grant validity are rechecked after those locks. A grant revocation uses the same grant-first order, so it cannot race a command into acting with revoked Department scope.

Composite commands have exactly one top-level transaction/receipt owner. Introduce an `AssetCommandContext` carrying the transaction client, Company/actor, top-level command/receipt ID, validated scope, and acquired-lock set. Internal primitives such as `closeCustodyWithinTransaction(ctx, ...)`, `revokeAllocationWithinTransaction(ctx, ...)`, and `applyWaiverWithinTransaction(ctx, ...)` never begin/commit a transaction, claim another operation receipt, re-lock rows out of canonical order, or return an independent API response. They perform their named mutation, evidence row, audit entry, and outbox event under the parent command; the parent stores one safe result snapshot and commits once.

Custody-request completion owns the request-completion receipt and invokes the appropriate internal close/revoke primitive. Waiver approval owns the waiver receipt and invokes the internal terminal-custody primitive. Separation finalization and Onboarding conversion use their own top-level domain transaction context; Asset primitives participate in that transaction and use source-command idempotency where applicable, without also claiming an Asset REST receipt. A replay therefore resolves at the original top-level command and cannot collide on a second command type/hash.

### 10.2 Assign physical/card Asset

Inside one transaction:

1. Lock Employee, any non-terminal Separation/Clearance, then Asset.
2. Verify expected version, `INDIVIDUAL`, lifecycle `ACTIVE`, not archived, and not expired.
3. Resolve Employee in scope and verify Company/Branch eligibility and active employment state.
4. Revalidate the actor's broad access or locked owning-Department grant.
5. Insert `EmployeeAsset(custodyStatus=ASSIGNED)` and dual-write legacy `status=ASSIGNED`; the partial unique index is the final concurrency guard.
6. Increment Asset version. Availability is derived from the new custody row.
7. Write audit and `ASSET_ASSIGNED` outbox event.

Do not use a preliminary read followed by an unguarded insert. If another transaction wins, return `409 ASSET_ALREADY_ASSIGNED` with a safe refresh instruction.

### 10.3 Close physical/card custody

1. Use a scoped non-locking lookup to discover Employee/Asset and any linked Separation/Clearance. Lock Employee, then the parent Separation/Clearance when applicable, then Asset and assignment.
2. Require `custodyStatus=ASSIGNED`, no `closedAt`, and both expected Asset/assignment versions.
3. Validate effective date.
4. Apply outcome:
   - `RETURNED`: close custody; Asset remains `ACTIVE` and becomes available.
   - `DAMAGED`: close custody; Asset becomes `IN_REPAIR`.
   - `LOST`: close custody; Asset becomes `LOST`.
5. Reconcile any open Asset clearance item and custody request.
6. Increment versions; audit and outbox atomically.

### 10.4 Allocate/revoke licence seat

Allocation:

1. Lock Employee, any non-terminal Separation/Clearance, Asset, and licence-detail row in that order.
2. Treat `expectedPoolVersion` as `Asset.version`; compare and conditionally increment it exactly once.
3. Require `SOFTWARE_LICENSE + POOL`, lifecycle `ACTIVE`, not archived/expired.
4. Validate Employee belongs to the same Company and is eligible.
5. Precheck available capacity for the domain error.
6. Insert allocation; the capacity trigger performs the final check and increments `allocatedSeatCount`.
7. Audit/outbox and commit.

Revocation:

1. Resolve the Employee and any linked Separation/Clearance through the allocation, then lock Employee, parent Separation/Clearance when applicable, Asset, licence-detail row, and allocation in that order.
2. Compare `expectedPoolVersion = Asset.version` plus the allocation version.
3. Conditionally change `ACTIVE -> REVOKED` and increment Asset version once.
4. The capacity trigger decrements the count exactly once.
5. Reconcile request/clearance item.
6. Audit/outbox and commit.

### 10.5 Decide/cancel/force transfer

1. After receipt and applicable source/destination grant locks, use a scoped lookup to discover the Asset, then lock Asset followed by transfer.
2. Require transfer `PENDING`; compare DTO Asset/transfer versions. Accept/force additionally requires current Asset owner and `Asset.version` to match `assetVersionAtRequest`.
3. Revalidate destination actor/grant, requester cancellation rights, or force permission for the selected action.
4. For accept/force of a cross-Branch physical/location Asset, assert no open custody/request and valid lifecycle.
5. Accept/force updates Asset Department and derived Branch. Reject/cancel leaves ownership unchanged. Every terminal transfer decision increments Asset and transfer versions once.
6. Audit the action and write safe notifications to source/destination custodians.

### 10.6 Complete employee request

1. Resolve target Employee/Asset and any linked Separation/Clearance through a scoped lookup, then lock Employee, parent Separation/Clearance when applicable, Asset, the licence-detail row when applicable, target custody, and request in that order.
2. Require request `SUBMITTED`/`IN_REVIEW` and authorized owning Department.
3. Invoke the matching `...WithinTransaction(ctx)` return/lost/damaged/revoke primitive under the request-completion receipt; do not call a public command facade.
4. Mark request `COMPLETED` only after custody succeeds.
5. Audit/outbox both changes atomically.

### 10.7 Approve clearance waiver

1. Resolve Employee/Asset and the parent Separation/Clearance through a scoped lookup, then lock Employee, Separation/Clearance, Asset/pool, the licence-detail row when applicable, target custody, clearance item, and waiver in that order.
2. Verify status `REQUESTED`, approver permission, and approver differs from requester.
3. Close physical custody as `WAIVED` and Asset as `LOST`, or close licence allocation as `WAIVED` and release a seat.
4. Mark waiver `APPROVED` and clearance item `WAIVED`.
5. Recompute child/summary clearance state from live custody. Do not assert zero here; other open items may require later return/revoke/waiver.
6. Audit/outbox all changes and commit.

### 10.8 Version tokens and canonical lock order

Public concurrency tokens:

| Command | Required versions |
|---|---|
| Category/Type update or transition | Resource version |
| Asset metadata/lifecycle/capacity | Asset version |
| Assign physical/card | Asset version |
| Close physical/card | Asset and assignment versions |
| Allocate licence | Pool version, meaning `Asset.version` |
| Revoke licence | Pool and allocation versions |
| Request transfer | Asset version |
| Accept/force transfer | Asset and transfer versions |
| Reject/cancel transfer | Asset and transfer versions |
| Revoke grant | Grant version |
| Create self request | Target custody/allocation version |
| Complete request | Asset, target, and request versions |
| Request waiver | Clearance item and target versions |
| Approve waiver | Asset, target, clearance item, and waiver versions |

Lock every multi-aggregate command in this order: idempotency receipt; NumberSeries when creating; required grants ordered by ID; Employees ordered by ID; Separation and parent Clearance when applicable; Category/Type; Assets ordered by ID; card then licence subtype; physical custody then licence allocations; transfers; custody requests; clearance items; waivers; AuditLog; OutboxEvent. When a route starts from a child ID, do a non-locking scoped discovery read, then re-read and validate after acquiring locks in this order. Never lock custody/allocation/request before its Employee, Asset, and applicable licence-detail row.

Assignment, allocation, Employee move, deactivation, and separation all acquire the Employee row first and revalidate employment state after the lock. The physical/licence eligibility triggers also lock the Employee row before accepting a new active record. This serializes “new custody” against career transfer or terminal-state completion; a separation preflight cannot pass concurrently with an insertion for the same Employee.

Compare versions only after locks are held and increment each changed resource once. An accepted same-hash idempotent replay returns its stored safe snapshot before version comparison because the original command already committed.

Implement one `AssetTransactionRunner` shared by Asset commands. It makes three total attempts and retries only Prisma `P2034` or PostgreSQL `40001`/`40P01`, using jittered 25–100 ms backoff outside the transaction. Validation, permission, unique, check, trigger, and version conflicts are never retried. Exhaustion returns `ASSET_TRANSACTION_RETRY_EXHAUSTED` without partial receipt, audit, or outbox rows.

### 10.9 Organization and Employee movement

Organization ownership fields are not generic update fields. Remove Company/Branch from Department update DTOs and Company from Branch update DTOs; database relations and reparent guards use `onUpdate: Restrict`. A future Organization reparent requires a separate audited data-migration workflow.

Branch/Department deactivation is blocked while active Assets, active grants, or pending transfers reference it. The operator must transfer/archive the Assets, revoke grants, and resolve transfers first. Hard deletion remains prohibited when any Asset history references the organization row.

Employee Company is immutable. Extend the existing `POST /hr/employees/:employeeId/career/transfer` route and `EmployeeCareerService.recordTransfer()` as the single authoritative Branch/Department movement hook. Inside its existing transaction, lock Employee first, derive Branch from the selected Department, validate the Department belongs to the Employee Company, and call `AssetCustodyPreflightService.assertEmployeeMoveAllowed(tx, ...)` before writing the career milestone or organization fields. Do not add a second Asset-specific transfer endpoint.

Remove `companyId`, `branchId`, `departmentId`, employment `status`, and `isActive` from the generic Employee PATCH DTO even though the current `UpdateEmployeeDto extends PartialType(CreateEmployeeDto)`. Until clients migrate, explicitly reject those keys at the controller/service boundary rather than ignoring them. Lifecycle changes must use their existing audited career/separation commands and therefore share the same Asset preflight.

The authoritative career-transfer command applies these rules:

- Same-Branch Department change is allowed; Asset ownership remains unchanged.
- Cross-Branch change is rejected while any open physical/card custody belongs to the old Branch.
- Same-Company software allocations may remain because licence eligibility is Company-wide.
- A different Company requires the existing Employee to finish separation/custody and a new Company Employee record.

Direct SQL is protected by `employee_organization_custody_guard`. A blocked move returns `EMPLOYEE_ASSET_TRANSFER_BLOCKED` with counts and safe custody IDs only.

### 10.10 Audit, logs, and private history

All Asset mutations use an `AssetAuditMapper` allowlist instead of serializing Prisma rows. Audit snapshots may contain IDs, masked card display, classification, lifecycle, capacity, versions, and safe status/date fields. They never contain card plaintext/ciphertext/lookup digest/nonce/tag/wrapped DEK/key versions, vault reference, Employee note, reason, remarks, waiver evidence, or decision note. For sensitive changes, store only `changedFields`, booleans such as `cardNumberChanged`, and encryption format version.

Add the same sensitive-field denylist to HTTP logging, exception serialization, tracing, analytics, outbox payload mapping, and background-job logs. Mutation audit failure rolls back the business transaction. Protected card lookup records a separate redacted access audit with actor, request ID, Company, Department, Asset, action, result, and approved purpose code; if that audit cannot be persisted, lookup fails closed.

Ordinary history endpoints show the safe audit/action projection without private reason/note fields. For an active workflow, its source/destination custodian, requesting Employee/handling custodian, or waiver requester/independent approver may see only the decision context needed for their current action without broad private-history permission. Lifecycle/action reasons and all unrelated or historical private transfer/request/waiver text require `assets.private-history.read`, valid scope, and a dedicated detail mapper. Self-service never receives internal decisions or other actors' notes.

## 11. Stable error codes

DTO/query validation returns `400`; a missing or out-of-record-scope resource returns the same `404`; coarse permission/action denial returns the existing `403 FORBIDDEN`; current-state and concurrency conflicts return `409`.

| HTTP | Code | Meaning |
|---:|---|---|
| 400 | `VALIDATION_ERROR` | DTO/query validation failed |
| 400 | `ASSET_DATE_RANGE_INVALID` | Invalid purchase/warranty, issue/expiry, or effective-date range |
| 400 | `ASSET_KIND_DETAILS_INVALID` | Subtype payload does not match Type |
| 400 | `ASSET_IDENTIFIER_FORMAT_INVALID` | Serial/card normalization failed |
| 404 | `ASSET_NOT_FOUND` | Missing or out-of-scope Asset |
| 404 | `ASSET_CATEGORY_NOT_FOUND` | Missing/foreign Category |
| 404 | `ASSET_TYPE_NOT_FOUND` | Missing/foreign Type |
| 404 | `ASSET_DEPARTMENT_NOT_FOUND` | Missing/foreign Department |
| 404 | `ASSET_EMPLOYEE_NOT_FOUND` | Missing/foreign Employee |
| 404 | `ASSET_ASSIGNMENT_NOT_FOUND` | Missing/foreign custody record |
| 404 | `LICENSE_ALLOCATION_NOT_FOUND` | Missing/foreign allocation |
| 404 | `ASSET_TRANSFER_NOT_FOUND` | Missing/foreign transfer |
| 404 | `ASSET_REQUEST_NOT_FOUND` | Missing/foreign custody request |
| 404 | `ASSET_DEPARTMENT_GRANT_NOT_FOUND` | Missing/foreign grant |
| 404 | `ASSET_CLEARANCE_ITEM_NOT_FOUND` | Missing/foreign clearance item |
| 404 | `ASSET_CLEARANCE_WAIVER_NOT_FOUND` | Missing/foreign waiver |
| 410 | `ASSET_LEGACY_ALIAS_DISABLED` | Deprecated DELETE alias is no longer enabled |
| 409 | `ASSET_VERSION_CONFLICT` | Stale expected version |
| 409 | `IDEMPOTENCY_KEY_REUSED` | Operation ID reused with different input |
| 409 | `ASSET_SOURCE_COMMAND_CONFLICT` | Internal source key reused for different custody input |
| 409 | `ASSET_CATEGORY_DUPLICATE` | Company code/name already exists |
| 409 | `ASSET_CATEGORY_IN_USE` | Active Types block archive |
| 409 | `ASSET_TYPE_DUPLICATE` | Company Type code/name already exists |
| 409 | `ASSET_TYPE_IN_USE` | Active Assets block archive |
| 409 | `ASSET_TYPE_CLASSIFICATION_IMMUTABLE` | Used Type category/kind/tracking changed |
| 409 | `ASSET_SERIAL_DUPLICATE` | Normalized serial already exists in Company |
| 409 | `ASSET_CARD_IDENTIFIER_DUPLICATE` | Protected card identifier already exists |
| 409 | `ASSET_DEPARTMENT_BRANCH_MISMATCH` | Department hierarchy does not match Asset |
| 409 | `ASSET_NOT_AVAILABLE` | State/expiry/archive blocks action |
| 409 | `ASSET_EXPIRED` | Card or licence is expired |
| 409 | `ASSET_ALREADY_ASSIGNED` | Active custody already exists |
| 409 | `ASSET_ASSIGNMENT_ALREADY_CLOSED` | Custody already closed |
| 409 | `ASSET_ACKNOWLEDGEMENT_ACTOR_MISMATCH` | Acknowledging User is not the custody Employee |
| 409 | `ASSET_INVALID_STATE_TRANSITION` | Lifecycle command is invalid |
| 409 | `ASSET_ACTIVE_CUSTODY_EXISTS` | Archive/dispose/transfer blocked |
| 409 | `ASSET_IDENTIFIER_CORRECTION_BLOCKED` | Active custody blocks correction |
| 409 | `EMPLOYEE_NOT_ELIGIBLE_FOR_ASSET` | Employee inactive or terminal |
| 409 | `EMPLOYEE_ASSET_CLEARANCE_ACTIVE` | New custody is blocked by active separation/clearance |
| 409 | `ASSET_EMPLOYEE_BRANCH_MISMATCH` | Physical/card Employee is in another Branch |
| 409 | `EMPLOYEE_ASSET_TRANSFER_BLOCKED` | Career move conflicts with open custody |
| 409 | `LICENSE_POOL_NOT_ACTIVE` | Pool suspended, retired, archived, or expired |
| 409 | `ASSET_TRANSFER_ALREADY_PENDING` | Pending transfer exists |
| 409 | `ASSET_TRANSFER_ASSET_CHANGED` | Owner/version differs from request snapshot |
| 409 | `ASSET_TRANSFER_INVALID_DESTINATION` | Same Department or foreign/invalid destination |
| 409 | `ASSET_TRANSFER_ACTIVE_CUSTODY` | Cross-Branch transfer has open physical custody |
| 409 | `ASSET_TRANSFER_INVALID_STATE` | Transfer is not pending |
| 409 | `LICENSE_NO_SEATS_AVAILABLE` | Pool is at capacity |
| 409 | `LICENSE_ALLOCATION_EXISTS` | Employee already has active seat |
| 409 | `LICENSE_CAPACITY_BELOW_USAGE` | Resize is below active allocation count |
| 409 | `LICENSE_ALLOCATION_ALREADY_CLOSED` | Allocation already revoked/waived |
| 409 | `ASSET_DEPARTMENT_GRANT_ALREADY_ACTIVE` | Duplicate active grant |
| 409 | `ASSET_DEPARTMENT_GRANT_REACTIVATION_REQUIRED` | Revoked grant must use versioned reactivation |
| 409 | `ASSET_REQUEST_ALREADY_OPEN` | Duplicate open request |
| 409 | `ASSET_REQUEST_TARGET_CLOSED` | Custody ended before request action |
| 409 | `ASSET_REQUEST_INVALID_STATE` | Request transition is invalid |
| 409 | `ASSET_CLEARANCE_MANAGED` | Generic ASSET summary cannot be cleared manually |
| 409 | `ASSET_CLEARANCE_LINK_INVALID` | Clearance summary/Employee/target relation is inconsistent |
| 409 | `ASSET_CLEARANCE_BLOCKED` | Outstanding custody prevents separation |
| 409 | `ASSET_WAIVER_SELF_APPROVAL_FORBIDDEN` | Same actor requested and approved |
| 409 | `ASSET_WAIVER_ALREADY_REQUESTED` | Clearance item already has a pending waiver |
| 409 | `ASSET_WAIVER_INVALID_STATE` | Waiver/item/target no longer approvable |
| 409 | `ORGANIZATION_ASSET_REPARENT_BLOCKED` | Organization mutation would invalidate Asset history/scope |
| 503 | `ASSET_SENSITIVE_STORAGE_UNAVAILABLE` | Card encryption/HMAC key unavailable |
| 503 | `ASSET_TRANSACTION_RETRY_EXHAUSTED` | Serialization/deadlock retry exhausted |

### 11.1 Database error translation

Map Prisma code/SQLSTATE plus explicit constraint or trigger name; never parse prose database messages.

| Database signal | Named constraint/index | API code |
|---|---|---|
| `P2002` / `23505` | Category Company/code or Company/name | `ASSET_CATEGORY_DUPLICATE` |
| `P2002` / `23505` | Type Company/code or Company/name | `ASSET_TYPE_DUPLICATE` |
| `P2002` / `23505` | `assets_company_serial_normalized_key` | `ASSET_SERIAL_DUPLICATE` |
| `P2002` / `23505` | `asset_card_lookup_company_version_digest_key` | `ASSET_CARD_IDENTIFIER_DUPLICATE` |
| `P2002` / `23505` | `employee_assets_one_active_assignment_per_asset_idx` | `ASSET_ALREADY_ASSIGNED` |
| `P2002` / `23505` | `software_license_allocations_one_active_employee_idx` | `LICENSE_ALLOCATION_EXISTS` |
| Source-command unique index | Either custody `source_command_key` index | Use the non-aborting source replay path below |
| `P2002` / `23505` | Department-grant User/Department unique | Scoped-read; return `ASSET_DEPARTMENT_GRANT_ALREADY_ACTIVE` or `ASSET_DEPARTMENT_GRANT_REACTIVATION_REQUIRED`; never mutate from create |
| `P2002` / `23505` | Pending transfer/request/waiver partial index | Matching already-open conflict |
| `P2002` / `23505` | Command Company/operation unique | Replay or `IDEMPOTENCY_KEY_REUSED` after digest comparison |
| `P2003` / `23503` | Scoped Company/Branch/Department/Type/Employee FK | Scope-safe matching `*_NOT_FOUND` |
| `P2025` | Conditional update found no row | Re-read scoped row; map not-found/version/state |
| `23514` | Kind/tracking or subtype shape check | `ASSET_KIND_DETAILS_INVALID` |
| `23514` | Date check | `ASSET_DATE_RANGE_INVALID` |
| `23514` | Capacity check | `LICENSE_CAPACITY_BELOW_USAGE` |
| `23514` | Waiver actor check | `ASSET_WAIVER_SELF_APPROVAL_FORBIDDEN` |
| Trigger `P0001` | `employee_asset_wrong_branch_guard` | `ASSET_EMPLOYEE_BRANCH_MISMATCH` |
| Trigger `P0001` | `employee_asset_ineligible_employee_guard` | `EMPLOYEE_NOT_ELIGIBLE_FOR_ASSET` |
| Trigger `P0001` | `employee_asset_unavailable_guard` | `ASSET_NOT_AVAILABLE` or `ASSET_EXPIRED` by named guard |
| Trigger `P0001` | `asset_shape_guard` | `ASSET_KIND_DETAILS_INVALID` |
| Trigger `P0001` | `employee_asset_actor_guard` | `ASSET_ACKNOWLEDGEMENT_ACTOR_MISMATCH` or invalid-state code by named guard |
| Trigger `P0001` | `license_capacity_guard` | `LICENSE_NO_SEATS_AVAILABLE` |
| Trigger `P0001` | `license_employee_eligibility_guard` | `EMPLOYEE_NOT_ELIGIBLE_FOR_ASSET` |
| Trigger `P0001` | `license_acknowledgement_actor_guard` | `ASSET_ACKNOWLEDGEMENT_ACTOR_MISMATCH` |
| Trigger `P0001` | `asset_cross_branch_transfer_guard` | `ASSET_TRANSFER_ACTIVE_CUSTODY` |
| Trigger `P0001` | `asset_type_classification_guard` | `ASSET_TYPE_CLASSIFICATION_IMMUTABLE` |
| Trigger `P0001` | `employee_organization_custody_guard` | `EMPLOYEE_ASSET_TRANSFER_BLOCKED` or `ASSET_CLEARANCE_BLOCKED` by named guard |
| Trigger `P0001` | `organization_reparent_guard` | `ORGANIZATION_ASSET_REPARENT_BLOCKED` |
| Trigger `P0001` | `asset_operational_state_guard` | `ASSET_ACTIVE_CUSTODY_EXISTS` or `ASSET_INVALID_STATE_TRANSITION` by named guard |
| Trigger `P0001` | `asset_clearance_link_guard` | `ASSET_CLEARANCE_LINK_INVALID` |
| `P2034`, `40001`, `40P01` | Transaction conflict/deadlock | Retry, then `ASSET_TRANSACTION_RETRY_EXHAUSTED` |

Trigger functions raise a distinct stable `CONSTRAINT` identifier with SQLSTATE `P0001`. Unknown integrity conflicts are logged with request ID/code/constraint and return the repository's generic conflict; SQL, table/column names, DTO contents, private notes, and secrets are never returned or logged.

Internal source-command insertion must not rely on catching `P2002`/`23505`, because PostgreSQL has already aborted that transaction. Use `INSERT ... ON CONFLICT ("companyId", "sourceCommandKey") WHERE "sourceCommandKey" IS NOT NULL DO NOTHING RETURNING id`. When no row is returned, scoped-select the existing custody/allocation in the still-valid transaction, compare `sourceCommandHash`, and return it only on an exact match; otherwise return `ASSET_SOURCE_COMMAND_CONFLICT`. Prisma's ordinary `create` plus exception catch is not an implementation of this contract.

```sql
RAISE EXCEPTION USING
  ERRCODE = 'P0001',
  CONSTRAINT = 'employee_asset_wrong_branch_guard',
  MESSAGE = 'Employee and Asset branch mismatch';
```

The adapter controls behavior from SQLSTATE plus `CONSTRAINT`; the prose message is diagnostic only.

## 12. Notifications and outbox

Create `asset_reminder_dispatches` as the durable producer ledger:

| Field | Rule |
|---|---|
| `id` | UUID-formatted String primary key |
| `companyId`, `branchId`, `departmentId` | Owning scope |
| `sourceType`, `sourceId` | Warranty/card/licence/assignment/request/transfer source |
| `reminderCode` | Stable notification-catalog code |
| `sourceDueDate` | Nullable date that caused a date reminder |
| `sourceVersion` | Nullable aggregate version for state/capacity attention |
| `triggerBusinessDate` | Branch-local date for this threshold |
| `status` | `AssetReminderDispatchStatus` |
| `attempts` | Producer attempt count |
| `lockedAt`, `lockedBy` | Worker claim metadata |
| `outboxEventId` | Created OutboxEvent, when enqueued |
| `suppressionCode`, `lastErrorCode` | Controlled non-sensitive operational codes |
| `dedupeKey` | Unique deterministic key |
| `createdAt`, `updatedAt` | Standard timestamps |

Implement `AssetReminderProducer` behind `ASSET_REMINDERS_ENABLED`. It scans by owning Branch using the Branch's valid IANA timezone and local business date; missing/invalid timezone blocks only that Branch and raises job-health telemetry, never a silent UTC fallback. Insert date-based dispatches with `ON CONFLICT DO NOTHING`. Claim work with one atomic statement; a preliminary select followed by an update is not allowed:

```sql
WITH picked AS (
  SELECT id
  FROM asset_reminder_dispatches
  WHERE status = 'PENDING' AND "lockedAt" IS NULL
  ORDER BY "createdAt", id
  FOR UPDATE SKIP LOCKED
  LIMIT :batchSize
)
UPDATE asset_reminder_dispatches AS d
SET "lockedAt" = now(), "lockedBy" = :workerId
FROM picked
WHERE d.id = picked.id
RETURNING d.*;
```

The worker retains its returned `lockedAt` as `claimedAt`. Enqueue, suppress, or fail uses a compare-and-set predicate on `id`, `status='PENDING'`, `lockedBy=:workerId`, and `lockedAt=:claimedAt`; affected-row count must equal one. Creating OutboxEvent and moving to `ENQUEUED` commit together. If the compare-and-set affects zero rows, that worker has lost ownership and must stop without writing completion state.

Initial rules are deterministic:

- Warranty, card expiry, licence expiry, and licence renewal: 90, 30, 7, and 0 calendar days before the stored date.
- Pending acknowledgement, Employee custody request, and ownership transfer: first attention after 2 elapsed Branch-local calendar days and escalation after 5.
- Licence capacity low: emit `ASSET_LICENSE_CAPACITY_LOW` when a successful allocation or downward resize crosses from above 10% available seats to at most 10% while at least one seat remains.
- Licence capacity full: emit `ASSET_LICENSE_CAPACITY_FULL` when a successful allocation or downward resize crosses from at least one available seat to zero.

Date dispatch keys use the form below. Capacity keys use `asset-attention:{sourceType}:{sourceId}:{reminderCode}:v:{sourceVersion}`.

Use:

```text
asset-reminder:{sourceType}:{sourceId}:{reminderCode}:{sourceDueDate}:{triggerBusinessDate}
```

Capacity dispatches are not reconstructed by the scanner. While holding Employee/Asset/licence-detail locks, allocation and resize commands calculate before/after available seats and threshold bands, increment `Asset.version`, and insert the applicable dispatch with `sourceVersion` equal to that post-mutation version in the same transaction using `ON CONFLICT DO NOTHING`. Revoke can restore capacity but emits no low/full event; a later downward crossing may emit again with its new post-mutation version. No repeated low event is emitted for changes that remain inside the same low band.

The producer excludes archived/inactive Assets and reminders no longer relevant to disposed/lost/returned/revoked records. Delivery rechecks current state and suppresses a stale dispatch. Warranty/card/licence expiry reminders target active owning-Department custodians plus central Asset Managers. Assigned-card/licence reminders may also target the active Employee User. Department Heads are recipients only when they also hold a valid custodian grant. Recipient IDs are deduplicated and revalidated at delivery; a Department with no custodian produces an operational alert and still uses any valid central Asset Manager fallback.

Poison-row rules:

- Claim index: `(status, lockedAt, createdAt)` for `PENDING` rows.
- Process each claimed dispatch in its own short transaction so one bad row cannot roll back or starve the remainder.
- On failure, compare-and-set by worker and claim timestamp, increment `attempts`, clear the lock, and return to `PENDING`; at the configured maximum (default five), mark `FAILED` and raise job-health/dead-letter telemetry.
- A stale `PENDING` lock older than the configured threshold (default 300 seconds) is cleared by a recovery compare-and-set. A previous worker cannot enqueue, suppress, or fail the row after a recovery/new claim because its old `claimedAt` no longer matches.
- `ENQUEUED` requires non-null unique `outboxEventId`; `PENDING`, `SUPPRESSED`, and `FAILED` have no outbox ID. `SUPPRESSED` is terminal with a controlled suppression code.
- Retrying a `FAILED` dispatch is an audited operational command that resets it to `PENDING`; it cannot change the dedupe key/source.

Startup configuration validation:

| Setting | Default/rule |
|---|---|
| `ASSET_V2_ENABLED` | `false`; master gate for allowlisted scopes |
| `ASSET_V2_SCOPE_ALLOWLIST_JSON` | Required non-empty array when V2 is enabled; entries are `{companyId, branchIds?: string[]}` and omitted `branchIds` means all Company Branches |
| `ASSET_LEGACY_DELETE_ALIAS_ENABLED` | `true` for non-allowlisted compatibility scopes; never honored in an allowlisted V2 scope |
| `ASSET_REMINDERS_ENABLED` | `false` until catalog, worker, and Branch timezones validate |
| `ASSET_REMINDER_BATCH_SIZE` | `100`; allowed `1..1000` |
| `ASSET_REMINDER_MAX_ATTEMPTS` | `5`; must be positive |
| `ASSET_REMINDER_STALE_LOCK_SECONDS` | `300`; allowed `30..3600` |
| `ASSET_EMAIL_MODE` | `DISABLED` or `OUTBOX`; default `DISABLED` |
| Active card KEK and accepted HMAC lookup-key versions | Required when `ASSET_V2_ENABLED=true` |
| Active and retained idempotency HMAC key versions | Required for every live `asset_command_receipts.requestHashKeyVersion`; separate key domain from Card lookup |

`AssetFeatureGate` is the single server-side scope authority. Every V2 controller, internal command, self-service projection, reminder scan, and Onboarding seam calls it before record access; jobs also include the allowlist in their database predicate. The gate validates configured IDs against Organization data, derives scope from authenticated/server-owned records, and never accepts a client override. A missing/invalid/empty allowlist fails V2 closed.

List shape, service implementation, and DELETE behavior are selected from the authenticated active organization context and loaded record scope, never a query/body/header feature flag. A partial-Company Branch pilot requires an active Branch context: allowlisted Branches use V2, non-allowlisted Branches use legacy compatibility, and a mixed Company context is rejected with an instruction to select a Branch. An all-Branches Company entry uses V2 at Company context. At Company Group context, all resolved Companies/Branches must be uniformly V2 or uniformly legacy; a mixed Group is rejected with a safe instruction to select Company/Branch. Company-wide Category/Type changes and all software-pool allocate/revoke/self-service operations require an all-Branches Company entry because licence eligibility is Company-wide. Ownership transfers and Department grants require both source and destination Branches in scope; a transfer/grant cannot cross from pilot to nonpilot scope. Background jobs remain allowlist-predicate filtered rather than depending on an interactive organization context.

If V2/reminders are enabled with invalid combinations, an invalid rollout scope, missing notification catalog entries, invalid batch/retry values, missing required crypto or receipt-verification key versions, or an invalid Branch timezone, fail the affected feature/Branch closed and emit a readiness error; do not silently substitute defaults beyond those listed.

Seed every event below in the notification catalog. In-app delivery is required. Email is produced from the same outbox event only when the configured provider/template is active; email failure never rolls back the already-committed Asset command and follows normal outbox retry/dead-letter handling.

Extend the safe outbox payload allowlist only with identifiers and safe status/date fields:

```text
assetId, employeeAssetId, licenseAllocationId, assetTransferId,
assetCustodyRequestId, assetClearanceItemId, assetClearanceWaiverId,
departmentId, employeeId, recipientUserIds, eventCode, status, dueDate
```

Never include Asset serial, card identifier, licence/vault reference, employee note, reason, decision note, condition, or remarks.

Add event codes:

```text
ASSET_ASSIGNED
ASSET_LICENSE_ALLOCATED
ASSET_ACKNOWLEDGEMENT_PENDING
ASSET_CUSTODY_REQUEST_SUBMITTED
ASSET_CUSTODY_REQUEST_RESOLVED
ASSET_TRANSFER_REQUESTED
ASSET_TRANSFER_ACCEPTED
ASSET_TRANSFER_REJECTED
ASSET_EXPIRY_ATTENTION
ASSET_LICENSE_CAPACITY_LOW
ASSET_LICENSE_CAPACITY_FULL
ASSET_CLEARANCE_WAIVER_REQUESTED
ASSET_CLEARANCE_WAIVER_APPROVED
ASSET_CLEARANCE_WAIVER_REJECTED
```

Use recipient-specific notification dedupe keys: `notification:{dispatchDedupeKey}:user:{userId}`. Recipient resolution occurs server-side from the Employee User link, active Department grants, and active broad-role assignments.

## 13. Onboarding integration boundary

Asset V2 must expose a transaction-aware internal command interface:

```ts
assignIndividualAssetWithinTransaction(assetCommandContext, {
  assetId,
  employeeId,
  assignedDate,
  sourceType: "ONBOARDING_TASK",
  sourceId: onboardingTaskId,
  sourceCommandKey: `onboarding-task:${onboardingTaskId}:assign-asset`,
  actorUserId,
  operationId
})

allocateLicenseSeatWithinTransaction(assetCommandContext, {
  assetId,
  employeeId,
  allocatedDate,
  sourceType: "ONBOARDING_TASK",
  sourceId: onboardingTaskId,
  sourceCommandKey: `onboarding-task:${onboardingTaskId}:allocate-license`,
  actorUserId,
  operationId
})
```

The Onboarding conversion service creates `assetCommandContext` from its existing transaction after the canonical Employee/grant/Asset locks are acquired. The Asset primitives do not own a second receipt or transaction. The later Onboarding implementation must call these services rather than insert custody rows directly. Public REST DTOs cannot set `sourceType`, `sourceId`, `sourceCommandKey`, or `sourceCommandHash`. Build the immutable `asset-source-command:v1` canonical JSON containing only Company, source type/ID/key, Employee, Asset, ISO effective date, and command kind, then store its lowercase hexadecimal SHA-256 as `sourceCommandHash`. The v1 field order/normalization is frozen; a future representation requires an explicit stored format-version migration rather than changing v1. These fields are identifiers/dates rather than secrets, so this hash needs no key-version lifecycle. Both source fields must be present together. On a Company/source-key conflict, use the non-aborting `ON CONFLICT DO NOTHING RETURNING` path, returning the existing result only when its hash matches; otherwise return `ASSET_SOURCE_COMMAND_CONFLICT`. An Onboarding task is complete only after the authoritative Asset transaction returns that reference or an approved Onboarding waiver is recorded.

No Onboarding task queue, assignment, or automatic task completion is implemented as part of this Asset plan.

## 14. Database integrity verification

Run equivalent read-only checks after backfill, migration, deployment, and during monitoring.

### Missing/invalid ownership

```sql
SELECT a.id, a."companyId", a."branchId", a."departmentId"
FROM assets a
LEFT JOIN departments d ON d.id = a."departmentId"
WHERE a."archivedAt" IS NULL
  AND (
    a."departmentId" IS NULL OR
    a."branchId" IS NULL OR
    d.id IS NULL OR
    d."companyId" <> a."companyId" OR
    d."branchId" <> a."branchId"
  );
```

Expected: zero rows.

### Duplicate active physical custody

```sql
SELECT "assetId", COUNT(*)
FROM employee_assets
WHERE "custodyStatus" = 'ASSIGNED' AND "closedAt" IS NULL
GROUP BY "assetId"
HAVING COUNT(*) > 1;
```

Expected: zero rows.

### Licence capacity drift

```sql
SELECT d."assetId", d."seatCapacity", d."allocatedSeatCount",
       COUNT(a.id) FILTER (WHERE a.status = 'ACTIVE') AS actual_active
FROM asset_software_license_details d
LEFT JOIN software_license_allocations a ON a."assetId" = d."assetId"
GROUP BY d."assetId", d."seatCapacity", d."allocatedSeatCount"
HAVING d."allocatedSeatCount" <> COUNT(a.id) FILTER (WHERE a.status = 'ACTIVE')
    OR d."allocatedSeatCount" > d."seatCapacity";
```

Expected: zero rows.

### Terminal Employees with active custody

```sql
SELECT e.id
FROM employees e
WHERE (e."isActive" = false OR e."employmentStatus" IN ('RESIGNED', 'TERMINATED'))
  AND (
    EXISTS (
      SELECT 1 FROM employee_assets ea
      WHERE ea."employeeId" = e.id
        AND ea."custodyStatus" = 'ASSIGNED'
        AND ea."closedAt" IS NULL
    ) OR EXISTS (
      SELECT 1 FROM software_license_allocations la
      WHERE la."employeeId" = e.id AND la.status = 'ACTIVE'
    )
  );
```

Expected: zero rows.

### Operational state violations

```sql
SELECT a.id
FROM assets a
WHERE EXISTS (
  SELECT 1 FROM employee_assets ea
  WHERE ea."assetId" = a.id
    AND ea."custodyStatus" = 'ASSIGNED'
    AND ea."closedAt" IS NULL
    AND (a."archivedAt" IS NOT NULL OR a."trackingMode" <> 'INDIVIDUAL'
         OR a."lifecycleStatus" <> 'ACTIVE')
)
OR EXISTS (
  SELECT 1
  FROM software_license_allocations la
  JOIN asset_software_license_details ld ON ld."assetId" = a.id
  WHERE la."assetId" = a.id AND la.status = 'ACTIVE'
    AND (a."archivedAt" IS NOT NULL OR a.kind <> 'SOFTWARE_LICENSE'
         OR a."trackingMode" <> 'POOL'
         OR a."lifecycleStatus" NOT IN ('ACTIVE', 'SUSPENDED')
         OR (ld."expiresOn" IS NOT NULL AND ld."expiresOn" < CURRENT_DATE))
);
```

Expected: zero rows.

### Classification/subtype drift

```sql
SELECT a.id
FROM assets a
JOIN asset_types t ON t.id = a."assetTypeId"
LEFT JOIN asset_card_details cd ON cd."assetId" = a.id
LEFT JOIN asset_software_license_details ld ON ld."assetId" = a.id
WHERE a.kind <> t.kind
   OR a."trackingMode" <> t."trackingMode"
   OR (a.kind = 'CARD' AND (cd."assetId" IS NULL OR ld."assetId" IS NOT NULL))
   OR (a.kind = 'SOFTWARE_LICENSE' AND (ld."assetId" IS NULL OR cd."assetId" IS NOT NULL))
   OR (a.kind NOT IN ('CARD', 'SOFTWARE_LICENSE')
       AND (cd."assetId" IS NOT NULL OR ld."assetId" IS NOT NULL))
   OR (a.kind = 'HARDWARE' AND nullif(trim(a."serialNumberNormalized"), '') IS NULL)
   OR (a."trackingMode" = 'LOCATION' AND nullif(trim(a.location), '') IS NULL);
```

Expected: zero rows.

### Legacy mirror drift

```sql
SELECT a.id
FROM assets a
WHERE a."isActive" <> (a."archivedAt" IS NULL)
   OR a.status <> CASE
     WHEN a."lifecycleStatus" = 'ACTIVE'
       AND a."trackingMode" = 'INDIVIDUAL'
       AND EXISTS (
         SELECT 1 FROM employee_assets ea
         WHERE ea."assetId" = a.id
           AND ea."custodyStatus" = 'ASSIGNED' AND ea."closedAt" IS NULL
       ) THEN 'ASSIGNED'
     WHEN a."lifecycleStatus" = 'ACTIVE' THEN 'AVAILABLE'
     WHEN a."lifecycleStatus" IN ('IN_REPAIR', 'SUSPENDED') THEN 'REPAIR'
     WHEN a."lifecycleStatus" = 'LOST' THEN 'LOST'
     WHEN a."lifecycleStatus" IN ('DISPOSED', 'RETIRED') THEN 'DISPOSED'
   END
UNION ALL
SELECT c.id
FROM asset_categories c
WHERE c."isActive" <> (c."archivedAt" IS NULL)
UNION ALL
SELECT t.id
FROM asset_types t
WHERE t."isActive" <> (t."archivedAt" IS NULL)
UNION ALL
SELECT ea.id
FROM employee_assets ea
WHERE ea.status <> CASE
  WHEN ea."custodyStatus" = 'WAIVED' THEN 'LOST'
  ELSE ea."custodyStatus"::text
END;
```

Expected: zero rows during the compatibility window.

### Invalid clearance linkage

```sql
SELECT i.id
FROM asset_clearance_items i
JOIN employee_clearance_items s ON s.id = i."clearanceSummaryItemId"
JOIN employee_clearances c ON c.id = i."clearanceId"
JOIN employee_separations sep ON sep.id = c."separationId"
LEFT JOIN employee_assets ea ON ea.id = i."employeeAssetId"
LEFT JOIN software_license_allocations la ON la.id = i."licenseAllocationId"
WHERE s."clearanceId" <> i."clearanceId"
   OR s."clearanceType" <> 'ASSET'
   OR sep."employeeId" <> i."employeeId"
   OR coalesce(ea."employeeId", la."employeeId") <> i."employeeId";
```

Expected: zero rows.

### Invalid waiver approval

```sql
SELECT id
FROM asset_clearance_waivers
WHERE status = 'APPROVED'
  AND (
    "decidedByUserId" IS NULL OR
    "requestedByUserId" = "decidedByUserId"
  );
```

Expected: zero rows.

## 15. Test implementation

### Unit/service tests

- Every kind/tracking combination and subtype validation.
- Company Group/Company/Branch/Department scope.
- Broad versus Department-granted access.
- Category/Type immutability and archive rules.
- Asset capability calculation.
- Physical, card, location, and pool lifecycle transitions.
- Lifecycle effective-date ordering, including repair completion after send-to-repair.
- Employee eligibility and business-date validation.
- Card masking and protected-value failure.
- Card normalization/masking, envelope AES-GCM nonce/tag/AAD tamper failure, KEK rewrap, DEK rotation that preserves format version, explicit format migration that changes version/AAD, and dual-version HMAC lookup rotation.
- Card exact lookup during mixed-key backfill and all-or-nothing identifier correction/rotation rollback when crypto, digest, audit, or outbox fails.
- Request, transfer, and waiver state machines.
- Generic ASSET clearance summary cannot bypass detail custody.
- New custody is rejected after non-terminal clearance begins, while clearance creation racing custody deterministically includes the custody or wins and blocks it.
- Employee career-transfer and organization reparent guards.
- Asset-domain action evidence persists required effective date/reason/note and remains private/append-only while AuditLog/outbox stay redacted.
- Audit mapper/log/tracing redaction for every sensitive/private field.
- Safe outbox payload and deterministic deduplication.

### Real PostgreSQL integration tests

- Two concurrent physical assignments: exactly one commit.
- Assignment racing archive/transfer: only one valid outcome.
- Two concurrent returns: exactly one terminal write and one notification set.
- Concurrent last-seat allocation: capacity is never exceeded.
- Concurrent revoke: allocated-seat counter decrements exactly once.
- Audit or outbox failure rolls back the business mutation.
- Foreign Company/Branch/Department composite relations fail.
- Partial unique indexes and trigger backstops reject direct invalid writes.
- Waiver approval closes custody atomically and forbids self-approval.
- Direct SQL cannot resolve a clearance child unless target terminal state matches, or waive it without a matching approved maker-checker waiver; approved waiver state implies matching child/target state.
- Separation completion racing custody changes remains deterministic.
- Both EmployeeClearance and EmployeeSeparation completion paths invoke the same live Asset preflight.
- Employee Branch change racing assignment/return cannot create cross-Branch active custody.
- Physical assignment and licence allocation racing separation/deactivation serialize on Employee and cannot create terminal-Employee custody.
- Direct Department/Branch reparent and direct active-custody Employee move fail through database backstops.
- Idempotent retry returns the same result; mismatched reuse returns conflict.
- Same sensitive create request has a different ciphertext nonce but an idempotent replay returns the stored safe snapshot.
- Reminder producer instances create one dispatch/outbox row; workers claim disjoint rows with `SKIP LOCKED`.
- A worker crashing after claim is recovered; its stale completion cannot overwrite a takeover claim or create a second outbox event.
- Stale expiry dispatch is suppressed, Branch-local date is correct, and invalid timezone fails only that Branch.
- Reminder threshold boundaries, rapid allocate/revoke/resize capacity crossings, one event per downward band crossing, poison-row isolation, failed-attempt exhaustion, stale-lock recovery, and outbox/state constraints.

### HTTP/API tests

Cover these personas:

- Organization Owner.
- Company Admin.
- Central Asset Manager.
- Department Custodian.
- HR read-only/waiver approver.
- Employee self-service.
- Foreign-tenant actor.

For every endpoint, test list filtering plus direct foreign-ID access. Verify `allowedActions`, stable error code, and no secret/private-field leakage. Generic Asset read remains masked; protected exact lookup requires its dedicated permission and valid Department scope. Employee self-service remains masked and cannot address another Employee's custody.

Feature-gate tests prove V2/legacy routing from server-owned Company/Branch scope, mixed Company-context rejection, Company-wide pool containment, and denial of pilot-to-nonpilot transfers/grants. No client flag can change the selected implementation or response shape.

### Migration tests

- Clean database migration.
- Upgrade with every legacy status and custody outcome.
- Asset/Type mapping dry run and apply.
- Unmapped rows stop contract migration.
- Duplicate identifiers and invalid hierarchy stop constraint validation.
- Missing Hardware serial/Location location/Card encrypted input/Licence pool input, mapped open-custody Branch mismatch, or inactive row without archive evidence stops contract migration.
- Existing non-terminal clearances reconcile to one ASSET summary and one child per live target; duplicate summaries or terminal-clearance/live-custody contradictions stop migration.
- Invalid clearance summary/Employee/target links are rejected by deferred trigger.
- Re-running migration/backfill is safe and produces no duplicates.
- Existing legacy assignment index is proven to use `status + returnedDate` before contract and `custodyStatus + closedAt` afterward.
- Legacy Asset/custody mirrors remain correct for every V2 transition during the compatibility window.

## 16. Implementation order and release gates

1. Fix current Asset P1 scoping, DTO, status, transaction, and Employee-eligibility defects.
2. Merge the API types, permissions, error catalog, and state-machine contract.
3. Apply expand migration and deploy dual-compatible backend with Asset V2 disabled.
4. Implement Department access and paginated read APIs.
5. Implement Category/Type/Asset command services and subtype persistence.
6. Implement physical/card custody and software allocation transactions.
7. Implement transfer, Employee request, clearance, and notification flows.
8. Update the frontend to consume the new response contract and `allowedActions`.
9. Run controlled ownership/type backfill.
10. Apply contract migration only after zero exceptions.
11. Complete real PostgreSQL, API, browser, migration, backup, and restore gates.
12. Enable for a controlled Company/Branch pilot and expand only after signed acceptance.

Production approval requires:

- No unresolved P0/P1 Asset defect.
- Every active Asset has valid Company/Branch/Department/Type classification.
- Zero custody duplication or state drift.
- Zero licence-capacity drift.
- Zero terminal Employees with active custody.
- Zero unauthorized cross-Department or cross-tenant access.
- Every mutation and its audit/outbox commit or roll back together.
- No raw licence secret, protected card identifier, private reason, or remarks in ordinary responses/logs/outbox.
- From-zero and upgrade migrations pass on the recorded release commit.
- Automated gates and real-persona UAT pass with recorded evidence.
