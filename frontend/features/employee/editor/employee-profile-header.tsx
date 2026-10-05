"use client";

import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  MoreHorizontal,
  Pencil,
  UserX,
} from "lucide-react";

import { StatusBadge } from "@/components/common/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useAuth } from "@/providers/auth-provider";

import {
  getEmployeeStatusLabel,
  getEmployeeStatusTone,
} from "../components/employee-status-badge";
import type { Employee } from "../types/employee";

interface EmployeeProfileHeaderProps {
  employee: Employee;
  onEdit: () => void;
  onDeactivate: () => void;
  onBack?: () => void;
}

export function EmployeeProfileHeader({
  employee,
  onEdit,
  onDeactivate,
  onBack,
}: EmployeeProfileHeaderProps) {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const canManage = hasPermission("hr.employees.manage");
  const fullName = `${employee.firstName} ${employee.lastName}`.trim();
  const initials = `${employee.firstName?.[0] ?? ""}${
    employee.lastName?.[0] ?? ""
  }`.toUpperCase();

  return (
    <header className="relative overflow-hidden rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_6px_18px_rgba(16,24,40,0.035)] sm:p-5">
      <span
        className="absolute inset-x-0 top-0 h-0.5 bg-primary"
        aria-hidden="true"
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() =>
              onBack ? onBack() : router.push("/hr/employees")
            }
            aria-label="Back to employees"
          >
            <ArrowLeft className="size-4" />
          </Button>

          <Avatar className="size-12 shrink-0 border border-primary/10 sm:size-14">
            <AvatarFallback className="bg-primary-soft text-base font-semibold text-primary">
              {initials || "GE"}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-[-0.025em] text-foreground sm:text-2xl">
                {fullName}
              </h1>
              <StatusBadge
                label={getEmployeeStatusLabel(employee.employmentStatus)}
                tone={getEmployeeStatusTone(employee.employmentStatus)}
              />
            </div>
            <p className="mt-1.5 truncate text-sm text-muted-foreground">
              <span className="font-mono">{employee.employeeCode}</span>
              {" · "}
              {employee.designation?.designationName ??
                "Designation not assigned"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {canManage ? (
            <Button type="button" onClick={onEdit}>
              <Pencil className="size-4" />
              Edit Employee
            </Button>
          ) : null}

          {canManage ? (
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={`More actions for ${fullName}`}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={onDeactivate}
              >
                <UserX className="size-4" />
                Deactivate Employee
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          ) : null}
        </div>
      </div>
    </header>
  );
}
