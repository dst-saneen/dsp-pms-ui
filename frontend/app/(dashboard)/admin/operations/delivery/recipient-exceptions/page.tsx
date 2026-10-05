"use client";

import { useState } from "react";
import { format } from "date-fns";
import { UserX } from "lucide-react";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { ModuleCapabilityGate } from "@/components/common/module-capability-gate";
import { OpsPathBanner } from "@/features/delivery/components/ops-path-banner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  useRecipientExceptions,
  useResolveRecipientException,
} from "@/features/delivery/hooks/use-delivery";
import type { RecipientException } from "@/features/delivery/types/delivery";

export default function RecipientExceptionsPage() {
  const { data, isLoading } = useRecipientExceptions({ limit: 100 });
  const resolve = useResolveRecipientException();
  const [target, setTarget] = useState<RecipientException | null>(null);
  const [reason, setReason] = useState("");

  const handleResolve = () => {
    if (!target || !reason.trim()) return;
    resolve.mutate(
      {
        id: target.id,
        reason: reason.trim(),
        expectedVersion: target.version,
      },
      {
        onSuccess: () => {
          setTarget(null);
          setReason("");
        },
      },
    );
  };

  return (
    <ModuleCapabilityGate capability="deliveryOperationsNav"><PageContainer>
      <PageHeader
        title="Recipient Exceptions"
        description="Delivery events that could not resolve a recipient. Resolve after the employee, candidate, or routing data is corrected."
      />
      <OpsPathBanner
        current="exceptions"
        note="Resolve after fixing employee/candidate/routing data. Resolution requires a unique reason."
      />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (data?.items.length ?? 0) === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
          <UserX className="size-10 opacity-30" />
          <p>No open recipient exceptions.</p>
          <p className="max-w-md text-xs">
            Exceptions appear when a send cannot resolve a recipient. Fix
            employee/candidate data first, then resolve with a reason.
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Detail</TableHead>
              <TableHead>Opened</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.items ?? []).map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-mono text-xs">{row.eventType}</TableCell>
                <TableCell className="font-mono text-xs">{row.reasonCode}</TableCell>
                <TableCell className="max-w-[280px] truncate text-sm">
                  {row.redactedDetail ?? "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(new Date(row.createdAt), "dd MMM yyyy")}
                </TableCell>
                <TableCell className="text-right">
                  {row.status === "OPEN" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTarget(row)}
                    >
                      Resolve
                    </Button>
                  ) : (
                    <span className="text-muted-foreground text-xs">Resolved</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog
        open={Boolean(target)}
        onOpenChange={(open) => {
          if (!open) {
            setTarget(null);
            setReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve recipient exception</DialogTitle>
            <DialogDescription>
              Confirm the recipient data is corrected, then record why this
              exception can be closed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="exception-reason">Reason</Label>
            <Input
              id="exception-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Employee email restored and re-routed"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setTarget(null);
                setReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleResolve}
              disabled={!reason.trim() || resolve.isPending}
            >
              {resolve.isPending ? "Resolving…" : "Resolve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer></ModuleCapabilityGate>
  );
}
