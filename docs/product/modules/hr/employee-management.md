# Employee Management Framework

## Purpose

The Employee Management Framework serves as the master record for all employees within the ERP.

This framework manages employee information, employment details, company assignments, department assignments, project participation, payroll integration, training records, certifications and performance management.

All operational modules must reference Employee records.

---

# Employee Master

## Employee Fields

| Field          | Type              | Required |
| -------------- | ----------------- | -------- |
| Employee ID    | System            | Yes      |
| Employee Code  | Text              | Yes      |
| First Name     | Text              | Yes      |
| Last Name      | Text              | No       |
| Full Name      | System            | Yes      |
| Date of Birth  | Date              | No       |
| Gender         | Dropdown          | No       |
| Nationality    | Dropdown          | No       |
| Mobile Number  | Text              | No       |
| Email          | Email             | Yes      |
| Personal Email | Email             | No       |
| Profile Photo  | File Upload       | No       |
| Status         | Active / Inactive | Yes      |

---

# Employment Information

## Employment Fields

| Field             | Type            | Required |
| ----------------- | --------------- | -------- |
| Employee          | Lookup          | Yes      |
| Employment Type   | Dropdown        | Yes      |
| Joining Date      | Date            | Yes      |
| Confirmation Date | Date            | No       |
| Exit Date         | Date            | No       |
| Notice Period     | Number          | No       |
| Designation       | Lookup          | Yes      |
| Department        | Lookup          | Yes      |
| Team              | Lookup          | No       |
| Reporting Manager | Employee Lookup | No       |
| Employee Category | Dropdown        | Yes      |
| Work Location     | Text            | No       |

---

## Employment Types

* Permanent
* Contract
* Temporary
* Intern
* Freelancer
* Consultant

---

# Multi Company Assignment

The ERP must support employee sharing across companies.

## Assignment Types

### Primary Assignment

Employee belongs to a primary company.

### Secondary Assignment

Employee may be assigned to one or more additional companies.

---

## Example

Employee

→ Primary Company: BIM Services

→ Secondary Company: Training Academy

→ Secondary Company: Engineering Consultancy

---

## Requirements

* Employees may work across multiple companies.
* Assignment percentages must be tracked.
* Assignment history must be maintained.
* Intercompany cost allocation must be supported.

---

# Branch Assignment

Employees may be assigned to:

* One Primary Branch
* Multiple Secondary Branches

The ERP must maintain branch assignment history.

---

# Skills Management

## Skill Fields

| Field                | Type                                        |
| -------------------- | ------------------------------------------- |
| Skill Name           | Text                                        |
| Skill Category       | Dropdown                                    |
| Skill Level          | Beginner / Intermediate / Advanced / Expert |
| Certification Linked | Yes / No                                    |

---

## Example Skills

* Revit Architecture
* Revit Structure
* Revit MEP
* Navisworks
* Dynamo
* Civil 3D
* AutoCAD
* BIM Coordination
* Project Management
* Primavera P6
* Power BI
* Python
* SQL

---

# Certification Management

## Example Certifications

* Autodesk Certified Professional
* PMP
* PMI-SP
* ISO 19650
* LEED
* ACC Professional

---

## Requirements

* Certification expiry tracking.
* Certification renewal reminders.
* Certification document storage.

---

# Employee Documents

## Supported Documents

* Passport
* Visa
* Emirates ID
* Employment Contract
* Educational Certificates
* Professional Certifications
* Performance Reviews

---

## Requirements

* Version control.
* Expiry tracking.
* Secure storage.
* Access control.

---

# Payroll Information

## Payroll Fields

| Field            | Type     |
| ---------------- | -------- |
| Employee         | Lookup   |
| Salary Structure | Lookup   |
| Basic Salary     | Currency |
| Allowances       | Currency |
| Deductions       | Currency |
| Payment Method   | Dropdown |

---

## Payment Methods

* Bank Transfer
* Cheque
* Cash

---

# Leave Management Integration

The Employee record must integrate with:

* Leave Management
* Attendance Management
* Timesheets
* Payroll
* Project Assignments

---

# Training Management Integration

Employee records must support:

* Internal Training
* External Training
* Course Completion Tracking
* Certification Tracking

---

# Project Assignment

Employees may be assigned to:

* Multiple Projects
* Multiple Companies
* Multiple Departments

---

## Assignment Information

* Allocation Percentage
* Start Date
* End Date
* Role in Project
* Billable Status

---

# Resource Utilization

The ERP must calculate:

## Employee Capacity

Example:

160 Hours / Month

---

## Allocation

Project A = 50%

Project B = 30%

Training = 20%

---

## Utilization

Total Utilization = 100%

---

# Performance Management

## KPIs

Examples:

* Billable Hours
* Utilization Percentage
* Project Delivery Performance
* Training Hours
* Certification Status
* Attendance Score

---

# Employee Lifecycle

Candidate
│
├── Recruitment
│
├── Onboarding
│
├── Active Employment
│
├── Promotion
│
├── Transfer
│
├── Resignation
│
└── Exit

---

# Business Rules

### Rule 1

Every employee must have a unique Employee Code.

### Rule 2

Every employee must belong to a primary company.

### Rule 3

Employees may belong to multiple companies.

### Rule 4

Employees may be assigned to multiple projects.

### Rule 5

Employees may possess multiple skills.

### Rule 6

Employees may possess multiple certifications.

### Rule 7

Inactive employees cannot receive new assignments.

### Rule 8

Employee assignment history must be retained.

### Rule 9

Project allocation cannot exceed 100%.

### Rule 10

All employee actions must be auditable.

---

# Relationship Diagram

Employee
│
├── User Account
├── Company Assignments
├── Branch Assignments
├── Department
├── Team
├── Skills
├── Certifications
├── Documents
├── Payroll
├── Leave
├── Timesheets
├── Projects
├── Training
└── Performance

---

# Future Expansion

## Future Features

* Competency Matrix
* Career Path Planning
* Succession Planning
* Workforce Planning
* AI Skill Gap Analysis
* Employee Self Service Portal
* Mobile Employee App

---

## Scalability Requirements

* Unlimited Employees
* Unlimited Skills
* Unlimited Certifications
* Unlimited Assignments
* Unlimited Companies
