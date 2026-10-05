"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";

import { FormSheet } from "@/components/common/form-sheet";
import { PageToolbar } from "@/components/common/page-toolbar";
import { StatusBadge } from "@/components/common/status-badge";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import { LookupSelect } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useBranches } from "@/features/lookups/hooks/use-branches";
import { useCompanies } from "@/features/lookups/hooks/use-companies";
import { useAuth } from "@/providers/auth-provider";
import { getApiErrorMessage } from "@/services/api-client";

import { OptionalHolidayPolicyCard } from "@/features/optional-holiday/optional-holiday-policy-card";

import {
  useBusinessCalendars,
  useEnsureOfficeCalendars,
  useProvisionBranchCalendar,
  useProvisionCompanyCalendar,
  useSetOfficeRuntimeMode,
} from "./hooks";
import { friendlyConfigStatus } from "./labels";
import { nextBusinessCalendarRuntimeAction } from "./runtime-mode-action";
import type { BusinessCalendarRow } from "./types";
import { usePersistedCompanyId } from "./use-persisted-selection";

function statusTone(status: string) {
  if (status === "READY" || status === "ACTIVE_MODE") return "success" as const;
  if (status === "LEGACY_MODE" || status === "SHADOW_MODE") return "progress" as const;
  if (status === "INACTIVE") return "neutral" as const;
  return "warning" as const;
}

const MODE_PRIORITY = ["ACTIVE_MODE", "SHADOW_MODE", "LEGACY_MODE", "READY", "INACTIVE"] as const;

function primaryMode(statuses: string[]): string | null {
  for (const code of MODE_PRIORITY) {
    if (statuses.includes(code)) return code;
  }
  return statuses.find((s) => !s.startsWith("MISSING_")) ?? null;
}

function attentionItems(statuses: string[]): string[] {
  return statuses.filter((s) => s === "MISSING_LOCATION" || s === "MISSING_TIMEZONE");
}

export function BusinessCalendarAdminWorkspace() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("calendar.business.manage");
  const canPublish = hasPermission("calendar.business.publish");
  const { companyId, setCompanyId, ready } = usePersistedCompanyId();
  const [createOpen, setCreateOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [name, setName] = useState("Company Calendar");
  const [timezone, setTimezone] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [branchId, setBranchId] = useState("");

  const companies = useCompanies();
  const branches = useBranches(companyId || undefined);
  const calendarsQuery = useBusinessCalendars(companyId || undefined);
  const provisionCompany = useProvisionCompanyCalendar();
  const provisionBranch = useProvisionBranchCalendar();
  const ensureMutation = useEnsureOfficeCalendars();

  const companyItems = useMemo(
    () =>
      (companies.data ?? []).map((company) => ({
        id: company.id,
        code: company.code,
        name: company.name,
      })),
    [companies.data]
  );
  const branchItems = useMemo(
    () =>
      (branches.data ?? []).map((branch) => ({
        id: branch.id,
        code: branch.code,
        name: branch.name,
      })),
    [branches.data]
  );

  const selectedCompany = companyItems.find((c) => c.id === companyId);
  const companyCalendars = (calendarsQuery.data ?? []).filter((row) => row.scope === "COMPANY");
  const branchCalendars = (calendarsQuery.data ?? []).filter((row) => row.scope === "BRANCH");

  async function submitCompany(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!companyId || !name.trim() || !timezone.trim()) {
      setFormError("Company, name and timezone are required.");
      return;
    }
    try {
      await provisionCompany.mutateAsync({
        companyId,
        calendarCode: "MAIN",
        calendarName: name.trim(),
        defaultTimezone: timezone.trim(),
      });
      setCreateOpen(false);
    } catch (error) {
      setFormError(getApiErrorMessage(error, "Could not create calendar."));
    }
  }

  return (
    <WorkspaceShell>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Setup order</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-1 text-sm">
          <p>
            1. Select a <strong className="text-foreground">Company</strong>.
          </p>
          <p>
            2. Create the <strong className="text-foreground">Company calendar</strong> first (base
            holidays / working week).
          </p>
          <p>
            3. Add <strong className="text-foreground">Branch calendars</strong> that inherit or
            override the company calendar.
          </p>
          <p>
            4. Open a calendar → edit the <strong className="text-foreground">draft version</strong>{" "}
            → Publish. Draft is not live for Attendance or Leave until published.
          </p>
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-sm">
        Pick a company, then open its company or branch calendar to set holidays and working days.
      </p>

      <PageToolbar>
        <div className="w-full max-w-md space-y-1">
          <Label className="text-muted-foreground text-xs" htmlFor="business-calendar-company">
            Company
          </Label>
          <LookupSelect
            id="business-calendar-company"
            value={companyId}
            onChange={(value) => {
              setCompanyId(value);
              setBranchId("");
            }}
            items={companyItems}
            placeholder="Select company"
            loading={companies.isLoading || !ready}
          />
        </div>
        {canManage ? (
          <div className="flex flex-wrap items-end gap-2">
            <Button
              type="button"
              disabled={!companyId}
              title={companyId ? "Create the base company calendar" : "Select a company first"}
              onClick={() => setCreateOpen(true)}
            >
              Create company calendar
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!companyId}
              onClick={() => setAdvancedOpen((value) => !value)}
            >
              {advancedOpen ? "Hide advanced" : "Advanced"}
            </Button>
          </div>
        ) : null}
      </PageToolbar>

      {companyId ? <OptionalHolidayPolicyCard companyId={companyId} /> : null}

      {canManage && advancedOpen && companyId ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Advanced setup</CardTitle>
            <p className="text-muted-foreground text-xs">
              Optional tools to check or create missing calendars for this company.
            </p>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={ensureMutation.isPending || !timezone.trim()}
              onClick={() =>
                void ensureMutation.mutateAsync({
                  companyId,
                  dryRun: true,
                  defaultTimezone: timezone.trim(),
                })
              }
            >
              Check missing calendars
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={ensureMutation.isPending || !timezone.trim()}
              onClick={() =>
                void ensureMutation.mutateAsync({
                  companyId,
                  dryRun: false,
                  defaultTimezone: timezone.trim(),
                })
              }
            >
              Create missing calendars
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!ready ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : !companyId ? (
        <Card>
          <CardContent className="text-muted-foreground space-y-1 p-8 text-center text-sm">
            <p className="text-foreground font-medium">Select a company</p>
            <p>Your choice is kept when you switch tabs.</p>
          </CardContent>
        </Card>
      ) : calendarsQuery.isLoading ? (
        <p className="text-muted-foreground text-sm">Loading calendars…</p>
      ) : calendarsQuery.isError ? (
        <div className="space-y-2">
          <p className="text-destructive text-sm">
            {getApiErrorMessage(calendarsQuery.error, "Could not load calendars.")}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void calendarsQuery.refetch()}
          >
            Retry
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {selectedCompany ? (
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold tracking-tight">{selectedCompany.name}</h3>
                <p className="text-muted-foreground text-xs">
                  {selectedCompany.code} · {companyCalendars.length} company ·{" "}
                  {branchCalendars.length} branch
                  {branchCalendars.length === 1 ? "" : "es"}
                </p>
              </div>
            </div>
          ) : null}

          {companyCalendars.length === 0 ? (
            <Card>
              <CardContent className="space-y-3 p-6 text-sm">
                <p className="font-medium">No company calendar yet</p>
                <p className="text-muted-foreground">
                  Create the main company calendar first. Branch offices can then inherit it and add
                  local holidays.
                </p>
                {canManage ? (
                  <Button type="button" onClick={() => setCreateOpen(true)}>
                    Create company calendar
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ) : (
            companyCalendars.map((companyCalendar) => {
              const children = branchCalendars.filter(
                (branch) =>
                  branch.parentCalendarId === companyCalendar.id ||
                  (!branch.parentCalendarId && branch.companyId === companyCalendar.companyId)
              );
              return (
                <div key={companyCalendar.id} className="space-y-3">
                  <section className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="bg-primary/15 text-primary flex size-6 items-center justify-center rounded-full text-xs font-semibold">
                        1
                      </span>
                      <div>
                        <h4 className="text-sm font-semibold">Company calendar</h4>
                        <p className="text-muted-foreground text-xs">
                          Shared rules for the whole company
                        </p>
                      </div>
                    </div>
                    <CalendarRow
                      calendar={companyCalendar}
                      variant="company"
                      canPublish={canPublish}
                    />
                  </section>

                  <section className="border-border ml-3 space-y-3 border-l-2 pl-4 sm:ml-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="bg-muted text-muted-foreground flex size-6 items-center justify-center rounded-full text-xs font-semibold">
                          2
                        </span>
                        <div>
                          <h4 className="text-sm font-semibold">Branch calendars</h4>
                          <p className="text-muted-foreground text-xs">
                            Inherit company rules · add local holidays if needed
                          </p>
                        </div>
                      </div>
                      {canManage ? (
                        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end">
                          <div className="min-w-0 space-y-1 sm:w-56">
                            <Label
                              className="text-muted-foreground text-xs"
                              htmlFor="business-calendar-branch"
                            >
                              Branch
                            </Label>
                            <LookupSelect
                              id="business-calendar-branch"
                              value={branchId}
                              onChange={setBranchId}
                              items={branchItems}
                              placeholder="Select branch"
                              loading={branches.isLoading}
                            />
                          </div>
                          <Button
                            type="button"
                            disabled={!branchId || provisionBranch.isPending}
                            onClick={() => void provisionBranch.mutateAsync({ branchId })}
                          >
                            Create branch calendar
                          </Button>
                        </div>
                      ) : null}
                    </div>

                    {children.length === 0 ? (
                      <Card>
                        <CardContent className="text-muted-foreground p-4 text-sm">
                          No branch calendars yet. Select a branch and create one to customize that
                          office.
                        </CardContent>
                      </Card>
                    ) : (
                      <ul className="space-y-2">
                        {children.map((calendar) => (
                          <li key={calendar.id}>
                            <CalendarRow
                              calendar={calendar}
                              variant="branch"
                              canPublish={canPublish}
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </div>
              );
            })
          )}
        </div>
      )}

      <FormSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create company calendar"
        description="Main office calendar. Branches can inherit holidays and working days from this."
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="create-company-calendar-form"
              disabled={provisionCompany.isPending}
            >
              Create
            </Button>
          </div>
        }
      >
        <form id="create-company-calendar-form" className="space-y-4" onSubmit={submitCompany}>
          <div className="space-y-2">
            <Label htmlFor="bc-name">Calendar name</Label>
            <Input id="bc-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bc-tz">Timezone</Label>
            <Input
              id="bc-tz"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="Asia/Kolkata"
            />
            <p className="text-muted-foreground text-xs">Example: Asia/Kolkata</p>
          </div>
          {formError ? <p className="text-destructive text-sm">{formError}</p> : null}
        </form>
      </FormSheet>
    </WorkspaceShell>
  );
}

function CalendarRow({
  calendar,
  variant,
  canPublish,
}: {
  calendar: BusinessCalendarRow;
  variant: "company" | "branch";
  canPublish: boolean;
}) {
  const mode = primaryMode(calendar.configurationStatus);
  const attention = attentionItems(calendar.configurationStatus);
  const timezone = calendar.branch?.timezone ?? calendar.defaultTimezone;
  const isBranch = variant === "branch";
  const runtimeAction = nextBusinessCalendarRuntimeAction(
    calendar.runtimeMode,
    calendar.hasPublishedVersion
  );
  const setRuntimeMode = useSetOfficeRuntimeMode();

  return (
    <div
      className={cn(
        "bg-card rounded-xl border p-4 transition-colors",
        isBranch ? "border-border bg-muted/20 border-dashed" : "border-border shadow-sm"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-base font-semibold">
              {isBranch ? (
                <span className="text-muted-foreground mr-1" aria-hidden>
                  ↳
                </span>
              ) : null}
              {calendar.calendarName}
            </p>
            {mode ? (
              <StatusBadge label={friendlyConfigStatus(mode)} tone={statusTone(mode)} />
            ) : null}
          </div>

          <p className="text-muted-foreground text-xs">
            {isBranch ? "Branch office" : "Company-wide"}
            {calendar.branch ? ` · ${calendar.branch.branchName}` : ""}
            {timezone ? ` · ${timezone}` : ""}
          </p>

          {isBranch ? (
            <p className="text-muted-foreground text-xs">
              Inherits company calendar
              {calendar.parentCalendar ? ` (${calendar.parentCalendar.calendarName})` : ""}. Local
              holidays override only the days you change.
            </p>
          ) : (
            <p className="text-muted-foreground text-xs">
              Base working week and holidays for all offices unless a branch customizes a day.
            </p>
          )}

          {attention.length > 0 ? (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {attention.map((status) => (
                <StatusBadge key={status} label={friendlyConfigStatus(status)} tone="warning" />
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {canPublish && runtimeAction ? (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground max-w-56 text-right text-xs">
                {runtimeAction.description}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={setRuntimeMode.isPending}
                onClick={() =>
                  void setRuntimeMode.mutateAsync({
                    companyId: calendar.companyId,
                    branchId: calendar.branchId ?? undefined,
                    mode: runtimeAction.nextMode,
                  })
                }
              >
                {runtimeAction.label}
              </Button>
            </div>
          ) : null}
          {!calendar.hasPublishedVersion ? (
            <p className="text-muted-foreground text-xs">
              Publish a calendar version before testing or using it for Attendance, Leave, or roster
              planning.
            </p>
          ) : null}
          <Button type="button" size="sm" asChild>
            <Link href={`/administration/business-calendar/${calendar.id}`}>Open</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
