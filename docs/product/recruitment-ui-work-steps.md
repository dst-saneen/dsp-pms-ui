# Recruitment UI — your work steps

**Your scope:** frontend only (`recruitment-to-onboarding-ui-plan.md`)  
**Reference only:** API plan (Jebin)  
**Later (not now):** `onboarding-department-flow-gap-explained.md`

---

## Now — build in this order

### Step 1 — Lock the contract for UI
- Shared types, enums, errors, permissions, query keys, route map  
- Match the API plan; do not invent statuses or rules in the browser  

### Step 2 — Recruitment shell
- Add **Recruitment** under Human Resources  
- Routes, nav (permission-aware), feature shell  
- Shared badges, list primitives, loading/empty/error patterns  

### Step 3 — Job Openings
- Opening list (filters, status, next action)  
- Opening editor (job details, org, hiring manager, headcount, criteria)  
- Publication checklist + Publish / Hold / Close  

### Step 4 — Candidates & Applications
- Candidate intake (internal HR entry)  
- Application list + filters  
- Application detail tabs: Overview, Documents, Interviews, Evaluations, Offer, Timeline  
- Authorized transitions (screen, interview, reject, withdraw)  

### Step 5 — Interviews & panel
- Interview calendar / list  
- Scheduler (round, panel, mode, deadline)  
- Panel **My Workspace**: assigned interviews, draft + submit evaluation  
- Evaluation form (scores, recommendation, notes) — submitted = read-only  

### Step 6 — Hiring Manager decisions
- **Hiring Decisions** queue in My Workspace  
- Compare candidates, review permitted summaries  
- Select / reject (no offer/convert/compensation unless permitted)  

### Step 7 — Offers
- Offer composer  
- Send / retry email / revoke / revise  
- Version history (read-only after send)  

### Step 8 — Public Careers
- `/careers/[companyCode]` listing  
- Job detail + application form (CV upload, privacy, honeypot / Turnstile as planned)  

### Step 9 — Public offer response
- Token validate → show offer → Accept / Decline  
- Safe expired / revoked / already-responded states  
- Never store token in local/session storage  

### Step 10 — Ready to Hire → Employee
- Preflight checklist from server  
- Convert Candidate → Employee  
- Redirect to Employee Detail (Career + Onboarding tabs)  

### Step 11 — Employee entry & career UI
- Replace normal **Add Employee** with **Recruit Candidate** path  
- Career tab (milestones; HR full vs employee sanitized)  
- Probation queue / confirm Active (server-driven)  

### Step 12 — Hardening
- Component tests + Playwright persona flow  
- Responsive, accessibility, security (no confidential leak)  
- Feature flags, UAT, release gates  

---

## After this UI is done (later)

### Step 13 — Connect to department onboarding
Only after Recruitment → Convert → Employee works:

- Use `docs/product/onboarding-department-flow-gap-explained.md`  
- Route tasks by department / owner  
- Notify owners on start  
- Each department completes their own tasks  

**Do not start Step 13 now.**

---

## One-line plan

**Build Recruitment UI end-to-end (Steps 1–12) → then improve department-wise Onboarding (Step 13).**
