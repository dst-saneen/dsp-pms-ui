"use client";

import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { userInviteHref } from "@/features/security/lib/security-navigation";
import { useAuth } from "@/providers/auth-provider";
import { getApiErrorMessage } from "@/services/api-client";

import { EmployeeStatusBadge } from "../components/employee-status-badge";
import { useEmployeeDirectory } from "../hooks/use-employees";
import {
  employeeDetailHref,
  employeeDirectoryHref,
  type EmployeeDirectoryFilters,
  toEmployeeSearchParams,
} from "../lib/employee-navigation";
import type { Employee } from "../types/employee";

interface EmployeeTableProps {
  filters: EmployeeDirectoryFilters;
  listHref: string;
  onPageChange: (page: number) => void;
}

export function EmployeeTable({
  filters,
  listHref,
  onPageChange,
}: EmployeeTableProps) {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const canInviteUsers = hasPermission("security.users.manage");
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useEmployeeDirectory(toEmployeeSearchParams(filters));

  const employees = data?.items ?? [];
  const total = data?.total ?? 0;
  const limit = data?.limit ?? filters.limit;
  const page = data?.page ?? filters.page;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const columnCount = canInviteUsers ? 6 : 5;

  function openInvite(employee: Employee) {
    router.push(
      userInviteHref({
        returnTo: listHref,
        employeeId: employee.id,
      }),
    );
  }

  return (
    <div className="space-y-3">
      <div className="border-border overflow-hidden rounded-xl border">
        <Table aria-label="Employees">
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Employee</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead>Status</TableHead>
              {canInviteUsers ? (
                <TableHead className="text-right">Login</TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={columnCount}
                  className="text-muted-foreground h-32 text-center text-sm"
                >
                  Loading employees…
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={columnCount} className="h-32 text-center text-sm">
                  <p className="text-destructive">
                    {getApiErrorMessage(
                      error,
                      "We could not load the employee list.",
                    )}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => void refetch()}
                  >
                    Retry
                  </Button>
                </TableCell>
              </TableRow>
            ) : employees.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columnCount}
                  className="text-muted-foreground h-32 text-center text-sm"
                >
                  No employees found. Try different filters or add an employee.
                </TableCell>
              </TableRow>
            ) : (
              employees.map((employee: Employee) => {
                const linkedUser = employee.user;
                const hasLogin = Boolean(linkedUser?.id);
                const isPendingInvite =
                  hasLogin && linkedUser?.status === "INVITED";
                const isLinkedActive =
                  hasLogin && linkedUser?.status !== "INVITED";
                return (
                  <TableRow
                    key={employee.id}
                    className="hover:bg-muted/40 cursor-pointer"
                    tabIndex={0}
                    onClick={() =>
                      router.push(employeeDetailHref(employee.id, listHref))
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        router.push(employeeDetailHref(employee.id, listHref));
                      }
                    }}
                  >
                    <TableCell className="font-mono text-xs">
                      {employee.employeeCode}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {employee.firstName} {employee.lastName}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {employee.email ?? "No email"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {employee.department?.departmentName ?? "—"}
                    </TableCell>
                    <TableCell>
                      {employee.designation?.designationName ?? "—"}
                    </TableCell>
                    <TableCell>
                      <EmployeeStatusBadge status={employee.employmentStatus} />
                    </TableCell>
                    {canInviteUsers ? (
                      <TableCell className="text-right">
                        {isLinkedActive ? (
                          <span className="text-muted-foreground text-xs">
                            Linked
                          </span>
                        ) : isPendingInvite ? (
                          <span
                            className="text-xs font-medium text-sky-700"
                            title="Invitation sent — waiting for the person to set a password"
                          >
                            Invited
                          </span>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={(event) => {
                              event.stopPropagation();
                              openInvite(employee);
                            }}
                          >
                            <UserPlus className="size-3.5" />
                            Invite user
                          </Button>
                        )}
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-muted-foreground">
          {total === 0
            ? "0 results"
            : `Showing ${(page - 1) * limit + 1}–${Math.min(page * limit, total)} of ${total}`}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || isLoading}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </Button>
          <span className="text-muted-foreground">
            Page {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || isLoading}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Keep href builder available for callers that import from table historically. */
export { employeeDirectoryHref };
