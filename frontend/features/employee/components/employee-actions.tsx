"use client";

import {
  MoreHorizontal,
  Eye,
  Pencil,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { Employee } from "../types/employee";
import { useRouter } from "next/navigation";

interface EmployeeActionsProps {
  employee: Employee;
}

export function EmployeeActions({
  employee,
}: EmployeeActionsProps) {
  const router = useRouter();

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() =>
              router.push(`/hr/employees/${employee.id}`)
            }
          >
            <Eye className="mr-2 h-4 w-4" />
            View Profile
          </DropdownMenuItem>

          <DropdownMenuItem
              onClick={() =>
                  router.push(
                      `/hr/employees/${employee.id}/edit`
                  )
              }
          >
            <Pencil className="mr-2 h-4 w-4" />
            Edit Employee
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}