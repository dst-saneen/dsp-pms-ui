# Frappe HR Payroll — Reference Analysis for Our Next.js HR System

> **Purpose:** Learning/reference document only.  
> **Do NOT** copy Frappe’s Python/Frappe DocType architecture into our app.  
> **Do NOT** modify our existing Next.js/backend code based on this alone — use this as the blueprint, then implement deliberately in our architecture.  
> **Source repo:** cloned Frappe HRMS in this workspace (`hrms/`).

**How to use this file in another Cursor project:**

1. Copy this document into the target repository's reference documentation (for example, `docs/reference/frappe-hr-payroll.md`).
2. Fill Section 8 (“What we already have”) against your real schema/APIs.
3. Implement Phase 1 → Phase 4 from Section 9, one domain at a time.
4. When coding, open the cited Frappe files in this clone for formula detail — do not port Frappe framework patterns.

---

## Table of Contents

1. [Repository Structure & Major Modules](#1-repository-structure--major-modules)
2. [Payroll Domain Model (Entities & Dependencies)](#2-payroll-domain-model-entities--dependencies)
3. [Feature-by-Feature Deep Dive](#3-feature-by-feature-deep-dive)
4. [Complete Payroll Calculation Flow](#4-complete-payroll-calculation-flow)
5. [Source Code Index (Files / Classes / Functions)](#5-source-code-index-files--classes--functions)
6. [Edge Cases & Validations We Should Mirror](#6-edge-cases--validations-we-should-mirror)
7. [Conceptual Mapping: Frappe → Our Next.js Stack](#7-conceptual-mapping-frappe--our-nextjs-stack)
8. [Gap Analysis Checklist (Fill Against Our App)](#8-gap-analysis-checklist-fill-against-our-app)
9. [Recommended Implementation Plan](#9-recommended-implementation-plan)
10. [Suggested Data Model for Our Architecture](#10-suggested-data-model-for-our-architecture)
11. [Pseudocode: Payroll Engine (Framework-Agnostic)](#11-pseudocode-payroll-engine-framework-agnostic)

---

## 1. Repository Structure & Major Modules

### 1.1 Top-level layout

```
hrms/                          # Frappe HR product root
├── frontend/                  # Vue SPA (employee portal / modern UI)
├── frappe-ui/                 # UI library submodule
├── roster/                    # Roster-related frontend
├── docker/                    # Dev/prod Docker setup
└── hrms/                      # Python app package (business logic lives HERE)
    ├── modules.txt            # Module list
    ├── hooks.py               # App hooks, regional overrides
    ├── payroll/               # ★ PAYROLL MODULE (primary focus)
    ├── hr/                    # Core HR DocTypes (Employee lifecycle, attendance glue, utils)
    ├── leaves/                # Leave workspace (DocTypes mostly under hr/)
    ├── shift_and_attendance/  # Shift/attendance workspace
    ├── tax_and_benefits/      # Tax/benefits workspace
    ├── recruitment/
    ├── performance/
    ├── expenses/
    ├── tenure/
    ├── regional/              # Country-specific tax (esp. India)
    ├── controllers/
    └── overrides/
```

### 1.2 Modules declared in `hrms/modules.txt`

| Module | Role |
|--------|------|
| HR Setup | Masters (company HR config, grades, etc.) |
| Tenure | Employee lifecycle / tenure |
| Recruitment | Job openings, applicants, offers |
| Shift and Attendance | Shifts, check-in, attendance |
| Leaves | Leave types, applications, allocations |
| Expenses | Expense claims, advances |
| Performance | Appraisals, goals |
| **Payroll** | Salary structures, slips, payroll runs |
| Tax and Benefits | Tax exemptions, flexible benefits UI surface |
| HR | Catch-all HR DocTypes |

### 1.3 Payroll DocTypes (complete list under `hrms/payroll/doctype/`)

**Core run path**

| DocType | Purpose |
|---------|---------|
| `salary_component` | Master: Basic, HRA, PF, Tax, etc. |
| `salary_structure` | Template of earnings/deductions + formulas |
| `salary_structure_assignment` | Assigns structure to employee (base, tax slab, from_date) |
| `bulk_salary_structure_assignment` | Bulk assign SSA |
| `payroll_period` | Tax/benefit year window |
| `payroll_settings` | Global payroll calculation switches |
| `payroll_entry` | Batch payroll run for a period |
| `payroll_employee_detail` | Child: employees on a payroll entry |
| `salary_slip` | Per-employee payslip for a period |
| `salary_detail` | Child row on structure & slip (component line) |
| `additional_salary` | One-off / recurring earning or deduction |

**Tax & benefits**

| DocType | Purpose |
|---------|---------|
| `income_tax_slab` | Progressive tax slabs + charges |
| `taxable_salary_slab` | Child of tax slab |
| `income_tax_slab_other_charges` | Cess / % on tax |
| `employee_tax_exemption_category` / `_sub_category` | Exemption masters |
| `employee_tax_exemption_declaration` | Mid-year declared exemptions |
| `employee_tax_exemption_proof_submission` | Year-end proofs |
| `employee_other_income` | Other taxable income |
| `employee_benefit_*` | Flexible benefits application/claim/ledger |

**Adjustments & specials**

| DocType | Purpose |
|---------|---------|
| `employee_incentive` | Creates Additional Salary |
| `retention_bonus` | Creates Additional Salary |
| `arrear` | Structure change back-pay → Additional Salary |
| `payroll_correction` | Fix LWP / missed days → Additional Salary |
| `salary_withholding` | Hold salary (exclude from bank payment) |
| `gratuity` / `gratuity_rule` | End-of-service gratuity |
| `salary_slip_loan` | Loan repayment lines on slip |
| `salary_slip_leave` | Leave balance snapshot on slip |
| `salary_slip_timesheet` | Timesheet-based wage lines |

### 1.4 Design philosophy (what to learn, not copy)

Frappe models payroll as:

1. **Masters** (components, structures, tax slabs, periods, settings)
2. **Assignments** (employee ↔ structure + base + tax slab)
3. **Adjustments** (Additional Salary as universal injection point for OT, bonus, incentive, advance recovery, arrears)
4. **Batch run** (Payroll Entry selects employees → creates Salary Slips)
5. **Per-employee engine** (Salary Slip recalculates everything on validate/save)

For our Next.js app: keep the **same domain concepts and calculation order**, but implement with our tables, services, and APIs.

---

## 2. Payroll Domain Model (Entities & Dependencies)

```
Salary Component ──────────────────────────┐
       │                                   │
       ▼                                   │
Salary Structure (earnings/deductions)     │
       │                                   │
       ▼                                   │
Salary Structure Assignment ◄── Income Tax Slab
 (employee, from_date, base, variable)     │
       │                                   │
       │     Payroll Period (tax year)     │
       │     Payroll Settings (rules)      │
       │                                   │
       ▼                                   ▼
Additional Salary / OT / Incentive / Loans / Attendance / Leave
       │
       ▼
Payroll Entry (period + filters + employee list)
       │
       ▼
Salary Slip (per employee)
       │
       ├── earnings[] / deductions[]
       ├── payment_days / LWP / absent
       ├── tax (annualized TDS)
       ├── loan_repayment
       └── net_pay = gross − deductions − loans
```

### Dependency rules (critical)

| Depends on | Required for |
|------------|--------------|
| Salary Component | Building Salary Structure |
| Submitted active Salary Structure | SSA |
| Submitted SSA covering slip start | Salary Slip |
| Income Tax Slab on SSA | Variable tax components |
| Payroll Period covering slip dates | Tax calculation |
| Payroll Settings | Working/payment days logic |
| Attendance **or** Leave Apps | LWP / payment days |
| Additional Salary (optional) | OT, bonus, arrears, advance recovery |
| Lending app loans (optional) | Loan repayment on slip |

---

## 3. Feature-by-Feature Deep Dive

---

### 3.1 Salary Component

**What it does**  
Reusable master for every pay line (Basic, HRA, Special Allowance, PF, Professional Tax, Income Tax, Employer PF, etc.).

**User workflow**

1. HR creates components once.
2. Marks type: `Earning` | `Deduction` | `Employer Contribution`.
3. Sets flags (payment-days, taxable, statistical, formula defaults).
4. Optionally maps GL accounts per company.
5. Components are pulled into Salary Structures.

**Required fields / flags**

| Field | Meaning |
|-------|---------|
| `salary_component` | Name |
| `salary_component_abbr` | Short code used in formulas (e.g. `B`, `HRA`) |
| `type` | Earning / Deduction / Employer Contribution |
| `depends_on_payment_days` | Default **1** — prorate by payment days |
| `is_tax_applicable` | Counts toward taxable earnings |
| `variable_based_on_taxable_salary` | Auto-computed TDS from tax slabs |
| `exempted_from_income_tax` | Deduction reduces taxable income |
| `statistical_component` | Formula helper only; not paid / not in totals |
| `do_not_include_in_total` | Show but exclude from gross/net |
| `amount_based_on_formula` + `formula` + `condition` | Default calc rules |
| `deduct_full_tax_on_selected_payroll_date` | Bonus taxed fully in that month |
| `arrear_component` | Eligible for arrear recalculation |
| `accrual_component` | Accrue without paying now |
| `is_flexible_benefit` | Flex benefit pool |

**Business rules**

- Tax slab–driven components must **not** have fixed amounts/formulas (validated on structure).
- Updating a component can sync defaults into structures (`update_salary_structures`).

**Source**

- `hrms/payroll/doctype/salary_component/salary_component.json`
- `hrms/payroll/doctype/salary_component/salary_component.py`

**Useful for us?** **Yes — essential.** Component master with flags is the foundation of flexible payroll without hardcoding Basic/HRA/PF.

---

### 3.2 Salary Structure

**What it does**  
Named template of how pay is built for a role/band/company (list of components + formulas + frequency).

**User workflow**

1. Create structure (company, currency, frequency, active Yes/No).
2. Add earnings and deductions (from Salary Components).
3. Optionally override amount/formula/condition per row.
4. Optionally add employer contributions and flex benefits.
5. Submit (make immutable for assignments).
6. Assign to employees via SSA (or Assign button).

**Key fields**

- `payroll_frequency`: Monthly / Fortnightly / Bimonthly / Weekly / Daily
- `is_active`, `company`, `currency`
- Child tables: `earnings`, `deductions`, `employer_contributions`, `employee_benefits`
- Optional timesheet mode: `salary_slip_based_on_timesheet`, `hour_rate`

**Formula system (important)**

- Formulas are Python-like expressions evaluated safely.
- Context includes: `base`, `variable` (from SSA), employee fields, other component abbreviations, later `payment_days`, `gross_pay`.
- Example concepts: `B * 0.4` for HRA; `gross_pay * 0.12` for PF.

**Source**

- `hrms/payroll/doctype/salary_structure/salary_structure.py` — validate, assign, `make_salary_slip`
- `hrms/payroll/doctype/salary_structure/salary_structure.json`
- `hrms/payroll/utils.py` — `sanitize_expression`, `_safe_eval`, `COMPONENT_EVAL_GLOBALS`, `get_component_eval_context`
- Help: `salary_structure/condition_and_formula_help.html`

**Useful for us?** **Yes.** Even if we start with fixed components (no formula DSL), support structure templates + assignment. Add formula engine later if needed.

---

### 3.3 Earnings

**What it does**  
Positive pay components that build **gross pay**.

**How calculated**

1. Evaluate structure earning rows (condition → formula/amount).
2. Add Additional Salary earnings (OT, incentive, etc.).
3. Add flexible benefit payouts (if configured).
4. Prorate if `depends_on_payment_days`.
5. Sum into `gross_pay` (skip `do_not_include_in_total`).

**Order rule:** Earnings are calculated **before** deductions so deduction formulas can use `gross_pay` / earning abbrs.

**Source:** `SalarySlip.calculate_component_amounts("earnings")` in `salary_slip.py` (~L1236).

---

### 3.4 Deductions

**What it does**  
Amounts subtracted from gross (PF employee, tax, professional tax, advance recovery as Additional Salary deduction, etc.).

**How calculated**

1. Structure deduction rows.
2. Additional Salary deductions.
3. **Variable tax** injected via `add_tax_components()`.
4. Sum → `total_deduction`.

**Note:** Loan repayments are **not** normal deductions — subtracted separately (see Loans).

**Source:** `calculate_component_amounts("deductions")`, `add_tax_components()`.

---

### 3.5 Salary Structure Assignment (Employee Salary Assignment)

**What it does**  
Links an employee to a salary structure from a date, with pay inputs (`base`, `variable`) and tax slab.

**User workflow**

1. Pick employee + structure + `from_date`.
2. Enter `base` (and optional `variable`).
3. Select `income_tax_slab` (required if structure has tax components).
4. Set `payroll_payable_account`, cost centers, opening tax balances if mid-year join.
5. Submit.
6. Later raise/change = new SSA with new `from_date` (history preserved).

**Required data**

| Field | Why |
|-------|-----|
| `employee` | Who |
| `salary_structure` | What template |
| `from_date` | Effective date (one submitted SSA per employee per date) |
| `base` / `variable` | Formula inputs |
| `income_tax_slab` | For TDS |
| `payroll_payable_account` | Accounting + payroll entry filter |

**Resolution on slip:** latest submitted SSA where `from_date <= actual_start_date` and structure matches.

**Source**

- `hrms/payroll/doctype/salary_structure_assignment/salary_structure_assignment.py`
  - `get_evaluated_components()` — full-cycle formula eval
  - `get_assigned_salary_structure(employee, on_date)`
- Slip: `SalarySlip.set_salary_structure_assignment()` (~L881)

**Useful for us?** **Yes — essential.** Separating “structure template” from “employee assignment with base” is the right model for raises and mid-period changes.

---

### 3.6 Salary Slip

**What it does**  
The calculated payslip for one employee for one period. This is the **calculation engine**.

**User workflow**

- Usually created in bulk by Payroll Entry submit.
- Can be created individually from structure.
- On save: full recalculation (`validate`).
- On submit: locks slip, creates loan repayments, emails, benefit ledger updates.
- Net pay must be ≥ 0 to submit.

**Key fields**

- Identity: `employee`, `company`, `posting_date`, `payroll_frequency`, `start_date`, `end_date`, `salary_structure`, `payroll_entry`
- Days: `total_working_days`, `leave_without_pay`, `absent_days`, `payment_days`
- Tables: `earnings`, `deductions`, `accrued_benefits`, `employer_contributions`, `loans` (if lending)
- Totals: `gross_pay`, `total_deduction`, `total_loan_repayment`, `net_pay`, `rounded_total`
- Tax breakup: `ctc`, exemptions, `annual_taxable_amount`, `current_month_income_tax`, etc.

**Main entry — `validate()` (~L212)**

```
check withholding → status → active employee → dates → duplicate check
if no earnings/deductions yet:
    get_emp_and_working_day_details()   # load structure + days
else:
    get_working_days_details(lwp=...)
set_salary_structure_assignment()
calculate_net_pay()
compute YTD / MTD / leave balances
```

**Net pay — `set_net_pay()` (~L953)**

```
net_pay = gross_pay − (total_deduction + total_loan_repayment)
rounded_total = round(net_pay)   # unless disabled in Payroll Settings
```

**Source:** `hrms/payroll/doctype/salary_slip/salary_slip.py` (≈2749 lines) — primary file to study.

**Useful for us?** **Yes.** Our equivalent is a `Payslip` / `PayrollRunItem` service that recalculates deterministically from inputs.

---

### 3.7 Payroll Entry

**What it does**  
Batch payroll for a date range + filters: select employees → create slips → submit slips → accounting entries → bank payment.

**User workflow**

| Step | Action | Code |
|------|--------|------|
| 1 | Create Payroll Entry (company, dates, frequency, payable account, filters) | DocType create |
| 2 | **Get Employees** | `fill_employee_details()` → `get_employee_list()` |
| 3 | Optional: Create/Submit Overtime Slips | if settings `create_overtime_slip` |
| 4 | **Create Salary Slips** (submit PE) | `on_submit` → `create_salary_slips()` |
| 5 | **Submit Salary Slips** | `submit_salary_slips()` + accrual JE |
| 6 | **Make Bank Entry** | `make_bank_entry()` |

**Employee selection rules**

Employee included only if:

1. Active Salary Structure matches company/currency/frequency.
2. Submitted SSA links them, with matching payable account, `from_date ≤ end_date`.
3. Employee active; joined on/before end; relieved on/after start (or still employed).
4. Optional filters: branch / department / designation / grade.
5. No **submitted** Salary Slip already for same start/end.

**Approval/workflow**

- No dedicated payroll approval DocType.
- Optional Frappe Workflow on Payroll Entry (UI hides Create Slips button if workflow exists).
- Submittable documents act as gates (Structure, SSA, Additional Salary, Slip, PE).
- For our app: map to our existing approval framework if we have one.

**Source**

- `hrms/payroll/doctype/payroll_entry/payroll_entry.py`
- `hrms/payroll/doctype/payroll_entry/payroll_entry.js`

**Useful for us?** **Yes.** Batch run + employee eligibility filters + idempotency (don’t double-pay) are must-haves.

---

### 3.8 Tax Calculations

**What it does**  
Computes monthly TDS by projecting **annual** taxable income, applying progressive slabs, subtracting YTD tax already paid, dividing by **remaining payroll periods**.

**This is NOT “monthly income × monthly rate.”**

#### Tax slab master

- `Income Tax Slab`: `effective_from`, `tax_relief_limit`, `standard_tax_exemption_amount`, `allow_tax_exemption`, slabs[], other_charges[]
- Progressive math in `calculate_base_tax_from_tax_slabs()`:

```
for each slab (if condition passes):
  tax += (amount falling in slab) × percent × 0.01
if annual_taxable <= tax_relief_limit → tax = 0
then other charges (e.g. cess % of tax)
```

**Source:** `hrms/payroll/doctype/income_tax_slab/income_tax_slab.py`

#### Monthly tax on slip — `calculate_variable_tax()` (~L1899)

```
annual_tax = calculate_tax_by_tax_slab(annual_taxable_without_full_tax_addl)
current_structured_tax = (annual_tax − tax_already_paid_YTD) / remaining_sub_periods
full_tax_on_bonus = tax(with_full_tax_addl) − tax(without)   # if any
current_tax_amount = max(0, current_structured_tax + full_tax_on_bonus)
```

#### Annual taxable projection — `compute_taxable_earnings_for_year()` (~L970)

Conceptually:

```
previous_period_taxable
+ current_structured_taxable (payment-days prorated)
+ future_structured × (remaining_sub_periods − 1)   # full-cycle projection
+ current_additional (+ recurring future)
+ other_incomes + unclaimed_benefits
− total_exemption_amount
```

#### Exemptions

| When | Source |
|------|--------|
| Mid tax year | Employee Tax Exemption **Declaration** |
| Last cycle of payroll period | Force switch to **Proof Submission** (or 0) |
| Always (if allowed) | Standard exemption from tax slab |

**Source**

- Declaration: `employee_tax_exemption_declaration.py`
- Proof: `employee_tax_exemption_proof_submission.py`
- Slip: `get_total_exemption_amount()`
- India HRA extras: `hrms/regional/india/utils.py`

**Useful for us?**  
- If we pay employees in a jurisdiction with progressive annual TDS (e.g. India): **copy this annualization approach**.  
- If flat monthly tax / different country: keep the **extension point** (`apply_regional_deductions` pattern) but implement our jurisdiction rules.

---

### 3.9 Overtime

**What it does**  
OT is **not** computed inside Salary Slip formulas. It flows:

```
Attendance (OT duration + overtime_type)
  → Overtime Slip (batch per employee/period)
    → Additional Salary (earning component)
      → Salary Slip picks it up
```

**Amount formula** (`overtime_slip.py`):

```
amount = overtime_duration × hourly_rate × multiplier
```

- Multiplier from Overtime Type: standard / weekend / public holiday.
- Hourly rate: fixed **or** derived from selected salary components ÷ standard hours.

**Payroll Entry integration:** optional Create/Submit Overtime Slips before creating salary slips (`Payroll Settings.create_overtime_slip`).

**Source**

- `hrms/hr/doctype/overtime_slip/overtime_slip.py`
- `hrms/hr/doctype/overtime_type/overtime_type.py`
- `payroll_entry.py` — `create_overtime_slips`, `submit_overtime_slips`

**Useful for us?** **Yes**, if we track OT. Pattern to reuse: **compute OT separately → inject as payroll adjustment**, don’t bury OT inside structure formulas.

---

### 3.10 Attendance Impact

**What it does**  
When `Payroll Settings.payroll_based_on = "Attendance"`, LWP/absent/unmarked/half-day attendance reduce `payment_days`.

**Settings that matter**

| Setting | Effect |
|---------|--------|
| `payroll_based_on` | `"Attendance"` vs Leave Application |
| `include_holidays_in_total_working_days` | Denominator for daily rate |
| `consider_marked_attendance_on_holidays` | Count holiday absences |
| `consider_unmarked_attendance_as` | Present vs Absent |
| `daily_wages_fraction_for_half_day` | Default 0.5 |

**Source:** `SalarySlip.get_working_days_details()` (~L539), `calculate_lwp_ppl_and_absent_days_based_on_attendance()` (~L826).

**Useful for us?** **Yes.** Decide explicitly: payroll-from-attendance vs payroll-from-leave, and document holiday/unmarked rules.

---

### 3.11 Leave Without Pay (LWP)

**What it does**  
Unpaid leave (and partially paid leave / PPL) reduces payment days → prorates components with `depends_on_payment_days`.

**Two modes**

1. **Leave Application mode:** approved leaves where Leave Type `is_lwp` / `is_ppl`.
2. **Attendance mode:** On Leave / Half Day with LWP/PPL leave type; Absent counted separately.

**PPL rule**

```
equivalent_lwp *= (1 − fraction_of_daily_salary_per_leave)
# if fraction empty → treat as full LWP day
```

**Half day**

```
lwp_fraction = 1 − daily_wages_fraction_for_half_day   # e.g. 0.5
```

**Payment days**

```
payment_days = employment_window_days − LWP − absent − unmarked − half_absent×fraction
if payment_days would go negative → 0
```

**Salary impact**

```
if depends_on_payment_days:
  amount = default_amount × (payment_days / total_working_days)
```

**Source**

- `get_working_days_details`, `get_payment_days` (~L719)
- `calculate_lwp_or_ppl_based_on_leave_application` (~L752)
- `get_lwp_or_ppl_for_date_range` (~L2603)
- `get_amount_based_on_payment_days` (~L2143)

**Useful for us?** **Yes — essential** for any attendance-linked payroll.

---

### 3.12 Loans / Advances

#### Loans (salary repayment)

- Requires ERPNext **Lending** app (`salary_slip_loan_utils.py` gated).
- Loans with `repay_from_salary`, open, same company.
- On calc: fill loan child table + `total_loan_repayment`.
- On submit: create Loan Repayment entries.
- **Net pay subtracts loans outside deduction table.**

#### Employee Advances

- Not auto-deducted as loans.
- Recovery typically via **Additional Salary** deduction (`create_return_through_additional_salary`).
- Expense claims reduce claimed amount on advance; residual can be recovered via payroll.

**Source**

- `hrms/payroll/doctype/salary_slip/salary_slip_loan_utils.py`
- `hrms/hr/doctype/employee_advance/` (advance return helper)

**Useful for us?**  
Map to our loan/advance modules. Keep **net = gross − deductions − loan_repayments** as a clean separation.

---

### 3.13 Payroll Periods

**What it does**  
Defines the **tax/benefit year** (e.g. Apr 1–Mar 31), not the monthly payroll cycle.

**Used for**

- Remaining sub-periods for TDS spreading (`get_period_factor`)
- YTD taxables / taxes paid
- Tax exemption declaration uniqueness
- Flexible benefits windows
- Opening balance warnings on SSA for mid-year joins

**Source:** `hrms/payroll/doctype/payroll_period/payroll_period.py`

**Useful for us?** **Yes** if tax is annualized. Always separate “pay cycle” from “tax year.”

---

### 3.14 Additional Salary (universal adjustment)

**What it does**  
One-off or recurring earning/deduction outside the structure — the **extension bus** for almost all special payroll items.

**Rules**

- Requires existing SSA.
- Non-recurring: `payroll_date` inside slip range.
- Recurring: `from_date`/`to_date` overlaps slip end.
- `overwrite_salary_structure_amount`: replace vs add.
- Can reference source doc (`ref_doctype` / `ref_docname`).

**Creators of Additional Salary in Frappe**

- Overtime Slip  
- Employee Incentive  
- Retention Bonus  
- Gratuity (optional)  
- Arrear  
- Payroll Correction  
- Employee Advance return  
- Benefit claims  

**Source:** `hrms/payroll/doctype/additional_salary/additional_salary.py` — `get_additional_salaries()`  
Slip: `add_additional_salary_components()` (~L1625)

**Useful for us?** **Yes — highly recommended.** Implement a single `PayrollAdjustment` table instead of many special-case slip hacks.

---

### 3.15 Other important payroll features

| Feature | What | Source | Useful? |
|---------|------|--------|---------|
| **Payroll Settings** | Global switches for days/tax/email/accounting | `payroll_settings` | Yes |
| **Employer Contributions** | CTC display (EPF employer etc.); not in net | structure + slip | Optional |
| **Flexible Benefits** | Accrue/payout benefit pool | `add_employee_benefits`, benefit ledger | If we offer flex CTC |
| **Arrear** | Back-pay after structure change | `arrear` | Yes for raises mid-cycle |
| **Payroll Correction** | Fix wrong LWP days → pay difference | `payroll_correction` | Yes |
| **Salary Withholding** | Hold payment; slip status Withheld | `salary_withholding` | If needed legally |
| **Timesheet salary** | Wage = hours × rate | slip timesheet paths | If contractors/hourly |
| **Gratuity** | EOS benefit by rules/slabs | `gratuity`, `gratuity_rule` | Country-dependent |
| **Regional hooks** | India statutory extras | `hrms/regional/`, `apply_regional_deductions` | Pattern yes |

---

## 4. Complete Payroll Calculation Flow

### 4.1 End-to-end narrative

```
Employee
  └─ has Salary Structure Assignment (from_date, base, tax slab)
       └─ points to Salary Structure (components + formulas)
            │
            ▼
HR creates Payroll Entry for period (e.g. 1–30 Sep)
  └─ Get Employees (eligible via SSA + filters − already paid)
       │
       ├─ (optional) Overtime Slips → Additional Salary
       ├─ (optional) other Additional Salaries already submitted
       │
       ▼
Create Salary Slip per employee
  │
  ├─ 1. Resolve employment window (join/relieve clip dates)
  ├─ 2. Compute total_working_days, LWP, absent, payment_days
  ├─ 3. Load SSA + evaluate structure components
  ├─ 4. Evaluate EARNINGS → apply payment-days proration
  ├─ 5. gross_pay = sum(earnings included in total)
  ├─ 6. Evaluate DEDUCTIONS (non-tax) + Additional Salary deductions
  ├─ 7. Compute TAX (annual projection → slab → / remaining periods)
  ├─ 8. Loan repayments (if any)
  ├─ 9. Regional deductions hook
  ├─10. Employer contributions (display only)
  └─11. net_pay = gross − deductions − loans → round
       │
       ▼
Submit slips → accrual accounting → bank payment
```

### 4.2 Flow diagram (calculation order inside one slip)

```
validate / recalculate
        │
        ▼
┌───────────────────────┐
│ Working days & LWP    │  ← Attendance XOR Leave Apps + Settings
└───────────┬───────────┘
            ▼
┌───────────────────────┐
│ Resolve SSA           │  ← base, variable, tax slab, structure
└───────────┬───────────┘
            ▼
┌───────────────────────┐
│ Earnings              │  structure + additional + benefits
│  → payment-days scale │
│  → gross_pay          │
└───────────┬───────────┘
            ▼
┌───────────────────────┐
│ Deductions (non-tax)  │  structure + additional
└───────────┬───────────┘
            ▼
┌───────────────────────┐
│ Tax components        │  annualize → slab → monthly TDS
└───────────┬───────────┘
            ▼
┌───────────────────────┐
│ Loans                 │  outside deduction total
└───────────┬───────────┘
            ▼
┌───────────────────────┐
│ net_pay & rounding    │
└───────────────────────┘
```

### 4.3 What triggers calculation

| Trigger | Effect |
|---------|--------|
| Salary Slip save/validate | Full recalc |
| Changing LWP / dates / structure on slip | Recalc on save |
| Payroll Entry submit | Bulk create slips (each runs validate) |
| Submitting Additional Salary / OT / Incentive | Available for next slip calc (doesn’t rewrite past submitted slips) |
| New SSA from_date | Affects slips with actual_start ≥ from_date |

---

## 5. Source Code Index (Files / Classes / Functions)

### 5.1 Must-read files

| Priority | Path | Why |
|----------|------|-----|
| P0 | `hrms/payroll/doctype/salary_slip/salary_slip.py` | Entire calculation engine |
| P0 | `hrms/payroll/doctype/payroll_entry/payroll_entry.py` | Batch run |
| P0 | `hrms/payroll/doctype/salary_structure_assignment/salary_structure_assignment.py` | Assignment + component eval |
| P0 | `hrms/payroll/doctype/income_tax_slab/income_tax_slab.py` | Tax math |
| P0 | `hrms/payroll/utils.py` | Safe formula eval |
| P1 | `hrms/payroll/doctype/salary_structure/salary_structure.py` | Structure + make slip |
| P1 | `hrms/payroll/doctype/salary_component/salary_component.py` + `.json` | Flags |
| P1 | `hrms/payroll/doctype/additional_salary/additional_salary.py` | Adjustments |
| P1 | `hrms/payroll/doctype/payroll_period/payroll_period.py` | `get_period_factor` |
| P1 | `hrms/payroll/doctype/payroll_settings/payroll_settings.json` | Switches |
| P2 | `hrms/hr/doctype/overtime_slip/overtime_slip.py` | OT → Additional Salary |
| P2 | `hrms/payroll/doctype/salary_slip/salary_slip_loan_utils.py` | Loans |
| P2 | `hrms/payroll/doctype/arrear/arrear.py` | Back pay |
| P2 | `hrms/payroll/doctype/payroll_correction/payroll_correction.py` | LWP fixes |
| P2 | `hrms/regional/india/utils.py` | India-specific tax/HRA |
| P2 | `hrms/payroll/doctype/salary_slip/test_salary_slip.py` | Edge-case goldmine |

### 5.2 Salary Slip — key methods

| Method | ~Line | Role |
|--------|------:|------|
| `validate` | 212 | Orchestrates full recalc |
| `get_emp_and_working_day_details` | 417 | First load: days + structure |
| `get_working_days_details` | 539 | working/payment/LWP/absent |
| `get_payment_days` | 719 | Employment-window days |
| `calculate_lwp_or_ppl_based_on_leave_application` | 752 | Leave-based LWP |
| `calculate_lwp_ppl_and_absent_days_based_on_attendance` | 826 | Attendance-based LWP |
| `set_salary_structure_assignment` | 881 | Attach SSA |
| `calculate_net_pay` | 905 | Earnings → gross → deductions → loans → net |
| `set_net_pay` | 953 | Final net formula |
| `compute_taxable_earnings_for_year` | 970 | Annual taxable projection |
| `calculate_component_amounts` | 1236 | Per type component pipeline |
| `eval_condition_and_formula` | 1378 | Row condition/formula |
| `add_additional_salary_components` | 1625 | Inject adjustments |
| `add_tax_components` | 1669 | Variable tax |
| `calculate_variable_tax` | 1899 | Monthly TDS from annual |
| `get_taxable_earnings` | 2052 | Taxable earning breakdown |
| `get_amount_based_on_payment_days` | 2143 | Proration |
| `get_total_exemption_amount` | 2191 | Declaration/proof/standard |

### 5.3 Tax slab functions

| Function | File | Role |
|----------|------|------|
| `calculate_tax_by_tax_slab` | `income_tax_slab.py` L47 | Entry |
| `calculate_base_tax_from_tax_slabs` | L71 | Progressive bands |
| `calculate_other_charges` | L89 | Cess etc. |
| `eval_tax_slab_condition` | L104 | Conditional slabs |

---

## 6. Edge Cases & Validations We Should Mirror

### 6.1 Hard stops (throw / block)

1. Employee not active.
2. Pay period before joining date / after relieving (invalid window).
3. Duplicate payslip for same employee + same start/end.
4. No SSA covering the slip’s actual start date.
5. Tax component present but Income Tax Slab missing on SSA.
6. Tax slab disabled or effective after payroll period start.
7. More holidays than working days (misconfigured holiday list).
8. `net_pay < 0` on submit.
9. Loan repayment amount > payable.
10. Payroll based on not configured in settings.

### 6.2 Soft warnings

1. Manual LWP ≠ system-calculated LWP.
2. Timesheet hours > max working hours setting.
3. Formula present but `amount_based_on_formula` unchecked (on structure).

### 6.3 Calculation edge cases (from tests + code)

| Case | Behavior |
|------|----------|
| Mid-month joiner | `actual_start_date = max(period_start, DOJ)` → fewer payment days |
| Mid-month exit | `actual_end_date = min(period_end, relieving)` |
| `payment_days = 0` | All `depends_on_payment_days` components → 0 |
| Unmarked attendance as Absent | Reduces payment days |
| Half-day / PPL | Fractional LWP |
| LWP after relieving | Ignored |
| Holidays excluded | Shrinks both working days & payment days |
| Dependent formulas (PF on gross) | Two-pass: eval then prorate; abbrs update |
| Recurring Additional Salary | Included in future tax projection |
| Full-tax additional (bonus) | Extra tax in that month only |
| Last tax-period cycle | Switch declaration → proof |
| `remaining_sub_periods = 0` | Tax amount 0 (no divide-by-zero) |
| Opening balances on SSA | Mid-year join tax continuity |
| Withheld salary | Slip exists but excluded from bank payment |
| Employer contributions | Not in gross/net/taxable (unless configured otherwise) |
| Statistical components | Invisible helpers for formulas |

### 6.4 Idempotency / process safety

- Don’t include employees who already have a **submitted** slip for the period.
- Canceling Payroll Entry cancels/deletes linked slips and JEs.
- Large runs (>30 employees) enqueue background jobs.

---

## 7. Conceptual Mapping: Frappe → Our Next.js Stack

> Reminder: implement **concepts** in our architecture (API routes, Prisma/SQL, services). Do not port DocTypes, `frappe.db`, or child-table JSON.

| Frappe concept | Frappe implementation | Implement in our stack as |
|----------------|----------------------|---------------------------|
| Salary Component | DocType + flags | `salary_components` table + admin UI |
| Salary Structure | DocType + child Salary Detail | `salary_structures` + `salary_structure_lines` |
| SSA | DocType with base/tax slab | `employee_salary_assignments` (effective_from, base, structure_id, tax_regime_id) |
| Payroll Period | Tax year DocType | `tax_years` / `payroll_fiscal_periods` |
| Payroll Settings | Single DocType | `payroll_settings` (org-level JSON/table) |
| Payroll Entry | Batch DocType | `payroll_runs` + `payroll_run_employees` |
| Salary Slip | Calc engine DocType | `payslips` + `payslip_lines` + `PayrollCalculationService` |
| Additional Salary | Adjustment DocType | `payroll_adjustments` (source_type, source_id) |
| Income Tax Slab | Progressive slabs | `tax_slabs` + `tax_slab_bands` + `TaxService` |
| Tax Declaration/Proof | Two DocTypes | `tax_declarations` / `tax_proofs` |
| Overtime Slip | HR DocType → Additional Salary | `overtime_entries` → create adjustment |
| LWP/Attendance | Settings + slip methods | Shared `AttendancePayrollAdapter` |
| Loans | Lending integration | Our loan module → `payslip.loan_deductions` |
| Workflow | Optional Frappe Workflow | Our existing approval engine |
| Accounting JE | ERPNext GL | Our finance/ledger integration (if any) |

### What NOT to copy

- Frappe DocType JSON schemas as our DB schema 1:1  
- Python `safe_eval` formula DSL (unless we consciously want a sandboxed expression language — better start with fixed formulas + config)  
- ERPNext Journal Entry coupling (unless we have GL)  
- Bench/site multi-tenancy model  
- Child table UX patterns unique to Desk  

---

## 8. Gap Analysis Checklist (Fill Against Our App)

> This Frappe clone does **not** contain your Next.js app. Fill this table in the other Cursor project.

| Capability | Frappe has | We have? (Y/N/Partial) | Missing? | Priority | Notes |
|------------|------------|------------------------|----------|----------|-------|
| Salary component master with flags | Y | | | P0 | |
| Salary structure templates | Y | | | P0 | |
| Employee salary assignment (effective dates) | Y | | | P0 | |
| Payroll run batch | Y | | | P0 | |
| Payslip with line items | Y | | | P0 | |
| Payment days / LWP proration | Y | | | P0 | |
| Attendance → payroll link | Y | | | P0 | |
| Leave → LWP link | Y | | | P0 | |
| Formula-based components | Y | | | P2 | Can start fixed |
| Annualized TDS | Y | | | P0/P1 | Depends on country |
| Tax exemption declaration/proof | Y | | | P1 | |
| Payroll adjustments (OT/bonus/arrears) | Y | | | P0 | |
| Overtime → payroll | Y | | | P1 | |
| Loan/advance recovery on payslip | Y | | | P1 | |
| Mid-join / mid-exit proration | Y | | | P0 | |
| Duplicate payslip prevention | Y | | | P0 | |
| Salary withholding | Y | | | P2 | |
| Arrears on structure change | Y | | | P2 | |
| Payroll correction | Y | | | P2 | |
| Employer contribution / CTC view | Y | | | P2 | |
| Flex benefits | Y | | | P3 | |
| Gratuity | Y | | | P3 | |
| Payslip email/PDF | Y | | | P1 | |
| Approval on payroll run | Optional | | | P1 | Use our workflow |

**After filling:** anything marked Missing + Priority P0/P1 becomes the implementation backlog in Section 9.

---

## 9. Recommended Implementation Plan

### Principles

1. Preserve our Next.js + backend + auth + DB.  
2. Port **business rules & calculation order**, not Frappe code.  
3. Ship a correct **monthly payroll MVP** before tax sophistication / flex benefits.  
4. Every calculation should be pure/testable in a service layer (unit tests mirroring Frappe edge cases).

### Phase 0 — Discovery (in our app repo)

- Inventory existing Employee, Attendance, Leave, Payroll tables/APIs.
- Complete Section 8 checklist.
- Decide jurisdiction tax model (India annual TDS vs other).

### Phase 1 — Core masters & assignment (no calc yet)

**Why:** Without components/structures/assignments, every payslip becomes hardcoded.

**Build:**

- `SalaryComponent` CRUD + flags (`dependsOnPaymentDays`, `isTaxable`, `type`)
- `SalaryStructure` + lines
- `EmployeeSalaryAssignment` (`effectiveFrom`, `baseSalary`, `structureId`)
- Admin UI in Next.js

### Phase 2 — Payment days engine

**Why:** Most payroll bugs are days/LWP bugs.

**Build:**

- Org `PayrollSettings` (holidays in working days?, attendance vs leave, half-day fraction)
- `computePaymentDays(employeeId, start, end)` service
- Unit tests: mid-join, LWP, holidays, unmarked absent, half-day

**Reference Frappe:** `get_working_days_details`, `get_payment_days`, LWP methods.

### Phase 3 — Payslip calculation MVP

**Why:** Delivers net salary.

**Build:** `PayrollCalculationService.calculate(employee, period)`:

1. Load assignment + structure lines  
2. Compute payment days  
3. Earnings (fixed or simple % of base) × payment factor  
4. Deductions (fixed / % of gross)  
5. `net = gross − deductions`  
6. Persist payslip + lines  

**Skip initially:** full formula DSL, flex benefits, employer contributions.

### Phase 4 — Payroll run batch

**Why:** Ops need bulk processing.

**Build:**

- `PayrollRun` create → select eligible employees → generate payslips → submit/lock → export bank file
- Eligibility mirrors Frappe filters + “no duplicate submitted slip”
- Hook into our approval system before submit if required

### Phase 5 — Adjustments bus

**Why:** Avoid special-casing OT/bonus/incentive forever.

**Build:** `PayrollAdjustment` with `type`, `componentId`, `amount`, `payrollDate`/`dateRange`, `sourceType/sourceId`.

Wire:

- Manual adjustments  
- Overtime module → adjustment  
- Advance recovery → adjustment  

### Phase 6 — Tax engine (if required)

**Why:** Annualized TDS is legally sensitive.

**Build:**

- Tax year + slabs + bands  
- Assignment → tax regime  
- Annual projection + remaining periods (copy Frappe math in TypeScript)  
- Declarations / proofs  

**Reference:** `calculate_variable_tax`, `calculate_tax_by_tax_slab`, `compute_taxable_earnings_for_year`.

### Phase 7 — Hardening

- Arrears, payroll corrections, withholding  
- YTD reports, salary register  
- PDF/email payslips  
- Accounting export  
- Property-based tests from `test_salary_slip.py` scenarios  

---

## 10. Suggested Data Model for Our Architecture

> Illustrative only — adapt to our naming/ORM. Not Frappe DocTypes.

```text
salary_components
  id, org_id, name, code (abbr), type [EARNING|DEDUCTION|EMPLOYER],
  depends_on_payment_days, is_taxable, is_statistical,
  include_in_gross, is_tax_component, full_tax_on_payment,
  default_calc_type [FIXED|PERCENT_OF_BASE|PERCENT_OF_GROSS|FORMULA],
  default_value, is_active

salary_structures
  id, org_id, name, frequency, currency, is_active

salary_structure_lines
  id, structure_id, component_id, calc_type, value, condition_json,
  sequence, overrides flags...

employee_salary_assignments
  id, employee_id, structure_id, effective_from, base, variable,
  tax_slab_id, opening_taxable, opening_tax_paid, status

tax_years
  id, org_id, name, start_date, end_date

tax_slabs / tax_slab_bands
  ...

payroll_settings
  org_id, payroll_based_on, include_holidays, unmarked_as,
  half_day_fraction, round_net_pay, ...

payroll_runs
  id, org_id, period_start, period_end, status, filters_json,
  created_by, approved_by

payroll_run_employees
  run_id, employee_id, assignment_id, is_withheld

payslips
  id, run_id?, employee_id, period_start, period_end,
  total_working_days, lwp_days, absent_days, payment_days,
  gross, total_deductions, total_loan_repayment, net, rounded_net,
  status [DRAFT|SUBMITTED|CANCELLED|WITHHELD],
  tax_breakup_json

payslip_lines
  id, payslip_id, component_id, type, amount, default_amount,
  additional_amount, calc_snapshot_json

payroll_adjustments
  id, employee_id, component_id, amount, payroll_date,
  from_date, to_date, overwrite, source_type, source_id, status
```

---

## 11. Pseudocode: Payroll Engine (Framework-Agnostic)

```typescript
// Conceptual — implement in our backend language/service

function calculatePayslip(employeeId: string, start: Date, end: Date): Payslip {
  const settings = loadPayrollSettings();
  const employee = loadEmployee(employeeId);
  const assignment = getAssignmentAsOf(employeeId, start); // SSA equivalent
  const structure = loadStructure(assignment.structureId);

  // 1. Days
  const { totalWorkingDays, lwp, absent, paymentDays } =
    computePaymentDays(employee, start, end, settings);

  // 2. Context for formulas (if any)
  const ctx = {
    base: assignment.base,
    variable: assignment.variable,
    payment_days: paymentDays,
    employee,
  };

  // 3. Earnings
  const earningLines = [];
  for (const line of structure.earnings) {
    let amount = evalLine(line, ctx); // fixed or formula
    const adj = getAdjustments(employeeId, start, end, line.componentId, "EARNING");
    amount = applyAdjustments(amount, adj);
    if (line.dependsOnPaymentDays && totalWorkingDays > 0) {
      amount = amount * (paymentDays / totalWorkingDays);
    } else if (line.dependsOnPaymentDays && paymentDays === 0) {
      amount = 0;
    }
    earningLines.push({ ...line, amount });
    ctx[line.code] = amount; // for dependent formulas
  }
  const gross = sumIncluded(earningLines);
  ctx.gross_pay = gross;

  // 4. Deductions (non-tax)
  const deductionLines = [];
  for (const line of structure.deductions.filter(l => !l.isTaxComponent)) {
    let amount = evalLine(line, ctx);
    amount = applyAdjustments(amount, getAdjustments(..., "DEDUCTION"));
    if (line.dependsOnPaymentDays) amount = prorate(amount, paymentDays, totalWorkingDays);
    deductionLines.push({ ...line, amount });
    ctx[line.code] = amount;
  }

  // 5. Tax (optional / jurisdiction-specific)
  const taxAmount = calculateMonthlyTax({
    employee, assignment, start, end, earningLines, deductionLines, settings,
  });
  if (taxAmount != null) {
    deductionLines.push({ code: "TAX", amount: taxAmount, isTaxComponent: true });
  }

  // 6. Loans
  const loanRepayment = getLoanRepaymentForPeriod(employeeId, start, end);

  // 7. Net
  const totalDeduction = sum(deductionLines);
  const net = gross - totalDeduction - loanRepayment;
  if (net < 0) throw new Error("Net pay cannot be negative");

  return {
    employeeId, start, end,
    totalWorkingDays, lwp, absent, paymentDays,
    earningLines, deductionLines, loanRepayment,
    gross, totalDeduction, net,
    roundedNet: settings.roundNetPay ? Math.round(net) : net,
  };
}

function calculateMonthlyTax(input): number {
  // Mirror Frappe:
  // annualTaxable = prev + current + futureProjection - exemptions
  // annualTax = progressiveSlab(annualTaxable)
  // return max(0, (annualTax - taxPaidYtd) / remainingPeriods + fullTaxOnBonus)
}
```

---

## Appendix A — Quick “Why this matters for us”

| Idea from Frappe | Why implement | How (in our stack) |
|------------------|---------------|--------------------|
| Component flags (`depends_on_payment_days`, taxable) | Avoid hardcoding every rule | Columns on component master |
| Structure vs Assignment split | Supports raises & history | Two tables + effective_from |
| Payment days engine | Correct unpaid leave/absent | Shared service used by payslip calc |
| Additional Salary bus | One extension point for OT/bonus/arrears | `payroll_adjustments` |
| Annualized tax | Correct TDS for progressive regimes | `TaxService` with tax year |
| Payroll run eligibility | Prevent double payment | Query: assignment ∩ filters − existing slips |
| Calculation order (earnings → gross → deductions → tax → loans → net) | Dependent formulas & tax base correctness | Enforce order in one service method |
| Mid-join/exit clipping | Fair first/last month pay | `actualStart`/`actualEnd` before days math |

---

## Appendix B — File path cheat sheet (absolute-from-repo-root)

```
hrms/payroll/doctype/salary_slip/salary_slip.py
hrms/payroll/doctype/salary_slip/salary_slip.json
hrms/payroll/doctype/salary_slip/salary_slip_loan_utils.py
hrms/payroll/doctype/salary_slip/test_salary_slip.py
hrms/payroll/doctype/payroll_entry/payroll_entry.py
hrms/payroll/doctype/payroll_entry/payroll_entry.js
hrms/payroll/doctype/salary_structure/salary_structure.py
hrms/payroll/doctype/salary_structure_assignment/salary_structure_assignment.py
hrms/payroll/doctype/salary_component/salary_component.json
hrms/payroll/doctype/additional_salary/additional_salary.py
hrms/payroll/doctype/income_tax_slab/income_tax_slab.py
hrms/payroll/doctype/payroll_period/payroll_period.py
hrms/payroll/doctype/payroll_settings/payroll_settings.py
hrms/payroll/utils.py
hrms/hr/doctype/overtime_slip/overtime_slip.py
hrms/hr/doctype/overtime_type/overtime_type.py
hrms/regional/india/utils.py
hrms/modules.txt
```

---

## Appendix C — Status of this analysis workspace

- This workspace is the **cloned Frappe HRMS reference**, not your production Next.js app.
- **No application code was modified** for this analysis.
- Next step (in the other Cursor project): copy this file → fill Section 8 → implement Phase 1.

---

*Generated from source analysis of Frappe HR payroll modules. Prefer the cited `.py` functions over secondary docs when formulas conflict.*
