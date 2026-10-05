# ERP Schema Relationships

## Purpose

This document defines all major relationships between ERP entities.

The document serves as the blueprint for:

- PostgreSQL Foreign Keys
- NestJS Entity Relationships
- API Design
- Data Ownership Rules

---

# Relationship Types

## One To One (1:1)

Example:

Employee
→ User Account

One Employee has one User Account.

---

## One To Many (1:N)

Example:

Company
→ Branches

One Company has many Branches.

---

## Many To Many (N:N)

Example:

Employee
↔ Projects

One Employee can work on many Projects.

One Project can have many Employees.

Implemented using:

project_resources

---

# CORE DOMAIN

## Company Group Structure

Company Group
│
└── Companies

Relationship:

company_groups (1)
→ companies (N)

Foreign Key:

companies.company_group_id

---

## Company Structure

Company
│
└── Branches

Relationship:

companies (1)
→ branches (N)

Foreign Key:

branches.company_id

---

## Company Structure

Company
│
├── Departments
├── Employees
├── Projects
├── Cost Centers
└── Bank Accounts

Relationships:

companies (1)
→ departments (N)

companies (1)
→ employees (N)

companies (1)
→ projects (N)

companies (1)
→ cost_centers (N)

companies (1)
→ bank_accounts (N)

---

# ORGANIZATION DOMAIN

## Department Structure

Department
│
└── Teams

Relationship:

departments (1)
→ teams (N)

Foreign Key:

teams.department_id

---

## Department Employees

Department
│
└── Employees

Relationship:

departments (1)
→ employees (N)

Foreign Key:

employees.department_id

---

# USER MANAGEMENT DOMAIN

## User Roles

Users
↔ Roles

Relationship:

Many To Many

Bridge Table:

user_roles

---

## Role Permissions

Roles
↔ Permissions

Relationship:

Many To Many

Bridge Table:

role_permissions

---

# EMPLOYEE DOMAIN

## Employee Company Assignment

Employees
↔ Companies

Relationship:

Many To Many

Bridge Table:

employee_company_assignments

---

## Employee Skills

Employees
↔ Skills

Relationship:

Many To Many

Bridge Table:

employee_skills

---

## Employee Certifications

Employees
↔ Certifications

Relationship:

Many To Many

Bridge Table:

employee_certifications

---

# CRM DOMAIN

## Client Contacts

Clients
│
└── Contacts

Relationship:

clients (1)
→ client_contacts (N)

Foreign Key:

client_contacts.client_id

---

## Client Opportunities

Clients
│
└── Opportunities

Relationship:

clients (1)
→ opportunities (N)

Foreign Key:

opportunities.client_id

---

## Opportunity Proposals

Opportunities
│
└── Proposals

Relationship:

opportunities (1)
→ proposals (N)

Foreign Key:

proposals.opportunity_id

---

# PROJECT DOMAIN

## Client Projects

Clients
│
└── Projects

Relationship:

clients (1)
→ projects (N)

Foreign Key:

projects.client_id

---

## Project Resources

Projects
↔ Employees

Relationship:

Many To Many

Bridge Table:

project_resources

---

## Project Tasks

Projects
│
└── Tasks

Relationship:

projects (1)
→ project_tasks (N)

Foreign Key:

project_tasks.project_id

---

## Project Deliverables

Projects
│
└── Deliverables

Relationship:

projects (1)
→ project_deliverables (N)

Foreign Key:

project_deliverables.project_id

---

## Project Risks

Projects
│
└── Risks

Relationship:

projects (1)
→ project_risks (N)

Foreign Key:

project_risks.project_id

---

## Project Variations

Projects
│
└── Variations

Relationship:

projects (1)
→ project_variations (N)

Foreign Key:

project_variations.project_id

---

# RESOURCE DOMAIN

## Employee Timesheets

Employees
│
└── Timesheets

Relationship:

employees (1)
→ timesheets (N)

---

## Project Timesheets

Projects
│
└── Timesheets

Relationship:

projects (1)
→ timesheets (N)

---

# FINANCE DOMAIN

## Chart Of Accounts

Chart Of Accounts
│
└── Journal Lines

Relationship:

chart_of_accounts (1)
→ journal_lines (N)

---

## Journal Entry Lines

Journal Entries
│
└── Journal Lines

Relationship:

journal_entries (1)
→ journal_lines (N)

---

## Client Invoices

Clients
│
└── Invoices

Relationship:

clients (1)
→ invoices (N)

---

## Project Invoices

Projects
│
└── Invoices

Relationship:

projects (1)
→ invoices (N)

---

## Invoice Receipts

Invoices
│
└── Receipts

Relationship:

invoices (1)
→ receipts (N)

---

## Company Budgets

Companies
│
└── Budgets

Relationship:

companies (1)
→ budgets (N)

---

# TRAINING DOMAIN

## Course Batches

Courses
│
└── Batches

Relationship:

courses (1)
→ batches (N)

---

## Batch Enrollments

Students
↔ Batches

Relationship:

Many To Many

Bridge Table:

enrollments

---

# DOCUMENT DOMAIN

Documents can belong to:

- Employee
- Client
- Project
- Invoice
- Course
- Vendor

Implementation:

documents

entity_type
entity_id

Polymorphic Relationship

---

# WORKFLOW DOMAIN

## Workflow Steps

Workflows
│
└── Steps

Relationship:

workflows (1)
→ workflow_steps (N)

---

## Workflow Approvals

Workflows
│
└── Approvals

Relationship:

workflows (1)
→ approvals (N)

---

# AUDIT DOMAIN

Users
│
└── Audit Logs

Relationship:

users (1)
→ audit_logs (N)

---

# DELETE RULES

## Restrict Delete

Never physically delete:

- Companies
- Employees
- Clients
- Projects
- Invoices

Use:

Soft Delete

---

## Cascade Delete

Allowed For:

- User Roles
- Role Permissions
- Employee Skills
- Employee Certifications

---

# MULTI COMPANY RULES

Company
│
├── Employees
├── Projects
├── Budgets
├── Accounts
└── Bank Accounts

All transactions must belong to a company.

---

# DATA OWNERSHIP RULES

## Shared Across Group

- Clients
- Leads
- Opportunities
- Skills
- Certifications

---

## Company Specific

- Projects
- Employees
- Budgets
- Financial Transactions

---

# ERP Master Relationship Map

Company Group

│

└── Companies

     │

     ├── Branches

     ├── Departments

     ├── Employees

     │    │

     │    ├── Skills

     │    ├── Certifications

     │    ├── Timesheets

     │    └── Project Assignments

     │

     ├── Projects

     │    │

     │    ├── Tasks

     │    ├── Deliverables

     │    ├── Risks

     │    ├── Variations

     │    └── Invoices

     │

     └── Budgets

Clients

│

├── Contacts

├── Opportunities

│     │

│     └── Proposals

│

└── Projects