"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import { useModuleCapabilities } from "@/hooks/use-module-capabilities";

import { EmployeeSalariesTab } from "./employee-salaries-tab";
import { PayrollPathBanner } from "./payroll-path-banner";
import { PayrollReportsTab } from "./payroll-reports-tab";
import { PayrollRunsTab } from "./payroll-runs-tab";
import { PayslipOperationsTab } from "./payslip-operations-tab";
import { RecurringDeductionsTab } from "./recurring-deductions-tab";
import { SalaryComponentsTab } from "./salary-components-tab";
import { TaxProfilesTab } from "./tax-profiles-tab";

const PAYROLL_TABS = [
  "components",
  "salaries",
  "tax",
  "deductions",
  "runs",
  "payslip-operations",
  "reports",
] as const;

type PayrollTab = (typeof PAYROLL_TABS)[number];

function pathCurrentForTab(
  tab: PayrollTab
): "components" | "salaries" | "runs" | "payslips" | "reports" {
  if (tab === "components") return "components";
  if (tab === "salaries" || tab === "tax" || tab === "deductions") {
    return "salaries";
  }
  if (tab === "payslip-operations") return "payslips";
  if (tab === "reports") return "reports";
  return "runs";
}

function PayrollWorkspaceInner({ initialTab }: { initialTab: PayrollTab }) {
  const router = useRouter();
  const { data: capabilities } = useModuleCapabilities();
  const canManagePayroll =
    capabilities?.payroll && (capabilities.payrollActions?.includes("CREATE_RUN") ?? false);

  const [tab, setTab] = useState<PayrollTab>(initialTab);

  function goToTab(next: string) {
    const nextTab = (PAYROLL_TABS as readonly string[]).includes(next)
      ? (next as PayrollTab)
      : "components";
    setTab(nextTab);
    router.replace(`/hr/payroll?tab=${nextTab}`);
  }

  if (capabilities && !capabilities.payroll) {
    const reasons = capabilities.payrollDependencyState?.blockedReasons ?? [];
    return (
      <WorkspaceShell>
        <PayrollPathBanner
          current="components"
          note="Payroll must be enabled for this company. Finance, file storage, and worker readiness are checked when you create a run."
        />
        <p className="text-muted-foreground text-sm">
          Payroll is unavailable for this active Company and Branch.
          {reasons.length
            ? ` Ask Platform Admin to clear: ${reasons.join(", ")}.`
            : " Ask Platform Admin to enable Payroll for your company."}
        </p>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell>
      <PayrollPathBanner
        current={pathCurrentForTab(tab)}
        note="Setup first (components → employee salaries), then Runs → Calculate → Approve → Mark paid → Payslips. Approve needs a different user than the maker when maker-checker applies."
      />
      {!canManagePayroll ? (
        <p className="text-muted-foreground mb-3 text-xs">
          You can view payroll setup and runs. Create / calculate actions stay disabled without
          payroll manage permission.
        </p>
      ) : null}
      <Tabs value={tab} onValueChange={goToTab}>
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="components">1. Salary Components</TabsTrigger>
          <TabsTrigger value="salaries">2. Employee Salaries</TabsTrigger>
          <TabsTrigger value="tax">Tax Profiles</TabsTrigger>
          <TabsTrigger value="deductions">Recurring Deductions</TabsTrigger>
          <TabsTrigger value="runs">3. Runs</TabsTrigger>
          <TabsTrigger value="payslip-operations">Payslip Operations</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>
        <TabsContent value="components" className="mt-4">
          <p className="text-muted-foreground mb-3 text-xs">
            Create Basic / Allowance / Deduction components. Next: Employee Salaries.
          </p>
          <SalaryComponentsTab />
        </TabsContent>
        <TabsContent value="salaries" className="mt-4">
          <p className="text-muted-foreground mb-3 text-xs">
            Attach a salary revision (effective before the payroll month). Next: Runs.
          </p>
          <EmployeeSalariesTab />
        </TabsContent>
        <TabsContent value="tax" className="mt-4">
          <TaxProfilesTab />
        </TabsContent>
        <TabsContent value="deductions" className="mt-4">
          <RecurringDeductionsTab />
        </TabsContent>
        <TabsContent value="runs" className="mt-4">
          <p className="text-muted-foreground mb-3 text-xs">
            Preflight → Create draft → open the run → Calculate → Approve → Mark paid.
          </p>
          <PayrollRunsTab />
        </TabsContent>
        <TabsContent value="payslip-operations" className="mt-4">
          <p className="text-muted-foreground mb-3 text-xs">
            After Mark paid, retry failed payslip generation here. Employees download from My
            Workspace.
          </p>
          <PayslipOperationsTab />
        </TabsContent>
        <TabsContent value="reports" className="mt-4">
          <PayrollReportsTab />
        </TabsContent>
      </Tabs>
    </WorkspaceShell>
  );
}

function PayrollWorkspaceQueryState() {
  const searchParams = useSearchParams();
  const tabParam = searchParams?.get("tab");
  const initialTab: PayrollTab =
    tabParam && (PAYROLL_TABS as readonly string[]).includes(tabParam)
      ? (tabParam as PayrollTab)
      : "components";

  return <PayrollWorkspaceInner key={initialTab} initialTab={initialTab} />;
}

export function PayrollWorkspace() {
  return (
    <Suspense fallback={<div className="bg-muted/40 h-40 animate-pulse rounded-xl" />}>
      <PayrollWorkspaceQueryState />
    </Suspense>
  );
}
