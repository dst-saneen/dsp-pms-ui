# Payroll Gap Analysis & Implementation Approval

> **Audience:** Product + engineering leadership  
> **Purpose:** Final approval of what to build next for payroll  
> **Constraint:** Analysis only — no application code changed for this document  
> **Sources:** [Frappe HR Payroll reference](../../../reference/frappe-hr-payroll.md), our Payroll Lite implementation, Prisma schema, Nest payroll services, Next.js `/hr/payroll` UI
> **Non-goal:** Do **not** migrate to Frappe HR or copy Frappe Python/DocType architecture

---

## 1. Executive Summary

We already ship a production-oriented **Payroll Lite**: company-scoped salary components, effective-dated employee salary revisions, fixed monthly tax profiles, recurring deductions, monthly payroll runs with preflight → calculate → maker-checker approve → mark paid → aggregate Office Finance expense → secure payslip PDF.

Compared with the Frappe HR payroll reference, our **biggest gaps** are not “missing CRUD screens” — they are **calculation sophistication**: no shared salary-structure templates, no payment-days / LWP / attendance proration engine, no annualized progressive tax, and overtime / unpaid leave are **warnings + manual adjustments**, not automatic money conversion (by design in `docs/development/payroll-lite-db-api-ui-implementation-plan.md`).

**Recommended direction:** Keep our NestJS + Prisma + Next.js architecture. Enhance Payroll Lite in phases — first decide auto-proration and tax jurisdiction rules, then deepen the existing calculation service and adjustment bus. Do **not** port Frappe DocTypes, Python `safe_eval`, or ERPNext GL coupling.

**Ask for approval:** Confirm (a) scope for the next build phase, (b) tax approach, (c) attendance vs leave for payroll days, (d) whether OT/LWP remain manual or become system-calculated, and (e) what stays deferred.

---

## 2. Current State (Our System)

### 2.1 What payroll features we already have

| Area | What we have | Evidence |
|------|----------------|----------|
| Salary component master | Company-scoped `EARNING` / `DEDUCTION` components with archive/version | `SalaryComponent` in `backend/prisma/schema.prisma`; `PayrollSalaryComponentsService`; UI `SalaryComponentsTab` |
| Employee salary assignment | Effective-dated **salary revisions** with fixed line amounts (not shared templates) | `EmployeeSalary` + `EmployeeSalaryLine`; `PayrollEmployeeInputsService.createSalaryRevision`; UI `EmployeeSalariesTab` |
| Tax | **Fixed monthly amount** per employee tax profile (effective-dated) | `EmployeeTaxProfile.monthlyTaxAmount`; `TaxProfilesTab` |
| Recurring deductions | Fixed monthly amounts with start/end month (loan recovery can be modeled manually) | `EmployeeDeduction`; `RecurringDeductionsTab` |
| Payroll run batch | Monthly run: DRAFT → CALCULATED → APPROVED → PAID / CANCELLED | `PayrollRun`, `PayrollRunsService`, UI `PayrollRunsTab` |
| Preflight | Blockers (finance setup, attendance period readiness, overlaps) + warnings (missing salary/tax, joiner/leaver, unclaimed OT/LWP) | `PayrollPreflightService` |
| Calculation | Sums salary lines + tax + recurring deductions + run adjustments; blocks negative net | `PayrollCalculationService` |
| Adjustments bus (run-scoped) | Manual / OVERTIME / UNPAID_LEAVE adjustments with amount + reason | `PayrollRunAdjustment`; line source enum `PayrollLineSource` |
| Attendance coupling | Requires branch `AttendancePeriod` in `PAYROLL_PENDING` or `CLOSED`; snapshots link on calculate | `PayrollRunAttendancePeriod`; preflight `ATTENDANCE_PERIOD_NOT_READY` |
| Overtime coupling | Approved `PAYROLL_PENDING` OT warns if no adjustment | `OvertimeRequest` + preflight `UNCLAIMED_OVERTIME` |
| Unpaid leave coupling | Approved leave where `LeaveType.isPaid = false` warns if no adjustment | preflight `UNCLAIMED_UNPAID_LEAVE` |
| Approvals | Maker-checker: creator/calculator cannot approve | `PayrollRunsService.approve` |
| Payslips | Generated after paid; secure file storage; employee self-download | `PayrollPayslip`, `PayrollPayslipsService` |
| Finance | Aggregate confidential payroll expense on mark paid | `PayrollExpenseService` |
| UI workspace | `/hr/payroll` tabs: runs, components, salaries, tax, deductions, payslip ops, reports | `frontend/features/payroll/components/payroll-workspace.tsx` |
| Ops safety | Versioned commands, command receipts, action events, feature gate | `PayrollCommandReceipt`, `PayrollActionEvent`, `PayrollFeatureGuard` |

**Locked product behavior (from our own plan):** Attendance / Leave / OT are **evidence and warning sources**; Payroll Lite does **not** convert days/hours into money automatically. Joiner/leaver/LWP/OT money changes require **reviewed adjustments**. Statutory formula engines, automatic proration, bank files, and multi-currency are explicitly deferred.

### 2.2 Current calculation flow (as implemented today)

```
Employee (active + eligible employment status)
  └─ EmployeeSalary revision effective for period (fixed component lines)
  └─ EmployeeTaxProfile (optional fixed monthlyTaxAmount)
  └─ EmployeeDeduction[] (active for period)
       │
HR creates PayrollRun (year/month) ── DRAFT
  └─ Preflight: finance readiness, one run/month, attendance periods ready,
     salary/tax overlap blockers, warnings for missing salary/tax,
     joiners/leavers, unclaimed OT / unpaid leave
       │
Optional: PayrollRunAdjustment[] (MANUAL | OVERTIME | UNPAID_LEAVE)
  └─ Amounts entered by maker (system does not compute OT hours → money)
       │
Calculate (PayrollCalculationService)
  ├─ Snapshot AttendancePeriods linked to run
  ├─ For each eligible employee with effective salary:
  │    lines = salary component amounts (as-is, no proration)
  │          + TAX line (if profile)
  │          + RECURRING_DEDUCTION lines
  │          + adjustment lines
  │    gross = sum(earnings)
  │    totalDeductions = sum(deductions)
  │    net = gross − totalDeductions  (must be ≥ 0)
  │    persist PayrollRunEmployee + PayrollRunEmployeeLine[]
  └─ Run → CALCULATED
       │
Approve (different user) → APPROVED
Mark paid (payment account + reference) → PAID
  ├─ Create aggregate Office Finance expense
  └─ Queue/generate PayrollPayslip PDFs (secure storage; not email attachments)
```

**Contrast with Frappe order:** We do **not** currently compute working/payment days, evaluate formulas, annualize tax, or subtract loans outside the deduction total. Adjustments are included in the same deduction/earning sum.

### 2.3 Key tables / APIs / services / files

**Tables (Prisma):** `SalaryComponent`, `EmployeeSalary`, `EmployeeSalaryLine`, `EmployeeTaxProfile`, `EmployeeDeduction`, `PayrollRun`, `PayrollRunEmployee`, `PayrollRunEmployeeLine`, `PayrollRunAdjustment`, `PayrollRunAttendancePeriod`, `PayrollPayslip`, `PayrollActionEvent`, `PayrollCommandReceipt`  
**Related workforce:** `AttendancePeriod`, `LeaveType` (`isPaid`), `LeaveRequest`, `OvertimeRequest` (`approvedSettlement = PAYROLL_PENDING`)

**APIs (Nest, under `/payroll`, feature-gated):**  
`GET /payroll/preflight`, `CRUD-ish /payroll/runs` (+ calculate / return-to-draft / approve / mark-paid / cancel / adjustments / register.csv), `/payroll/salary-components`, `/payroll/employees/:id/salary-revisions|tax-profiles|deductions`, `/payroll/payslips`, `/payroll/dashboard`

**Core services:**  
`backend/src/modules/payroll/services/payroll-calculation.service.ts`  
`backend/src/modules/payroll/services/payroll-preflight.service.ts`  
`backend/src/modules/payroll/services/payroll-runs.service.ts`  
`backend/src/modules/payroll/services/payroll-employee-inputs.service.ts`  
`backend/src/modules/payroll/services/payroll-payslips.service.ts`  
`backend/src/modules/office-finance/services/payroll-expense.service.ts`

**Frontend:** `frontend/app/(dashboard)/hr/payroll/`, `frontend/features/payroll/`

**Note:** There is also a legacy-looking `backend/src/modules/payroll-run/` and `employee-salary/` module with older wording (“salary structure”). Canonical Payroll Lite path is the `payroll` module + Prisma models above. Treat older modules as **Unknown — needs confirmation** before any dual-write cleanup.

---

## 3. Reference State (From Frappe Analysis)

Frappe models payroll as: **component masters → structure templates → employee structure assignment (base + tax slab + effective date) → adjustments bus (Additional Salary) → payroll entry batch → salary slip engine**.

Inside each slip, calculation order is fixed: **working/payment days (attendance XOR leave) → resolve assignment → earnings (+ proration) → gross → non-tax deductions → annualized tax → loans → net**.

Key ideas worth learning (concepts only): component flags, structure vs assignment split, payment-days engine, universal adjustment bus, annualized progressive TDS, OT computed outside the slip then injected, eligibility/idempotency on batch runs.

---

## 4. Feature Comparison Matrix

| Frappe feature / concept | What Frappe does (short) | What we already have | Status | Business impact if missing | Recommendation | Priority | Suggested approach in OUR architecture |
|--------------------------|--------------------------|----------------------|--------|----------------------------|----------------|----------|----------------------------------------|
| Salary component master | Typed master with flags (payment-days, taxable, statistical, formula defaults) | `SalaryComponent` with `EARNING`/`DEDUCTION` only; no payroll flags | **Partial** | Cannot drive proration/tax/formula without hardcoding | **Enhance** | P0 | Add nullable flag columns on `SalaryComponent` (e.g. `dependsOnPaymentDays`, `isTaxable`, `includeInGross`); keep Nest CRUD + existing UI |
| Salary structure templates | Reusable template of components + formulas per band/role | No shared template table; each `EmployeeSalary` carries its own lines | **Missing** | Raises/band changes require editing every employee; inconsistent packages | **Build new** (lightweight) | P1 | New `SalaryStructure` + `SalaryStructureLine` tables; UI to create templates; assignment copies or references structure into revision — **no** Python formula DSL initially |
| Employee salary assignment / effective dating | SSA: structure + base + variable + tax slab + `from_date` | `EmployeeSalary` revisions with `effectiveFrom`/`effectiveTo` + fixed amounts; tax separate | **Partial** | We have history/raises; lack base/structure link and mid-period dual-revision prorate | **Enhance** | P0 | Keep revision model; optionally link `structureId` + `baseSalary`; calc resolves revision as-of period (document multi-revision-in-month rule) |
| Payroll run / batch | Payroll Entry: select employees → create/submit slips → bank | Monthly `PayrollRun` with full lifecycle + eligibility + one-run-per-month | **Already Have** | — | **Keep as-is** | — | Continue Nest run state machine; add filters later if needed |
| Salary slip / payslip calculation | Full recalc engine per employee | Snapshot lines on calculate; payslip PDF after paid | **Partial** | Correct for fixed packages; wrong for day-based pay | **Enhance** | P0 | Extend `PayrollCalculationService` as single calc orchestrator; keep payslip as presentation of snapshot |
| Earnings & deductions | Structure rows + Additional Salary; earnings before deductions | Fixed salary lines + tax + recurring + adjustments summed | **Partial** | Dependent % of gross / PF-style rules hard | **Enhance** | P1 | Support simple calc types on lines (`FIXED`, `PERCENT_OF_BASE`, `PERCENT_OF_GROSS`) in our DB — defer sandboxed formula language |
| Payment days / attendance impact | Settings + attendance reduce payment days | Attendance period is a **gate/snapshot**, not a day engine | **Missing** | Unpaid absences don’t auto-affect pay; ops risk / fairness disputes | **Build new** *if* product chooses auto-proration | P0 | New `PayrollSettings` + `computePaymentDays()` service consuming Attendance + calendar; unit-test mid-join/LWP/half-day |
| Leave / LWP | Leave apps or attendance LWP/PPL → prorate | Unpaid leave → **warning**; money via manual `UNPAID_LEAVE` adjustment | **Partial** | Manual effort; inconsistent LWP amounts | **Enhance** or keep manual | P0 | Decision: auto-deduct from payment days **or** assisted adjustment wizard prefilled from leave days × daily rate |
| Tax calculation | Annualized progressive TDS from slabs + exemptions | Fixed `monthlyTaxAmount` on `EmployeeTaxProfile` | **Partial** | Wrong TDS for progressive jurisdictions; compliance risk | **Enhance** / **Defer** by jurisdiction | P0/P1 | Keep fixed monthly as Regime A; if India-like needed, add `TaxYear` + slabs + `TaxService` called after earnings — do not replace profile overnight |
| Tax exemption declaration/proof | Mid-year declaration; year-end proofs | Not present | **Missing** | Needed only if annualized progressive tax | **Defer** until tax engine approved | P2 | Tables + Nest APIs under tax module when Phase tax starts |
| Overtime | OT slip → Additional Salary → slip | OT module exists; payroll only warns; amount manual | **Partial** | OT pay errors / missed OT | **Enhance** | P1 | Service: approved OT → suggested `PayrollRunAdjustment` (hours × rate × multiplier from `OvertimePolicy`); maker confirms |
| Loans / advances recovery | Loans outside deductions; advances via Additional Salary | No dedicated loan module; recovery via `EmployeeDeduction` or manual adjustment | **Partial** / **Unknown** | Double-count or missed recovery | **Keep as-is** short term; enhance later | P2 | Continue recurring deduction for recovery; if loan module appears, map repayments to separate `loanRepayment` total on run employee |
| Additional salary / adjustments | Universal recurring/one-off bus across periods | `PayrollRunAdjustment` **scoped to a run** | **Partial** | Harder to schedule recurring bonuses outside a run | **Enhance** | P1 | Add optional org-level `PayrollAdjustment` (date range) applied at calculate; keep run-level overrides |
| Approvals / workflow | Optional Frappe workflow; submit gates | Maker-checker on run approve; versioned commands | **Already Have** | — | **Keep as-is** | — | Optionally plug company approval framework later; not a Frappe port |
| Mid-join / mid-exit proration | Clip employment window → fewer payment days | **Warning only** (`JOINER_IN_PERIOD` / `LEAVER_IN_PERIOD`) | **Missing** (auto) | Overpay first/last month unless manual adjust | **Build new** with payment-days OR assisted adjust | P0 | Same payment-days service; or preflight-assisted deduction suggestion |
| Duplicate payslip / period prevention | No second submitted slip for same dates | Unique non-cancelled run per company/month; employee unique per run | **Already Have** | — | **Keep as-is** | — | Retain uniqueness + preflight `PAYROLL_PERIOD_EXISTS` |
| Formula-based components | Python-like safe_eval on structure | Fixed amounts only | **Missing** | Needed for complex CTC breakup | **Defer** | P2/P3 | Prefer typed calc modes first; only add expression sandbox with explicit security review |
| Payroll settings | Global switches (attendance vs leave, holidays, rounding) | Feature readiness flags; no payroll days settings entity | **Missing** | Ambiguous rules across companies | **Build new** | P0 | `payroll_settings` per company (JSON or table) owned by payroll module |
| Employer contributions / CTC view | Employer PF etc. display, not in net | Not modeled (`SalaryComponentType` has no EMPLOYER) | **Missing** | CTC reporting incomplete | **Defer** | P2 | Add `EMPLOYER` component type + display-only lines |
| Arrears / payroll correction | Structure-change back-pay; LWP fix → Additional Salary | Paid runs immutable; later-run adjustments | **Partial** | Corrections possible manually; no guided arrear | **Defer** / light enhance | P2 | Guided “correction adjustment” templates on next run |
| Salary withholding | Hold bank payment; slip exists | Not present | **Not Needed** initially / **Defer** | Legal hold scenarios | **Defer** | P3 | Flag on `PayrollRunEmployee` excluding from payment export when bank files exist |
| Flex benefits / gratuity / timesheet wage | Specialty Frappe modules | Not present | **Not Needed** now | Only if product sells these | **Defer** | P3 | Separate domains later |
| Payslip PDF / delivery | Email/PDF on submit | Secure PDF + download grant; not email-attached | **Already Have** (different delivery model) | — | **Keep as-is** | — | Preserve secure storage model; optional notify via Delivery V2 |
| Bank payment file | Make bank entry / export | Manual payment reference only | **Missing** | Ops still leave system for bank upload | **Defer** | P2 | Export CSV/SEPA later; do not auto-initiate transfers |
| Accounting / JE coupling | ERPNext journal entries | Aggregate Finance expense only (no employee lines) | **Already Have** (lite) | Fine for Payroll Lite confidentiality | **Keep as-is** | — | Do not copy ERPNext GL line coupling |
| Regional / India statutory extras | HRA/PT/etc. hooks | Not present | **Unknown** — needs country decision | Compliance | **Defer** until jurisdiction decided | P1/P2 | Extension point in `TaxService` / regional adapter — TypeScript, not Frappe regional Python |

---

## 5. Critical Gaps (P0/P1)

### 5.1 Payment days / LWP / mid-join proration (P0)

- **Why it matters:** Most payroll disputes are “days paid.” Frappe’s core correctness comes from payment-days math. We warn on joiners/leavers/unpaid leave but still pay full fixed package unless a human adjusts.
- **Risk if we don’t build:** Systematic overpay/underpay; audit findings; ops burnout entering adjustments.
- **Proposed approach:** Company `PayrollSettings` + `PaymentDaysService` in Nest using Attendance Period finalization and/or approved unpaid leave (`LeaveType.isPaid = false`). `PayrollCalculationService` prorates components flagged `dependsOnPaymentDays`.
- **Effort:** **L**
- **Dependencies:** Business decision (attendance vs leave), holiday/calendar source, Attendance Period closedness (already gated).

### 5.2 Explicit product decision: keep manual adjustments vs auto-money (P0 decision)

- **Why it matters:** Our Payroll Lite contract intentionally keeps OT/LWP as reviewed adjustments. Changing this is a product/compliance shift, not a small refactor.
- **Risk if undecided:** Engineering builds the wrong engine; UAT thrash.
- **Proposed approach:** Approve one mode: (A) **Assisted manual** — system suggests amounts, maker confirms; (B) **Automatic** — system posts lines, maker reviews run totals.
- **Effort:** Decision **S**; implementation **M–L**
- **Dependencies:** Finance/HR policy owners.

### 5.3 Tax approach for progressive jurisdictions (P0/P1)

- **Why it matters:** Fixed monthly tax is operationally simple but legally wrong for annual progressive TDS (e.g. India).
- **Risk if we don’t build (when required):** Incorrect withholding, employee refunds/shortfalls, statutory exposure.
- **Proposed approach:** Keep `EmployeeTaxProfile.monthlyTaxAmount` as Regime A. If Regime B approved, add tax year + slabs + annual projection service invoked after earnings in calculation order — mirror Frappe **math**, not Frappe DocTypes.
- **Effort:** Regime A keep **S**; Regime B **L**
- **Dependencies:** Target country/tax year; exemption process ownership.

### 5.4 Salary structure templates (P1)

- **Why it matters:** Without templates, every hire/raise re-enters the full breakup; banding drifts.
- **Risk:** Payroll setup cost; inconsistent CTC; harder mass revisions.
- **Proposed approach:** `SalaryStructure` master; “apply to employee” creates `EmployeeSalary` revision lines (copy-on-assign first). Optional later: live reference + override amounts.
- **Effort:** **M**
- **Dependencies:** Component flags/calc types for meaningful templates.

### 5.5 Overtime → payroll money path (P1)

- **Why it matters:** We already track approved OT with `PAYROLL_PENDING` settlement; money path is incomplete.
- **Risk:** Missed OT payouts; inconsistent rates.
- **Proposed approach:** From `OvertimeRequest.calculationSnapshot` + policy multipliers, generate suggested earning adjustment; mark OT settled when run paid (or when adjustment confirmed).
- **Effort:** **M**
- **Dependencies:** Confirmed hourly rate source (salary components vs fixed rate) — **Unknown — needs confirmation** what `calculationSnapshot` already contains for money.

### 5.6 Component flags + simple percent calcs (P0/P1)

- **Why it matters:** Foundation for proration and PF-like deductions without a formula DSL.
- **Risk:** Every new rule becomes a code fork.
- **Proposed approach:** Extend `SalaryComponent` / revision lines with flags and `calcType`; evaluate inside `PayrollCalculationService` in earnings→gross→deductions order.
- **Effort:** **M**
- **Dependencies:** Schema migration approval; UI for flags.

### 5.7 Cross-run / recurring adjustments bus (P1)

- **Why it matters:** Frappe’s Additional Salary works across periods; ours is run-scoped only.
- **Risk:** Recurring incentives/recoveries require re-entry each month.
- **Proposed approach:** Optional `PayrollAdjustmentSchedule` applied at calculate into run lines; retain run-level `PayrollRunAdjustment` for one-offs.
- **Effort:** **M**
- **Dependencies:** None major.

---

## 6. What We Should NOT Copy From Frappe

- Frappe **DocType JSON** schemas as our Prisma models 1:1  
- Python **`safe_eval` / formula DSL** as the first calculation strategy  
- **ERPNext Journal Entry** / Lending app coupling  
- Bench/site multi-tenancy and Desk child-table UX patterns  
- Porting `salary_slip.py` (~2.7k lines) into Nest as a transliteration  
- Emailing payslip files as unrestricted attachments (we use secure storage + grants)  
- Assuming India regional modules are required for all companies  
- Replacing our maker-checker / command-receipt / feature-gate model with Frappe Workflow  
- Treating Frappe “submit” document states as mandatory UX for every master  

---

## 7. Recommended Target Architecture (Our Stack)

### 7.1 Domain model (enhance, don’t replace)

```
SalaryComponent (+ flags, calc defaults)
      │
SalaryStructure (optional template) ──► EmployeeSalary revision (effective dating)
                                              │
EmployeeTaxProfile (Regime A fixed OR link to TaxRegime)
EmployeeDeduction / LoanRecovery (recurring)
PayrollAdjustmentSchedule (optional cross-run bus)
      │
AttendancePeriod + LeaveRequest + OvertimeRequest ──► PaymentDays / suggested adjustments
      │
PayrollRun (batch lifecycle we already have)
      │
PayrollCalculationService (single orchestrator)
      │
PayrollRunEmployee + Lines (immutable snapshot)
      │
Approve → Mark paid → Finance aggregate expense → PayrollPayslip
```

### 7.2 Calculation order we should enforce

1. Resolve employment window (join / separation clip)  
2. Compute `totalWorkingDays`, `lwpDays`, `absentDays`, `paymentDays` (**if** auto-proration approved; else skip and rely on adjustments)  
3. Resolve effective `EmployeeSalary` (+ optional structure)  
4. Evaluate **earnings** (fixed / % of base) → apply payment-days factor where flagged → apply earning adjustments  
5. `gross`  
6. Evaluate **non-tax deductions** (fixed / % of gross) + recurring deductions + deduction adjustments  
7. **Tax** (Regime A: profile amount; Regime B: annualized service)  
8. Loan repayments (**if** introduced — keep separate from normal deductions)  
9. `net = gross − deductions − loans`; reject `net < 0` (already enforced)  
10. Persist snapshot lines with source provenance  

### 7.3 How adjustments / OT / tax / LWP plug in

| Input | Plug-in point |
|-------|----------------|
| LWP / unpaid leave | Prefer payment-days reduction on `dependsOnPaymentDays` earnings; else `UNPAID_LEAVE` adjustment (current) |
| Overtime | Suggested or auto `OVERTIME` earning adjustment from OT module — **not** buried in structure formulas |
| Manual bonus/recovery | `MANUAL_ADJUSTMENT` or scheduled adjustment bus |
| Tax | After earnings (and non-tax deductions that reduce taxable base, once defined) |
| Attendance | Gate run readiness (keep) **and** optionally feed payment-days (new) |

---

## 8. Phased Implementation Plan

### Phase 0 — Discovery leftovers (before coding)

**Outcomes:** Signed decisions on tax, days source, auto vs assisted money.  
**Scope:** Confirm overtime snapshot money fields; inventory any live use of legacy `payroll-run` / `employee-salary` modules; confirm target jurisdictions.  
**Out of scope:** Schema/code changes.

### Phase 1 — Harden masters (low risk)

**Outcomes:** Component flags + optional structure templates + clearer revision UX.  
**Scope:** Schema flags; structure CRUD; apply-structure-to-employee; UI updates.  
**Out of scope:** Formula DSL; tax engine; auto-proration.

### Phase 2 — Payment days engine (highest correctness risk)

**Outcomes:** Deterministic days math with unit tests (mid-join, LWP, half-day, holidays).  
**Scope:** `PayrollSettings`, `PaymentDaysService`, wiring into calculate **behind company setting**.  
**Out of scope:** Changing companies still on manual-adjustment mode.

### Phase 3 — Calculation enhancements

**Outcomes:** Percent-of-base/gross; proration honor flags; clearer line provenance.  
**Scope:** Extend `PayrollCalculationService` only.  
**Out of scope:** Regional statutory packs.

### Phase 4 — OT + LWP assisted/auto path

**Outcomes:** Preflight warnings become actionable suggested adjustments or auto lines.  
**Scope:** OT settlement lifecycle on paid; unpaid leave suggestion based on leave days × daily rate.  
**Out of scope:** Full timesheet contractor payroll.

### Phase 5 — Tax Regime B (only if approved)

**Outcomes:** Annualized progressive TDS with tax year/slabs.  
**Scope:** Tax tables + `TaxService`; assignment/profile link; YTD from paid runs.  
**Out of scope:** Full exemption proof workflow (can follow).

### Phase 6 — Hardening / ops

**Outcomes:** Bank export, arrear helpers, employer CTC lines, YTD register polish.  
**Out of scope:** Frappe feature parity for gratuity/flex benefits unless sold.

**Least-risk sequence:** Phase 0 decisions → Phase 1 masters → Phase 2 days (feature-flagged) → Phase 3 calc → Phase 4 OT/LWP → Phase 5 tax → Phase 6 ops.

---

## 9. Approval Checklist

### Scope to build now

- [ ] Component flags (`dependsOnPaymentDays`, taxable, include-in-gross)
- [ ] Salary structure templates (copy-on-assign)
- [ ] Payment days engine (feature-flagged per company)
- [ ] Assisted OT → adjustment suggestions
- [ ] Assisted unpaid leave → adjustment suggestions
- [ ] Simple percent-of-base / percent-of-gross calc types

### Scope to defer

- [ ] Sandboxed formula expression language
- [ ] Annualized tax + slabs + exemptions
- [ ] Employer contribution / CTC-only lines
- [ ] Arrears / payroll correction wizards
- [ ] Salary withholding
- [ ] Bank file generation / auto disbursement
- [ ] Flex benefits / gratuity / timesheet wages
- [ ] Full Frappe feature parity

### Tax approach decision

- [ ] **Regime A (keep):** Fixed `EmployeeTaxProfile.monthlyTaxAmount` only  
- [ ] **Regime B (build):** Annualized progressive slabs (jurisdiction: __________)  
- [ ] **Hybrid:** Regime A default; Regime B opt-in per company  

### Attendance vs Leave for payroll days

- [ ] Payroll days from **Attendance** (finalized period)  
- [ ] Payroll days from **Leave** (unpaid / LWP types)  
- [ ] Hybrid (attendance absences + unpaid leave)  
- [ ] **No auto days** — keep warnings + manual adjustments only  

### Approval workflow decision

- [ ] Keep current maker-checker on payroll run (**recommended default**)  
- [ ] Add extra company approval framework step before calculate / before pay  
- [ ] No change  

### Open questions needing business input

- [ ] Target countries for statutory tax in next 12 months  
- [ ] Auto vs assisted money conversion for OT/LWP  
- [ ] Daily rate definition for LWP (calendar days vs payment days vs working days)  
- [ ] Whether mid-month salary revision should prorate between two packages  
- [ ] Whether loan/advance is a near-term product requirement  

---

## 10. Open Questions / Decisions Needed

1. **Jurisdiction:** Which companies need progressive annual TDS vs flat monthly tax in the next release window?  
2. **Auto vs assisted:** Confirm whether unpaid leave and OT may post money without a maker-entered amount.  
3. **Days source:** Attendance-finalized metrics vs leave applications vs both — what is authoritative when they disagree?  
4. **Daily rate:** How is LWP deduction computed from a multi-component package? (sum of `dependsOnPaymentDays` earnings ÷ working days?)  
5. **Mid-period revision:** If two `EmployeeSalary` ranges overlap a month, do we take latest only (current behavior) or split prorate? Current code picks latest overlapping revision — changing this needs explicit approval.  
6. **Overtime money source:** Confirm fields in `OvertimeRequest.calculationSnapshot` / policy for payable amount — **Unknown — needs confirmation**.  
7. **Legacy modules:** Is `backend/src/modules/payroll-run/` and older `employee-salary` HTTP surface still used by any client? **Unknown — needs confirmation**.  
8. **Loans/advances:** Is a dedicated module planned, or is `EmployeeDeduction` sufficient for FY near-term?  
9. **Structure templates priority:** Is mass banding pain high enough for Phase 1, or should payment days come first?  
10. **Bank export:** Required before next customer go-live, or is manual payment reference enough?

---

## Appendix A — Flow comparison (ours vs reference)

| Step | Frappe reference | Our system today |
|------|------------------|------------------|
| Employee | Active employee | Same (`PAYROLL_ELIGIBLE_EMPLOYMENT_STATUSES`) |
| Salary structure | Shared template + formulas | Per-employee fixed lines |
| Assignment | SSA + base + tax slab | `EmployeeSalary` + separate tax profile |
| Payroll processing | Payroll Entry batch | `PayrollRun` lifecycle |
| Earnings/deductions | Eval + Additional Salary | Fixed lines + adjustments |
| Tax | Annualized slabs | Fixed monthly amount |
| Attendance/leave | Payment days engine | Gate + warnings; manual money |
| Payslip | Slip is calc engine | Snapshot + later PDF |
| Net salary | gross − ded − loans | gross − all deduction lines |

## Appendix B — Evidence index (primary)

- Reference: [Frappe HR Payroll reference](../../../reference/frappe-hr-payroll.md)
- Product contract: `docs/development/payroll-lite-db-api-ui-implementation-plan.md`  
- Schema: `backend/prisma/schema.prisma` (SalaryComponent → PayrollPayslip block)  
- Calc: `backend/src/modules/payroll/services/payroll-calculation.service.ts`  
- Preflight: `backend/src/modules/payroll/services/payroll-preflight.service.ts`  
- UI: `frontend/features/payroll/`

---

*Document generated for approval. No application code was modified to produce this analysis.*
