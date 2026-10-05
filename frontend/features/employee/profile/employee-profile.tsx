"use client";

import { useState } from "react";

import { useEmployee } from "../hooks/use-employee";
import { useDeactivateEmployee } from "../hooks/use-deactivate-employee";

import { EmployeeProfileHeader } from "../editor/employee-profile-header";
import { EmployeeTabs } from "../editor/employee-tabs";

import { useRouter } from "next/navigation";

import { InfoCard } from "@/components/common/info-card";
import { InfoRow } from "@/components/common/info-row";
import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";

import { EmployeeDocumentProfile } from "@/features/employee-document/profile/employee-document-profile";
import { EmployeeAssetProfile } from "@/features/employee-asset/profile/employee-asset-profile";
import { EmployeeOnboardingProfile } from "@/features/employee-onboarding";
import { EmployeeLeaveProfile } from "@/features/employee-leave/components/employee-leave-profile";
import { EmployeeSalaryProfile } from "@/features/payroll";
import { useAuth } from "@/providers/auth-provider";
import { ProfileLayout } from "@/components/profile";

interface Props {
  employeeId: string;
}

export function EmployeeProfile({ employeeId }: Props) {
  const { data: employee, isLoading } = useEmployee(employeeId);
  const router = useRouter();
  const { hasPermission } = useAuth();
  const canViewSalary =
    hasPermission("payroll.payroll.read") ||
    hasPermission("payroll.payroll.manage");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const deactivateEmployee = useDeactivateEmployee();

  if (isLoading) {
    return <div className="p-6">Loading employee...</div>;
  }

  if (!employee) {
    return <div className="p-6">Employee not found.</div>;
  }

  const overviewContent = (
    <div className="grid gap-6 lg:grid-cols-2">
      <InfoCard title="Personal Information">
        <InfoRow label="First Name" value={employee.firstName} />
        <InfoRow label="Last Name" value={employee.lastName} />
        <InfoRow label="Email" value={employee.email} />
        <InfoRow label="Mobile" value={employee.mobile} />
      </InfoCard>

      <InfoCard title="Employment">
        <InfoRow label="Employee Code" value={employee.employeeCode} />
        <InfoRow label="Employee Type" value={employee.employeeType} />
        <InfoRow label="Status" value={employee.employmentStatus} />
      </InfoCard>
    </div>
  );

  const tabs = [
    {
      value: "overview",
      label: "Overview",
      content: overviewContent,
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
          },
        ]
      : []),
  ];

  return (
    <ProfileLayout>
      <EmployeeProfileHeader
        employee={employee}
        onEdit={() => router.push(`/hr/employees/${employee.id}/edit`)}
        onDeactivate={() => setConfirmOpen(true)}
      />

      <EmployeeTabs defaultValue="overview" tabs={tabs} />

      <ConfirmActionDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Deactivate Employee"
        message="The employee will be deactivated and can no longer be assigned to new HR activities. Existing records will be preserved for historical reporting."
        nameLabel="Employee"
        codeLabel="Employee Code"
        name={`${employee.firstName} ${employee.lastName}`}
        code={employee.employeeCode}
        confirmLabel="Deactivate"
        loadingLabel="Deactivating..."
        loading={deactivateEmployee.isPending}
        onConfirm={() =>
          deactivateEmployee.mutate(employee.id, {
            onSuccess: () => {
              setConfirmOpen(false);
            },
          })
        }
      />
    </ProfileLayout>
  );
}
