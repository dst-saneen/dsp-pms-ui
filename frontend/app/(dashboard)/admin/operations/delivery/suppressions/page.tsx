"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ShieldOff } from "lucide-react";

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
  useSuppressions,
  useReleaseSuppression,
} from "@/features/delivery/hooks/use-delivery";
import type { EmailSuppression } from "@/features/delivery/types/delivery";

export default function SuppressionsPage() {
  const { data, isLoading } = useSuppressions({ limit: 100 });
  const release = useReleaseSuppression();
  const [target, setTarget] = useState<EmailSuppression | null>(null);
  const [reason, setReason] = useState("");

  const handleRelease = () => {
    if (!target || !reason.trim()) return;
    release.mutate(
      {
        id: target.id,
        reason: reason.trim(),
        expectedVersion:
          target.actionRequirements?.expectedVersion ?? target.version ?? 1,
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
        title="Email Suppressions"
        description="Addresses that have hard-bounced or complained. Release only after verifying the address is valid and the recipient has consented."
      />
      <OpsPathBanner
        current="suppressions"
        note="Release only after the address is verified and the recipient has consented. Release requires a unique reason."
      />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : data?.items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
          <ShieldOff className="size-10 opacity-30" />
          <p>No active suppressions.</p>
          <p className="max-w-md text-xs">
            Suppressions appear after hard bounces or complaints. Check the{" "}
            <Link href="/admin/operations/delivery" className="underline">
              delivery queue
            </Link>{" "}
            for bounce statuses first.
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reason</TableHead>
              <TableHead>Suppressed</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.items ?? []).map((sup) => (
              <TableRow key={sup.id}>
                <TableCell className="font-mono text-xs">{sup.reason}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(new Date(sup.suppressedAt), "dd MMM yyyy")}
                </TableCell>
                <TableCell className="text-sm">
                  {sup.companyGroupId ? "Company group" : "Global"}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTarget(sup)}
                  >
                    Release
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Release confirmation dialog */}
      <Dialog
        open={Boolean(target)}
        onOpenChange={(open) => { if (!open) { setTarget(null); setReason(""); } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Release suppression</DialogTitle>
            <DialogDescription>
              Releasing this suppression will allow future emails to this
              address. Provide a reason for audit purposes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="release-reason">Reason</Label>
            <Input
              id="release-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Confirmed valid address by recipient request"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setTarget(null); setReason(""); }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRelease}
              disabled={!reason.trim() || release.isPending}
            >
              {release.isPending ? "Releasing…" : "Release"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer></ModuleCapabilityGate>
  );
}
