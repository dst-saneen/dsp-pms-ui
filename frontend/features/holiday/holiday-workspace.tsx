"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { CalendarDays } from "lucide-react";

import { ErrorState } from "@/components/common/error-state";
import { FormSheet } from "@/components/common/form-sheet";
import { PageToolbar } from "@/components/common/page-toolbar";
import { StatusBadge } from "@/components/common/status-badge";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import { DataTable } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { friendlyConfigStatus } from "@/features/business-calendar/labels";
import { useBranches } from "@/features/branch/hooks/use-branches";
import { useCompanies } from "@/features/lookups/hooks/use-companies";
import { useAuth } from "@/providers/auth-provider";
import { getApiErrorMessage } from "@/services/api-client";

import { businessCalendarHref, holidaySourceLabel } from "./holiday-calendar-link";
import {
  useCreateHoliday,
  useDeleteHoliday,
  useHolidayDirectory,
  useHolidaySources,
  useUpdateHoliday,
} from "./hooks";
import type { HolidayDirectoryItem, HolidayPayload } from "./types";

const empty = (): HolidayPayload => ({
  companyId: "",
  holidayName: "",
  holidayDate: "",
  holidayType: "PUBLIC",
});

function modeTone(mode?: string) {
  if (mode === "ACTIVE") return "success" as const;
  if (mode === "SHADOW" || mode === "LEGACY") return "progress" as const;
  return "neutral" as const;
}

function modeLabel(mode?: string) {
  if (!mode) return "Previous source";
  return friendlyConfigStatus(`${mode}_MODE`);
}

function formatHolidayDate(item: HolidayDirectoryItem) {
  const start = item.holidayDate.slice(0, 10);
  const end = (item.endDate ?? item.holidayDate).slice(0, 10);
  const startLabel = new Date(`${start}T00:00:00Z`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  if (start === end) return startLabel;
  const endLabel = new Date(`${end}T00:00:00Z`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${startLabel} – ${endLabel}`;
}

function scopeLabel(item: HolidayDirectoryItem) {
  if (item.branch?.branchName) return item.branch.branchName;
  if (item.company?.companyName) return item.company.companyName;
  return item.calendarScope === "BRANCH" ? "Branch" : "Company";
}

export function HolidayWorkspace() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const canManage = hasPermission("hr.holidays.manage");
  const canOpenBusiness = hasPermission("calendar.business.read");
  const year = new Date().getUTCFullYear();
  const [yearFilter, setYearFilter] = useState(year);
  const query = useHolidayDirectory({ year: yearFilter });
  const sourcesQuery = useHolidaySources();
  const companies = useCompanies();
  const [selected, setSelected] = useState<HolidayDirectoryItem | null>(null);
  const [form, setForm] = useState<HolidayPayload>(empty);
  const branches = useBranches(form.companyId || undefined);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const create = useCreateHoliday();
  const update = useUpdateHoliday();
  const remove = useDeleteHoliday();
  const canEditLegacy = sourcesQuery.data?.canEditLegacyHolidays ?? false;
  const offices = sourcesQuery.data?.offices ?? [];
  const items = query.data ?? [];
  const fromBusiness = items.filter((item) => item.source === "BUSINESS_CALENDAR").length;

  function openNew() {
    setSelected(null);
    setForm(empty());
    setError(null);
    setOpen(true);
  }

  function openEdit(holiday: HolidayDirectoryItem) {
    if (holiday.source !== "LEGACY_HOLIDAYS") return;
    setSelected(holiday);
    setForm({
      companyId: holiday.companyId,
      branchId: holiday.branchId ?? undefined,
      holidayName: holiday.holidayName,
      holidayDate: holiday.holidayDate.slice(0, 10),
      holidayType: holiday.holidayType,
      holidayCode: holiday.holidayCode ?? undefined,
      description: holiday.description ?? undefined,
    });
    setError(null);
    setOpen(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (
      !form.companyId ||
      !form.holidayName.trim() ||
      !form.holidayDate ||
      !form.holidayType.trim()
    ) {
      setError("Company, name, date, and type are required.");
      return;
    }
    const data = {
      ...form,
      branchId: form.branchId || undefined,
      holidayName: form.holidayName.trim(),
    };
    try {
      if (selected) await update.mutateAsync({ id: selected.id, data });
      else await create.mutateAsync(data);
      setOpen(false);
    } catch (cause) {
      setError(getApiErrorMessage(cause, "Unable to save holiday."));
    }
  }

  const columns: ColumnDef<HolidayDirectoryItem>[] = [
    {
      accessorKey: "holidayName",
      header: "Holiday",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.holidayName}</p>
          {row.original.calendarName ? (
            <p className="text-muted-foreground text-xs">
              {row.original.calendarName}
              {row.original.versionNumber ? ` · v${row.original.versionNumber}` : ""}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      id: "dates",
      header: "Date",
      cell: ({ row }) => formatHolidayDate(row.original),
    },
    { accessorKey: "holidayType", header: "Type" },
    {
      id: "classification",
      header: "Classification",
      cell: ({ row }) => {
        if (row.original.source !== "BUSINESS_CALENDAR") return "—";
        return (
          <StatusBadge
            label={row.original.isOptionalHoliday ? "Optional / Floating" : "Mandatory"}
            tone={row.original.isOptionalHoliday ? "progress" : "warning"}
          />
        );
      },
    },
    {
      id: "scope",
      header: "Office",
      cell: ({ row }) => scopeLabel(row.original),
    },
    {
      id: "source",
      header: "Source",
      cell: ({ row }) => (
        <div className="space-y-1">
          <StatusBadge
            label={holidaySourceLabel(row.original.source)}
            tone={row.original.source === "BUSINESS_CALENDAR" ? "success" : "progress"}
          />
          <p className="text-muted-foreground text-xs">{modeLabel(row.original.runtimeMode)}</p>
        </div>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const legacy = row.original.source === "LEGACY_HOLIDAYS";
        if (canManage && canEditLegacy && legacy) {
          return (
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => openEdit(row.original)}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (window.confirm(`Delete ${row.original.holidayName}?`)) {
                    void remove.mutate(row.original.id);
                  }
                }}
              >
                Delete
              </Button>
            </div>
          );
        }
        if (canOpenBusiness && row.original.calendarId) {
          return (
            <Button size="sm" variant="outline" asChild>
              <Link href={businessCalendarHref(row.original.calendarId)}>Open calendar</Link>
            </Button>
          );
        }
        return null;
      },
    },
  ];

  return (
    <WorkspaceShell>
      <div className="border-border bg-card rounded-xl border p-4">
        <p className="text-sm font-medium">Holiday source</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Published holidays come from Business Calendar. The previous holiday source remains
          available only for offices that have not completed the calendar transition.
        </p>
        {offices.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {offices.slice(0, 8).map((office) => (
              <StatusBadge
                key={`${office.companyId}:${office.branchId ?? "company"}`}
                label={`${office.branchName ?? office.companyName} · ${modeLabel(office.runtimeMode)}`}
                tone={modeTone(office.runtimeMode)}
              />
            ))}
          </div>
        ) : null}
        <div className="mt-3">
          {canOpenBusiness ? (
            <Button asChild>
              <Link href="/administration/business-calendar">Open Business Calendar</Link>
            </Button>
          ) : (
            <p className="text-muted-foreground text-sm">
              Ask an administrator to open Business Calendar for a transitioned office.
            </p>
          )}
        </div>
      </div>

      <PageToolbar>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-sm">
            {query.isLoading
              ? "Loading…"
              : fromBusiness > 0
                ? `${fromBusiness} published holiday${fromBusiness === 1 ? "" : "s"} in ${yearFilter}`
                : `No published holidays in ${yearFilter} yet`}
          </span>
          <div className="flex gap-1">
            {[year - 1, year, year + 1].map((candidate) => (
              <Button
                key={candidate}
                type="button"
                size="sm"
                variant={yearFilter === candidate ? "default" : "outline"}
                onClick={() => setYearFilter(candidate)}
              >
                {candidate}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              void query.refetch();
              void sourcesQuery.refetch();
            }}
            disabled={query.isFetching}
          >
            {query.isFetching ? "Refreshing…" : "Refresh"}
          </Button>
          {canManage && canEditLegacy ? (
            <Button variant="outline" onClick={openNew}>
              Add previous-source holiday
            </Button>
          ) : null}
          {canOpenBusiness ? (
            <Button asChild>
              <Link href="/administration/business-calendar">Add holiday</Link>
            </Button>
          ) : null}
        </div>
      </PageToolbar>

      {query.error ? (
        <ErrorState
          title="Could not load holidays"
          description={getApiErrorMessage(query.error, "Try again.")}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <DataTable
          columns={columns}
          data={items}
          isLoading={query.isLoading}
          emptyIcon={CalendarDays}
          emptyTitle="No holidays yet"
          emptyDescription={
            canEditLegacy
              ? "Publish a calendar for transitioned offices, or add a previous-source holiday only for an office still completing transition."
              : "Open Business Calendar, add a holiday to a draft, then publish it."
          }
          emptyActionLabel={canOpenBusiness ? "Open Business Calendar" : undefined}
          emptyActionIcon={CalendarDays}
          onEmptyAction={
            canOpenBusiness ? () => router.push("/administration/business-calendar") : undefined
          }
          enablePagination
          pageSize={10}
        />
      )}

      <FormSheet
        open={open}
        onOpenChange={setOpen}
        title={selected ? "Edit previous-source holiday" : "Add previous-source holiday"}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button
              type="submit"
              form="holiday-form"
              disabled={create.isPending || update.isPending}
            >
              {create.isPending || update.isPending ? "Saving…" : "Save holiday"}
            </Button>
          </div>
        }
      >
        <form id="holiday-form" className="grid gap-4" onSubmit={submit}>
          <p className="text-muted-foreground text-sm">
            Use this only for an office still completing the calendar transition.
          </p>
          <div className="space-y-2">
            <Label htmlFor="holiday-company">Company</Label>
            <Select
              value={form.companyId}
              onValueChange={(companyId) =>
                setForm((current) => ({ ...current, companyId, branchId: undefined }))
              }
            >
              <SelectTrigger id="holiday-company">
                <SelectValue placeholder="Select company" />
              </SelectTrigger>
              <SelectContent>
                {(companies.data ?? []).map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="holiday-branch">Branch (optional)</Label>
            <Select
              value={form.branchId ?? "ALL"}
              onValueChange={(branchId) =>
                setForm((current) => ({
                  ...current,
                  branchId: branchId === "ALL" ? undefined : branchId,
                }))
              }
            >
              <SelectTrigger id="holiday-branch">
                <SelectValue placeholder="All branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All branches</SelectItem>
                {(branches.data ?? []).map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.branchName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="holiday-name">Name</Label>
              <Input
                id="holiday-name"
                value={form.holidayName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    holidayName: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="holiday-date">Date</Label>
              <Input
                id="holiday-date"
                type="date"
                value={form.holidayDate}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    holidayDate: event.target.value,
                  }))
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="holiday-type">Type</Label>
            <Input
              id="holiday-type"
              value={form.holidayType}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  holidayType: event.target.value,
                }))
              }
              placeholder="PUBLIC"
            />
          </div>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
        </form>
      </FormSheet>
    </WorkspaceShell>
  );
}
