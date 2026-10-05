"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/services/api-client";
import { useModuleCapabilities } from "@/hooks/use-module-capabilities";
import { useAuth } from "@/providers/auth-provider";
import { toast } from "sonner";

import { useClearanceCommand, useEmployeeSeparation } from "../hooks";
import {
  actorLabel,
  createOperationId,
  displayDate,
} from "../lib/allowed-actions";
import {
  businessReasonHint,
  isValidBusinessReason,
} from "../lib/business-reason";
import { getAssetResolutionLinks } from "../lib/asset-resolution-links";
import type {
  ClearanceAction,
  EmployeeClearanceItem,
  EmployeeSeparation,
  SeparationAction,
} from "../types";
import { SeparationActionDialog } from "./separation-workspace";
import { HrOpsPathBanner } from "./hr-ops-path-banner";

const separationActionLabel: Record<SeparationAction, string> = {
  APPROVE: "Approve",
  REJECT: "Reject",
  CANCEL: "Cancel",
  COMPLETE: "Complete",
};

export function SeparationDetailWorkspace({ separationId }: { separationId: string }) {
  const { hasPermission } = useAuth();
  const { data: capabilities } = useModuleCapabilities();
  const query = useEmployeeSeparation(separationId);
  const [selectedAction, setSelectedAction] = useState<{
    separation: EmployeeSeparation;
    action: SeparationAction;
  } | null>(null);
  const [selectedClearance, setSelectedClearance] = useState<{
    item: EmployeeClearanceItem;
    action: ClearanceAction;
  } | null>(null);
  const separation = query.data;

  if (query.isLoading) {
    return <WorkspaceShell><Message text="Loading employee separation…" /></WorkspaceShell>;
  }
  if (query.error || !separation) {
    return <WorkspaceShell><Message text={getApiErrorMessage(query.error, "Could not load employee separation.")} /></WorkspaceShell>;
  }

  const summary = separation.clearanceSummary;
  const items = separation.clearanceItems ?? [];
  const assetResolutionLinks = getAssetResolutionLinks(
    Boolean(capabilities?.assetsNav),
    hasPermission
  );

  return (
    <WorkspaceShell>
      <HrOpsPathBanner
        current="separations"
        note="Clearance Clear/Reopen need a real reason. Complete shows consequences and stays blocked while assets or mandatory items are open."
      />
      <section className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Detail label="Employee" value={actorLabel(separation.employee)} />
        <Detail label="Last working day" value={displayDate(separation.lastWorkingDate)} />
        <Detail label="Reason" value={separation.reason ?? "—"} />
        <div><p className="text-xs text-muted-foreground">Status</p><StatusBadge label={separation.status} tone="neutral" /></div>
      </section>

      {summary?.assetClearanceBlocked ? (
        <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/20 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p>
              Asset custody is still outstanding. Resolve returns, transfers, or
              clearance waivers before final separation completion.
            </p>
            {assetResolutionLinks.length > 0 ? (
              <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                {assetResolutionLinks.map((link) => (
                  <Link className="underline" href={link.href} key={link.href}>
                    {link.label}
                  </Link>
                ))}
              </p>
            ) : (
              <p className="mt-2 text-xs">
                Ask an Asset Manager or Asset Custodian to resolve the outstanding
                custody items.
              </p>
            )}
          </div>
        </div>
      ) : null}

      <section className="rounded-lg border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Approval and completion</h2>
            <p className="text-sm text-muted-foreground">
              {separation.approvalProgress?.currentStepName ??
                "No active approval step"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(separation.allowedActions ?? []).map((action) => (
              <Button
                key={action}
                variant={
                  action === "REJECT" || action === "CANCEL"
                    ? "outline"
                    : "default"
                }
                onClick={() => setSelectedAction({ separation, action })}
              >
                {separationActionLabel[action]}
              </Button>
            ))}
          </div>
        </div>
        {summary ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {summary.mandatoryCleared} of {summary.mandatoryTotal} mandatory
            clearance items cleared.
          </p>
        ) : null}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-semibold">Department clearance</h2>
          <p className="text-sm text-muted-foreground">
            Only server-authorized Department actions appear below. Clear and
            Reopen both need a business reason. Asset custody is read-only here —
            use the Asset links above.
          </p>
        </div>
        {items.length === 0 ? (
          <Message text="No manual clearance items are currently available." />
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-4 py-3 font-medium">Department</th>
                  <th className="px-4 py-3 font-medium">Required</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Cleared by</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr className="border-t" key={item.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.itemType}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {item.executorDepartmentName ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {item.mandatory ? "Mandatory" : "Optional"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge label={item.status} tone="neutral" />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {item.clearedBy
                        ? `${actorLabel(item.clearedBy)} · ${displayDate(item.clearedAt)}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {(item.allowedActions ?? []).map((action) => (
                          <Button
                            key={action}
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setSelectedClearance({ item, action })
                            }
                          >
                            {action === "CLEAR" ? "Clear" : "Reopen"}
                          </Button>
                        ))}
                        {(item.allowedActions ?? []).length === 0 &&
                        item.itemType === "ASSET" ? (
                          <span className="text-muted-foreground text-xs">
                            Resolve in Assets
                          </span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <SeparationActionDialog
        selected={selectedAction}
        onOpenChange={(open) => !open && setSelectedAction(null)}
      />
      <ClearanceActionDialog
        selected={selectedClearance}
        onOpenChange={(open) => !open && setSelectedClearance(null)}
      />
    </WorkspaceShell>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

function Message({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed px-5 py-10 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

export function ClearanceActionDialog({
  selected,
  onOpenChange,
}: {
  selected: { item: EmployeeClearanceItem; action: ClearanceAction } | null;
  onOpenChange: (open: boolean) => void;
}) {
  const mutation = useClearanceCommand();
  const [note, setNote] = useState("");
  const requiresReason =
    selected?.action === "CLEAR" ||
    selected?.action === "REOPEN" ||
    Boolean(selected?.item.actionRequirements?.requiresReason);
  const reasonOk = !requiresReason || isValidBusinessReason(note);

  async function submit() {
    if (!selected || !reasonOk) return;
    try {
      const noteValue = note.trim();
      await mutation.mutateAsync({
        itemId: selected.item.id,
        action: selected.action.toLowerCase() as "clear" | "reopen",
        input: {
          expectedVersion:
            selected.item.actionRequirements?.expectedVersion ??
            selected.item.version,
          operationId: createOperationId(),
          ...(selected.action === "REOPEN"
            ? { reason: noteValue }
            : { remarks: noteValue }),
        },
      });
      toast.success(
        selected.action === "CLEAR"
          ? "Clearance item cleared."
          : "Clearance item reopened.",
      );
      setNote("");
      onOpenChange(false);
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, "Could not update the clearance item."),
      );
    }
  }

  return (
    <Dialog open={Boolean(selected)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {selected?.action === "CLEAR" ? "Clear item" : "Reopen item"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">{selected?.item.title}</p>
          <div className="space-y-2">
            <Label htmlFor="clearance-action-reason">Reason (required)</Label>
            <Textarea
              id="clearance-action-reason"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              {businessReasonHint(true)}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!selected || mutation.isPending || !reasonOk}
            onClick={() => void submit()}
          >
            {mutation.isPending
              ? "Saving…"
              : selected?.action === "CLEAR"
                ? "Clear item"
                : "Reopen item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
