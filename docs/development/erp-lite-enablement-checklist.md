# ERP Lite enablement checklist

Feature gates default **off**. Enable one company only after migration deploy and setup sign-off.

## Environment

```bash
OFFICE_FINANCE_LITE_ENABLED=true
OFFICE_FINANCE_LITE_COMPANY_IDS=<company-uuid>
PAYROLL_LITE_ENABLED=true
PAYROLL_LITE_COMPANY_IDS=<company-uuid>
```

## Finance prerequisites (per company)

1. Financial profile: base currency + reporting start date
2. Payroll expense category (EXPENSE) linked on the profile
3. At least one active payment account
4. Open finance period covering the payroll paid date
5. Distinct maker vs approver users (maker-checker)

## Payroll prerequisites

1. Salary components configured
2. Active salary revisions for eligible employees
3. Attendance periods in `PAYROLL_PENDING` or `CLOSED` for branches with eligible employees
4. HR maker ≠ Finance/Payroll approver for the same run

## Post-enable smoke

1. `GET /me/module-capabilities` shows `officeFinanceLite` / `payrollLite`
2. Create/submit/approve a manual expense
3. Attach a clean Finance receipt to a draft/approved transaction and download via grant
4. Create payroll draft → calculate → independent approve → mark paid
5. Confirm one aggregate Finance expense (no employee salary lines)
6. Outbox processes `payroll.payslip.generate` → payslip becomes `AVAILABLE`
7. Employee lists and downloads own payslip only via short-lived grant
8. Export `GET /office-finance/reports/export.csv` with safe content-disposition

## Storage notes

- Finance receipts and payslips require File Storage V2 + company/branch allowlist.
- Payslips use the internal generated-file primitive (CLEAN private PDF); they are never emailed as attachments.
