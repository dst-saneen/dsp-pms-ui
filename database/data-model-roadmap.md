# Data Model Roadmap

## Purpose

The Data Model Roadmap defines the database architecture for the ERP platform.

The goal is to create a scalable PostgreSQL schema that supports:

* Multi-Company Operations
* Multi-Branch Operations
* Multiple Business Units
* Multiple Countries
* Multiple Currencies
* Unlimited Users
* Unlimited Projects

The database must support future expansion without requiring major redesign.

---

# Database Architecture

The ERP database is divided into five major domains.

1. Master Data
2. Transaction Data
3. Relationship Data
4. Analytics Data
5. Audit Data

---

# Master Data Domain

Master Data represents information that changes infrequently.

## Company Domain

Tables:

* companies
* branches
* company_types
* currencies
* countries
* time_zones

---

## Organization Domain

Tables:

* departments
* teams
* business_units
* cost_centers

---

## User Domain

Tables:

* users
* roles
* permissions
* role_permissions
* user_roles

---

## Human Resources Domain

Tables:

* employees
* designations
* employment_types

---

## CRM Domain

Tables:

* clients
* contacts
* vendors

---

## Training Domain

Tables:

* courses
* batches
* trainers
* students

---

# Transaction Data Domain

Transaction Data stores operational records.

## CRM Transactions

Tables:

* leads
* opportunities
* activities

---

## Project Transactions

Tables:

* projects
* project_resources
* project_tasks
* project_milestones

---

## Procurement Transactions

Tables:

* purchase_requests
* purchase_orders
* vendor_quotes

---

## Finance Transactions

Tables:

* expenses
* invoices
* payments
* budgets

---

## Training Transactions

Tables:

* enrollments
* assessments
* certificates

---

## BIM Transactions

Tables:

* bim_projects
* models
* clashes
* qaqc_reviews
* deliverables

---

# Relationship Data Domain

Relationship tables manage many-to-many relationships.

Examples:

## User Access

user_roles

Links:

User ↔ Role

---

## Permissions

role_permissions

Links:

Role ↔ Permission

---

## Project Resources

project_resources

Links:

Project ↔ Employee

---

## Course Enrollment

enrollments

Links:

Student ↔ Course

---

# Analytics Data Domain

Used for reporting and dashboards.

Tables:

* kpi_snapshots
* revenue_forecasts
* expense_forecasts
* resource_forecasts
* dashboard_metrics

---

# Audit Data Domain

Tracks system activity.

Tables:

* audit_logs
* login_logs
* approval_logs
* integration_logs

---

# Core Relationships

Company
│
├── Branch
│
├── Department
│
├── Employee
│
├── Client
│
├── Vendor
│
└── Project

---

Project
│
├── Client
├── Employees
├── Expenses
├── Invoices
├── Deliverables
└── Forecasts

---

Employee
│
├── User Account
├── Department
├── Team
├── Projects
└── Approvals

---

# Multi-Tenant Strategy

Version 1

Single Database

Shared Schema

Company Isolation Through Foreign Keys

---

Version 2

Optional Tenant-Based Architecture

Company-Level Data Isolation

---

# Naming Standards

## Table Names

Use plural lowercase.

Examples:

companies
employees
projects
invoices

---

## Primary Keys

Format:

id UUID

Example:

company_id
employee_id
project_id

---

## Foreign Keys

Format:

entity_id

Examples:

company_id
branch_id
employee_id
project_id

---

# Soft Delete Strategy

All major tables should support:

* is_active
* created_at
* updated_at
* deleted_at

Soft deletion should be used wherever possible.

---

# Success Criteria

The database must support:

* Unlimited Companies
* Unlimited Users
* Unlimited Projects
* Multiple Countries
* Multiple Currencies
* Future ERP Modules
* High Performance Reporting
* Cloud Deployment
