# Business Calendar - Stage-by-Stage Development Work Order

- **Status:** READY FOR ENGINEERING EXECUTION
- **Version:** 1.0
- **Baseline date:** 2026-08-07
- **Product:** Group ERP
- **Database:** PostgreSQL, schema `dsp_pms`
- **Functional source:** `docs/hr/business-calendar-client-proposal.md`
- **Related baseline:** `docs/hr/workforce-time-management-plan.md`
- **Related engineering plan:** `docs/development/workforce-time-management-development-work-order.md`

## Document purpose

This document is the engineering work order for implementing a common, versioned Business Calendar used by every ERP domain.

It converts the confirmed client decisions into:

- Architecture boundaries.
- Exact database intentions.
- Backend services and APIs.
- Frontend screens and workflows.
- Compatibility and migration controls.
- Stage dependencies and exit gates.
- Security, concurrency and audit requirements.
- Testing, rollout and rollback procedures.

Creating this document does not modify source code, database migrations, environment files or database data. Applying any migration to AWS RDS requires a separate reviewed deployment activity and backup evidence.

---

# 1. Confirmed functional baseline

The implementation must preserve the following client decisions.

1. Every office must have an effective Business Calendar.
2. The Company Calendar is the main-office calendar.
3. If a Company has no Branch, the Company Calendar is used directly.
4. Every Branch has a derived calendar that inherits the Company Calendar.
5. A Branch may add holidays and override inherited rules for regional requirements.
6. Branch timezone is authoritative for Branch business-date calculations.
7. Imported holidays require HR or Admin review before publication.
8. Published calendars remain editable because holidays may change after publication.
9. Published edits must preserve change history through an amendment revision; they must not silently overwrite published evidence.
10. The architecture must support all countries.
11. Initial country focus is India and the Middle East.
12. India must support state-wise holiday applicability.
13. HR and Admin can create, review, publish and amend calendars.
14. Leave, Attendance, Shift Roster and Payroll remain separate modules that consume Business Calendar results.
15. Informational events do not affect business-day calculation unless they have an explicitly authorized business-day effect.

## 1.1 Terminology

| Term | Meaning |
|---|---|
| Business Calendar | Common Company or Branch calendar configuration. |
| Company Calendar | Base calendar for the main office and inheritance source for Branch calendars. |
| Branch Calendar | Derived office calendar containing inherited rules plus Branch overrides. |
| Calendar Version | Effective-dated configuration containing Working Week rules and Business Events. |
| Published amendment | A revision created when HR or Admin edits a published calendar. |
| Business Calendar Runtime | Authoritative resolved result for an office and business date. |
| Workforce Calendar | Existing privacy-aware view that combines roster, leave, attendance and related employee information. |
| Shift Roster | Existing HR schedule that snapshots employee work expectations. |
| Work Plan | Existing project/task planning feature; it is not the Business Calendar. |

---

# 2. Scope

## 2.1 Included

- Company and Branch Business Calendars.
- Company-to-Branch inheritance.
- Branch and regional overrides.
- Branch timezone resolution.
- Calendar versions and effective dates.
- Editable published calendars through audited amendment revisions.
- Working Week configuration.
- Configurable Event Types, Categories and Sources.
- Company, Branch, Department, Employee and Project event targets.
- Holiday and working-day effects.
- Business Day Preview.
- Materialized and revisioned Business Calendar Runtime.
- Manual event entry.
- Excel, CSV and ICS import staging and review.
- Provider-neutral Government API adapter boundary.
- Integration with Leave, Attendance, Shift Roster and Workforce Calendar.
- Future-safe Payroll and Project consumer contracts.
- HR/Admin permissions.
- Audit, outbox, notification and impact tracking.
- Shadow-mode migration from existing Branch Working Days and Holidays.

## 2.2 Excluded from the initial release

- Payroll calculation.
- Automatic statutory overtime or deduction rules.
- Automatic publication of imported or Government API holidays.
- A promise to provide live Government API data for every country at launch.
- Private employee diary events.
- Complex recurring-event rules.
- Employee-created Company or Branch events.
- Automatic mutation of locked Attendance or Payroll history.
- Replacing the existing Shift Roster, Leave, Attendance or project Work Plan modules.
- Deleting the existing `holidays` or `branch_working_days` tables during initial rollout.

## 2.3 Non-blocking deployment inputs

These inputs are required before their specific rollout stage, but they do not block foundation development:

- Exact Middle East countries required for the first production rollout.
- Approved Government holiday provider per country.
- API authentication, licensing and rate limits.
- Whether maker-checker separation is mandatory for each tenant.
- Client-specific colours and display labels for custom event metadata.

---

# 3. Current-state compatibility report

The existing implementation already includes:

- `Company` and `Branch`.
- Branch `countryCode`, `state`, `city` and optional `timezone`.
- `BranchWorkingDay` with weekday, working status and `DayPortion`.
- `Holiday` with Company scope, optional Branch scope, date, type and `DayPortion`.
- Shift Roster generation using Branch Working Days and Holidays.
- Workforce Calendar aggregation using Holidays, Leave, Attendance and Shift Roster entries.
- Leave day calculation using existing Holiday and Branch Working Day data.
- Attendance snapshots and Attendance Period locking.
- Existing holiday and calendar permissions.
- Business audit, outbox and persistent notification foundations.

The current implementation does not provide:

- A common Company/Branch Business Calendar entity.
- Calendar versioning.
- Company-to-Branch inheritance as a first-class model.
- Published-calendar amendment history.
- Configurable event metadata.
- Business-day-effect validation.
- Import batches and review workflow.
- A single runtime resolver consumed by all modules.
- Runtime revision history.
- Impact analysis for changes to published dates.

## 3.1 Compatibility rule

The new module must be introduced additively and initially run in shadow mode.

Existing operational consumers must continue using the legacy Holiday and Branch Working Day logic until:

1. Existing data is mapped into draft Business Calendars.
2. Runtime parity has been measured.
3. Differences have been reviewed.
4. HR validates the office calendar.
5. The office is explicitly switched from `LEGACY` to `ACTIVE`.

No “big bang” replacement is permitted.

---

# 4. Architecture decisions

## 4.1 Common ERP ownership

Create a standalone NestJS `BusinessCalendarModule`.

It is a common platform module, not a child of Leave, Attendance or Shift Roster.

The module owns:

- Calendar configuration.
- Versions.
- Working Week rules.
- Business Events.
- Inheritance and override resolution.
- Publication and amendments.
- Runtime generation.
- Imports.
- Calendar impact records.

Consumer modules own their transactions:

- Leave owns Leave Requests and balance effects.
- Attendance owns punches, classifications and periods.
- Shift Roster owns employee schedule snapshots.
- Payroll owns future payroll calculation.
- Projects own Work Plans and tasks.

## 4.2 Office model

Use one Company Calendar and zero or one derived calendar per Branch.

```text
Company Calendar
  |
  +-- Branch Calendar A
  +-- Branch Calendar B
  +-- Branch Calendar C
```

The Branch Calendar stores only Branch-specific versions, rules and events. It does not duplicate all inherited Company records.

When a Company version changes, Branches inherit the new Company result automatically unless a Branch override controls the same date or rule.

## 4.3 Time model

- Store timestamps in UTC.
- Store business dates in PostgreSQL `date` columns.
- Use Branch IANA timezone for Branch calculations.
- Use Company Calendar default timezone when no Branch exists.
- Never derive a business date from the backend server timezone.
- All-day events remain attached to their intended local date.
- Timed events store UTC timestamps and an applicable timezone.
- Historical consumer records retain runtime and schedule snapshots.

## 4.4 Published edit model

The UI may show **Edit published calendar**.

Internally, published records remain immutable:

1. The service clones the effective published version into an amendment draft.
2. HR or Admin edits the amendment draft.
3. The system calculates impact.
4. The actor supplies a reason and effective date.
5. Publication creates a new published version.
6. The previous version is superseded only for the new version's effective range.
7. Runtime rows receive a new revision.
8. The complete operation, audit and outbox event commit transactionally.

This satisfies the client requirement for editable published calendars without losing history.

## 4.5 Runtime model

Operational consumers call one exported service:

```ts
BusinessCalendarRuntimeService.resolveBusinessDay({
  companyId,
  branchId,
  businessDate,
});
```

The result includes:

- Working or non-working.
- Full Day, First Half or Second Half.
- Effective timezone.
- Company and Branch Calendar identifiers.
- Company and Branch Version identifiers.
- Controlling event or override.
- Human-readable reason.
- Runtime revision identifier.

Redis may cache runtime results but is never the source of truth.

## 4.6 Informational events

Meetings, celebrations, training and similar events can appear in calendar views without changing:

- Leave chargeable days.
- Shift Roster day type.
- Attendance classification.
- Overtime eligibility.

Only an authorized business-day effect contributes to runtime calculation.

---

# 5. Migration Impact Report

## 5.1 Migration identity

- Proposed migration name: `business_calendar_foundation`
- Migration type: additive with controlled compatibility backfill.
- Target schema: `dsp_pms`.
- Historical data deletion: prohibited.
- Existing public API removal: prohibited.
- Automatic AWS RDS execution: prohibited.

## 5.2 Risk classification

Overall migration and rollout risk is **high** because the final module becomes an input to Leave, Attendance and Shift Roster calculations.

The first database migration is structurally additive. Most operational risk occurs during consumer cutover, not table creation.

## 5.3 Required pre-migration evidence

Capture:

- Git commit.
- Prisma validation result.
- Prisma migration status.
- Applied migration count and checksums.
- Database name and active schema.
- PostgreSQL version.
- Counts for Companies, Branches, Branch Working Days and Holidays.
- Branches missing country, subdivision or timezone.
- Distinct Holiday types.
- Duplicate Company/Branch holidays.
- Invalid or ambiguous Holiday dates.
- Companies without Branches.
- Branches with no Working Week rows.
- Branches with incomplete weekday configuration.
- Existing published or locked Shift Rosters.
- Existing locked Attendance Periods.
- Verified database snapshot or logical backup evidence.

Stop if the target is not the intended disposable or approved environment.

## 5.4 Compatibility commitments

- Existing Holiday identifiers remain valid during transition.
- Existing Branch Working Days remain unchanged.
- Existing Shift Roster entries remain immutable snapshots.
- Existing Attendance classifications are not recalculated.
- Existing approved Leave transactions are not silently recalculated.
- Existing API response envelope remains `{ "success": true, "data": ... }`.
- Out-of-scope identifiers continue returning `404`.
- No sample calendar, event, holiday or runtime records are created in production.

---

# 6. Exact database design

The final schema must be reviewed against the generated Prisma migration SQL before implementation. The following is the required logical design.

## 6.1 New enums

### `BusinessCalendarScope`

- `COMPANY`
- `BRANCH`

### `BusinessCalendarRuntimeMode`

- `LEGACY`
- `SHADOW`
- `ACTIVE`

### `BusinessCalendarVersionStatus`

- `DRAFT`
- `IN_REVIEW`
- `PUBLISHED`
- `SUPERSEDED`
- `RETIRED`

### `BusinessCalendarRuleMode`

- `DEFINE`
- `OVERRIDE`

### `BusinessDayEffect`

- `NONE`
- `NON_WORKING_DAY`
- `WORKING_DAY_OVERRIDE`
- `FIRST_HALF_NON_WORKING`
- `SECOND_HALF_NON_WORKING`

### `BusinessDayStatus`

- `WORKING`
- `NON_WORKING`

### `CalendarEventTargetType`

- `COMPANY`
- `BRANCH`
- `DEPARTMENT`
- `EMPLOYEE`
- `PROJECT`

### `CalendarSourceKind`

- `MANUAL`
- `EXCEL`
- `CSV`
- `ICS`
- `REST_API`
- `GOVERNMENT_API`
- `MIGRATION`

### `CalendarImportStatus`

- `UPLOADED`
- `VALIDATED`
- `REVIEW_REQUIRED`
- `APPROVED`
- `REJECTED`
- `PUBLISHED`
- `FAILED`

### `CalendarImportRowStatus`

- `VALID`
- `DUPLICATE`
- `CHANGED`
- `INVALID`
- `SELECTED`
- `SKIPPED`
- `PUBLISHED`

### `CalendarImpactStatus`

- `PENDING`
- `ACKNOWLEDGED`
- `RESOLVED`
- `IGNORED`

The existing `DayPortion` enum remains authoritative.

## 6.2 New table: `business_calendars`

Purpose: one common Calendar entity per Company main office or Branch office.

Required columns:

- `id`
- `company_id`
- `branch_id`, nullable for Company Calendar
- `parent_calendar_id`, nullable for Company Calendar
- `scope`
- `scope_key`
- `calendar_code`
- `calendar_name`
- `default_timezone`
- `runtime_mode`, default `LEGACY`
- `is_active`
- `created_by_user_id`
- `updated_by_user_id`
- `created_at`
- `updated_at`

Required rules:

- `scope_key` is unique and server generated:
  - `COMPANY:<company UUID>`
  - `BRANCH:<branch UUID>`
- Company Calendar has no Branch and no parent.
- Branch Calendar has a Branch and a parent Company Calendar.
- Parent and child belong to the same Company.
- Inheritance cycles are rejected.
- Branch belongs to the same Company.
- One calendar exists per office scope.
- Calendar history uses `ON DELETE RESTRICT`.

## 6.3 New table: `business_calendar_versions`

Purpose: effective-dated, reviewable configuration revisions.

Required columns:

- `id`
- `calendar_id`
- `version_number`
- `status`
- `effective_from`
- `effective_to`, nullable
- `amends_version_id`, nullable
- `change_reason`, nullable until amendment publication
- `optimistic_version`, default `1`
- `content_checksum`
- `created_by_user_id`
- `submitted_by_user_id`, nullable
- `submitted_at`, nullable
- `reviewed_by_user_id`, nullable
- `reviewed_at`, nullable
- `published_by_user_id`, nullable
- `published_at`, nullable
- `superseded_at`, nullable
- `created_at`
- `updated_at`

Required rules:

- Positive version numbers.
- Unique Calendar and version number.
- Effective end cannot precede effective start.
- Published effective ranges cannot overlap for the same Calendar.
- Published content is immutable.
- Editing a published calendar creates a new amendment version.
- State transitions use optimistic concurrency.
- Publication occurs under a Calendar-specific PostgreSQL advisory lock.

## 6.4 New table: `business_calendar_working_week_rules`

Purpose: Company Working Week definitions and optional Branch overrides.

Required columns:

- `id`
- `calendar_version_id`
- `day_of_week`, `0` through `6`
- `rule_mode`
- `is_working_day`
- `day_portion`
- `reason`, required for Branch override
- `created_at`
- `updated_at`

Required rules:

- Unique Version and weekday.
- Company versions define all seven weekdays before publication.
- Branch versions may contain only the weekdays being overridden.
- Missing Branch weekday rules inherit the Company rule.
- Shift start, end and break times remain owned by the Shift module.

## 6.5 New table: `business_calendar_event_types`

Purpose: lookup-driven event behaviour.

Required columns:

- `id`
- `company_id`, nullable for protected global types
- `scope_key`
- `event_type_code`
- `event_type_name`
- `description`
- `allows_business_day_effect`
- `is_system`
- `is_active`
- `display_order`
- `color_token`
- `icon_key`
- `created_at`
- `updated_at`

Seed protected global types:

- `HOLIDAY`
- `CELEBRATION`
- `MEETING`
- `TRAINING`
- `MAINTENANCE`
- `SHUTDOWN`
- `PAYROLL`
- `AUDIT`
- `CUSTOM`

`HOLIDAY` cannot be deleted or configured to disallow its defined business-day capabilities.

## 6.6 New table: `business_calendar_event_categories`

Required columns:

- `id`
- `company_id`, nullable for protected global categories
- `scope_key`
- `category_code`
- `category_name`
- `description`
- `is_system`
- `is_active`
- `display_order`
- `color_token`
- `created_at`
- `updated_at`

Seed global categories:

- `GOVERNMENT`
- `COMPANY`
- `REGIONAL`
- `OPERATIONAL`
- `SYSTEM`
- `CUSTOM`

## 6.7 New table: `business_calendar_event_sources`

Required columns:

- `id`
- `company_id`, nullable for protected global sources
- `scope_key`
- `source_code`
- `source_name`
- `source_kind`
- `description`
- `is_system`
- `is_active`
- `display_order`
- `created_at`
- `updated_at`

Seed global sources:

- `MANUAL`
- `EXCEL`
- `CSV`
- `ICS`
- `REST_API`
- `GOVERNMENT_API`
- `MIGRATION`

Credentials and provider secrets must not be stored in this table.

## 6.8 New table: `business_calendar_events`

Purpose: version-owned holiday and informational events.

Required columns:

- `id`
- `calendar_version_id`
- `company_id`
- `event_type_id`
- `event_category_id`
- `event_source_id`
- `event_code`, nullable
- `event_name`
- `description`, nullable
- `all_day`
- `start_date`
- `end_date`
- `starts_at`, nullable
- `ends_at`, nullable
- `event_timezone`, nullable
- `business_day_effect`
- `paid_holiday`
- `is_protected`
- `external_reference`, nullable
- `source_payload_hash`, nullable
- `legacy_holiday_id`, nullable and unique
- `created_by_user_id`
- `created_at`
- `updated_at`

Required rules:

- End date cannot precede start date.
- All-day events use business dates.
- Timed events require start, end and timezone.
- `paid_holiday` is allowed only for a non-working holiday effect.
- Informational event types default to `NONE`.
- An event type must allow the selected business-day effect.
- A protected statutory holiday override requires elevated permission and reason.
- Duplicate active business-affecting events for the same target, date and portion are rejected unless explicitly resolved.

## 6.9 New table: `business_calendar_event_targets`

Purpose: safe event applicability without unvalidated polymorphic identifiers.

Required columns:

- `id`
- `event_id`
- `target_type`
- `company_id`
- `branch_id`, nullable
- `department_id`, nullable
- `employee_id`, nullable
- `project_id`, nullable
- `created_at`

Required rules:

- Exactly one target matching `target_type`.
- Every target belongs to the Event Company.
- Branch, Department, Employee and Project identifiers must be inside the active tenant scope.
- Business-day effects are supported only for Company or Branch targets in version 1.
- Department, Employee and Project targets are informational in version 1.
- Unique Event and target combination.

## 6.10 New table: `business_calendar_amendments`

Purpose: explicit record of edits initiated from a published calendar.

Required columns:

- `id`
- `calendar_id`
- `previous_version_id`
- `amendment_version_id`
- `effective_date`
- `reason`
- `previous_checksum`
- `new_checksum`
- `impact_summary`
- `created_by_user_id`
- `published_by_user_id`
- `published_at`
- `created_at`

Updates and deletes are prohibited through service rules.

## 6.11 New table: `business_calendar_runtime_days`

Purpose: revisioned operational result for an office and business date.

Required columns:

- `id`
- `office_scope_key`
- `company_id`
- `branch_id`, nullable
- `calendar_id`
- `business_date`
- `runtime_revision`
- `is_current`
- `company_version_id`
- `branch_version_id`, nullable
- `timezone`
- `day_status`
- `day_portion`
- `reason_code`
- `reason_text`
- `controlling_event_id`, nullable
- `resolution_trace`
- `source_checksum`
- `resolved_at`
- `superseded_at`, nullable

Required rules:

- Unique office, date and runtime revision.
- A partial unique index permits only one current row per office and date.
- Previous revisions are retained.
- Runtime rebuild supersedes rather than deletes prior rows.
- Runtime rows use `ON DELETE RESTRICT`.
- `resolution_trace` contains safe identifiers and rule codes, not sensitive employee data.

## 6.12 New table: `business_calendar_impacts`

Purpose: track operational records that require review after a published amendment.

Required columns:

- `id`
- `amendment_id`
- `company_id`
- `branch_id`, nullable
- `business_date`
- `entity_type`
- `entity_id`
- `impact_code`
- `impact_summary`
- `status`
- `resolved_by_user_id`, nullable
- `resolved_at`, nullable
- `resolution_reason`, nullable
- `created_at`
- `updated_at`

Tracked entity types initially include:

- Leave Request
- Shift Roster
- Attendance Period
- Payroll Period when introduced

The table stores sanitized summaries. Sensitive Leave reasons or employee notes are prohibited.

## 6.13 New table: `business_calendar_import_batches`

Required columns:

- `id`
- `company_id`
- `calendar_id`
- `calendar_version_id`
- `event_source_id`
- `source_kind`
- `source_file_name`, sanitized
- `source_object_key`, nullable
- `source_checksum`
- `status`
- `total_rows`
- `valid_rows`
- `duplicate_rows`
- `changed_rows`
- `invalid_rows`
- `uploaded_by_user_id`
- `reviewed_by_user_id`, nullable
- `reviewed_at`, nullable
- `created_at`
- `updated_at`

## 6.14 New table: `business_calendar_import_rows`

Required columns:

- `id`
- `import_batch_id`
- `row_number`
- `external_reference`, nullable
- `normalized_payload`
- `payload_hash`
- `status`
- `validation_errors`
- `candidate_event_id`, nullable
- `created_at`
- `updated_at`

Import rows are staging records and never affect runtime directly.

## 6.15 New table: `leave_request_calendar_days`

Purpose: preserve the Business Calendar result used to calculate each Leave Request.

Required columns:

- `id`
- `leave_request_id`
- `business_date`
- `runtime_day_id`
- `day_portion`
- `charged_days`
- `calculation_status`
- `created_at`

Required rules:

- Unique Leave Request and business date.
- `charged_days` is non-negative and no greater than one.
- Approval and Leave ledger changes use the same transaction.
- Recalculation creates a reviewed replacement calculation; approved history is not silently overwritten.

## 6.16 Existing table changes

| Table | Additive change |
|---|---|
| `branches` | Add normalized `country_subdivision_code`; keep existing country, state, city and timezone fields. |
| `holidays` | Add optional unique link to the migrated Business Calendar Event or expose the relation from the Event side. Do not remove existing columns. |
| `shift_roster_entries` | Add optional `business_calendar_runtime_day_id` snapshot reference. |
| `attendances` | Add optional `business_calendar_runtime_day_id` for unscheduled or direct runtime classification paths. |
| `companies` | Add Prisma inverse relations only. |
| `branches` | Add Prisma inverse relations for calendars, runtime and impacts. |
| `users` | Add Prisma inverse relations for calendar lifecycle actors. |
| `leave_requests` | Add inverse relation to Leave Request Calendar Days. |

Country, subdivision and timezone remain nullable during migration so existing tenants are not broken. Calendar publication is blocked until the applicable office location is complete.

## 6.17 Indexes and SQL constraints

Migration SQL must include:

- Partial unique current-runtime index.
- Published-version effective-range overlap protection.
- Scope and parent consistency checks.
- Branch-to-Company consistency checks.
- Valid weekday check.
- Valid date range checks.
- Paid-Holiday and business-day-effect checks.
- Exactly-one-event-target check.
- Non-negative Leave charged-day check.
- Runtime date lookup indexes.
- Company/Branch/date event indexes.
- Import checksum and external-reference indexes.
- Impact status indexes.

No new workforce history table uses cascade deletion.

---

# 7. Runtime resolution rules

## 7.1 Inputs

- Company identifier.
- Optional Branch identifier.
- Business date.
- Optional preview Version identifiers.

## 7.2 Resolution sequence

1. Validate active session tenant scope.
2. Validate Company.
3. Validate Branch belongs to Company when supplied.
4. Resolve office Calendar:
   - Branch Calendar when Branch exists.
   - Company Calendar otherwise.
5. Resolve timezone:
   - Branch timezone.
   - Company Calendar default timezone when no Branch exists.
6. Resolve effective Company published version.
7. Resolve effective Branch published version, when present.
8. Start from Company Working Week.
9. Apply Company dated business-day event.
10. Apply Branch Working Week override.
11. Apply Branch dated business-day event or override.
12. Reject unresolved conflicts.
13. Produce result and resolution trace.
14. Materialize a new runtime revision when the checksum changed.

## 7.3 Precedence

```text
Branch dated override or Branch holiday
        overrides
Branch Working Week override
        overrides
Company dated override or Company holiday
        overrides
Company Working Week
```

At one scope and date, ambiguous business-day effects must be resolved before publication.

## 7.4 Company updates and Branch inheritance

When a Company version is amended:

- A Branch with no conflicting override inherits the new result.
- A Branch with an explicit dated override keeps its Branch result.
- A Branch Working Week override remains in force.
- Runtime differences are included in the publication impact preview.

## 7.5 Historical integrity

- Existing published or locked Shift Roster entries keep their runtime snapshot.
- Locked Attendance Periods are not recalculated automatically.
- Approved Leave calculations are not silently rewritten.
- Open and future records are listed as impacts.
- The current calendar view may show an amended holiday while historical transactions retain the version originally used.

---

# 8. Backend API plan

All successful responses retain:

```json
{
  "success": true,
  "data": {}
}
```

## 8.1 Calendar administration

- `GET /business-calendars`
- `POST /business-calendars`
- `GET /business-calendars/:calendarId`
- `PATCH /business-calendars/:calendarId`
- `GET /business-calendars/:calendarId/inheritance`
- `GET /business-calendars/:calendarId/versions`
- `POST /business-calendars/:calendarId/versions`
- `GET /business-calendar-versions/:versionId`
- `PATCH /business-calendar-versions/:versionId`
- `PUT /business-calendar-versions/:versionId/working-week`
- `POST /business-calendar-versions/:versionId/submit-review`
- `POST /business-calendar-versions/:versionId/return-draft`
- `POST /business-calendar-versions/:versionId/publish`
- `POST /business-calendar-versions/:versionId/start-amendment`
- `POST /business-calendar-versions/:versionId/preview-impact`

## 8.2 Business Events

- `GET /business-calendar-versions/:versionId/events`
- `POST /business-calendar-versions/:versionId/events`
- `GET /business-calendar-events/:eventId`
- `PATCH /business-calendar-events/:eventId`
- `DELETE /business-calendar-events/:eventId`

Published events cannot be updated directly. The caller must operate on an amendment Version.

## 8.3 Metadata

- `GET /business-calendar-metadata/event-types`
- `POST /business-calendar-metadata/event-types`
- `PATCH /business-calendar-metadata/event-types/:id`
- `GET /business-calendar-metadata/categories`
- `POST /business-calendar-metadata/categories`
- `PATCH /business-calendar-metadata/categories/:id`
- `GET /business-calendar-metadata/sources`
- `POST /business-calendar-metadata/sources`
- `PATCH /business-calendar-metadata/sources/:id`

Protected system metadata cannot be deleted.

## 8.4 Runtime and preview

- `GET /business-calendar/runtime/day`
- `GET /business-calendar/runtime/range`
- `POST /business-calendar/runtime/preview`
- `POST /business-calendar/runtime/rebuild`
- `GET /business-calendar/impacts`
- `POST /business-calendar/impacts/:impactId/resolve`

Runtime rebuild is an administrative operation and accepts bounded date ranges only.

## 8.5 Imports

- `POST /business-calendar-imports`
- `GET /business-calendar-imports`
- `GET /business-calendar-imports/:batchId`
- `POST /business-calendar-imports/:batchId/validate`
- `POST /business-calendar-imports/:batchId/review`
- `POST /business-calendar-imports/:batchId/apply-to-draft`
- `POST /business-calendar-imports/:batchId/reject`

Applying an import creates or updates events in a Draft Version. It does not publish the calendar.

## 8.6 Calendar views

- `GET /business-calendar/company-view`
- `GET /business-calendar/branch-view`
- `GET /me/business-calendar`

The existing Workforce Calendar endpoints remain and later consume the new runtime.

## 8.7 Stable error codes

- `BUSINESS_CALENDAR_NOT_CONFIGURED`
- `BUSINESS_CALENDAR_TIMEZONE_REQUIRED`
- `BUSINESS_CALENDAR_LOCATION_REQUIRED`
- `BUSINESS_CALENDAR_VERSION_OVERLAP`
- `BUSINESS_CALENDAR_VERSION_NOT_EDITABLE`
- `BUSINESS_CALENDAR_AMENDMENT_REQUIRED`
- `BUSINESS_CALENDAR_CONFLICT`
- `BUSINESS_CALENDAR_IMPACT_REVIEW_REQUIRED`
- `BUSINESS_CALENDAR_IMPORT_REVIEW_REQUIRED`
- `BUSINESS_CALENDAR_INHERITANCE_INVALID`
- `BUSINESS_CALENDAR_PROTECTED_OVERRIDE`
- `BUSINESS_CALENDAR_STALE_VERSION`
- `BUSINESS_CALENDAR_RUNTIME_NOT_READY`

Use `409` for stale or concurrent state transitions, `400` for invalid configuration and `404` for out-of-scope identifiers.

---

# 9. Permission plan

Add:

- `calendar.business.read`
- `calendar.business.manage`
- `calendar.business.review`
- `calendar.business.publish`
- `calendar.business.amend`
- `calendar.business.import`
- `calendar.business.runtime.preview`
- `calendar.business.protected-override`

## 9.1 Initial role mapping

| Role | Mapping |
|---|---|
| Organization Owner | All Business Calendar permissions |
| Company Administrator | All Business Calendar permissions |
| HR Manager | Read, manage, review, publish, amend, import and preview |
| Project Manager | No administration permission; applicable calendar viewing continues through existing view permissions |
| Employee | Own applicable view only |
| Custom Role | No new permission automatically |

The permission model keeps Manage and Publish separate even when HR and Admin initially receive both. This permits maker-checker enforcement later without another schema change.

## 9.2 Security rules

- Every query is restricted by Company Group, Company and Branch scope.
- Client filters cannot widen session scope.
- A non-global session without organization context returns no tenant data.
- A Branch identifier from another Company returns `404`.
- Department, Employee and Project targets are validated against tenant scope.
- Imported files are size-limited, type-validated and scanned according to deployment policy.
- File names, payloads and event descriptions are not written to application logs.
- Calendar reasons may appear in business audit but not general request logs.

---

# 10. Stage dependency map

| Stage | Name | Depends on | May run in parallel with |
|---|---|---|---|
| 0 | Baseline and compatibility audit | None | UI wireframes |
| 1 | Database and permission foundation | Stage 0 | Read-only UX prototypes |
| 2 | Calendar administration and tenant security | Stage 1 | Metadata UI |
| 3 | Version, Working Week and Event editor | Stage 2 | Import parser spike |
| 4 | Publication, amendments and Runtime | Stage 3 | Calendar-view UI |
| 5 | Legacy backfill and shadow comparison | Stage 4 | Import workflow |
| 6 | Workforce consumer integration | Stage 5 parity gate | Admin UI completion |
| 7 | Imports and geographic packs | Stage 3, Runtime contract | Stage 6 |
| 8 | Complete frontend rollout | Stages 4, 6 and 7 interfaces | QA automation |
| 9 | Production-readiness testing and UAT | Stages 1-8 | Documentation |
| 10 | Controlled production rollout | Stage 9 sign-off | None |

No consumer integration starts before the Runtime contract and shadow-parity tooling are complete.

---

# 11. Stage 0 - Baseline and compatibility audit

## Objective

Prove the current data and consumer behaviour before designing the migration.

## Backend and database work

- Inventory existing Company, Branch, Working Day and Holiday data.
- Identify Companies without Branches.
- Identify missing or invalid IANA timezones.
- Normalize country and subdivision requirements without changing data.
- Record existing Holiday type values.
- Detect duplicate and conflicting Holidays.
- Map all current Holiday consumers.
- Map all Branch Working Day consumers.
- Confirm Attendance and Shift Roster snapshot behaviour.
- Confirm migration checksums and applied migration status.
- Document legacy API contracts and UI fields.

## Frontend work

- Capture current Holidays, Branch Working Days, Shift Roster and Workforce Calendar flows.
- Produce wireframes for:
  - Calendar list.
  - Company/Branch inheritance view.
  - Calendar Version workspace.
  - Event editor drawer.
  - Published amendment flow.
  - Business Day Preview.
  - Import review.

## Deliverables

- Migration Impact Report with actual counts.
- Current consumer map.
- Data-quality report.
- Approved Prisma model diagram.
- API contract draft.
- UI flow review.
- Test fixture specification.

## Exit gate

- No unknown Holiday or Working Day consumer remains.
- Location gaps are quantified.
- Migration checksum baseline is clean or separately remediated.
- Database design receives engineering review.

---

# 12. Stage 1 - Database and permission foundation

## Objective

Create additive schema and authorization foundations without changing operational behaviour.

## Database work

- Add new enums and tables.
- Add normalized Branch subdivision field.
- Add lifecycle actor relations.
- Add indexes and SQL checks.
- Seed protected global Event Types, Categories and Sources idempotently.
- Add permission catalog entries idempotently.
- Map standard roles.
- Keep every Business Calendar in `LEGACY` mode.
- Create no production sample events or runtime days.

## Backend work

- Generate Prisma client.
- Add repository helpers and transactional test factories.
- Add Calendar scope-key generator.
- Add IANA timezone and ISO country/subdivision validators.
- Add common error codes.
- Add permission route-policy entries.

## Tests

- Apply migration to an empty disposable PostgreSQL database.
- Apply migration to a production-shaped disposable snapshot.
- Verify all new objects are under `dsp_pms`.
- Test database checks.
- Test permission catalog idempotency.
- Confirm existing APIs and tests remain unchanged.

## Exit gate

- Prisma validation passes.
- Empty and upgrade migration tests pass.
- No operational query reads the new tables.
- No AWS RDS destructive test is run.

---

# 13. Stage 2 - Calendar administration and tenant security

## Objective

Implement Company and Branch Calendar creation, inheritance and safe administration.

## Backend work

- Create `BusinessCalendarModule`.
- Implement Calendar list, detail, create and update.
- Create one Company Calendar through an idempotent provisioning service.
- Create a derived Branch Calendar when a Branch is provisioned.
- For existing Companies and Branches, use a dry-run maintenance command before creation.
- Prevent cross-Company parent selection.
- Prevent inheritance cycles.
- Validate Calendar code and scope key.
- Validate Branch country, subdivision and timezone readiness.
- Write Calendar mutations and business audits in one Prisma transaction.
- Emit sanitized outbox events after successful commit.

## Frontend work

- Add common Administration navigation entry: **Business Calendar**.
- Add Calendar list grouped by Company.
- Show the Company Calendar and inherited Branch calendars.
- Display configuration status:
  - Ready.
  - Missing timezone.
  - Missing location.
  - Legacy mode.
  - Shadow mode.
  - Active.
- Use the shared FormSheet pattern for Calendar setup.
- Show inherited parent without allowing cross-Company selection.

## Tests

- Company with no Branch.
- Company with multiple Branches.
- Branch parent belongs to another Company.
- Missing tenant context.
- Company Group, Company and Branch isolation.
- Concurrent provisioning is idempotent.
- Calendar deactivation preserves history.

## Exit gate

- Every test office resolves to at most one Calendar.
- Cross-tenant tests pass.
- No calendar has an invalid parent.
- Existing Company and Branch screens remain compatible.

---

# 14. Stage 3 - Versions, Working Week and Business Events

## Objective

Deliver the complete Draft editing experience without activating runtime.

## Backend work

- Implement Version create, list, detail and update.
- Implement state transitions:
  - Draft to In Review.
  - In Review to Draft.
- Implement Company Working Week.
- Implement sparse Branch Working Week overrides.
- Implement Event Type, Category and Source lookups.
- Implement Business Event CRUD.
- Implement event targets with tenant validation.
- Validate Holiday-only metadata.
- Validate date and time ranges.
- Prevent direct mutation of published content.
- Calculate deterministic Version checksum.
- Write mutation and audit in one transaction.

## Frontend work

- Add Calendar Version workspace.
- Show lifecycle, effective dates and inheritance.
- Add seven-day Working Week editor.
- Clearly label inherited and overridden Branch rules.
- Add month/list Business Event views.
- Use right-side FormSheet Event editor.
- Show Holiday-only metadata conditionally.
- Add metadata administration for HR/Admin.
- Show conflict and validation summaries.
- Support keyboard navigation and mobile layouts.

## Tests

- Complete and incomplete Company Working Week.
- Sparse Branch override.
- Company event inherited by Branch.
- Branch event applies only to Branch.
- Department/Employee/Project event remains informational.
- Informational event cannot accidentally affect business-day runtime.
- Half-day Holiday validation.
- Timed-event timezone validation.
- Cross-tenant event target rejection.
- Protected metadata cannot be deleted.

## Exit gate

- HR/Admin can prepare a valid Draft Version.
- Draft Version can enter review.
- No Draft affects live Leave, Attendance or Shift Roster behaviour.

---

# 15. Stage 4 - Publication, editable amendments and Runtime

## Objective

Publish versioned calendars safely and provide one authoritative Runtime resolver.

## Backend work

- Implement Business Day Preview against Draft or Published versions.
- Implement deterministic Runtime resolution.
- Implement publication under a PostgreSQL advisory lock.
- Add optimistic state predicates so one concurrent publication wins.
- Validate non-overlapping effective ranges.
- Materialize Runtime rows for a bounded configured range.
- Extend runtime on demand and through an idempotent scheduled job.
- Implement **Edit published calendar** as an amendment clone.
- Require amendment reason and effective date.
- Calculate affected dates and records.
- Create Business Calendar Impact records.
- Publish new Runtime revisions transactionally.
- Write audit and outbox event in the same transaction.
- Invalidate only relevant post-commit caches.
- Preserve previous Runtime revisions.

## Frontend work

- Add Business Day Preview page.
- Display the complete resolution trace:
  - Company Working Week.
  - Company event.
  - Branch Working Week override.
  - Branch event or override.
- Add Publish confirmation.
- Add Edit Published Calendar action.
- Show amendment reason and effective-date fields.
- Show impact counts before publication.
- Show records requiring follow-up.
- Restore focus correctly after drawers and dialogs.

## Concurrency tests

- Two actors publish the same Version.
- Two actors start competing amendments.
- Stale Version update.
- Runtime rebuild while publication occurs.
- Duplicate outbox delivery.

Exactly one valid state transition must succeed; later calls return `409`.

## Exit gate

- Published Calendar edits are available through amendments.
- Publication never overwrites history.
- Runtime result is deterministic and revisioned.
- Impact preview is mandatory for an amendment.

---

# 16. Stage 5 - Legacy backfill and shadow comparison

## Objective

Map current data into the new model and prove parity before any consumer cutover.

## Maintenance command

Create a dry-run-by-default command that:

- Requires explicit `--apply`.
- Requires expected Company, Branch, Working Day and Holiday counts.
- Verifies database name and schema.
- Refuses production execution without an additional deployment guard.
- Is idempotent.
- Writes safe audit evidence.
- Never deletes legacy records.
- Never guesses missing timezone or subdivision.

## Backfill behaviour

1. Create a Company Calendar for each active Company.
2. Create a Branch Calendar for each active Branch.
3. Set all calendars to `LEGACY`.
4. Convert Company Holidays into Company Calendar migration events.
5. Convert Branch Holidays into Branch Calendar migration events.
6. Preserve Holiday identifiers through `legacy_holiday_id`.
7. Convert existing Branch Working Days into Branch migration rules.
8. Do not infer a Company Working Week from one Branch.
9. Flag Company Calendars requiring HR Working Week configuration.
10. Map existing Holiday portion to the matching business-day effect.
11. Create no published data without an explicit reviewed activation step.

## Shadow mode

For an HR-reviewed office:

- Publish the migrated Version.
- Change runtime mode from `LEGACY` to `SHADOW`.
- Calculate legacy and new results for:
  - The previous 12 months.
  - The current year.
  - At least the next 18 months.
- Store or export a sanitized parity report.
- Categorize differences:
  - Missing timezone.
  - Missing Company Working Week.
  - Holiday precedence.
  - Half-day handling.
  - Invalid legacy date.
  - Legitimate new Branch override.

## Exit gate

- Every intended cutover office has zero unexplained parity differences.
- HR signs off the Calendar and location.
- No consumer is switched automatically.

---

# 17. Stage 6 - Workforce consumer integration

## Objective

Move existing consumers to the Runtime one at a time, with an office-level rollback switch.

## 17.1 Shift Roster

- Replace direct Holiday and Branch Working Day calculation with Runtime resolution when office mode is `ACTIVE`.
- Keep `LEGACY` and `SHADOW` behaviour available.
- Store Runtime Day identifier on generated roster entries.
- Preserve manual roster overrides.
- Never regenerate a Published or Locked Roster automatically after a Calendar amendment.
- Create an impact record requiring HR review.

### Acceptance

- New Draft Roster uses amended runtime.
- Existing Published Roster remains unchanged.
- Branch half-day Holiday produces the correct roster day portion.

## 17.2 Leave

- Replace direct date exclusion logic with Runtime resolution in `ACTIVE` mode.
- Create Leave Request Calendar Day snapshots.
- Preserve existing Leave lifecycle and response contracts.
- Calculate full and half chargeable days.
- Keep balance reservation, approval and ledger writes transactional.
- When Calendar changes affect future submitted or approved Leave, create an impact record; do not silently alter the request.

### Acceptance

- Company Holiday is excluded for all inheriting Branches.
- Branch-only Holiday is excluded only for that Branch.
- First-half Holiday and second-half Leave charge correctly.
- Locked or approved history remains auditable.

## 17.3 Attendance

- Attendance continues to prefer the Published or Locked Shift Roster snapshot.
- Direct or unscheduled paths may use Runtime and store its identifier.
- Calendar amendments do not rewrite finalized Attendance.
- Open-period impacts are reported for HR review.
- Missing punches remain explicit exceptions.

### Acceptance

- Holiday and weekly-off classifications remain stable.
- Branch timezone controls the business date.
- Locked Attendance Period rejects recalculation.

## 17.4 Workforce Calendar and My Workspace

- Replace direct Holiday query with Runtime and Business Event projections.
- Continue privacy rules for Leave and Attendance.
- Show informational Company and Branch events.
- Show Department/Employee/Project events only to applicable authorized users.
- Keep source-module links; do not duplicate Leave or Attendance records as Business Events.

## 17.5 Overtime and Comp-off

- Continue using the Shift Roster and Attendance snapshots.
- Do not recalculate approved Overtime because a Calendar later changes.
- New calculations use the effective runtime through the roster.

## 17.6 Payroll and Projects

- Define read-only consumer interfaces.
- Do not implement Payroll calculation in this work order.
- Do not modify the existing Work Plan tables.

## Cutover rule

Activate one office at a time:

```text
LEGACY -> SHADOW -> ACTIVE
```

Changing an office back to `LEGACY` is permitted only before new Calendar-dependent transactions require Runtime identifiers. After that point, use a forward fix while preserving snapshots.

## Exit gate

- Leave, Shift Roster, Attendance and Workforce Calendar tests pass in Legacy and Active modes.
- Open/future impacts are visible.
- No historical transaction is silently changed.

---

# 18. Stage 7 - Imports and geographic support

## Objective

Deliver reviewed holiday ingestion while keeping providers replaceable.

## 18.1 Manual, Excel and CSV

- Publish a template with:
  - Event name.
  - Event code.
  - Date or date range.
  - Country code.
  - Subdivision code.
  - Event type.
  - Category.
  - Day portion.
  - Paid Holiday.
  - Business-day effect.
  - External reference.
- Validate MIME type, file extension and size.
- Calculate checksum.
- Normalize rows.
- Detect duplicates and changes.
- Show review summary.
- Apply selected rows only to a Draft Version.

## 18.2 ICS

- Parse all-day dates without UTC date shifting.
- Convert timed events to UTC with timezone evidence.
- Reject unsupported recurrence rules with a clear message.
- Store source UID as external reference.
- Keep imported events in Draft.

## 18.3 Government API adapter

Define:

```ts
interface GovernmentHolidayProvider {
  listJurisdictions(): Promise<Jurisdiction[]>;
  fetchHolidays(input: {
    countryCode: string;
    subdivisionCode?: string;
    year: number;
  }): Promise<NormalizedHoliday[]>;
}
```

Provider requirements:

- Idempotent import.
- Rate-limit handling.
- Retry with bounded exponential backoff.
- Source checksum.
- External reference.
- No automatic publication.
- Credentials from validated environment or secret manager.
- No credentials or response bodies in logs.

## 18.4 Geographic model

- Use ISO 3166-1 alpha-2 country codes.
- Use ISO 3166-2 subdivision codes where available.
- India requires State/Union Territory mapping.
- Middle East regional fields may represent Emirate, Province or Governorate.
- Branch timezone remains an IANA timezone.

## Exit gate

- Imports cannot affect Runtime without human review and Version publication.
- India state-wise fixture tests pass.
- At least one representative Middle East country fixture passes.
- Provider failure leaves a resumable import batch.

---

# 19. Stage 8 - Complete frontend rollout

## Objective

Deliver a professional, accessible Business Calendar experience using the existing application shell and design system.

## Routes

- `/administration/business-calendar`
- `/administration/business-calendar/[calendarId]`
- `/administration/business-calendar/[calendarId]/versions/[versionId]`
- `/administration/business-calendar/preview`
- `/administration/business-calendar/imports`

Keep the existing Holiday route during transition. After cutover, it may redirect to the Business Calendar Events view while preserving bookmarks and permission checks.

## Main workspace

Tabs:

- Offices
- Calendar Versions
- Working Week
- Business Events
- Imports
- Business Day Preview
- Change Impacts

## Required UI behaviour

- Company Calendar shown as parent.
- Branch calendars visually nested under the Company.
- Inherited values clearly labelled.
- Branch overrides visually distinguishable.
- Published Calendar displays **Edit published calendar**.
- Published edit transparently opens an amendment revision.
- Impact review is displayed before publication.
- Month, week and list views.
- Filter by Company, Branch, type, category, source and publication status.
- Branch-local date and timezone labels.
- FormSheet drawer for create/edit forms.
- Confirmation dialog for publish, protected override and amendment.
- Loading, empty, unavailable and retry states.
- No fake events, actions, charts or API results.

## Accessibility

- Keyboard-operable month and list navigation.
- Visible focus.
- Focus containment and restoration in drawers/dialogs.
- Screen-reader event labels.
- Non-colour indicators for inherited, overridden and conflict states.
- Reduced-motion support.
- No horizontal body overflow at 1440px, 1024px, 768px or 390px.

## Exit gate

- HR/Admin can complete the full Draft-to-Publish and Published-to-Amendment flows.
- A Branch user sees correct inherited and local events.
- Employee calendar privacy remains intact.

---

# 20. Stage 9 - Production-readiness testing and UAT

## 20.1 Database tests

- Empty database migration.
- Production-shaped disposable snapshot migration.
- Migration rollback rehearsal before data exists.
- Scope-key uniqueness.
- Published effective-range overlap.
- Runtime-current partial uniqueness.
- Event-target checks.
- Import idempotency.
- Amendment history immutability.

## 20.2 Business-day boundary tests

- Company with no Branch.
- Branch inherits Company weekday.
- Branch overrides weekday.
- Company full-day Holiday.
- Branch full-day Holiday.
- First-half Holiday.
- Second-half Holiday.
- Company special working-day override.
- Branch special working-day override.
- Company amendment inherited by Branch.
- Branch override remains after Company amendment.
- Conflicting events block publication.
- Leap day.
- Year boundary.
- Cross-year event.
- Overnight timed event.
- DST start and end in supported timezones.
- India State-specific holiday.
- Middle East regional holiday.

## 20.3 Published-edit tests

- Edit Published creates amendment.
- Previous Version remains unchanged.
- Reason and effective date required.
- Impact preview required.
- Open future roster produces impact.
- Published or Locked Roster is not automatically regenerated.
- Approved future Leave produces impact.
- Locked Attendance remains unchanged.
- Two simultaneous amendments return one winner and one `409`.

## 20.4 Tenant-isolation tests

Test list, detail, create, update, delete, review, publish, amendment, preview and import across:

- Company Group.
- Company.
- Branch.
- Department.
- Employee.
- Project.

Client filters must never widen active session scope.

## 20.5 Permission tests

- HR Manager.
- Company Administrator.
- Organization Owner.
- Project Manager.
- Employee.
- Custom Role with no automatic permission.
- Protected override permission.
- Manage without Publish.
- Publish without valid reviewed content.

## 20.6 Consumer integration tests

- Shift Roster in Legacy, Shadow and Active mode.
- Leave day calculation and ledger rollback.
- Attendance snapshot and locked period.
- Overtime historical stability.
- Workforce Calendar informational events.
- Employee self-service privacy.
- Company/Branch event inheritance.

## 20.7 Import tests

- Valid Excel.
- Valid CSV.
- Valid ICS.
- Duplicate file checksum.
- Duplicate event.
- Changed external event.
- Invalid country/subdivision.
- Invalid date.
- Oversized file.
- Unsupported recurrence.
- Partial row selection.
- Provider timeout and retry.
- Review required before publication.

## 20.8 Performance targets

Measure against production-shaped disposable data:

- Single-day Runtime lookup.
- 62-day range lookup.
- Roster generation for a Branch.
- Leave calculation for a long request.
- Month calendar view.
- Import validation of the approved maximum row count.

Runtime lookups must use indexed queries and bounded batches. Capture query plans for slow paths.

## 20.9 Quality gates

Backend:

```powershell
cd backend
npm.cmd run prisma:validate
npm.cmd run prisma:generate
npm.cmd run lint:check
npm.cmd run build
npm.cmd test
```

Frontend:

```powershell
cd frontend
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd run build
```

Also require:

- Disposable PostgreSQL integration suite.
- Zero frontend lint warnings.
- Zero changed-file trailing-whitespace failures.
- No destructive automated tests against AWS RDS.
- Manual keyboard and responsive verification.
- HR/Admin workflow UAT.

## Exit gate

- Technical sign-off complete.
- Business UAT complete.
- Migration and rollback evidence captured.
- No unresolved severity-1 or severity-2 defect.

---

# 21. Stage 10 - Controlled production rollout

## 21.1 Preparation

1. Confirm approved Git commit.
2. Capture Prisma migration status.
3. Capture database backup evidence.
4. Review generated migration SQL.
5. Verify permission catalog SQL.
6. Verify environment and feature flags.
7. Confirm first-wave Companies and Branches.
8. Confirm Branch locations and timezones.
9. Confirm HR/Admin rollout users.

## 21.2 Deployment

1. Deploy additive database migration.
2. Deploy backend with Calendar consumers disabled.
3. Deploy frontend with Business Calendar navigation restricted to authorized users.
4. Run post-deployment schema verification.
5. Provision Company and Branch Calendars using the guarded command.
6. Keep offices in `LEGACY`.
7. HR reviews migrated configuration.
8. Publish Calendar Versions.
9. Enable `SHADOW`.
10. Run and approve parity report.
11. Enable `ACTIVE` for one pilot office.
12. Smoke-test Leave, Shift Roster, Attendance and Calendar views.
13. Expand office by office.

## 21.3 Monitoring

Monitor:

- Runtime resolution failures.
- Parity differences.
- Missing timezone/location.
- Publication conflicts.
- Import failures.
- Outbox failures.
- Unresolved change impacts.
- Leave or Roster calculation differences.

Logs contain request IDs and safe entity identifiers only.

## 21.4 Rollback

Before office activation:

- Return office to `LEGACY`.
- Hide Business Calendar navigation if necessary.
- Preserve additive tables and audit history.

After Calendar-dependent transactions exist:

- Do not drop tables.
- Do not delete runtime revisions.
- Disable affected consumers through controlled configuration.
- Preserve transaction snapshots.
- Deploy a forward fix.

Restore from backup only for migration corruption or unrecoverable deployment failure.

Legacy Holiday and Branch Working Day tables remain available for at least two stable releases after the last office cutover.

---

# 22. Required backend files

## 22.1 Create

```text
backend/src/modules/business-calendar/
  business-calendar.module.ts
  business-calendar.controller.ts
  business-calendar.service.ts
  business-calendar-version.service.ts
  business-calendar-event.service.ts
  business-calendar-metadata.service.ts
  business-calendar-runtime.service.ts
  business-calendar-publication.service.ts
  business-calendar-amendment.service.ts
  business-calendar-impact.service.ts
  business-calendar-import.service.ts
  business-calendar-scope.service.ts
  business-calendar-lock.util.ts
  business-calendar-date.util.ts
  business-calendar.types.ts
  dto/
  providers/
  *.spec.ts

backend/scripts/
  provision-business-calendars.ts
  compare-business-calendar-runtime.ts

backend/prisma/migrations/<timestamp>_business_calendar_foundation/
  migration.sql
```

## 22.2 Modify

```text
backend/prisma/schema.prisma
backend/src/app.module.ts
backend/src/modules/auth/route-policy.ts
backend/src/modules/auth/employee-domain-scope.service.ts
backend/src/common/constants/workforce-time-contracts.ts
backend/src/modules/branch/branch.service.ts
backend/src/modules/company/company.service.ts
backend/src/modules/holiday/holiday.service.ts
backend/src/modules/shift-roster/shift-roster-generation.service.ts
backend/src/modules/shift-roster/shift-roster.service.ts
backend/src/modules/leave-policy/leave-policy-resolver.service.ts
backend/src/modules/employee-leave/leave-request.service.ts
backend/src/modules/attendance/attendance.service.ts
backend/src/modules/workforce-calendar/workforce-calendar.service.ts
backend/src/modules/self-service/self-service.service.ts
```

The exact consumer file list must be confirmed by the Stage 0 dependency search.

---

# 23. Required frontend files

## 23.1 Create

```text
frontend/features/business-calendar/
  types.ts
  service.ts
  hooks.ts
  business-calendar-workspace.tsx
  components/
  dialogs/
  forms/
  utils/

frontend/app/(dashboard)/administration/business-calendar/page.tsx
frontend/app/(dashboard)/administration/business-calendar/[calendarId]/page.tsx
frontend/app/(dashboard)/administration/business-calendar/[calendarId]/versions/[versionId]/page.tsx
frontend/app/(dashboard)/administration/business-calendar/preview/page.tsx
frontend/app/(dashboard)/administration/business-calendar/imports/page.tsx
```

## 23.2 Modify

```text
frontend/config/api.ts
frontend/config/navigation.ts
frontend/lib/shell-navigation.ts
frontend/features/holiday/*
frontend/features/shift-roster/*
frontend/features/workforce-calendar/*
frontend/features/my-workspace/*
frontend/components/workforce/month-calendar.tsx
```

Reuse:

- Application shell.
- FormSheet.
- DataTable.
- Status badges.
- Empty/error/loading states.
- Existing responsive calendar components where suitable.

Do not create a second unrelated calendar design system.

---

# 24. Completion checklist

The Business Calendar foundation is complete only when:

- [ ] Every active Company has one Company Calendar.
- [ ] Every active Branch has one derived Branch Calendar.
- [ ] Company-without-Branch resolution works.
- [ ] Branch timezone is validated and authoritative.
- [ ] Company inheritance works.
- [ ] Branch holidays and overrides work.
- [ ] Published calendars are editable through amendments.
- [ ] Published history remains immutable.
- [ ] Imported holidays require review.
- [ ] Business Day Preview and Runtime agree.
- [ ] Runtime revisions are retained.
- [ ] Leave uses Runtime snapshots in Active mode.
- [ ] Shift Roster uses Runtime snapshots in Active mode.
- [ ] Attendance history is not silently recalculated.
- [ ] Workforce Calendar displays informational events safely.
- [ ] India State-level fixtures pass.
- [ ] Initial Middle East fixtures pass.
- [ ] HR/Admin permissions pass.
- [ ] Cross-tenant tests pass.
- [ ] Concurrency tests pass.
- [ ] Shadow parity is approved.
- [ ] Backend and frontend quality gates pass.
- [ ] Production backup and rollback evidence exists.
- [ ] Business UAT is signed off.

---

# 25. Closure report required from development

At completion, engineering must provide:

- Implemented Git commit.
- Migration name and checksum.
- Database objects added.
- Backfill dry-run and apply evidence.
- Offices provisioned.
- Shadow parity results.
- Runtime cutover list.
- Test suite results.
- Security and tenant-isolation evidence.
- Performance measurements.
- Known limitations.
- Deferred countries/providers.
- Rollback rehearsal result.
- Technical sign-off.
- Business UAT reference.

The feature must not be described as production-ready solely because the application builds or unit tests pass.
