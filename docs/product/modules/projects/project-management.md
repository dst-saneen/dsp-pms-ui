# Project Management Framework

## Purpose

The Project Management Framework manages the complete lifecycle of projects from opportunity conversion to project closure.

The framework must support multiple project types, multiple billing models, resource allocation, budgeting, profitability tracking and forecasting.

Projects are the primary revenue-generating entities within the ERP.

---

# Project Master

## Project Fields

| Field | Type | Required |
|---------|---------|---------|
| Project ID | System | Yes |
| Project Code | Text | Yes |
| Project Name | Text | Yes |
| Project Type | Dropdown | Yes |
| Client | Lookup | Yes |
| Company | Lookup | Yes |
| Branch | Lookup | No |
| Business Unit | Lookup | No |
| Project Manager | Employee Lookup | Yes |
| Start Date | Date | Yes |
| End Date | Date | No |
| Status | Dropdown | Yes |
| Currency | Lookup | Yes |

---

## Project Types

- BIM Project
- Engineering Project
- Consultancy Project
- Training Project
- Software Development Project
- Internal Project

---

## Project Status

- Draft
- Proposal
- Approved
- Active
- On Hold
- Completed
- Closed
- Cancelled

---

# Opportunity Conversion

Projects may originate from:

- CRM Opportunity
- Direct Award
- Internal Initiative

---

## Requirements

- Opportunity history must be retained.
- Proposal documents must be linked.
- Contract documents must be linked.

---

# Client Management Integration

Each project must be linked to:

- Client
- Client Contacts
- Opportunities
- Contracts

---

# Contract Management

## Contract Fields

| Field | Type |
|---------|---------|
| Contract Number | Text |
| Contract Date | Date |
| Contract Value | Currency |
| Contract Type | Dropdown |
| Contract Document | File |

---

## Contract Types

- Lump Sum
- Time & Material
- Framework Agreement
- Retainer Agreement
- Unit Rate Contract

---

# Billing Models

The ERP must support:

- Fixed Price
- Hourly Billing
- Resource Based Billing
- Milestone Billing
- Retainer Billing

---

# Project Budget

## Budget Components

- Resource Cost
- Procurement Cost
- Subcontractor Cost
- Travel Cost
- Miscellaneous Cost

---

## Budget Tracking

Track:

- Planned Budget
- Actual Cost
- Remaining Budget
- Forecast Cost

---

# Project Resources

Projects may have:

- Project Manager
- BIM Coordinator
- BIM Modelers
- Engineers
- Trainers
- Consultants
- Freelancers

---

## Resource Allocation

Track:

- Allocation Percentage
- Allocation Hours
- Billable Status
- Cost Rate
- Billing Rate

---

# Work Breakdown Structure (WBS)

Projects must support unlimited WBS levels.

---

## Example

Project

├── Design

│   ├── Architecture

│   ├── Structure

│   └── MEP

├── BIM

│   ├── Modeling

│   ├── Coordination

│   └── QA/QC

└── Delivery

---

# Task Management

## Task Fields

| Field | Type |
|---------|---------|
| Task Name | Text |
| Task Owner | Employee |
| Start Date | Date |
| End Date | Date |
| Status | Dropdown |
| Priority | Dropdown |
| Progress % | Number |

---

## Task Status

- Not Started
- In Progress
- Review
- Completed
- Cancelled

---

# Deliverable Management

## Deliverable Fields

| Field | Type |
|---------|---------|
| Deliverable Name | Text |
| Deliverable Type | Dropdown |
| Due Date | Date |
| Submission Date | Date |
| Revision Number | Text |
| Status | Dropdown |

---

## Deliverable Types

- BIM Model
- Drawing Package
- Report
- Training Material
- Software Release
- Documentation

---

# Timesheet Integration

Projects must integrate with:

- Employee Timesheets
- Resource Planning
- Payroll
- Cost Allocation

---

# Expense Management

Track:

- Labor Cost
- Travel Cost
- Procurement Cost
- Vendor Cost
- Miscellaneous Cost

---

# Revenue Management

Track:

- Contract Value
- Approved Variations
- Invoiced Revenue
- Received Revenue
- Remaining Revenue

---

# Invoice Integration

Projects must support:

- Advance Invoices
- Progress Invoices
- Milestone Invoices
- Final Invoices

---

# Variation Management

Track:

- Client Change Requests
- Scope Changes
- Approved Variations
- Rejected Variations

---

# Risk Management

## Risk Fields

| Field | Type |
|---------|---------|
| Risk Name | Text |
| Impact | Dropdown |
| Probability | Dropdown |
| Mitigation Plan | Text |

---

# Profitability Analysis

## Project Profitability

Revenue

-

Cost

=

Profit

---

## Metrics

- Gross Profit
- Gross Margin
- Net Profit
- Resource Utilization
- Budget Variance

---

# Forecasting

Forecast:

- Revenue
- Costs
- Resource Demand
- Cash Flow

---

# Dashboard Requirements

## Project Dashboard

Show:

- Active Projects
- Revenue
- Cost
- Profit
- Resource Utilization
- Deliverables Due
- Budget Variance
- Forecast Revenue

---

# Business Rules

### Rule 1

Every project must belong to a company.

### Rule 2

Every project must have a Project Manager.

### Rule 3

Every project must have a currency.

### Rule 4

Projects may have multiple resources.

### Rule 5

Projects may have multiple deliverables.

### Rule 6

Projects may have multiple invoices.

### Rule 7

Budget history must be retained.

### Rule 8

Project profitability must be calculated automatically.

### Rule 9

Project forecasts must update automatically.

### Rule 10

All project actions must be auditable.

---

# Relationship Diagram

Project

│

├── Client

├── Contract

├── Resources

├── WBS

├── Tasks

├── Deliverables

├── Timesheets

├── Expenses

├── Invoices

├── Variations

├── Risks

├── Profitability

└── Forecasts

---

# Future Expansion

## Future Features

- Project Portfolio Management
- Earned Value Management
- AI Schedule Forecasting
- AI Risk Prediction
- Client Project Portal
- Mobile Project App

---

## Scalability Requirements

- Unlimited Projects
- Unlimited Tasks
- Unlimited Deliverables
- Unlimited Resources
- Unlimited Invoices
- Unlimited Forecast Scenarios