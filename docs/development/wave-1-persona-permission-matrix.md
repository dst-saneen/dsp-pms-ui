# Wave 1 — Persona & permission matrix (CORE-01)

**Purpose:** UAT guide for Designation pilot (DES-07) and shared authz UX.  
**Not** a full RBAC redesign — maps known permission codes to daily screens.

---

## Personas

| Persona | Intent | Typical permissions (subset) |
|---|---|---|
| **Org structure admin** | Maintain company structure | `organization.structure.manage`, `organization.structure.read`, companies/branches as granted |
| **HR onboarding manager** | Templates & employee onboarding | `hr.onboarding.manage`, `hr.onboarding.read`, `onboardingNav` capability |
| **Combined HR + structure** | Can create designation and link onboarding depts | Both structure.manage + onboarding.manage + capability |
| **Structure read-only** | View lists only | `organization.structure.read` (no manage) |
| **Employee (self)** | My Workspace only | `hr.self.read` |
| **Approver** | Leave / clearance queues | `hr.team.approve`, clearance perms |
| **Finance / Payroll** | Finance & payroll lite | finance.* / payroll.* + module capabilities |
| **Second-tenant user** | Isolated company | Same role codes, different Company/Branch context |

---

## Designation / Onboarding matrix (DES-07)

| Action | Structure manage | Onboarding manage + nav | Read-only structure | Other tenant |
|---|---|---|---|---|
| See Designations list | if read | if read | Yes | Own company only |
| New Designation button | Yes | No (unless also structure manage) | No | No cross-tenant |
| Save designation fields | Yes | No | No | No |
| See / edit onboarding dept section | if also onboarding manage + nav | Yes (with structure manage to create) | No | No |
| Link departments (API) | structure for create; onboarding for link | Required for link | 403 | 403 / empty |
| Open Onboarding Templates | — | Yes | — | Own scope |
| Create Designation from Templates toolbar | structure manage | — | Hidden | — |

---

## Daily vs config (persona reach)

| Persona | Top daily screens | Must not dig through first |
|---|---|---|
| Employee | My Workspace | Admin masters |
| Approver | Leave requests, approvals | Leave types/policies |
| HR onboarding | Employee Onboarding queue | Asset taxonomy |
| Structure admin | Designations / Departments | Delivery ops |
| Finance | Transactions / payroll run | Org company groups |

---

## UAT evidence notes

1. Run each Designation persona on the same frozen SHA (Phase E).  
2. Confirm buttons that should be hidden never appear.  
3. Confirm second tenant never sees first tenant designations.  
4. Capability off (`onboardingNav=false`) hides onboarding section even if permission bits exist.
