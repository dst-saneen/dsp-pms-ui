# Resource Planning Framework

## Purpose

The Resource Planning Framework manages employee allocation across companies, departments, projects, training programs and internal activities.

The framework ensures optimal resource utilization while supporting forecasting, capacity planning and profitability analysis.

The system must support both dedicated and shared resources.

---

# Resource Master

## Resource Definition

A resource may be:

- Employee
- Freelancer
- Consultant
- Trainer
- Contractor

---

## Resource Categories

- BIM Resource
- Engineering Resource
- Training Resource
- Project Management Resource
- Sales Resource
- Finance Resource
- HR Resource
- IT Resource

---

# Resource Capacity

## Capacity Fields

| Field | Type |
|---------|---------|
| Resource | Lookup |
| Working Hours Per Day | Number |
| Working Days Per Week | Number |
| Monthly Capacity Hours | System |
| Annual Capacity Hours | System |

---

## Example

Working Hours Per Day = 8

Working Days Per Week = 5

Monthly Capacity = 160 Hours

Annual Capacity = 1920 Hours

---

# Company Allocation

Resources may work across multiple companies.

## Example

Employee

Primary Company:
- BIM Services (60%)

Secondary Companies:
- Training Academy (20%)
- Engineering Consultancy (20%)

---

## Requirements

- Allocation percentages must be tracked.
- Historical allocations must be retained.
- Intercompany cost allocations must be supported.

---

# Project Allocation

Resources may be assigned to multiple projects.

---

## Allocation Fields

| Field | Type |
|---------|---------|
| Resource | Lookup |
| Project | Lookup |
| Start Date | Date |
| End Date | Date |
| Allocation Percentage | Percentage |
| Allocation Hours | Number |
| Billable | Yes / No |

---

## Example

Project A = 50%

Project B = 30%

Project C = 20%

Total = 100%

---

# Non Project Allocation

Resources may be allocated to:

- Training
- Internal Development
- Administration
- Leave
- Business Development
- Research & Development

---

## Example

Project Work = 70%

Training = 10%

Administration = 10%

R&D = 10%

Total = 100%

---

# Utilization Management

## Utilization Formula

Utilization %

=

Allocated Hours

÷

Available Capacity

× 100

---

## Utilization Categories

### Under Utilized

Less than 70%

### Optimal

70% to 90%

### Fully Utilized

90% to 100%

### Over Allocated

Above 100%

---

# Forecasting

The system must forecast:

- Available Resources
- Resource Shortages
- Resource Surplus
- Hiring Requirements

---

## Forecast Inputs

- Active Projects
- Pipeline Projects
- Opportunities
- Training Requirements
- Historical Utilization

---

# Resource Demand Planning

## Requirements

The ERP must identify:

- Required Skills
- Required Headcount
- Future Resource Gaps
- Future Hiring Needs

---

## Example

Upcoming Project

Requires:

- 3 BIM Coordinators
- 5 BIM Modelers
- 2 QA/QC Engineers

ERP should identify shortages automatically.

---

# Skill Based Planning

Resources must be searchable by:

- Skill
- Certification
- Experience
- Availability
- Company
- Department

---

## Example Search

Find:

- Revit Expert
- Available Next Month
- UAE Based

---

# Timesheet Integration

Resource Planning must integrate with:

- Timesheets
- Attendance
- Leave
- Projects
- Payroll

---

# Cost Allocation

Resource costs must be distributed based on allocation.

---

## Example

Monthly Cost = AED 10,000

Allocation:

Project A = 50%

Project B = 30%

Training = 20%

Cost Allocation:

Project A = AED 5,000

Project B = AED 3,000

Training = AED 2,000

---

# Profitability Integration

Resource Planning must support:

- Project Profitability
- Department Profitability
- Company Profitability

---

# Dashboards

## Resource Dashboard

Show:

- Available Resources
- Utilized Resources
- Overallocated Resources
- Upcoming Availability
- Resource Demand
- Resource Gaps

---

# Business Rules

### Rule 1

Resource allocation cannot exceed 100%.

### Rule 2

Allocation history must be retained.

### Rule 3

Resource costs must be traceable.

### Rule 4

Forecast calculations must use project pipeline data.

### Rule 5

Shared resources must support intercompany allocations.

### Rule 6

Utilization calculations must be automated.

### Rule 7

Resources must be searchable by skill and availability.

---

# Relationship Diagram

Resource

│

├── Employee

├── Skills

├── Certifications

├── Company Allocation

├── Project Allocation

├── Timesheets

├── Forecasts

├── Costs

└── Utilization

---

# Future Expansion

## Future Features

- AI Resource Forecasting
- AI Hiring Recommendations
- Resource Heat Maps
- Resource Availability Calendar
- Workforce Optimization

---

## Scalability Requirements

- Unlimited Resources
- Unlimited Projects
- Unlimited Allocations
- Unlimited Skills
- Unlimited Forecast Scenarios