"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Boxes } from "lucide-react";
import { toast } from "sonner";

import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/services/api-client";
import { hasAllowedAction } from "@/features/asset/lib/allowed-actions";
import { createOperationId } from "@/features/asset/lib/operation-id";
import { useAuth } from "@/providers/auth-provider";

import { AssignEmployeeAssetDialog } from "../dialogs/assign-employee-asset-dialog";
import { useEmployeeAssetsByEmployee } from "../hooks/use-employee-assets-by-employee";
import { useReturnEmployeeAsset } from "../hooks/use-return-employee-asset";
import { useAssetClearancePreflight } from "../hooks/use-asset-clearance-preflight";
import type {
  AssetReturnOutcome,
  EmployeeAsset,
} from "../types";

interface EmployeeAssetProfileProps {
  employeeId: string;
}

type ReturnAction = {
  assignment: EmployeeAsset;
  outcome: AssetReturnOutcome;
};

export function EmployeeAssetProfile({
  employeeId,
}: EmployeeAssetProfileProps) {
  const { hasPermission } = useAuth();
  const [assignOpen, setAssignOpen] = useState(false);
  const [returnAction, setReturnAction] = useState<ReturnAction | null>(null);
  const [reason, setReason] = useState("");
  const [clearanceStarted, setClearanceStarted] = useState(false);

  const { data: assignments = [], isLoading } =
    useEmployeeAssetsByEmployee(employeeId);
  const clearanceQuery = useAssetClearancePreflight(employeeId);
  const returnAsset = useReturnEmployeeAsset();
  const canAssign =
    hasPermission("assets.assignments.manage") ||
    hasPermission("assets.department.assignments.manage");

  const handleReturn = async () => {
    if (!returnAction) {
      return;
    }

    const needsReason =
      returnAction.outcome === "LOST" || returnAction.outcome === "DAMAGED";
    if (needsReason && !reason.trim()) {
      toast.error("A reason is required.");
      return;
    }

    try {
      await returnAsset.mutateAsync({
        id: returnAction.assignment.id,
        employeeId,
        dto: {
          operationId: createOperationId(),
          outcome: returnAction.outcome,
          returnedDate: new Date().toISOString().slice(0, 10),
          expectedAssignmentVersion: returnAction.assignment.version,
          expectedAssetVersion: returnAction.assignment.asset?.version,
          reason: needsReason ? reason.trim() : undefined,
        },
      });

      setReturnAction(null);
      setReason("");
      toast.success("Asset assignment updated.");
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, "Could not update asset assignment."),
      );
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Loading assets...
        </CardContent>
      </Card>
    );
  }

  const clearance = clearanceQuery.data;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Assigned items</CardTitle>
          {canAssign ? (
            <Button onClick={() => setAssignOpen(true)}>Assign item</Button>
          ) : null}
        </CardHeader>

        <CardContent className="space-y-4">
          {clearance ? (
            <div className="space-y-3 rounded-md border p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">Asset clearance</p>
                  {clearance.blocked ? (
                    <p className="mt-1 text-muted-foreground">
                      {clearance.openAssignments.length} hardware/card item
                      {clearance.openAssignments.length === 1 ? "" : "s"} and{" "}
                      {clearance.openAllocations.length} license seat
                      {clearance.openAllocations.length === 1 ? "" : "s"} still
                      open. Return or waive each item before separation can
                      complete.
                    </p>
                  ) : (
                    <p className="mt-1 text-muted-foreground">
                      No outstanding custody. Clearance can proceed.
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={clearanceStarted ? "secondary" : "default"}
                    onClick={() => setClearanceStarted(true)}
                  >
                    {clearanceStarted ? "Clearance in progress" : "Start clearance"}
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/asset-management/waivers">Open waivers</Link>
                  </Button>
                </div>
              </div>
              {clearanceStarted || clearance.blocked ? (
                <div className="space-y-1">
                  {clearance.openAssignments.map((item) => (
                    <p key={item.id} className="font-mono text-xs">
                      Open · {item.asset?.assetCode} · {item.asset?.assetName} —
                      use Return on the assignment below.
                    </p>
                  ))}
                  {clearance.openAllocations.map((item) => (
                    <p key={item.id} className="font-mono text-xs">
                      License · {item.asset?.assetCode} · {item.asset?.assetName} —
                      revoke the seat or request a waiver.
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {assignments.length === 0 ? (
            <EmptyState
              icon={Boxes}
              title="Nothing assigned"
              description="Assign a physical item here. Allocate software seats from Licences."
            />
          ) : (
            assignments.map((assignment) => (
              <div key={assignment.id} className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">
                        {assignment.asset?.assetName ?? "Asset"}
                      </h3>
                      <Badge variant="outline">
                        {assignment.custodyStatus || assignment.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {assignment.asset?.assetCode}
                    </p>
                    <div className="text-sm text-muted-foreground">
                      Assigned{" "}
                      {format(new Date(assignment.assignedDate), "dd MMM yyyy")}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {hasAllowedAction(assignment.allowedActions, "RETURN") ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setReturnAction({
                            assignment,
                            outcome: "RETURNED",
                          })
                        }
                      >
                        Return
                      </Button>
                    ) : null}
                    {hasAllowedAction(assignment.allowedActions, "CLOSE_LOST") ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setReturnAction({ assignment, outcome: "LOST" })
                        }
                      >
                        Lost
                      </Button>
                    ) : null}
                    {hasAllowedAction(
                      assignment.allowedActions,
                      "CLOSE_DAMAGED",
                    ) ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setReturnAction({ assignment, outcome: "DAMAGED" })
                        }
                      >
                        Damaged
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <AssignEmployeeAssetDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        employeeId={employeeId}
      />

      <ConfirmActionDialog
        open={!!returnAction}
        onOpenChange={(open) => {
          if (!open) {
            setReturnAction(null);
            setReason("");
          }
        }}
        title={`Mark asset as ${returnAction?.outcome.toLowerCase()}`}
        message="This updates the asset assignment and availability."
        name={returnAction?.assignment.asset?.assetName ?? "Asset"}
        code={returnAction?.assignment.asset?.assetCode}
        loading={returnAsset.isPending}
        confirmLabel="Confirm"
        loadingLabel="Updating..."
        onConfirm={() => {
          void handleReturn();
        }}
      >
        {returnAction?.outcome === "LOST" ||
        returnAction?.outcome === "DAMAGED" ? (
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Reason is required"
            rows={3}
          />
        ) : null}
      </ConfirmActionDialog>
    </>
  );
}
