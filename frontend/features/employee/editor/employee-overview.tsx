import { InfoCard } from "@/components/common/info-card";
import { InfoRow } from "@/components/common/info-row";
import { EmployeeStatusBadge } from "../components/employee-status-badge";

import type { Employee } from "../types/employee";

interface EmployeeOverviewProps {
  employee: Employee;
}

export function EmployeeOverview({
  employee,
}: EmployeeOverviewProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <InfoCard
        title="Personal Information"
        description="Core employee identity and contact details"
      >
        <InfoRow
          label="Employee Code"
          value={<span className="font-mono">{employee.employeeCode}</span>}
        />
        <InfoRow
          label="Full Name"
          value={`${employee.firstName} ${employee.lastName}`}
        />
        <InfoRow label="Email" value={employee.email ?? "Not provided"} />
        <InfoRow label="Mobile" value={employee.mobile ?? "Not provided"} />
      </InfoCard>

      <InfoCard
        title="Current Status"
        description="Current employment classification"
      >
        <InfoRow
          label="Status"
          value={<EmployeeStatusBadge status={employee.employmentStatus} />}
        />
        <InfoRow
          label="Employee Type"
          value={employee.employeeType ?? "Not provided"}
        />
        <InfoRow
          label="Joining Date"
          value={employee.joiningDate ?? "Not provided"}
        />
      </InfoCard>

      <InfoCard
        title="Organization"
        description="Company placement and reporting line"
        className="xl:col-span-2"
      >
        <InfoRow
          label="Company"
          value={employee.company?.companyName ?? "Not assigned"}
        />
        <InfoRow
          label="Branch"
          value={employee.branch?.branchName ?? "Not assigned"}
        />
        <InfoRow
          label="Department"
          value={employee.department?.departmentName ?? "Not assigned"}
        />
        <InfoRow
          label="Designation"
          value={employee.designation?.designationName ?? "Not assigned"}
        />
        <InfoRow
          label="Manager"
          value={
            employee.manager
              ? `${employee.manager.firstName} ${employee.manager.lastName}`
              : "Not assigned"
          }
        />
      </InfoCard>
    </div>
  );
}
