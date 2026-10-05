# User Management & Role Framework

## Purpose

The User Management Framework controls authentication, authorization, access permissions and user ownership across all ERP modules.

The framework must support multiple companies, multiple branches, multiple roles and unlimited users.

Every user must be assigned appropriate access rights based on their responsibilities within the organization.

This framework serves as the security foundation for the entire ERP platform.

---

## User Master

### User Fields

| Field         | Type              | Required |
| ------------- | ----------------- | -------- |
| User ID       | System            | Yes      |
| Employee ID   | Lookup            | No       |
| First Name    | Text              | Yes      |
| Last Name     | Text              | No       |
| Email         | Email             | Yes      |
| Mobile Number | Text              | No       |
| Username      | Text              | Yes      |
| Password      | Encrypted         | Yes      |
| Company       | Lookup            | Yes      |
| Branch        | Lookup            | Yes      |
| Department    | Lookup            | No       |
| Designation   | Lookup            | No       |
| Role          | Lookup            | Yes      |
| Status        | Active / Inactive | Yes      |
| Last Login    | System            | No       |
| Created Date  | System            | Yes      |
| Modified Date | System            | Yes      |

---

## Role Management

### Role Fields

| Field       | Type              | Required |
| ----------- | ----------------- | -------- |
| Role Name   | Text              | Yes      |
| Role Code   | Text              | Yes      |
| Description | Text              | No       |
| Status      | Active / Inactive | Yes      |

### Example Roles

* Super Administrator
* Company Administrator
* HR Manager
* Finance Manager
* Project Manager
* BIM Manager
* Training Manager
* Procurement Manager
* Employee
* Client User
* Vendor User

### Additional ERP Roles

- Managing Director
- Operations Manager
- Business Development Manager
- Sales Executive
- BIM Coordinator
- BIM Modeler
- QA/QC Engineer
- Document Controller
- Trainer
- Student
- Accountant
- Finance Controller
- HR Manager
- Project Engineer
- Project Coordinator

---

## Permission Management

Permissions must be configurable without software changes.

### Permission Types

#### View

Allows user to view records.

#### Create

Allows user to create records.

#### Edit

Allows user to modify records.

#### Delete

Allows user to delete records.

#### Approve

Allows user to approve workflows.

#### Export

Allows user to export reports and data.

---

## Module Access

Users may be granted access to one or more modules.

### Example Modules

* HR
* Projects
* Finance
* CRM
* Procurement
* Training
* BIM
* Reporting
* System Administration

---

## Company Access

### Requirements

* A user may belong to one primary company.
* Users may be granted access to multiple companies.
* Access must be configurable by administrators.
* Company restrictions must apply across all modules.

---

## Branch Access

### Requirements

* A user may belong to one primary branch.
* Users may be granted access to multiple branches.
* Branch restrictions must apply across all modules.
* Branch visibility must be configurable.

---

## Authentication Requirements

### Supported Methods

* Username and Password
* Email and Password
* Single Sign-On (Future)
* Microsoft Authentication (Future)
* Google Authentication (Future)

### Security Requirements

* Passwords must be encrypted.
* Password reset functionality must be available.
* Account lockout after multiple failed login attempts.
* Session timeout support.
* Audit logging for login activities.

---

## Approval Hierarchy

The ERP must support configurable approval workflows.

### Examples

Employee
→ Supervisor
→ Manager
→ Director

Purchase Request
→ Department Head
→ Finance Manager
→ Managing Director

Leave Request
→ Reporting Manager
→ HR Manager

---

## Audit Trail

The system must track:

* Record Creation
* Record Modification
* Record Deletion
* Approval Actions
* Login Activities
* Logout Activities

### Audit Information

* User
* Date
* Time
* Action
* Module
* Record Reference

---

## Business Rules

### Rule 1

Each user must have at least one role.

### Rule 2

Each user must belong to a company.

### Rule 3

Each user must belong to a branch.

### Rule 4

Inactive users cannot access the ERP.

### Rule 5

Roles may contain multiple permissions.

### Rule 6

Permissions must be configurable.

### Rule 7

Super Administrators have unrestricted access.

### Rule 8

All user activities must be auditable.

### Rule 9

Approval workflows must be configurable.

### Rule 10

Module access must be controlled by permissions.

---

## Relationship Diagram

User
│
├── Company
├── Branch
├── Role
├── Permissions
├── Modules
└── Approval Hierarchy

Role
│
├── Permissions
└── Users

Company
│
├── Branches
└── Users

---

## Future Expansion

### Future Features

* Single Sign-On (SSO)
* Azure Active Directory Integration
* Google Workspace Integration
* Multi-Factor Authentication (MFA)
* Biometric Authentication
* API Access Tokens
* Mobile App Authentication
* Delegated Approvals
* Temporary Permissions

### Scalability Requirements

* Unlimited Users
* Unlimited Roles
* Unlimited Permissions
* Unlimited Approval Levels
* Multi-Tenant Support
* Enterprise Identity Management
