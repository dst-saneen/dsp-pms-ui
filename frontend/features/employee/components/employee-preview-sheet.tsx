"use client";

import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  Mail,
  MapPin,
  Phone,
  UserRound,
  UsersRound,
} from "lucide-react";

import { EntityPreviewSheet } from "@/components/common/entity-preview-sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/services/api-client";

import { useEmployee } from "../hooks/use-employee";
import {
  getEmployeeStatusLabel,
  getEmployeeStatusTone,
} from "./employee-status-badge";
import { StatusBadge } from "@/components/common/status-badge";

interface EmployeePreviewSheetProps {
  employeeId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function PreviewField({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail;
  label: string;
  value?: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-0.5 break-words text-sm font-medium text-foreground">
          {value || "Not provided"}
        </p>
      </div>
    </div>
  );
}

export function EmployeePreviewSheet({
  employeeId,
  open,
  onOpenChange,
}: EmployeePreviewSheetProps) {
  const {
    data: employee,
    isLoading,
    error,
    refetch,
  } = useEmployee(open && employeeId ? employeeId : "");

  const initials = employee
    ? `${employee.firstName?.[0] ?? ""}${employee.lastName?.[0] ?? ""}`.toUpperCase()
    : "";
  const fullName = employee
    ? `${employee.firstName} ${employee.lastName}`.trim()
    : "";

  return (
    <EntityPreviewSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Employee preview"
      description={
        employee?.employeeCode
          ? `Quick view · ${employee.employeeCode}`
          : "Quick employee details"
      }
      isLoading={isLoading}
      error={
        error
          ? getApiErrorMessage(
              error,
              "We could not load this employee preview.",
            )
          : null
      }
      onRetry={() => {
        void refetch();
      }}
      footer={
        employee ? (
          <Button asChild className="w-full">
            <Link
              href={`/hr/employees/${employee.id}`}
              onClick={() => onOpenChange(false)}
            >
              View full details
              <ArrowRight />
            </Link>
          </Button>
        ) : null
      }
    >
      {employee ? (
        <div className="space-y-6">
          <div className="flex items-center gap-4 rounded-xl border border-border bg-muted/35 p-4">
            <Avatar className="size-14 border border-primary/10">
              <AvatarFallback className="bg-primary-soft text-base font-semibold text-primary">
                {initials || "GE"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold">{fullName}</p>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {employee.designation?.designationName ??
                  "Designation not assigned"}
              </p>
              <div className="mt-2">
                <StatusBadge
                  label={getEmployeeStatusLabel(employee.employmentStatus)}
                  tone={getEmployeeStatusTone(employee.employmentStatus)}
                />
              </div>
            </div>
          </div>

          <section aria-labelledby="preview-contact-heading">
            <h3
              id="preview-contact-heading"
              className="text-sm font-semibold text-foreground"
            >
              Contact
            </h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <PreviewField icon={Mail} label="Email" value={employee.email} />
              <PreviewField
                icon={Phone}
                label="Mobile"
                value={employee.mobile}
              />
            </div>
          </section>

          <section aria-labelledby="preview-organization-heading">
            <h3
              id="preview-organization-heading"
              className="text-sm font-semibold text-foreground"
            >
              Organization
            </h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <PreviewField
                icon={Building2}
                label="Company"
                value={employee.company?.companyName}
              />
              <PreviewField
                icon={MapPin}
                label="Branch"
                value={employee.branch?.branchName}
              />
              <PreviewField
                icon={UsersRound}
                label="Department"
                value={employee.department?.departmentName}
              />
              <PreviewField
                icon={BriefcaseBusiness}
                label="Designation"
                value={employee.designation?.designationName}
              />
              <PreviewField
                icon={UserRound}
                label="Manager"
                value={
                  employee.manager
                    ? `${employee.manager.firstName} ${employee.manager.lastName}`
                    : undefined
                }
              />
            </div>
          </section>
        </div>
      ) : null}
    </EntityPreviewSheet>
  );
}
