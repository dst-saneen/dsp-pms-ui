"use client";

import { useState } from "react";

import { StatusBadge } from "@/components/common/status-badge";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/services/api-client";

import {
  createOperationId,
  hasAllowedAction,
} from "../lib/allowed-actions";
import { statusToneFor } from "../lib/status-tone";
import {
  useTeamTimesheets,
  useTimesheetTeamCommand,
} from "../hooks/use-projects";
import type { Timesheet } from "../types/project.types";
import { ProjectsPathBanner } from "./projects-path-banner";

export function TeamTimesheetsWorkspace({
  statusFilter = "SUBMITTED",
}: {
  statusFilter?: string;
}) {
  const query = useTeamTimesheets({ status: statusFilter });
  const command = useTimesheetTeamCommand();
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewSheet, setReviewSheet] = useState<Timesheet | null>(null);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState<{
    sheet: Timesheet;
    action: "approve" | "return";
  } | null>(null);

  const items = query.data?.items ?? [];

  return (
    <WorkspaceShell>
      <ProjectsPathBanner
        current="team-timesheets"
        note="Approve or Return submitted weeks. Return should include a clear reason. Full timesheet UAT continues in W15."
      />
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Hours</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isLoading ? (
              <TableRow>
                <TableCell colSpan={5}>Loading team timesheets…</TableCell>
              </TableRow>
            ) : query.error ? (
              <TableRow>
                <TableCell colSpan={5} className="text-destructive">
                  {getApiErrorMessage(query.error)}
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  No pending timesheet approvals.
                </TableCell>
              </TableRow>
            ) : (
              items.map((sheet) => (
                <TableRow key={sheet.id}>
                  <TableCell>
                    <div className="font-medium">
                      {sheet.displayName?.trim() || sheet.employeeId}
                    </div>
                    {sheet.employeeCode ? (
                      <div className="text-xs text-muted-foreground">
                        {sheet.employeeCode}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {sheet.periodStart} → {sheet.periodEnd}
                  </TableCell>
                  <TableCell>{sheet.totalHours}</TableCell>
                  <TableCell>
                    <StatusBadge
                      label={sheet.status}
                      tone={statusToneFor(sheet.status)}
                    />
                  </TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setReviewSheet(sheet);
                        setReviewOpen(true);
                      }}
                    >
                      Review
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review timesheet</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm">
              {reviewSheet?.displayName?.trim() || reviewSheet?.employeeId} · {reviewSheet?.periodStart}
              {" → "}
              {reviewSheet?.periodEnd}
            </p>
            <div className="max-h-[55vh] space-y-2 overflow-y-auto">
              {reviewSheet?.lines.length ? (
                reviewSheet.lines.map((line) => (
                  <div key={line.id} className="rounded-lg border p-3 text-sm">
                    <p className="font-medium">
                      {line.workDate} · {line.hours} hours
                    </p>
                    <p className="text-muted-foreground">
                      {line.taskId
                        ? `Task ${line.taskId}`
                        : line.workCategoryId
                          ? `Work category ${line.workCategoryId}`
                          : "No charge target"}
                    </p>
                    {line.remarks ? <p className="mt-1">{line.remarks}</p> : null}
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-sm">No lines submitted.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOpen(false)}>
              Close
            </Button>
            {reviewSheet && hasAllowedAction(reviewSheet.allowedActions, "RETURN") ? (
              <Button
                variant="outline"
                disabled={command.isPending}
                onClick={() => {
                  setPending({ sheet: reviewSheet, action: "return" });
                  setReason("");
                  setReviewOpen(false);
                  setReasonOpen(true);
                }}
              >
                Return
              </Button>
            ) : null}
            {reviewSheet && hasAllowedAction(reviewSheet.allowedActions, "APPROVE") ? (
              <Button
                disabled={command.isPending}
                onClick={() => {
                  setPending({ sheet: reviewSheet, action: "approve" });
                  setReason("");
                  setReviewOpen(false);
                  setReasonOpen(true);
                }}
              >
                Approve
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reasonOpen} onOpenChange={setReasonOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pending?.action === "approve"
                ? "Approve timesheet"
                : "Return timesheet"}
            </DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Remarks (optional for approve, recommended for return)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReasonOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!pending || command.isPending}
              onClick={() => {
                if (!pending) return;
                command.mutate({
                  id: pending.sheet.id,
                  action: pending.action,
                  expectedVersion:
                    pending.sheet.actionRequirements.expectedVersion,
                  operationId: createOperationId(),
                  reason: reason.trim() || undefined,
                });
                setReasonOpen(false);
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkspaceShell>
  );
}
