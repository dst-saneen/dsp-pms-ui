import type { PayrollIssue } from "../types";

export type PreflightGroup = {
  code: string;
  title: string;
  meaning: string;
  path?: string;
  href?: string;
  people: string[];
  count: number;
};

const COPY: Record<string, { title: string; meaning: string; path?: string; href?: string }> = {
  MISSING_SALARY_REVISION: {
    title: "No salary for this month",
    meaning:
      "These people have no salary package covering this pay month, so they are not included in calculated pay until a revision is added.",
    path: "Payroll → Employee salaries → pick the person → New revision (start on/before day 1 of the month).",
    href: "/hr/payroll?tab=salaries",
  },
  MISSING_TAX_PROFILE: {
    title: "No tax profile",
    meaning: "Tax remains zero for these people until a tax profile is added for the period.",
    path: "Payroll → Tax profiles → add a profile for the person.",
    href: "/hr/payroll?tab=tax",
  },
  JOINER_IN_PERIOD: {
    title: "Joined mid-month",
    meaning:
      "Their joining date falls inside this pay month — confirm whether they should get full or partial pay.",
    path: "Employee profile → check joining date.",
    href: "/hr/employees",
  },
  LEAVER_IN_PERIOD: {
    title: "Leaving this month",
    meaning: "Last working day is in this month — confirm final pay and any clearance.",
    path: "Employee separation / profile → check last working date.",
    href: "/hr/employees",
  },
  SALARY_REVISION_OVERLAP: {
    title: "Salary dates overlap",
    meaning: "Two salary packages cover the same days. Keep one clean Current revision.",
    path: "Payroll → Employee salaries → End the wrong Current row, then New revision.",
    href: "/hr/payroll?tab=salaries",
  },
  TAX_PROFILE_OVERLAP: {
    title: "Tax profiles overlap",
    meaning: "Two tax profiles cover the same days — keep one clean range.",
    path: "Payroll → Tax profiles → end or fix the overlapping profile.",
    href: "/hr/payroll?tab=tax",
  },
  PAYROLL_PREFLIGHT_FAILED: {
    title: "Readiness check unavailable",
    meaning:
      "Payroll readiness could not be verified. Retry before calculating or processing this run.",
  },
};

function personLabel(issue: PayrollIssue) {
  if (issue.entityLabel?.trim()) return issue.entityLabel.trim();
  if (issue.entityId) return issue.entityId.slice(0, 8);
  return null;
}

export function groupPreflightIssues(issues: PayrollIssue[]): PreflightGroup[] {
  const byCode = new Map<string, PayrollIssue[]>();
  for (const issue of issues) {
    const list = byCode.get(issue.code) ?? [];
    list.push(issue);
    byCode.set(issue.code, list);
  }

  return [...byCode.entries()].map(([code, rows]) => {
    const copy = COPY[code];
    const people = [
      ...new Set(rows.map(personLabel).filter((value): value is string => Boolean(value))),
    ];

    return {
      code,
      title: copy?.title ?? rows[0]?.message ?? code,
      meaning: copy?.meaning ?? "A readiness note from the payroll check for this month.",
      path: copy?.path,
      href: copy?.href,
      people,
      count: rows.length,
    };
  });
}

export function summarizePayrollWarnings(issues: PayrollIssue[]) {
  const noSalary = issues.filter((issue) => issue.code === "MISSING_SALARY_REVISION").length;
  const noTax = issues.filter((issue) => issue.code === "MISSING_TAX_PROFILE").length;

  return {
    noSalary,
    noTax,
    other: issues.length - noSalary - noTax,
    total: issues.length,
  };
}
