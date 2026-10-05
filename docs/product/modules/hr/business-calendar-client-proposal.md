# Business Calendar Management

## Proposed Functional Design for Client Confirmation

| Document | Details |
|---|---|
| Status | Confirmed functional baseline |
| Prepared on | 2026-08-07 |
| Product | Group ERP |
| Scope | Company, Branch and employee-facing business calendars |

> This proposal converts the shared client inputs into a recommended, configurable HRMS design. The suggested defaults may be adjusted during client validation without changing the overall architecture.

## 1. Objective

The Business Calendar will become the authoritative source for determining whether a date is a working day, non-working day, holiday, half-working day or an approved working-day override.

It will be configured at Company level and resolved for each Branch using the applicable regional rules and Branch timezone.

The published Business Calendar Runtime will be consumed by:

- Leave
- Attendance
- Shift Roster
- Payroll
- Projects and Work Plans
- Company Calendar
- Branch Calendar
- Employee Calendar
- My Workspace

Leave, attendance, shifts and tasks remain records owned by their respective modules. They may be displayed together in calendar views, but they do not become Business Events.

## 2. Recommended Functional Structure

```text
Company
  |
  +-- Calendar Profile
        |
        +-- Calendar Version
              |
              +-- Working Week
              +-- Business Events
              +-- Holiday Sources
              +-- Branch / Regional Overrides
              |
              +-- Review and Publish
                    |
                    +-- Business Calendar Runtime
                          |
                          +-- Leave
                          +-- Attendance
                          +-- Shift Roster
                          +-- Payroll
                          +-- Projects / Work Plans
                          +-- Company Calendar
                          +-- Branch Calendar
                          +-- Employee Calendar
                          +-- My Workspace
```

## 3. Calendar Profile

A Company may maintain more than one Calendar Profile when it operates across countries or regions.

Examples:

- India Calendar
- UAE Calendar
- Qatar Calendar

Each Calendar Profile contains:

- Calendar Code
- Calendar Name
- Default Timezone
- Default Calendar indicator
- Active indicator
- Company

### Recommended rules

1. A Company can have multiple active Calendar Profiles.
2. One profile may be identified as the Company's default.
3. Each Branch should be assigned one Calendar Profile.
4. If a Branch does not have an explicit assignment, the Company's default Calendar Profile applies.
5. A Calendar Profile cannot be deactivated while it is assigned to an active Branch unless a replacement is selected.
6. Calendar codes are system-validated and unique inside the Company.

## 4. Branch and Regional Overrides

Branch-level overrides are required because holidays and working-day rules may vary by state, province, emirate, municipality or operating location.

Examples:

- A regional government holiday applies only to one Branch.
- A Branch works on a Saturday that is normally a weekly off-day.
- A local election holiday applies to selected Branches.
- A Branch observes a half-day closure.

### Recommended precedence

```text
Branch / Regional Override
        overrides
Company Calendar Rule
        overrides
Standard Working Week
```

### Recommended controls

- Every Branch override requires a reason.
- Overrides belong to a Calendar Version and follow its review and publication workflow.
- A protected statutory holiday should require Company Administrator or Organization Owner authorization before it can be changed to a working day.
- Published history must not be edited directly.
- A correction to a published calendar must be introduced through a new Calendar Version.
- The resolved result must retain the source and reason for audit and explanation.

## 5. Timezone Handling

The Branch timezone should be authoritative for business-day calculations.

### Recommended rules

1. Every Branch must have a valid IANA timezone, such as:
   - `Asia/Kolkata`
   - `Asia/Dubai`
   - `Asia/Qatar`
2. The Calendar Profile timezone is the default.
3. An assigned Branch timezone takes precedence over the Calendar Profile timezone.
4. Publication should be blocked if an applicable Branch has no valid timezone.
5. All-day holidays and working-day rules are stored as business dates and must not move to another date because of UTC conversion.
6. Timed events are stored in UTC and displayed in the applicable Branch timezone.
7. Employee calendar dates are resolved using the employee's effective Branch timezone.
8. When an employee transfers Branch, historical dates retain the old Branch context and future dates use the new Branch context.

## 6. Calendar Version Lifecycle

Calendar configuration must be versioned so future changes can be prepared without changing the active calendar immediately.

### Proposed lifecycle

```text
DRAFT
  |
  v
IN REVIEW
  |
  +-- Returned to Draft
  |
  v
PUBLISHED / SCHEDULED
  |
  v
ACTIVE
  |
  v
RETIRED
```

Each version contains:

- Calendar Profile
- Version number
- Effective start date
- Optional effective end date
- Working Week
- Business Events
- Holiday sources
- Branch or regional overrides
- Drafted by
- Reviewed by
- Published by
- Publication timestamps

### Recommended rules

- An effective date is mandatory before publication.
- Only one version may be effective for a Calendar Profile on a given date.
- A published version is immutable.
- Corrections are introduced in a new version.
- A future version may be published in advance and activated automatically on its effective date.
- Publication updates the runtime only for the version's effective period.
- Previously closed attendance, leave and payroll periods are not recalculated automatically.

## 7. Working Week

The Working Week defines the normal business pattern before holidays or overrides are applied.

Each weekday can be configured as:

- Non-working day
- Full working day
- First-half working day
- Second-half working day
- Standard working hours

Example:

| Day | Status | Portion |
|---|---|---|
| Monday | Working | Full Day |
| Tuesday | Working | Full Day |
| Wednesday | Working | Full Day |
| Thursday | Working | Full Day |
| Friday | Working | Full Day |
| Saturday | Non-working | Not applicable |
| Sunday | Non-working | Not applicable |

A Branch or regional override may change a specific date without permanently changing the normal Working Week.

## 8. Business Events

Business Events are managed through a calendar view.

### Proposed user flow

```text
Open Business Events
  |
  v
Choose Calendar Version
  |
  v
Click a Date
  |
  v
Add or Edit Event
  |
  v
Save to Draft Version
  |
  v
Review and Publish Calendar Version
```

### Event editor

The event editor should include:

- Event Name
- Event Type
- Event Category
- Event Scope
- Company
- Branch, when applicable
- Department, Employee or Project, when applicable
- Start
- End
- Timezone for timed events
- Description
- Source
- Calendar Version

### Publication recommendation

An individual event should not have a separate independent publication process. It is saved to a Draft Calendar Version, and publishing the version publishes all approved configuration together.

This avoids a partially published calendar where its Working Week, holidays and overrides do not belong to the same approved version.

## 9. Configurable Event Metadata

The following concepts should remain separate and lookup-driven.

### Event Type

Event Type describes what the event is:

- Holiday
- Celebration
- Meeting
- Training
- Maintenance
- Shutdown
- Payroll
- Audit
- Custom

### Event Category

Event Category provides business classification:

- Government
- Company
- Regional
- Operational
- System
- Custom

### Event Scope

Event Scope defines who or what the event applies to:

- Company
- Branch
- Department
- Employee
- Project

### Event Source

Event Source identifies where the event originated:

- Manual
- Excel
- CSV
- ICS
- REST API
- Government API

### Configuration controls

Authorized administrators may:

- Add custom lookup values.
- Rename display labels.
- Select display colours and icons.
- Change display order.
- Activate or deactivate optional values.

Protected system codes, including the semantic `HOLIDAY` type, must not be deleted or changed to behave as another type. This preserves reliable attendance and leave calculations while keeping the displayed metadata configurable.

## 10. Holiday Behaviour

When the Event Type is Holiday, the editor should display additional fields.

### Conditional fields

- Affects Business Day
- Paid Holiday
- Day Portion
- Working Day Override
- Applicable scope
- Holiday source
- Optional statutory reference

### Business-day effects

Recommended effect values:

- Information only
- Non-working day
- Working-day override
- First half non-working
- Second half non-working

### Terminology recommendation

Use **Paid Holiday**, not **Paid Leave**.

A Paid Holiday means the employee is not expected to work but the day is paid according to Company policy. It does not consume the employee's leave balance.

## 11. Informational Events

Meetings, celebrations, training, audits and similar events may appear on calendar views without changing whether the date is a business day.

Examples:

- A Company celebration appears on Company and Employee calendars.
- A Branch meeting appears only for that Branch.
- A Department training event appears for applicable employees.
- A payroll cut-off appears for authorized users.

The Business Calendar Runtime ignores informational events when calculating working-day results unless an authorized event type is explicitly configured with a business-day effect.

## 12. Business Day Preview

A Business Day Preview page should allow HR or administrators to verify calendar behaviour before publication.

### Inputs

- Company
- Branch
- Calendar Version
- Date

### Result

- Working or non-working
- Full Day, First Half or Second Half
- Weekend indicator
- Holiday indicator
- Calendar Profile
- Calendar Version
- Applied Company rule
- Applied Branch or regional override
- Contributing event
- Source
- Reason
- Applicable timezone

Example:

```text
Date: 26 January 2027
Company: Example India Pvt Ltd
Branch: Kochi
Result: Non-working day
Reason: Republic Day
Source: Government holiday import reviewed by HR
Calendar: India Calendar
Version: 2027.1
Timezone: Asia/Kolkata
```

The preview must use the same resolution rules as the published runtime so the preview and actual workforce calculations cannot disagree.

## 13. Business Calendar Runtime

The runtime is the published, resolved result used by operational modules.

For an applicable date, it should be able to provide:

- Business date
- Working or non-working status
- Full-day or half-day portion
- Company
- Branch
- Calendar Profile
- Calendar Version
- Branch timezone
- Reason
- Source
- Contributing event or override

### Runtime principle

The runtime is concerned with business-day calculation. It does not treat meetings, celebrations or general events as holidays.

Only an event with an approved business-day effect contributes to the working-day result.

## 14. Module Integration

### Leave

```text
Employee applies for Leave
  |
  v
Leave workflow and approval
  |
  v
Business Calendar determines chargeable business days
  |
  v
Approved Leave appears on Employee and authorized team calendars
```

Leave is not stored as a Business Event. It remains a Leave record and is projected into the relevant calendar views.

### Attendance

Attendance uses the Business Calendar Runtime to determine:

- Expected working day
- Weekend
- Full-day or half-day holiday
- Working-day override
- Expected working duration

### Shift Roster

Shift Roster combines:

- Business-day result
- Assigned Shift
- Effective employee assignment
- Branch timezone
- Approved override

### Payroll

Payroll will later consume the locked attendance period and the effective Business Calendar result. Historical closed payroll periods will not be recalculated automatically when a future calendar version is published.

### Projects and Work Plans

The existing project Work Plan remains separate from the Business Calendar. Project tasks may use business-day results for scheduling and may be displayed on a user's calendar without becoming Business Events.

## 15. Calendar Views

### Company Calendar

Displays:

- Company holidays
- Company events
- Published calendar information

### Branch Calendar

Displays:

- Inherited Company holidays and events
- Regional events
- Branch events
- Branch working-day overrides

### Employee Calendar

Displays, according to permission:

- Applicable business holidays
- Assigned Shift
- Leave
- Attendance status
- Training
- Tasks
- Birthday
- Applicable Company, Branch and Department events

### Personal Calendar

The recommended first release should aggregate records from the source modules instead of introducing a separate private diary.

A private personal-event feature can be considered later with its own privacy, retention and sharing rules.

## 16. Imports and Government APIs

### Recommended first release

Support:

- Manual entry
- Excel import
- CSV import
- ICS import

Government API integration should follow after confirming:

- Countries and regions required
- Approved provider
- Authentication method
- Data licensing and usage terms
- Holiday coverage
- Regional accuracy
- Update frequency
- Failure and retry behaviour

### Import workflow

```text
Upload File or Read External Source
  |
  v
Validate and Compare
  |
  +-- New records
  +-- Changed records
  +-- Duplicates
  +-- Invalid records
  |
  v
Create Draft Import
  |
  v
HR Review
  |
  v
Publish through Calendar Version
```

Imported data must never publish automatically. HR must review and approve it.

Each imported event should retain:

- Source
- External reference
- Import batch
- Imported timestamp
- Original value
- Reviewed value
- Reviewer

## 17. Roles and Approval

### Recommended responsibilities

| Role | Responsibility |
|---|---|
| HR or Calendar Administrator | Create profiles, versions, events, imports and overrides |
| Calendar Reviewer | Review working weeks, events, sources and preview results |
| Company Administrator or Organization Owner | Publish Calendar Versions and authorize protected overrides |
| Project Manager | View applicable team calendar information |
| Employee | View own applicable calendar |

### Recommended control

Use a maker-checker process:

- The same user should not create and publish a Calendar Version when another eligible approver is available.
- Publication records the publisher and timestamp.
- Protected statutory-holiday overrides require a reason and higher authorization.

## 18. Existing ERP Foundation to Reuse

The current ERP already provides important foundations that should be reused:

- Company and Branch hierarchy
- Company and Branch timezone concepts
- Branch working days
- Holidays and day portions
- Shifts and Shift Rosters
- Leave
- Attendance
- Workforce Calendar
- Employee Workspace
- Tenant permissions
- Business audits
- Notifications and transactional events

The proposed Business Calendar adds the centralized profile, version, event, override, import and runtime layer. It should not replace working Leave, Attendance, Shift or Employee Workspace workflows.

## 19. Suggested Delivery Stages

### Stage 1 — Calendar Foundation

- Calendar Profiles
- Branch assignment
- Calendar Versions
- Working Week
- Branch timezone validation
- Business Day Preview

### Stage 2 — Events and Publication

- Event metadata
- Event editor
- Holiday behaviour
- Regional and Branch overrides
- Review and publication
- Runtime generation

### Stage 3 — Workforce Integration

- Leave integration
- Attendance integration
- Shift Roster integration
- Company, Branch and Employee calendar projections

### Stage 4 — Imports

- Excel
- CSV
- ICS
- Import validation and review

### Stage 5 — Extended Consumers

- Government API integrations
- Payroll consumption
- Project and Work Plan consumption
- Advanced reporting

## 20. Confirmed Client Decisions

The client confirmed:

1. Every office requires an effective calendar.
2. The Company Calendar is the main-office calendar.
3. If the Company has no Branch, the Company Calendar is used directly.
4. Every Branch has its own derived calendar and inherits the Company Calendar.
5. A Branch may add its own regional holidays and update inherited rules when required.
6. Branch timezone is authoritative for Leave, Attendance, Shift and business-day calculations.
7. Imported holidays require HR or Admin review.
8. Published calendars remain editable because holidays may change later.
9. Published edits must retain history through a tracked amendment revision rather than silently overwriting the original record.
10. The architecture must support all countries.
11. Initial holiday coverage focuses on India and the Middle East.
12. India requires State-level holiday applicability.
13. HR and Admin may create, review, publish and amend calendars.

## 21. Non-blocking Configuration Inputs

The following do not block foundation development:

- Exact Middle East countries included in the first production rollout.
- Approved Government holiday provider for each country.
- Provider credentials, licensing and synchronization limits.
- Whether a tenant later requires strict maker-checker separation.
- Client-specific labels, colours and ordering for custom event metadata.
- Future recurrence rules and private personal events.

## 22. Engineering Work Order

The stage-by-stage implementation, database, API, testing and rollout plan is maintained in:

`docs/development/business-calendar-development-work-order.md`
