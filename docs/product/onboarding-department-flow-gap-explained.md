# Onboarding by department — intended flow vs current backend

Simple explanation for discussion. No UI click steps.

**Product decision (locked):**  
On the **Onboarding Template**, assign the **department only**.  
Do **not** pick a named person on the template.  
**Who can see** the work is controlled by **permission**.  
The **department head** then **assigns that task to someone** in the department.

---

## 1. Intended idea (in one story)

Think of a **job role** (example: Staff).

For that role, HR designs one **Onboarding Template**.  
Inside that template, work is split **by department**:

| Department | Example task | Template assignment |
|------------|--------------|---------------------|
| IT | Give laptop to new employee | **IT department** (not a named IT person) |
| HR | Collect ID proof | **HR department** |
| Finance | Open bank / salary setup | **Finance department** |

**Important idea:**  
The template is **for one designation (job role)**.  
Each task inside is **owned by a department**, not by a person chosen at template time.

When HR **starts Employee Onboarding** for a real person:

1. All those department tasks are created for that hire  
2. People with permission for that department **can see** the pending work  
3. The **department head** assigns each task to the right person in that department  
4. That person completes **their** assigned task (not HR doing everyone’s work)

---

## 2. How assignment and visibility work

Three separate rules. Do not mix them.

```text
TEMPLATE  →  which DEPARTMENT owns the task
PERMISSION → who can SEE that department’s tasks
HEAD      → who is ASKED to DO this specific task
```

### A. Template = department only

When HR builds the template:

- Put the task under a department (IT / HR / Finance / …)  
- That is the only owner to set  
- Do **not** name “Ravi from IT” or “the IT executive” on the template  

Why: people change. The department stays. The head decides who does the work for **this** joiner.

### B. Permission = who can see it

After onboarding starts, the IT laptop task is visible to users who have permission to see **IT onboarding work**.

Typical pattern:

- IT department head sees IT tasks  
- Other IT users see them only if they have that permission  
- HR / Finance users do **not** see IT tasks just because they can open Employee Onboarding  
- HR still sees overall progress, but does not complete another department’s work

Permission is the control for **visibility**, not for naming a person on the template.

### C. Department head = assigns the task to others

Seeing a task is not the same as being the doer.

The **head of that department**:

- Sees the new joiner’s task in their department inbox  
- Assigns it to a person (or keeps it and does it themselves)  
- That person then completes it  

Example:

1. Template: “Give laptop” → **IT**  
2. Onboarding starts for Saneen  
3. IT users with permission see: “Saneen — Give laptop”  
4. IT head assigns it to an IT executive  
5. That executive completes it  

---

## 3. Ideal flow (how it should work)

```text
Template time
1. Pick designation (job role)
2. Build Onboarding Template for that role
3. Add work under each department (IT / HR / Finance / …)
4. Assign each task to that DEPARTMENT only
5. Publish template

When a person joins
6. Start Employee Onboarding
7. System copies all tasks onto that employee, still tagged by department
8. Users with department permission can see those tasks
9. Notify the department (especially the head): “new joiner work is waiting”
10. Department head assigns each task to a person
11. Assigned person completes the task
12. When all required tasks are done → onboarding complete
```

---

## 4. Special cases (not department queues)

Two owners are known from the hire record, so they are not “pick a person on the template”:

| Owner | Who it is | Why it is allowed |
|-------|-----------|-------------------|
| **Employee** | The new joiner | Always the same person as this onboarding |
| **Manager** | The new hire’s reporting manager | Already chosen on the offer / employee record |

These are still **not** named people on the template. The system resolves them when onboarding starts.

All other support work (IT, HR, Finance, Admin, …) stays **department-only**, then head assignment.

---

## 5. What we ALREADY have in backend

These parts already exist (at least as structure / partial logic):

| Already there | Meaning in simple words |
|---------------|-------------------------|
| **Onboarding Template linked to designation** | Checklist plan for a job role |
| **Department slices inside template** | Tasks can be grouped under IT, HR, Finance, etc. |
| **Task groups + tasks** | Real checklist items under each department |
| **Department stored on a task** | Can store “this belongs to IT / HR / …” as data |
| **`ownerType` on each task** | Extra label (EMPLOYEE / HR / IT / MANAGER / …) — useful for Employee / Manager specials; **not** the intended way to pick a named person |
| **Optional named person on template task** | Exists in backend, but **should not be used** on the template after this decision |
| **Start Employee Onboarding** | Copies template tasks to that employee |
| **Manager auto-link (partial)** | If owner = MANAGER, system can attach new hire’s reporting manager |
| **Employee auto-link (partial)** | If owner = EMPLOYEE, system can attach the new hire |
| **Start / Complete / Skip task APIs** | Task status can move forward |
| **Permissions on screens** | Some users can open onboarding screens; this is **not yet** “see only my department’s tasks” |
| **Extra advanced models** (Contribution / Execution Profile / Rules) | Richer “who executes” design exists, but **not used** when starting onboarding today |

So: **the backend can store department on a task**, which matches the locked decision.  
It does **not** yet treat department as an inbox that the head assigns from.

---

## 6. What is NOT working yet (the gap)

This is why today’s usage still feels like “HR does everything.”

### A. Template still allows naming a person

- Backend can store a specific employee on a template task  
- Intended product rule: **do not assign a person on the template** — department only  
- UI / validation should follow that rule

### B. Permission does not yet mean “see this department’s tasks”

- Today, onboarding permission is mostly “can use the HR onboarding screens”  
- It does **not** yet mean: IT sees IT tasks, Finance sees Finance tasks  
- HR can still complete any task

### C. Department head cannot assign the task to others

- Putting a task under **IT** does **not** create an IT head inbox  
- There is no clear “department head assigns this task to X” step  
- So work never lands on a real doer unless HR (or someone) completes it themselves

### D. Notifications for departments are missing in this path

Intended: when onboarding starts → notify the department (head / users with permission).

Today:

- Employee onboarding start does **not** clearly send “work waiting for your department”  
- People will not know work is waiting unless they open HR screens

### E. No department inbox to work from

- Employee can **see** onboarding in My Workspace (read)  
- Completing is still mainly through HR onboarding screens  
- No clear “my department’s pending onboarding tasks” for IT / Finance / …  
- No “assign to teammate” action for the head

### F. Approvals / waiting for approval

- Database has approval-related fields  
- Live employee-onboarding path does **not** fully run approve/reject for these tasks yet

---

## 7. What we need to do (extra work list)

To match the locked decision, these product + backend pieces are needed:

### Must-have

1. **Template rule: department only**  
   Each support task must have a department. Do not require (or offer) a named person on the template. Keep Employee / Manager as the only auto-resolved people.

2. **Permission = visibility by department**  
   Users see onboarding tasks for departments they are allowed to see. HR can monitor overall progress without completing other departments’ work.

3. **Department head assignment**  
   After onboarding starts, the head (or a permitted assigner) assigns the task to a person in that department. Until then, the task sits in the department queue.

4. **Notify on start**  
   When Employee Onboarding starts → notify the department that has work (“New joiner X — Give laptop is waiting for IT”).

5. **Assigned person completes the task**  
   Only the assigned person (and permitted department assigners, if we allow reassign/complete) should complete it. Not “any HR user completes everything.”

6. **Department inbox / workspace**  
   Each department sees pending onboarding tasks for their department, with assign + complete, without depending on HR to click Complete for everyone.

### Nice / later

7. Reminders if task is overdue or still unassigned  
8. Approval steps where needed (manager confirms IT issued laptop, etc.)  
9. Use the richer Contribution / Execution Rule model only if it still fits this simpler rule: **department on template → permission to see → head assigns**

---

## 8. Summary

| Statement | True? |
|-----------|--------|
| Template assigns a **department**, not a named person | **Yes — this is the locked rule** |
| Permission controls **who can see** those tasks | **Yes — this is the locked rule** |
| Department **head assigns** the task to the person who will do it | **Yes — this is the locked rule** |
| Intended design is already fully live | **No** |
| Backend can already store department on a task | **Yes** |
| Today it still behaves like HR-driven checklist | **Yes** |
| Main missing pieces | **Department-only template rule, permission-based visibility, head assignment, notify, department inbox** |

---

## 9. Short status line

Onboarding templates should assign work to a **department only**. After a hire starts onboarding, **permission** decides who can see that department’s tasks, and the **department head assigns** each task to the person who will do it. The backend can already group tasks by department, but it does not yet hide other departments’ work, notify the department, or let the head assign the task. Until those pieces exist, HR still completes the whole checklist.
