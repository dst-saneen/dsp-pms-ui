# Collaborative UAT Checklist — All Phases

**Execution ID:** `UAT-E2E-20260903-01`  
**Guide:** `docs/testing/erp-complete-website-workflow-and-manual-e2e-test-guide.md`  
**Run dates:** 3–4 September 2026  
**Overall result:** **Pass** (Phases 1–10 complete; accepted Partials listed below)  
**Website / API:** http://localhost:3200 · http://localhost:4500  

**Tenant A:** E2E Atlas Group UAT-E2E-20260903-01 · Atlas Services · Kochi HQ  
**Tenant B (Phase 10 isolation):** Learn Fresh Org 01 · Learn Fresh Company 01  

| Role | Username / code |
|------|-----------------|
| Owner (maker) | `owneratlasuate2e.b1627019` · `EMP-000031` |
| Arun (employee) | `arun.saanlo` · `EMP-000032` |
| Ishan IT | Ishan IT · `EMP-000033` |
| HR Approver | `hr.approver.uate2e20260903` · `EMP-HR-60903-01` |

**Key evidence:** Arun ACTIVE · Project `PRJ-000002` · Payroll `PR-000002` PAID net `111500.00` · 2 AVAILABLE payslips  

---

## Phase roll-up

| Phase | Focus | Result | Completed |
|------:|-------|--------|-----------|
| 1 | Foundation (auth / org) | **Pass** | 3 Sep 2026 |
| 2 | Recruitment → hire Arun | **Pass** | 3–4 Sep 2026 |
| 3 | Onboarding → Active | **Pass** | 4 Sep 2026 |
| 4 | Employee Documents | **Pass** | 4 Sep 2026 |
| 5 | Day-to-day HR | **Pass** (11/11) | 4 Sep 2026 |
| 6 | Asset V2 | **Pass** (AST-010 Partial) | 4 Sep 2026 |
| 7 | Project Lite | **Pass** (PRJ-010 Partial) | 4 Sep 2026 |
| 8 | Office Finance Lite | **Pass** (FIN-007 Partial) | 4 Sep 2026 |
| 9 | Payroll Lite | **Pass** (11/11) | 4 Sep 2026 |
| 10 | Delivery / isolation / sign-off | **Pass** (DEL/OPS Partial) | 4 Sep 2026 |

**Accepted Partials:** AST-010 · PRJ-010 · FIN-007 · DEL-001 · DEL-002 · DEL-003 · OPS-001  
**Optional not run:** ONB-006  

---

## Phase 1 — Foundation

| Task | Guide ID | Result | Notes |
|------|----------|--------|-------|
| 1 | AUTH-001 | **Pass** | Login / logout |
| 2 | REG-001 | **Pass** | Register org + OTP |
| 3 | ORG-001 | **Pass** | Onboarding wizard |
| 4a | ORG-002 | **Pass** | Branch timezone edit (after trigger fix) |
| 4b | — | **Pass** | Password ≠ email (after policy fix) |
| 4c | ORG-002 | **Pass** | Companies, branches, departments, designations, shifts |
| 5 | AUTH-002/003 | **Pass** | Forgot / change password |

**Fixes:** Password≠email policy (BE+FE); branch reparent trigger migration.

---

## Phase 2 — Recruitment → hire Arun

| Task | Guide ID | Result | Notes |
|------|----------|--------|-------|
| 1 | REC / HIRE path | **Pass** | Opening → publish → apply → interview → offer → convert → invite |
| 2 | — | **Pass** | Hiring manager = Owner; Arun created as `EMP-000032` |

**Evidence:** Opening `Software Engineer UAT-E2E-20260903-01`.

---

## Phase 3 — Onboarding → Active

| Task | Guide ID | Result | Notes |
|------|----------|--------|-------|
| 1 | ONT-001 | **Pass** | Open SE UAT Onboarding template |
| 2 | ONT-002 | **Pass** | Draft + HR/IT task groups |
| 3 | ONT-003 | **Pass** | Checklist + laptop asset tasks |
| 4 | ONT-004 | **Pass** | Validate + publish Version 2 |
| 5 | ONT-005 | **Pass** | Auto designation/branch resolution |
| 6 | ONB-001 | **Pass** | Preflight + start V2 for Arun |
| 7 | ONB-002 | **Pass** | HR monitoring |
| 8 | ONB-003 | **Pass** | Dept queue assign IT → Ishan |
| 9 | ONB-004 | **Pass** | Complete checklist tasks |
| 10 | ONB-005 | **Pass** | Fulfil Assign laptop (E2E Laptop 2) |
| 11 | ONB-006 | Not run | Optional skip/reopen/waive |
| 12 | ONB-007 | **Pass** | Complete Onboarding (after statusV2 sync fix) |
| 13 | ONB-008 | **Pass** | Probation → Active |

**Fixes:** Template clone/tenant snapshot; designer UX; asset types empty-state; V2 list unwrap; status badge sync; assignee/fulfil flow.

---

## Phase 4 — Employee Documents

| Task | Guide ID | Result | Notes |
|------|----------|--------|-------|
| 1–3 | DOC-001 | **Pass** | Categories + Passport / Degree types |
| 4–5 | DOC-002 | **Pass** | Upload Passport → clean scan → verify → download |
| 6 | DOC-003 | **Pass** | Reject + reset Degree |
| 7 | DOC-004 | **Pass** | Recruitment → employee doc mapping |

**Fixes:** S3 presigned PUT checksum; CORS → authenticated upload proxy; verify/download UX.

---

## Phase 5 — Day-to-day HR

| Task | Guide ID | Result | Notes |
|------|----------|--------|-------|
| 1–3 | CAL | **Pass** | Business calendar |
| 4 | SCH-001 | **Pass** | Work schedule |
| 5–7 | ATT | **Pass** | Attendance |
| 8 | LEV-001/002 | **Pass** | Leave types / request |
| 9 | LEV-003 | **Pass** | Leave approval |
| 10 | OVT-001/002 | **Pass** | Overtime |
| 11 | CO-001 | **Pass** | Comp-off half-day 2026-09-09 APPROVED |

**Evidence:** Leave `3b384f5a-…` · credit USED 0.5 · Maker≠Approver.

---

## Phase 6 — Asset V2

| Task | Guide ID | Result | Notes |
|------|----------|--------|-------|
| 1 | AST-001 | **Pass** | Categories / types |
| 2 | AST-002 | **Pass** | IT dept grant for Ishan |
| 3 | AST-003 | **Pass** | Inventory `AST-000001`…`AST-000004` |
| 4 | AST-004 | **Pass** | Laptop 1 → Ishan |
| 5 | AST-005 | **Pass** | Concurrent assign: one win / one 409 |
| 6 | AST-006 | **Pass** | Arun return Laptop 2 |
| 7 | AST-007 | **Pass** | Licence seat capacity |
| 8 | AST-008 | **Pass** | Transfer accept/reject/cancel |
| 9 | AST-009 | **Pass** | Repair / lost / suspend rules |
| 10 | AST-010 | **Partial** | Clearance preflight OK; full waiver needs separation |

**Fixes:** Asset V2 allowlist; scope resolver uses selected Company/Branch.

---

## Phase 7 — Project Lite

| Task | Guide ID | Result | Notes |
|------|----------|--------|-------|
| 1 | PRJ-001 | **Pass** | Projects Lite enabled |
| 2 | PRJ-002 | **Pass** | `PRJ-000002` DRAFT |
| 3 | PRJ-003 | **Pass** | Stages / team / task → Arun |
| 4 | PRJ-004 | **Pass** | Activate → Hold → Resume |
| 5–6 | PRJ-005/006 | **Pass** | Submit / return / complete |
| 7–8 | PRJ-007/008 | **Pass** | Timesheet submit / approve |
| 9 | PRJ-009 | **Pass** | Complete + archive |
| 10 | PRJ-010 | **Partial** | Client project blocked until Finance; resources 400 deferred |

**Fixes:** Projects Lite env allowlist; assign authority; `projects.*` permissions.

---

## Phase 8 — Office Finance Lite

| Task | Guide ID | Result | Notes |
|------|----------|--------|-------|
| 1 | FIN-001 | **Pass** | Profile INR; reporting start 2026-01-01 |
| 2 | FIN-002 | **Pass** | Customer + Vendor parties |
| 3 | FIN-003 | **Pass** | Income / Expense / Payroll categories |
| 4 | FIN-004 | **Pass** | Petty Cash + Operating Bank |
| 5 | FIN-005 | **Pass** | Period 2026-09 OPEN |
| 6 | FIN-006 | **Pass** | Draft Income/Expense/Transfer |
| 7 | FIN-007 | **Partial** | Upload session OK; full Clean scan needs File Scan worker |
| 8 | FIN-008 | **Pass** | Maker-checker (self-approve 409) |
| 9 | FIN-009 | **Pass** | Reverse once; second reverse 409 |
| 10 | FIN-010 | **Pass** | Lock / reopen period |
| 11 | FIN-011 | **Pass** | Reports + CSV |

**Fixes:** Finance allowlist; upload-session DB checks migration; party archive `reason`.

---

## Phase 9 — Payroll Lite

| Task | Guide ID | Result | Notes |
|------|----------|--------|-------|
| 1 | PAY-001 | **Pass** | Payroll workspace reachable |
| 2 | PAY-002 | **Pass** | Basic / Housing / Deduction components |
| 3 | PAY-003 | **Pass** | Salary revisions Owner + Arun |
| 4 | PAY-004 | **Pass** | Preflight clean; attendance PAYROLL_PENDING |
| 5 | PAY-005 | **Pass** | Draft `PR-000002` + adjustment |
| 6 | PAY-006 | **Pass** | Calculate → CALCULATED |
| 7 | PAY-007 | **Pass** | Return to draft → recalculate |
| 8 | PAY-008 | **Pass** | Approver approve; self/replay 409 |
| 9 | PAY-009 | **Pass** | Mark paid → Finance expense; PAID |
| 10 | PAY-010 | **Pass** | Payslip AVAILABLE; Arun download OK; other blocked |
| 11 | PAY-011 | **Pass** | Duplicate month blocked; CSV safe |

**Fixes:** Payroll allowlist; salary line createMany; mark-paid unique operationId; generated CLEAN evidence (`clamAvResult`/`scannedAt`).

---

## Phase 10 — Delivery / isolation / sign-off

| Task | Guide ID | Result | Notes |
|------|----------|--------|-------|
| 1 | WRK-001 | **Pass** | Arun My Workspace + payslips |
| 2 | WRK-002 | **Pass** | Owner scope; no Tenant B leak |
| 3 | WRK-003 | **Pass** | Kochi ↔ Bengaluru context switch |
| 4 | WRK-004 | **Pass** | Notifications + deep `href` |
| 5 | DEL-001 | **Partial** | Queue empty (`DELIVERY_V2_ENABLED=false`) |
| 6 | DEL-002 | **Partial** | No retryable DeliveryMessage |
| 7 | DEL-003 | **Partial** | Platform dead-letters need `platform.delivery.*` |
| 8 | DEL-004 | **Pass** | Recipient-exceptions OK |
| 9 | OPS-001 | **Partial** | Queue API healthy; no live V2 messages |
| 10 | OPS-003 | **Pass** | File ops; employee denied |
| 11 | OPS-004 | **Pass** | Retention; no purge |
| 12 | ISO-001 | **Pass** | Cross-tenant lists clean |
| 13 | ISO-002 | **Pass** | Direct-ID denial → safe 404 |
| 14 | ISO-003 | **Pass** | Cross-company hijack rejected |
| 15 | ISO-004 | **Pass** | Employee payroll approve forbidden |
| 16 | CON-009 | **Pass** | Leave approve replay 409 |
| 17 | CON-012 | **Pass** | Payroll approve/dup-month blocked |
| 18 | UX-003 | **Pass** | Denied + empty shapes |
| 19 | DB-001 | **Pass** | DB reconciles PAID run + payslips |
| 20 | GOLD-001 | **Pass** | Hire → work → finance → payroll chain |
| 21 | SIGNOFF-001 | **Pass** | No Fail/Blocked |

**Fixes:** Notification deep links (`notification-href.ts` + My Workspace links).

---

## Build check (4 Sep 2026)

| App | Result |
|-----|--------|
| Backend `pnpm run build` | **Pass** |
| Frontend `pnpm run build` | **Pass** (after onboarding TS cast + dueDays nullability fixes) |

---

*Companion summary for manager: `UAT-E2E-20260903-01-summary.md`*
