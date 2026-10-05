Document Structure
1. Purpose
Why consistent naming matters.
One business concept = one canonical name.
Avoid synonyms in code and database design.
2. General Naming Rules

Examples:

Rule	Example
Use nouns for entities	Employee, WorkflowTemplate
Use verbs for use cases	PublishWorkflow, GenerateRuntime
Avoid abbreviations	Department, not Dept
Avoid module-specific names for reusable concepts	WorkflowTemplate, not OnboardingTemplate
3. Platform Vocabulary
Canonical Name	Do Not Use
Workflow	Process
WorkflowTemplate	OnboardingTemplate, ApprovalTemplate
WorkflowVersion	Revision
WorkflowScope	Rule, Filter
WorkflowDepartment	DepartmentTemplate
WorkflowStage	TaskGroup, Section, Phase
WorkflowTask	ChecklistItem, Activity
WorkflowInstance	Runtime, ProcessInstance
WorkflowTaskInstance	RuntimeTask
4. HR Vocabulary
Canonical Name	Do Not Use
Employee	Staff, Worker
Department	Dept
Designation	JobTitle
Branch	Office
Company	Organization (unless legally distinct)
5. Approval Vocabulary
Canonical Name	Do Not Use
ApprovalWorkflow	ApprovalProcess
ApprovalStep	ApprovalLevel
ApprovalTransaction	ApprovalRequest
Approver	Reviewer (unless specifically reviewing)
6. Notification Vocabulary
Canonical Name	Do Not Use
Notification	Alert
NotificationTemplate	MessageTemplate
NotificationChannel	DeliveryMethod
7. Asset Vocabulary
Canonical Name	Do Not Use
Asset	Equipment
AssetAssignment	Allocation
AssetReturn	HandoverBack
8. Project Vocabulary
Canonical Name	Do Not Use
Project	Job
ProjectTask	Activity
ProjectMember	Resource
9. Naming Conventions
Database
PascalCase model names
camelCase fields
Singular model names
Foreign keys end with Id

Example:

WorkflowTemplate

workflowVersionId

departmentId
Backend

Services

WorkflowTemplateService

Repositories

WorkflowTemplateRepository

Use Cases

PublishWorkflowVersionUseCase

Policies

CanPublishWorkflowPolicy

Validators

PublishWorkflowValidator
Frontend

Hooks

useWorkflowTemplate()

Pages

WorkflowTemplatePage

Dialogs

WorkflowVersionDialog

Forms

WorkflowTemplateForm
API

Plural resources.

/workflow/templates

/workflow/versions

/workflow/runtime

Actions use verbs.

POST /workflow/versions/{id}/publish

POST /workflow/versions/{id}/archive

POST /workflow/runtime/generate
10. Reserved Enterprise Terms

These terms must never be renamed without Architecture Office approval:

Workflow
WorkflowTemplate
WorkflowVersion
WorkflowScope
WorkflowStage
WorkflowTask
WorkflowInstance
Approval
Notification
Audit
Employee
Department
Company
Branch
Project
Asset
Document
Identity
Role
Permission
11. Governance

Before introducing a new entity:

Check if a canonical term already exists.
If yes, use it.
If no, submit it for architecture review.
Update EAP_NAMING_STANDARD.md only after approval.