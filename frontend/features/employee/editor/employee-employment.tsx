import { InfoCard } from "@/components/common";
import { InfoRow } from "@/components/common";
import { EmployeeStatusBadge } from "../components/employee-status-badge";

import type { Employee } from "../types";

interface EmployeeEmploymentProps {
  employee: Employee;
}

export function EmployeeEmployment({
  employee,
}: EmployeeEmploymentProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <InfoCard
        title="Employment Information"
        description="Employment dates, type and lifecycle state"
      >
        <InfoRow
          label="Employment Status"
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
        title="Placement"
        description="Assigned legal entity, branch and department"
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
      </InfoCard>

      <InfoCard
        title="Reporting"
        description="Current manager relationship"
        className="xl:col-span-2"
      >
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
