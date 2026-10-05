"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";

import type { Employee } from "../types/employee";

interface EmployeeAvatarProps {
  employee: Employee;
}

export function EmployeeAvatar({
  employee,
}: EmployeeAvatarProps) {
  const initials = `${employee.firstName?.[0] ?? ""}${employee.lastName?.[0] ?? ""}`.toUpperCase();

  return (
    <div className="flex items-center gap-3">
      <Avatar className="h-9 w-9">
        <AvatarFallback>
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="flex flex-col">
        <span className="font-medium">
          {employee.firstName} {employee.lastName}
        </span>

        <span className="text-xs text-muted-foreground">
          {employee.employeeCode}
        </span>
      </div>
    </div>
  );
}