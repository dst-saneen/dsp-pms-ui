# Client Management Framework

## Purpose

The Client Management Framework serves as the central customer repository for the ERP.

The framework supports:

- Shared CRM across all companies
- Client lifecycle management
- Contact management
- Opportunity tracking
- Project integration
- Financial integration

The ERP must maintain a single source of truth for all clients across the business group.

---

# Shared CRM Strategy

CRM operates at Group Level.

Clients must not be duplicated across subsidiaries.

---

## Example

Client

QIC

Services Purchased:

- BIM Services
- Training Services
- Engineering Consultancy

The client must exist only once in the ERP.

---

# Client Master

## Client Fields

| Field | Type | Required |
|---------|---------|---------|
| Client ID | System | Yes |
| Client Code | Text | Yes |
| Client Name | Text | Yes |
| Legal Name | Text | No |
| Client Type | Dropdown | Yes |
| Industry | Dropdown | No |
| Website | Text | No |
| Phone | Text | No |
| Email | Email | No |
| Country | Lookup | Yes |
| City | Text | No |
| Address | Text | No |
| Status | Active / Inactive | Yes |

---

## Client Types

- Government
- Private Company
- Individual
- Educational Institution
- Contractor
- Consultant
- Developer
- Internal Company

---

# Contact Management

A client may have multiple contacts.

---

## Contact Fields

| Field | Type |
|---------|---------|
| Contact Name | Text |
| Designation | Text |
| Email | Email |
| Mobile Number | Text |
| Department | Text |
| Primary Contact | Yes / No |

---

## Example

Client

QIC

Contacts

- Ahmed (Projects Director)
- Mohammed (BIM Manager)
- Sara (Procurement)

---

# Client Classification

## Categories

- Strategic Client
- Key Client
- Regular Client
- New Client

---

## Priority Levels

- High
- Medium
- Low

---

# Business Development Information

Track:

- Account Manager
- Sales Manager
- Relationship Owner
- Last Meeting Date
- Last Activity Date

---

# Opportunity Integration

Clients must integrate with:

- Leads
- Opportunities
- Proposals
- Contracts

---

# Project Integration

Track:

- Active Projects
- Completed Projects
- Project Revenue
- Project Profitability

---

# Financial Integration

Track:

- Invoices
- Receivables
- Payments
- Outstanding Balances

---

## Client Financial Metrics

- Total Revenue
- Outstanding Receivables
- Average Collection Period
- Client Profitability

---

# Communication History

Track:

- Calls
- Meetings
- Emails
- WhatsApp Messages
- Notes

---

# Document Management

Store:

- Contracts
- NDAs
- Purchase Orders
- Correspondence
- Proposals

---

# Client Health Score

Calculate based on:

- Revenue
- Project Success
- Payment History
- Engagement Frequency

---

## Client Health Categories

- Excellent
- Good
- Average
- At Risk

---

# Multi Company Relationships

A single client may engage with multiple companies.

---

## Example

Client

QIC

Projects:

- BIM Services Company
- Training Academy
- Engineering Consultancy

---

# Dashboard Requirements

## Client Dashboard

Show:

- Active Clients
- New Clients
- Revenue by Client
- Outstanding Receivables
- Client Profitability
- Client Health Score

---

# Business Rules

### Rule 1

Client Codes must be unique.

### Rule 2

Clients must exist only once across the Group.

### Rule 3

A Client may have multiple Contacts.

### Rule 4

A Client may have multiple Projects.

### Rule 5

Client activity history must be retained.

### Rule 6

Client documents must be version controlled.

### Rule 7

Client financial history must be retained.

### Rule 8

Inactive Clients cannot receive new Projects.

### Rule 9

Client ownership must be traceable.

### Rule 10

All Client changes must be auditable.

---

# Relationship Diagram

Client

│

├── Contacts

├── Leads

├── Opportunities

├── Proposals

├── Contracts

├── Projects

├── Invoices

├── Payments

├── Documents

└── Activities

---

# Future Expansion

## Future Features

- Client Portal
- Client Satisfaction Surveys
- AI Relationship Scoring
- AI Revenue Forecasting
- Client Self Service

---

## Scalability Requirements

- Unlimited Clients
- Unlimited Contacts
- Unlimited Projects
- Unlimited Documents
- Unlimited Activities