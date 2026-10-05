"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { StatusBadge } from "@/components/common/status-badge";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/auth-provider";
import {
  normalizeLicenseAllocation,
  type LicenseAllocationApiRow,
} from "@/features/asset/lib/license-allocation-display";
import { AssetService } from "@/features/asset/services/asset-service";

import { EmployeeAssetTable } from "./employee-asset-table";
import { AssignEmployeeAssetDialog } from "../dialogs/assign-employee-asset-dialog";

export function EmployeeAssetWorkspace() {
  const { hasPermission } = useAuth();
  const [open, setOpen] = useState(false);
  const canAssign =
    hasPermission("assets.assignments.manage") ||
    hasPermission("assets.department.assignments.manage");

  const licenses = useQuery({
    queryKey: ["assets", "license-allocations", "assigned-page"],
    queryFn: () =>
      AssetService.getLicenseAllocationPage({
        limit: 100,
      }),
  });

  const activeLicenses = useMemo(
    () =>
      ((licenses.data?.items ?? []) as LicenseAllocationApiRow[])
        .map(normalizeLicenseAllocation)
        .filter((row) => row.status.toUpperCase() !== "REVOKED"),
    [licenses.data?.items],
  );

  return (
    <WorkspaceShell>
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Hardware</h2>
            <p className="text-muted-foreground text-xs">
              Laptops and phones with people.
            </p>
          </div>
          {canAssign ? (
            <Button onClick={() => setOpen(true)}>Assign item</Button>
          ) : null}
        </div>
        <EmployeeAssetTable />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Software seats</h2>
            <p className="text-muted-foreground text-xs">
              Who has Adobe and other licence seats.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/asset-management/licenses">Manage licences</Link>
          </Button>
        </div>

        {licenses.isLoading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : activeLicenses.length === 0 ? (
          <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-sm">
            No software seats yet.{" "}
            <Link className="underline" href="/asset-management/licenses">
              Give a seat
            </Link>
            .
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs">
                <tr>
                  <th className="px-4 py-3 font-medium">Licence</th>
                  <th className="px-4 py-3 font-medium">Who</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Given on</th>
                </tr>
              </thead>
              <tbody>
                {activeLicenses.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <p className="font-medium">{row.licenceName}</p>
                      <p className="text-muted-foreground font-mono text-xs">
                        {row.licenceCode}
                      </p>
                    </td>
                    <td className="px-4 py-3">{row.employeeLabel}</td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        label={row.status}
                        tone={
                          row.status.toUpperCase() === "ACTIVE"
                            ? "success"
                            : "neutral"
                        }
                      />
                    </td>
                    <td className="px-4 py-3">{row.givenOn ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AssignEmployeeAssetDialog open={open} onOpenChange={setOpen} />
    </WorkspaceShell>
  );
}
