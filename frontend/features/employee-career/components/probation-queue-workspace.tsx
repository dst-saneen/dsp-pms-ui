"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserCheck } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getApiErrorMessage } from "@/services/api-client";
import { useAuth } from "@/providers/auth-provider";
import { RECRUITMENT_ROUTES } from "@/features/recruitment/constants/routes";

import { EMPLOYEE_CAREER_PERMISSIONS } from "../constants/permissions";
import {
  useConfirmActive,
  useProbationDueQueue,
  useProbationPreflight,
} from "../hooks/use-employee-career";
import { ConfirmActiveDialog } from "./confirm-active-dialog";

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

export function ProbationQueueWorkspace() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(EMPLOYEE_CAREER_PERMISSIONS.manage);
  const canOverride = hasPermission(EMPLOYEE_CAREER_PERMISSIONS.override);

  const queueQuery = useProbationDueQueue();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const preflightQuery = useProbationPreflight(selectedEmployeeId ?? undefined);
  const confirmActive = useConfirmActive(selectedEmployeeId ?? "");

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCheck className="size-4" aria-hidden />
            Probation due
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            Employees in probation awaiting HR confirmation to active status.
          </p>
        </CardHeader>
        <CardContent>
          {queueQuery.isLoading ? (
            <p className="text-muted-foreground text-sm">Loading probation queue…</p>
          ) : null}

          {queueQuery.error ? (
            <ErrorState
              title="Probation queue unavailable"
              description={getApiErrorMessage(
                queueQuery.error,
                "We could not load the probation queue."
              )}
              onRetry={() => void queueQuery.refetch()}
            />
          ) : null}

          {!queueQuery.isLoading && !queueQuery.error && (queueQuery.data?.length ?? 0) === 0 ? (
            <EmptyState
              icon={UserCheck}
              title="No employees due for probation confirmation"
              description="Employees will appear here when probation ends and confirmation is required."
            />
          ) : null}

          {!queueQuery.isLoading && !queueQuery.error && (queueQuery.data?.length ?? 0) > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Probation end</TableHead>
                  <TableHead>Days remaining</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queueQuery.data?.map((item) => (
                  <TableRow
                    key={item.employeeId}
                    className="cursor-pointer"
                    onClick={() =>
                      router.push(RECRUITMENT_ROUTES.employeeDetail(item.employeeId, "career"))
                    }
                  >
                    <TableCell>
                      <div className="font-medium">{item.employeeName}</div>
                      <div className="text-muted-foreground text-xs">{item.employeeCode}</div>
                    </TableCell>
                    <TableCell>
                      <div>{item.designationName ?? "—"}</div>
                      <div className="text-muted-foreground text-xs">
                        {[item.departmentName, item.branchName].filter(Boolean).join(" · ")}
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(item.plannedEndDate)}</TableCell>
                    <TableCell>
                      {item.daysRemaining <= 0 ? (
                        <span className="text-amber-700">Due now</span>
                      ) : (
                        item.daysRemaining
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {canManage &&
                      (item.canConfirmActive || (canOverride && item.allowEarlyOverride)) ? (
                        <Button
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedEmployeeId(item.employeeId);
                          }}
                        >
                          {item.canConfirmActive ? "Confirm active" : "Confirm early"}
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          {item.confirmBlockedReason ?? "Not ready"}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}

          {!canManage ? (
            <p className="text-muted-foreground mt-4 text-sm">
              You can view the probation queue but cannot confirm employees without manage
              permission.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {selectedEmployeeId && preflightQuery.data ? (
        <ConfirmActiveDialog
          open={Boolean(selectedEmployeeId)}
          onOpenChange={(open) => {
            if (!open) setSelectedEmployeeId(null);
          }}
          preflight={preflightQuery.data}
          loading={confirmActive.isPending}
          onConfirm={async (values) => {
            await confirmActive.mutateAsync({
              version: preflightQuery.data!.version,
              confirmationDate: values.confirmationDate,
              note: values.note,
              reference: values.reference,
              earlyOverrideReason: values.earlyOverrideReason,
            });
            setSelectedEmployeeId(null);
          }}
        />
      ) : null}
    </>
  );
}
