import {
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Mail,
  MapPin,
  Phone,
  UsersRound,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import type { Employee } from "../types/employee";

interface EmployeeSummaryRailProps {
  employee: Employee;
}

function SummaryItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail;
  label: string;
  value?: string;
}) {
  return (
    <div className="flex gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary ring-1 ring-inset ring-primary/10">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <dt className="text-xs leading-4 text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 break-words text-sm font-medium">
          {value || "Not provided"}
        </dd>
      </div>
    </div>
  );
}

export function EmployeeSummaryRail({
  employee,
}: EmployeeSummaryRailProps) {
  return (
    <Card className="gap-0 py-0 lg:sticky lg:top-0">
      <CardHeader className="border-b border-border px-5 py-4">
        <CardTitle>Employee information</CardTitle>
        <CardDescription>
          Contact and organization details
        </CardDescription>
      </CardHeader>

      <CardContent className="p-0">
        <section className="border-b border-border p-5">
          <h3 className="text-xs font-semibold text-foreground">
            Contact
          </h3>
          <dl className="mt-4 space-y-4">
            <SummaryItem icon={Mail} label="Email" value={employee.email} />
            <SummaryItem icon={Phone} label="Mobile" value={employee.mobile} />
          </dl>
        </section>

        <section className="p-5">
          <h3 className="text-xs font-semibold text-foreground">
            Organization
          </h3>
          <dl className="mt-4 space-y-4">
            <SummaryItem
              icon={Building2}
              label="Company"
              value={employee.company?.companyName}
            />
            <SummaryItem
              icon={MapPin}
              label="Branch"
              value={employee.branch?.branchName}
            />
            <SummaryItem
              icon={UsersRound}
              label="Department"
              value={employee.department?.departmentName}
            />
            <SummaryItem
              icon={BriefcaseBusiness}
              label="Designation"
              value={employee.designation?.designationName}
            />
            <SummaryItem
              icon={CalendarDays}
              label="Joining date"
              value={employee.joiningDate}
            />
          </dl>
        </section>
      </CardContent>
    </Card>
  );
}
