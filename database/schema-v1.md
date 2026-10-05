# ERP Database Schema V1

## Purpose

This document defines the initial PostgreSQL schema architecture for the ERP platform.

The schema must support:

- Multi Company Operations
- Parent / Subsidiary Structure
- Shared Resources
- Shared CRM
- Full ERP Accounting
- Project Management
- Training Management
- Forecasting
- Analytics

---

# Database Standards

## Primary Keys

All tables must use UUID.

Example:

id UUID PRIMARY KEY

---

## Audit Fields

Every major table must contain:

created_at
updated_at
created_by
updated_by
is_active

---

## Soft Delete

Where applicable:

deleted_at

---

# CORE DOMAIN

## company_groups

Purpose:

Parent company structure.

Fields:

- id
- group_code
- group_name
- description

---

## companies

Fields:

- id
- company_code
- company_name
- company_type_id
- company_group_id
- parent_company_id
- country_id
- currency_id
- timezone_id
- registration_number
- tax_number

---

## branches

Fields:

- id
- company_id
- branch_code
- branch_name
- country_id
- timezone_id

---

## company_types

Fields:

- id
- type_name

---

## currencies

Fields:

- id
- currency_code
- currency_name
- symbol

---

## exchange_rates

Fields:

- id
- from_currency_id
- to_currency_id
- rate
- effective_date

---

# ORGANIZATION DOMAIN

## departments

Fields:

- id
- company_id
- branch_id
- department_code
- department_name

---

## teams

Fields:

- id
- department_id
- team_code
- team_name

---

## business_units

Fields:

- id
- company_id
- business_unit_name

---

## cost_centers

Fields:

- id
- company_id
- cost_center_code
- cost_center_name

---

# SECURITY DOMAIN

## users

Fields:

- id
- employee_id
- username
- email
- password_hash
- status

---

## roles

Fields:

- id
- role_code
- role_name

---

## permissions

Fields:

- id
- permission_code
- permission_name

---

## user_roles

Fields:

- id
- user_id
- role_id

---

## role_permissions

Fields:

- id
- role_id
- permission_id

---

# HR DOMAIN

## employees

Fields:

- id
- employee_code
- first_name
- last_name
- email
- joining_date
- designation_id
- primary_company_id
- primary_branch_id

---

## employee_company_assignments

Purpose:

Shared resource support.

Fields:

- id
- employee_id
- company_id
- allocation_percentage
- start_date
- end_date

---

## designations

Fields:

- id
- designation_name

---

## employee_skills

Fields:

- id
- employee_id
- skill_id
- skill_level

---

## skills

Fields:

- id
- skill_name
- category

---

## certifications

Fields:

- id
- certification_name

---

## employee_certifications

Fields:

- id
- employee_id
- certification_id
- issue_date
- expiry_date

---

# CRM DOMAIN

## clients

Fields:

- id
- client_code
- client_name
- client_type
- industry

---

## client_contacts

Fields:

- id
- client_id
- contact_name
- email
- mobile

---

## leads

Fields:

- id
- lead_number
- lead_name
- lead_source
- owner_id

---

## opportunities

Fields:

- id
- opportunity_name
- client_id
- estimated_value
- probability
- expected_award_date

---

## proposals

Fields:

- id
- opportunity_id
- proposal_number
- proposal_value
- version

---

## activities

Fields:

- id
- activity_type
- related_entity
- related_id
- owner_id

---

# PROJECT DOMAIN

## projects

Fields:

- id
- project_code
- project_name
- project_type
- client_id
- company_id
- project_manager_id
- start_date
- end_date

---

## project_resources

Fields:

- id
- project_id
- employee_id
- allocation_percentage
- billable

---

## project_tasks

Fields:

- id
- project_id
- task_name
- owner_id
- status

---

## project_milestones

Fields:

- id
- project_id
- milestone_name
- due_date

---

## project_deliverables

Fields:

- id
- project_id
- deliverable_name
- revision_no

---

## project_variations

Fields:

- id
- project_id
- variation_number
- value

---

## project_risks

Fields:

- id
- project_id
- risk_name
- probability
- impact

---

# RESOURCE DOMAIN

## resource_allocations

Fields:

- id
- employee_id
- project_id
- allocation_percentage
- allocation_hours

---

## timesheets

Fields:

- id
- employee_id
- project_id
- work_date
- hours

---

# FINANCE DOMAIN

## chart_of_accounts

Fields:

- id
- account_code
- account_name
- account_type

---

## journal_entries

Fields:

- id
- journal_number
- journal_date

---

## journal_lines

Fields:

- id
- journal_entry_id
- account_id
- debit
- credit

---

## invoices

Fields:

- id
- invoice_number
- project_id
- client_id
- amount

---

## invoice_lines

Fields:

- id
- invoice_id
- description
- amount

---

## receipts

Fields:

- id
- invoice_id
- receipt_date
- amount

---

## vendor_bills

Fields:

- id
- vendor_id
- bill_number
- amount

---

## payments

Fields:

- id
- payment_reference
- payment_date
- amount

---

## budgets

Fields:

- id
- company_id
- fiscal_year
- budget_amount

---

## bank_accounts

Fields:

- id
- company_id
- bank_name
- account_number

---

# INTERCOMPANY DOMAIN

## intercompany_transactions

Fields:

- id
- source_company_id
- target_company_id
- transaction_type
- amount

---

# TRAINING DOMAIN

## courses

Fields:

- id
- course_code
- course_name

---

## trainers

Fields:

- id
- employee_id

---

## students

Fields:

- id
- student_code
- student_name

---

## batches

Fields:

- id
- course_id
- batch_name

---

## enrollments

Fields:

- id
- student_id
- batch_id

---

# DOCUMENT DOMAIN

## documents

Fields:

- id
- document_name
- entity_type
- entity_id
- version

---

# WORKFLOW DOMAIN

## workflows

Fields:

- id
- workflow_name

---

## workflow_steps

Fields:

- id
- workflow_id
- sequence_no
- approver_role_id

---

## approvals

Fields:

- id
- workflow_id
- entity_type
- entity_id
- status

---

# ANALYTICS DOMAIN

## kpi_snapshots

## revenue_forecasts

## expense_forecasts

## resource_forecasts

## dashboard_metrics

---

# AUDIT DOMAIN

## audit_logs

Fields:

- id
- user_id
- action
- entity_type
- entity_id
- action_date

---

# PHASE 2 TABLES

Future additions:

- Payroll
- Attendance
- Leave Management
- Fixed Assets
- Procurement
- BIM Models
- Clash Detection
- QA/QC Reviews
- Client Portal
- Vendor Portal

---

# Estimated V1 Database Size

Master Tables:
~40

Transaction Tables:
~50

Relationship Tables:
~20

Analytics Tables:
~10

Total:
120+ Tables