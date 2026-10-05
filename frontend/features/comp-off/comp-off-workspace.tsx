"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { FormSheet } from "@/components/common/form-sheet";
import { PageToolbar } from "@/components/common/page-toolbar";
import { StatusBadge } from "@/components/common/status-badge";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import { DataTable } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/providers/auth-provider";
import { getApiErrorMessage } from "@/services/api-client";
import { useCompOffCredits, useRevokeCompOffCredit } from "./hooks";
import type { CompOffCredit } from "./types";

const employee = (item: CompOffCredit) => [item.employee?.firstName, item.employee?.lastName].filter(Boolean).join(" ") || item.employee?.employeeCode || item.employeeId;

export function CompOffWorkspace() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("hr.comp-off.manage");
  const query = useCompOffCredits();
  const revoke = useRevokeCompOffCredit();
  const [selected, setSelected] = useState<CompOffCredit | null>(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (!selected) return;
    if (!reason.trim()) return setError("Revoke reason is required.");
    setError(null);
    try { await revoke.mutateAsync({ id: selected.id, reason: reason.trim() }); setReason(""); setOpen(false); }
    catch (cause) { setError(getApiErrorMessage(cause, "Unable to revoke comp-off credit.")); }
  }
  const columns: ColumnDef<CompOffCredit>[] = [
    { id: "employee", header: "Employee", cell: ({ row }) => employee(row.original) },
    { accessorKey: "sourceDate", header: "Source date", cell: ({ row }) => new Date(row.original.sourceDate).toLocaleDateString() },
    { accessorKey: "earnedDays", header: "Earned" },
    { accessorKey: "availableDays", header: "Available" },
    { accessorKey: "expiresOn", header: "Expires", cell: ({ row }) => new Date(row.original.expiresOn).toLocaleDateString() },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge label={row.original.status} tone="neutral" /> },
    { id: "actions", header: "Actions", cell: ({ row }) => canManage && row.original.status === "AVAILABLE" && Number(row.original.reservedDays) === 0 && Number(row.original.usedDays) === 0 ? <Button size="sm" variant="ghost" onClick={() => { setSelected(row.original); setError(null); setOpen(true); }}>Revoke</Button> : null },
  ];
  return <WorkspaceShell>
    <PageToolbar>
      <span className="text-sm text-muted-foreground">
        From overtime approve (Comp-off settlement). Revoke needs a reason and
        only works when Available with 0 reserved / 0 used.
      </span>
      <Button
        variant="outline"
        disabled={query.isFetching}
        onClick={() => void query.refetch()}
      >
        {query.isFetching ? "Refreshing…" : "Refresh"}
      </Button>
    </PageToolbar>
    <DataTable columns={columns} data={query.data ?? []} isLoading={query.isLoading} error={query.error ? getApiErrorMessage(query.error, "Could not load comp-off credits.") : null} onRetry={() => void query.refetch()} emptyTitle="No comp-off credits" emptyDescription="Credits created from approved overtime will appear here." enablePagination pageSize={10} />
    <FormSheet open={open} onOpenChange={setOpen} title="Revoke comp-off credit" description={selected ? `${employee(selected)} · ${selected.availableDays} day(s) available` : undefined} size="md" footer={<div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Close</Button><Button type="submit" form="revoke-comp-off" variant="destructive" disabled={revoke.isPending}>{revoke.isPending ? "Revoking…" : "Revoke"}</Button></div>}>
      <form id="revoke-comp-off" onSubmit={submit} className="space-y-2"><Label htmlFor="revoke-reason">Reason</Label><Input id="revoke-reason" value={reason} onChange={(event) => setReason(event.target.value)} />{error ? <p className="text-destructive text-sm">{error}</p> : null}</form>
    </FormSheet>
  </WorkspaceShell>;
}
