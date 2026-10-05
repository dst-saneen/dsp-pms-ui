# ERP Business Model

## Purpose

This document defines the business architecture, operational model, ownership structure, revenue model, resource model and financial strategy of the ERP platform.

All future ERP modules, database structures, APIs and reporting systems must align with this document.

---

# Business Vision

Build a unified ERP platform capable of managing:

* BIM Services
* Engineering Consultancy
* Training Academy
* Software Development
* Future Business Divisions

The ERP must support both independent operations and shared services across all companies within the group.

---

# Group Company Structure

## Business Group

GROUP ERP

│

├── Parent Company

│

├── BIM Services Company

├── BIM Training Academy

├── Engineering Consultancy

├── Software Development Division

└── Future Subsidiaries

---

## Requirements

* Support Parent Company structure.
* Support Subsidiary Companies.
* Support Company Groups.
* Support Consolidated Reporting.
* Support Intercompany Transactions.
* Support Shared Resources.
* Support Shared Services.

---

# Shared CRM Strategy

CRM must operate at Group Level.

## Shared Entities

* Leads
* Opportunities
* Clients
* Contacts
* Activities
* Proposals

---

## Example

Client: QIC

Opportunities:

* BIM Services
* Training Services
* Engineering Consultancy

The client must exist only once within the ERP.

---

## Benefits

* No duplicate clients.
* Centralized business development.
* Cross-selling opportunities.
* Unified customer relationship management.

---

# Shared Resource Strategy

The ERP must support both dedicated and shared resources.

---

## Dedicated Resource

Employee

→ Assigned to one company

Example:

Employee

→ BIM Services Company

---

## Shared Resource

Employee

→ Primary Company

→ Secondary Company Assignments

Example:

Employee

Primary Company

→ BIM Services

Additional Assignments

→ Training Academy

→ Engineering Consultancy

---

## Requirements

* Employees may work across multiple companies.
* Time allocation must be tracked.
* Resource utilization must be tracked.
* Intercompany cost allocation must be supported.
* Shared resources must support profitability calculations.

---

# Project Strategy

The ERP must support multiple project types.

Project Types must be configurable.

---

## Supported Project Types

* BIM Projects
* Engineering Projects
* Training Projects
* Consultancy Projects
* Software Projects
* Internal Projects

---

## Project Structure

Project

│

├── Client

├── Contract

├── Budget

├── Resources

├── Tasks

├── Deliverables

├── Expenses

├── Invoices

├── Forecasts

└── Profitability

---

## Billing Models

The ERP must support:

* Fixed Price
* Resource Based
* Hourly
* Milestone Based
* Retainer Based

---

# Training Business Model

Training operations may function as a separate company.

---

## Training Services

* Public Courses
* Corporate Training
* Online Courses
* Recorded Courses
* Live Classes
* Certification Programs

---

## Student Features

* Student Portal
* Course Enrollment
* Course Progress Tracking
* Assessments
* Certificates
* Lifetime Learning Access

---

## Trainer Features

* Trainer Allocation
* Trainer Scheduling
* Trainer Performance Tracking

---

# Finance Strategy

The ERP must support full enterprise accounting.

---

## Financial Domains

* General Ledger
* Chart of Accounts
* Accounts Receivable
* Accounts Payable
* Banking
* Budgets
* Forecasting
* Tax Management
* Fixed Assets
* Cost Centers
* Profit Centers

---

## Intercompany Accounting

Support:

* Intercompany Billing
* Shared Resource Costs
* Shared Service Charges
* Internal Recharges

---

## Financial Reporting

Support:

* Company Financial Reports
* Group Financial Reports
* Consolidated Financial Reports

---

# Profitability Strategy

Profitability must be measurable at multiple levels.

---

## Company Profitability

Revenue

*

Expenses

=

Company Profit

---

## Project Profitability

Project Revenue

*

Project Expenses

=

Project Profit

---

## Department Profitability

Department Revenue

*

Department Expenses

=

Department Profit

---

## Resource Profitability

Resource Revenue Contribution

*

Resource Cost

=

Resource Profitability

---

# Forecasting Strategy

The ERP must support forecasting at multiple levels.

---

## Revenue Forecasting

Based on:

* Opportunities
* Contracts
* Active Projects
* Historical Revenue

---

## Expense Forecasting

Based on:

* Payroll
* Procurement
* Operational Costs
* Vendor Commitments

---

## Resource Forecasting

Based on:

* Available Capacity
* Project Pipeline
* Training Requirements

---

## Cash Flow Forecasting

Based on:

* Invoices
* Receivables
* Payables
* Payroll Obligations

---

# Dashboard Strategy

The ERP must provide dashboards at multiple levels.

---

## Executive Dashboard

* Group Revenue
* Group Profit
* Forecast Revenue
* Cash Position
* Resource Utilization

---

## Operations Dashboard

* Active Projects
* Resource Allocation
* Project Health
* Deliverables Status

---

## Finance Dashboard

* Revenue
* Expenses
* Profitability
* Receivables
* Payables

---

## CRM Dashboard

* Leads
* Opportunities
* Win Rate
* Sales Pipeline

---

## Training Dashboard

* Students
* Courses
* Revenue
* Trainer Utilization

---

# Long-Term Vision

Future versions should support:

* AI Assistants
* BIM Automation
* Workflow Automation
* Mobile Applications
* Client Portals
* Vendor Portals
* Student Portals
* Multi-Tenant SaaS Deployment
* White-Label ERP Distribution

---

# Success Criteria

The ERP must:

* Support multiple companies.
* Support company groups.
* Support shared resources.
* Support shared CRM.
* Support multiple business models.
* Support full accounting.
* Support forecasting.
* Support scalability without redesign.
