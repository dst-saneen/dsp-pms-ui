# ERP Database Standards

## Purpose

This document defines the database development standards for the ERP platform.

All database objects, tables, columns, indexes, constraints and relationships must comply with these standards.

---

# Database Platform

## Primary Database

PostgreSQL

Version:

16+

---

# Naming Standards

## Table Names

Use:

- Lowercase
- Plural
- Snake Case

Examples:

companies
employees
projects
project_tasks
journal_entries

---

## Column Names

Use:

snake_case

Examples:

employee_code
project_name
created_at
updated_at

---

## Primary Key Names

Every table must use:

id

Type:

UUID

Example:

id UUID PRIMARY KEY

---

## Foreign Key Naming

Format:

entity_id

Examples:

company_id
branch_id
employee_id
project_id

---

# UUID Strategy

All major tables use UUID.

Advantages:

- Distributed Systems
- API Friendly
- Multi Tenant Ready
- Better Security

Example:

id UUID PRIMARY KEY DEFAULT gen_random_uuid()

---

# Audit Columns

Every business table must contain:

created_at
updated_at
created_by
updated_by
is_active

---

## Data Types

created_at TIMESTAMP

updated_at TIMESTAMP

created_by UUID

updated_by UUID

is_active BOOLEAN

---

# Soft Delete Policy

Never hard delete major records.

Use:

deleted_at

Examples:

Employees
Projects
Clients
Invoices
Companies

---

# Required Constraints

## Unique Constraints

Examples:

company_code

employee_code

project_code

client_code

invoice_number

---

## Not Null Constraints

Apply wherever possible.

Example:

project_name NOT NULL

company_id NOT NULL

---

# Index Standards

Always index:

Primary Keys

Foreign Keys

Frequently Filtered Columns

---

## Examples

company_id

branch_id

employee_id

project_id

status

created_at

---

# Multi Company Standards

Every transaction table must contain:

company_id

Examples:

projects

invoices

expenses

timesheets

journal_entries

---

# Currency Standards

Financial tables must contain:

currency_id

exchange_rate

where applicable.

---

# Financial Precision

Use:

NUMERIC(18,2)

Examples:

amount
revenue
cost
budget

---

# Percentage Precision

Use:

NUMERIC(5,2)

Examples:

allocation_percentage

probability_percentage

utilization_percentage

---

# Date Standards

Use:

DATE

Examples:

joining_date

invoice_date

project_start_date

---

# DateTime Standards

Use:

TIMESTAMP WITH TIME ZONE

Examples:

created_at

updated_at

approval_date

---

# Status Standards

Prefer Lookup Tables.

Avoid hardcoded values.

Example:

project_statuses

employee_statuses

invoice_statuses

---

# Lookup Table Standards

Every lookup table should contain:

id

code

name

display_order

is_active

---

# Document Storage Standards

Documents should not be stored in database blobs.

Store:

file_path
file_name
file_size
mime_type

Actual files:

Object Storage

Examples:

AWS S3
Azure Blob
MinIO

---

# Workflow Standards

Workflow tables must support:

- Versioning
- Approval Levels
- Escalation Rules
- Delegation Rules

---

# Security Standards

Passwords:

bcrypt

Never store plaintext passwords.

---

# Audit Logging Standards

Track:

Create
Update
Delete
Approve
Reject
Login
Logout

---

# Performance Standards

Target:

- < 1 second standard queries
- < 3 seconds dashboards
- < 5 seconds financial reports

---

# Archiving Strategy

Archive:

Closed Projects

Historical Logs

Completed Workflows

Old Forecast Data

---

# Future Readiness

Database must support:

- Multi Tenant Architecture
- AI Analytics
- Data Warehouse Integration
- API Integrations
- SaaS Deployment

---

# Development Rule

No table may be created without:

- Primary Key
- Audit Columns
- Proper Constraints
- Proper Indexes
- Documentation