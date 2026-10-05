"use client";

import { useState } from "react";
import { UserRoundX } from "lucide-react";
import { toast } from "sonner";

import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { EntityDetailLayout } from "@/components/common/entity-detail-layout";
import { ErrorState } from "@/components/common/error-state";
import { getApiErrorMessage } from "@/services/api-client";
import { EmployeeDocumentProfile } from "@/features/employee-document";
import { EmployeeAssetProfile } from "@/features/employee-asset";
import { EmployeeLeaveProfile } from "@/features/employee-leave";
import { EmployeeOnboardingProfile } from "@/features/employee-onboarding";
import { EmployeeCareerTab } from "@/features/employee-career";
import { EmployeeSalaryProfile } from "@/features/payroll";
import { useAuth } from "@/providers/auth-provider";

import { EmployeeDetailLoading } from "./employee-detail-loading";
import { EmployeeEmployment } from "./employee-employment";
import { EmployeeOverview } from "./employee-overview";
import { EmployeeProfileHeader } from "./employee-profile-header";
import { EmployeeSummaryRail } from "./employee-summary-rail";
import {
  EmployeeTabs,
  type EmployeeTabItem,
} from "./employee-tabs";
import { useEmployeeEditor } from "./use-employee-editor";

export interface EmployeeEditorProps {
  employeeId: string;
  defaultTab?: string;
  listReturnTo?: string;
}

export function EmployeeEditor({
  employeeId,
  defaultTab,
  listReturnTo = "/hr/employees",
}: EmployeeEditorProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { hasPermission } = useAuth();
  const canViewSalary =
    hasPermission("payroll.payroll.read") ||
    hasPermission("payroll.payroll.manage");
  const {
    employee,
    isLoading,
    error,
    isDeactivating,
    edit,
    backToList,
    deactivate,
    refresh,
  } = useEmployeeEditor(employeeId, listReturnTo);

  if (isLoading) return <EmployeeDetailLoading />;

  if (error) {
    return (
      <ErrorState
        title="Employee details unavailable"
        description={getApiErrorMessage(
          error,
          "We could not load this employee record.",
        )}
        onRetry={() => {
          void refresh();
        }}
      />
    );
  }

  if (!employee) {
    return (
      <EmptyState
        icon={UserRoundX}
        title="Employee not found"
        description="This employee record may no longer be available."
      />
    );
  }

  const tabs: EmployeeTabItem[] = [
    {
      value: "overview",
      label: "Overview",
      content: <EmployeeOverview employee={employee} />,
    },
    {
      value: "employment",
      label: "Employment",
      content: <EmployeeEmployment employee={employee} />,
    },
    {
      value: "documents",
      label: "Documents",
      content: <EmployeeDocumentProfile employeeId={employee.id} />,
    },
    {
      value: "assets",
      label: "Assets & licences",
      content: <EmployeeAssetProfile employeeId={employee.id} />,
    },
    {
      value: "onboarding",
      label: "Onboarding",
      content: <EmployeeOnboardingProfile employeeId={employee.id} />,
    },
    {
      value: "career",
      label: "Career",
      content: <EmployeeCareerTab employeeId={employee.id} />,
    },
    {
      value: "leave",
      label: "Leave",
      content: <EmployeeLeaveProfile employeeId={employee.id} />,
    },
    ...(canViewSalary
      ? [
          {
            value: "salary",
            label: "Salary",
            content: <EmployeeSalaryProfile employeeId={employee.id} />,
          } satisfies EmployeeTabItem,
        ]
      : []),
  ];

  const fullName = `${employee.firstName} ${employee.lastName}`.trim();

  const handleDeactivate = async () => {
    try {
      await deactivate();
      setConfirmOpen(false);
      toast.success(`${fullName} has been deactivated.`);
    } catch (deactivateError) {
      toast.error(
        getApiErrorMessage(
          deactivateError,
          "We could not deactivate this employee.",
        ),
      );
    }
  };

  return (
    <>
      <EntityDetailLayout
        header={
          <EmployeeProfileHeader
            employee={employee}
            onEdit={edit}
            onDeactivate={() => setConfirmOpen(true)}
            onBack={backToList}          />
        }
        summary={<EmployeeSummaryRail employee={employee} />}
      >
        <EmployeeTabs tabs={tabs} defaultValue={defaultTab} />
      </EntityDetailLayout>

      <ConfirmActionDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Deactivate employee"
        message="This employee will become inactive. Existing records remain available."
        name={fullName}
        code={employee.employeeCode}
        loading={isDeactivating}
        confirmLabel="Deactivate"
        loadingLabel="Deactivating..."
        onConfirm={() => {
          void handleDeactivate();
        }}
      />
    </>
  );
}
