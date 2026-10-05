# Company Framework

## Purpose

The Company Framework provides multi-company support for the ERP platform.

The system must support unlimited companies, branches, countries,
currencies, business units and business types without requiring
application code changes.

This framework acts as the master structure upon which all ERP modules
such as HR, Projects, Finance, CRM, Training, Procurement and BIM
Operations will be built.

## Company Master

### Company Fields

| Field | Type | Required |
|---------|---------|---------|
| Company Name | Text | Yes |
| Company Code | Text | Yes |
| Company Type | Dropdown | Yes |
| Registration Number | Text | No |
| Tax Number | Text | No |
| Country | Dropdown | Yes |
| Base Currency | Dropdown | Yes |
| Time Zone | Dropdown | Yes |
| Email | Text | No |
| Phone | Text | No |
| Website | Text | No |
| Logo | File Upload | No |
| Status | Active / Inactive | Yes |
| Created Date | System | Yes |
| Modified Date | System | Yes |

## Branch Master

### Branch Fields

| Field | Type | Required |
|---------|---------|---------|
| Branch Name | Text | Yes |
| Company | Lookup | Yes |
| Branch Code | Text | Yes |
| Country | Dropdown | Yes |
| State | Text | No |
| City | Text | No |
| Address | Text | No |
| Time Zone | Dropdown | Yes |
| Email | Text | No |
| Phone | Text | No |
| Status | Active / Inactive | Yes |

## Company Types

The ERP must support configurable company types.

Examples:

| Type |
|--------|
| Operating Company |
| Training Company |
| Consulting Company |
| Engineering Company |
| BIM Services Company |
| Holding Company |
| Real Estate Company |
| Construction Company |

### Requirement

Company Types must be configurable by ERP Administrators.

No software deployment should be required to add new company types.

## Currency Management

The ERP must support multiple currencies.

Examples:

- AED
- INR
- USD
- EUR
- GBP

Future currencies must be added without code changes.

### Requirements

- Each company must have a Base Currency.
- Projects may use different currencies.
- Exchange rates must be maintained separately.
- Historical exchange rates should be retained.
- Financial reports must support currency conversion.

## Country & Time Zone

### Requirements

- The ERP must support all countries.
- The ERP must support all international time zones.
- Time zones must be selectable from a master list.
- A branch may use a different time zone than its parent company.
- Date and time must be stored in a standardized format.
- Reports should display time according to the user's configured time zone.

## Business Rules

### Rule 1
A company can have multiple branches.

### Rule 2
A branch belongs to only one company.

### Rule 3
Every company must have a base currency.

### Rule 4
Projects may use currencies different from the company currency.

### Rule 5
The ERP must support intercompany transactions.

### Rule 6
Company Codes must be unique.

### Rule 7
Branch Codes must be unique within a company.

### Rule 8
Inactive companies cannot create new transactions.

### Rule 9
Inactive branches cannot create new transactions.

### Rule 10
All ERP modules must reference Company and Branch records.

## Relationship Diagram

### Basic Structure

```text
Company
│
├── Branch 1
├── Branch 2
├── Branch 3
└── Branch N
```

### ERP Relationship Structure

```text
Company
│
├── Branches
│
├── Departments
│
├── Employees
│
├── Projects
│
├── Clients
│
├── Vendors
│
├── Assets
│
├── Training Programs
│
├── BIM Projects
│
└── Financial Transactions
```

## Future Expansion

The Company Framework must support future business growth without major redesign.

### Future Features

- Departments
- Cost Centers
- Business Units
- Legal Entities
- Subsidiaries
- Joint Ventures
- Intercompany Accounting
- Global Operations
- Regional Offices
- Shared Service Centers

### Scalability Requirements

- Support unlimited companies.
- Support unlimited branches.
- Support unlimited countries.
- Support unlimited currencies.
- Support multi-language operations.
- Support multi-timezone operations.
- Support cloud deployment.
- Support multi-tenant architecture in future versions.