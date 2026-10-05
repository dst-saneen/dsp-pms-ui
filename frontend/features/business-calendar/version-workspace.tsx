"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";

import { FormSheet } from "@/components/common/form-sheet";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { getApiErrorMessage } from "@/services/api-client";
import { useAuth } from "@/providers/auth-provider";

import {
  useCalendarMetadata,
  useCalendarVersion,
  useCalendarVersions,
  useCreateCalendarEvent,
  useCreateCalendarVersion,
  useDeleteCalendarEvent,
  useUpdateCalendarEvent,
  usePreviewImpact,
  usePreviewRuntimeDay,
  usePublishVersion,
  useReplaceWorkingWeek,
  useStartAmendment,
  useVersionEvents,
} from "./hooks";
import { resolveHolidayEventFlags } from "./optional-holiday-event";
import type { BusinessCalendarRow, CalendarEvent, CalendarVersion, WorkingWeekRule } from "./types";
import { DAY_LABELS } from "./types";
import { EventsCalendarViews } from "./events-views";
import {
  classifyPreviewDay,
  friendlyBusinessDayEffect,
  friendlyCalendarScope,
  friendlyDayPortion,
  friendlyPreviewKind,
  friendlyTraceLayer,
  friendlyVersionStatus,
  previewKindToneClass,
} from "./labels";

function versionTone(status: string) {
  if (status === "DRAFT") return "information";
  if (status === "IN_REVIEW") return "progress";
  if (status === "PUBLISHED") return "success";
  return "neutral";
}

function toDateInput(value: string | null | undefined) {
  if (!value) return "";
  return value.slice(0, 10);
}

function currentCalendarYearRange() {
  const year = new Date().getFullYear();
  return {
    from: `${year}-01-01`,
    to: `${year}-12-31`,
  };
}

function todayDateInput() {
  return new Date().toISOString().slice(0, 10);
}

export function resolveBusinessCalendarEventEndDate(
  startDate: string,
  endDate: string,
  multiDay: boolean
): string {
  return multiDay && endDate ? endDate : startDate;
}

export function CalendarVersionWorkspace({
  calendar,
  canManage,
  onBack,
  initialVersionId,
}: {
  calendar: BusinessCalendarRow;
  canManage: boolean;
  onBack?: () => void;
  initialVersionId?: string;
}) {
  const { hasPermission } = useAuth();
  const canPublish = hasPermission("calendar.business.publish");
  const canAmend = hasPermission("calendar.business.amend");
  const canPreview = hasPermission("calendar.business.runtime.preview");
  const versionsQuery = useCalendarVersions(calendar.id);
  const [selectedVersionId, setSelectedVersionId] = useState<string>(initialVersionId ?? "");
  const [createOpen, setCreateOpen] = useState(false);
  const [effectiveFrom, setEffectiveFrom] = useState(() => currentCalendarYearRange().from);
  const [effectiveTo, setEffectiveTo] = useState(() => currentCalendarYearRange().to);
  const [changeReason, setChangeReason] = useState("");
  const createVersion = useCreateCalendarVersion(calendar.id);
  const versionRows = versionsQuery.data ?? [];
  const activeVersionId = selectedVersionId || initialVersionId || versionRows[0]?.id || "";

  async function submitCreate(event: FormEvent) {
    event.preventDefault();
    const created = await createVersion.mutateAsync({
      effectiveFrom,
      effectiveTo: effectiveTo || undefined,
      changeReason: changeReason || undefined,
    });
    if (created?.id) setSelectedVersionId(created.id);
    setCreateOpen(false);
  }

  return (
    <div className="space-y-4 overflow-x-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          {onBack ? (
            <Button type="button" variant="ghost" onClick={onBack}>
              ← Back to calendars
            </Button>
          ) : (
            <Button type="button" variant="ghost" asChild>
              <Link href="/administration/business-calendar">← Back to offices</Link>
            </Button>
          )}
          <h2 className="text-lg font-semibold">
            {calendar.calendarName}{" "}
            <span className="text-muted-foreground text-sm font-normal">
              ({friendlyCalendarScope(calendar.scope)})
            </span>
          </h2>
          <p className="text-muted-foreground text-sm">
            Set the working week and holidays, then publish. Timezone:{" "}
            {calendar.branch?.timezone ?? calendar.defaultTimezone}.
          </p>
        </div>
        {canManage ? (
          <Button type="button" onClick={() => setCreateOpen(true)}>
            Create draft
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-[240px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Versions</CardTitle>
            <p className="text-muted-foreground text-xs">Draft → publish</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {(versionsQuery.data ?? []).length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No drafts yet. Create a draft to start.
              </p>
            ) : (
              (versionsQuery.data ?? []).map((version) => (
                <button
                  key={version.id}
                  type="button"
                  className={`w-full rounded-md border p-2 text-left text-sm ${
                    activeVersionId === version.id ? "border-primary bg-primary/5" : "border-border"
                  }`}
                  onClick={() => setSelectedVersionId(version.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span>v{version.versionNumber}</span>
                    <StatusBadge
                      label={friendlyVersionStatus(version.status)}
                      tone={versionTone(version.status)}
                    />
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {toDateInput(version.effectiveFrom)}
                    {version.effectiveTo ? ` → ${toDateInput(version.effectiveTo)}` : ""}
                  </p>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        {activeVersionId ? (
          <VersionEditor
            versionId={activeVersionId}
            calendar={calendar}
            canManage={canManage}
            canPublish={canPublish}
            canAmend={canAmend}
            canPreview={canPreview}
            onSelectVersion={setSelectedVersionId}
          />
        ) : (
          <Card>
            <CardContent className="text-muted-foreground p-6 text-sm">
              Select a version on the left, or create a draft to edit the working week and holidays.
            </CardContent>
          </Card>
        )}
      </div>

      <FormSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create draft"
        description="Draft calendars are safe to edit. Publish only when ready."
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="create-version-form" disabled={createVersion.isPending}>
              Create draft
            </Button>
          </div>
        }
      >
        <form id="create-version-form" className="space-y-4" onSubmit={submitCreate}>
          <div className="space-y-2">
            <Label htmlFor="vf">Effective from</Label>
            <Input
              id="vf"
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vt">Effective to</Label>
            <Input
              id="vt"
              type="date"
              value={effectiveTo}
              onChange={(e) => setEffectiveTo(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vr">Change reason</Label>
            <Input id="vr" value={changeReason} onChange={(e) => setChangeReason(e.target.value)} />
          </div>
        </form>
      </FormSheet>
    </div>
  );
}

function VersionEditor({
  versionId,
  calendar,
  canManage,
  canPublish,
  canAmend,
  canPreview,
  onSelectVersion,
}: {
  versionId: string;
  calendar: BusinessCalendarRow;
  canManage: boolean;
  canPublish: boolean;
  canAmend: boolean;
  canPreview: boolean;
  onSelectVersion: (id: string) => void;
}) {
  const versionQuery = useCalendarVersion(versionId);
  const eventsQuery = useVersionEvents(versionId);
  const metadata = useCalendarMetadata(calendar.companyId);
  const version = versionQuery.data;
  const editable = canManage && version?.status === "DRAFT";

  if (versionQuery.isLoading || !version) {
    return (
      <Card>
        <CardContent className="text-muted-foreground p-6 text-sm">Loading version…</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">
              Version {version.versionNumber}{" "}
              <StatusBadge
                label={friendlyVersionStatus(version.status)}
                tone={versionTone(version.status)}
              />
            </CardTitle>
            <p className="text-muted-foreground mt-1 text-xs">
              {toDateInput(version.effectiveFrom)}
              {version.effectiveTo ? ` → ${toDateInput(version.effectiveTo)}` : " → open-ended"}
              {version.amendsVersionId ? " · Editing a published calendar" : ""}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {version.validation.inheritanceNote}
            </p>
          </div>
          <VersionActions
            version={version}
            canPublish={canPublish}
            canAmend={canAmend}
            onSelectVersion={onSelectVersion}
          />
        </CardHeader>
        <CardContent>
          {version.validation.issues.length > 0 ? (
            <div className="border-warning/30 bg-warning/5 rounded-md border p-3 text-sm">
              <p className="font-medium">Before you can publish</p>
              <ul className="mt-1 list-disc pl-5 text-xs">
                {version.validation.issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-success text-sm">Ready to publish.</p>
          )}
        </CardContent>
      </Card>

      {canPreview ? <DayPreviewPanel version={version} calendar={calendar} /> : null}

      <WorkingWeekEditor key={version.id} version={version} editable={!!editable} />

      <EventsPanel
        version={version}
        events={eventsQuery.data ?? []}
        editable={!!editable}
        companyId={calendar.companyId}
        branchId={calendar.branchId}
        metadata={metadata.data}
      />
    </div>
  );
}

function VersionActions({
  version,
  canPublish,
  canAmend,
  onSelectVersion,
}: {
  version: CalendarVersion;
  canPublish: boolean;
  canAmend: boolean;
  onSelectVersion: (id: string) => void;
}) {
  const publish = usePublishVersion(version.id);
  const startAmendment = useStartAmendment(version.id);
  const previewImpact = usePreviewImpact(version.id);
  const [amendOpen, setAmendOpen] = useState(false);
  const [impactOpen, setImpactOpen] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState(
    toDateInput(version.effectiveFrom) || todayDateInput()
  );
  const [reason, setReason] = useState("");
  const [impact, setImpact] = useState<Record<string, unknown> | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  async function runPublish(acknowledgeImpact: boolean) {
    setLocalError(null);
    try {
      await publish.mutateAsync({
        optimisticVersion: version.optimisticVersion,
        // Always send explicit boolean for amendments (required by API).
        impactPreviewAcknowledged: acknowledgeImpact ? true : undefined,
      });
      setImpactOpen(false);
    } catch (error) {
      setLocalError(getApiErrorMessage(error, "Could not publish version."));
    }
  }

  async function onPublishClick() {
    setLocalError(null);
    if (version.amendsVersionId) {
      const preview = await previewImpact.mutateAsync({});
      setImpact(preview ?? null);
      setImpactOpen(true);
      return;
    }
    if (
      !window.confirm(
        "Publish this calendar version? Employees will use these working days and holidays for the effective dates. Earlier published history is kept."
      )
    ) {
      return;
    }
    await runPublish(false);
  }

  async function onStartAmendment(event: FormEvent) {
    event.preventDefault();
    setLocalError(null);
    try {
      const draft = await startAmendment.mutateAsync({
        effectiveDate,
        reason: reason.trim(),
      });
      if (draft?.id) onSelectVersion(draft.id);
      setAmendOpen(false);
    } catch (error) {
      setLocalError(getApiErrorMessage(error, "Could not start amendment."));
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        {canPublish && (version.status === "DRAFT" || version.status === "IN_REVIEW") ? (
          <Button
            type="button"
            disabled={
              publish.isPending || previewImpact.isPending || !version.validation.readyForReview
            }
            title={
              version.validation.readyForReview
                ? "Publish makes this calendar live for Attendance and Leave"
                : "Fix validation issues below before publishing"
            }
            onClick={() => void onPublishClick()}
          >
            Publish
          </Button>
        ) : null}
        {canAmend && version.status === "PUBLISHED" ? (
          <Button type="button" onClick={() => setAmendOpen(true)}>
            Edit published calendar
          </Button>
        ) : null}
      </div>
      {localError ? <p className="text-destructive text-xs">{localError}</p> : null}

      <FormSheet
        open={amendOpen}
        onOpenChange={setAmendOpen}
        title="Edit published calendar"
        description="Creates a change draft. Previous published history is kept."
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setAmendOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="start-amendment-form" disabled={startAmendment.isPending}>
              Create change draft
            </Button>
          </div>
        }
      >
        <form id="start-amendment-form" className="space-y-4" onSubmit={onStartAmendment}>
          <div className="space-y-2">
            <Label htmlFor="ae">Changes apply from</Label>
            <Input
              id="ae"
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ar">Reason</Label>
            <Input
              id="ar"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              minLength={3}
            />
          </div>
        </form>
      </FormSheet>

      <FormSheet
        open={impactOpen}
        onOpenChange={setImpactOpen}
        title="Review before publishing"
        description="Check what may be affected, then confirm to publish this change."
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setImpactOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={publish.isPending}
              onClick={() => void runPublish(true)}
            >
              Confirm & publish
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm">
          {localError ? (
            <p className="border-destructive/30 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-sm">
              {localError}
            </p>
          ) : null}
          <p>
            Days that change: <strong>{String(impact?.changedDateCount ?? 0)}</strong>
          </p>
          <p>
            Leave requests that may need follow-up:{" "}
            <strong>{String(impact?.openLeaveCount ?? 0)}</strong>
          </p>
          <p>
            Shift roster rows that may need follow-up:{" "}
            <strong>{String(impact?.openRosterCount ?? 0)}</strong>
          </p>
          <p className="text-muted-foreground text-xs">
            Overlaps are a review reminder only — they do not block publishing after you confirm.
            Use Review Changes afterward if needed.
          </p>
          {Array.isArray(impact?.changedDates) && (impact?.changedDates as string[]).length > 0 ? (
            <p className="text-muted-foreground text-xs">
              Sample dates: {(impact?.changedDates as string[]).slice(0, 8).join(", ")}
            </p>
          ) : (
            <p className="text-muted-foreground text-xs">
              No day-status differences in the preview window.
            </p>
          )}
        </div>
      </FormSheet>
    </div>
  );
}

function DayPreviewPanel({
  version,
  calendar,
}: {
  version: CalendarVersion;
  calendar: BusinessCalendarRow;
}) {
  const preview = usePreviewRuntimeDay();
  const [date, setDate] = useState(toDateInput(version.effectiveFrom) || todayDateInput());
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [showWhy, setShowWhy] = useState(false);

  async function runPreview() {
    const data = await preview.mutateAsync({
      companyId: calendar.companyId,
      branchId: calendar.branchId ?? undefined,
      date,
      companyVersionId: calendar.scope === "COMPANY" ? version.id : undefined,
      branchVersionId: calendar.scope === "BRANCH" ? version.id : undefined,
    });
    setResult(data ?? null);
    setShowWhy(false);
  }

  const resolved = result?.result as
    | {
        dayStatus?: string;
        dayPortion?: string;
        reasonCode?: string;
        reasonText?: string;
        resolutionTrace?: Array<{ layer: string; code: string; detail: string }>;
      }
    | undefined;

  const kind = resolved
    ? classifyPreviewDay({
        dayStatus: resolved.dayStatus,
        dayPortion: resolved.dayPortion,
        reasonCode: resolved.reasonCode,
      })
    : null;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <div>
          <CardTitle className="text-base">Quick day check</CardTitle>
          <p className="text-muted-foreground text-xs">
            See how one date looks with this version (same language as Calendar Preview).
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="pd">Date</Label>
            <Input id="pd" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <Button
            type="button"
            size="sm"
            disabled={preview.isPending}
            onClick={() => void runPreview()}
          >
            Check day
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {kind && resolved ? (
          <>
            <div className={cn("rounded-md border px-3 py-2", previewKindToneClass[kind])}>
              <p className="font-medium">{friendlyPreviewKind(kind)}</p>
              <p className="text-xs opacity-90">
                {resolved.dayPortion ? `${friendlyDayPortion(resolved.dayPortion)} · ` : ""}
                {resolved.reasonText ?? "No extra note"}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setShowWhy((value) => !value)}
            >
              {showWhy ? "Hide why" : "Why this day?"}
            </Button>
            {showWhy ? (
              <ol className="text-muted-foreground list-decimal space-y-1 pl-5 text-xs">
                {(resolved.resolutionTrace ?? []).map((step, index) => (
                  <li key={`${step.layer}-${index}`}>
                    <span className="text-foreground font-medium">
                      {friendlyTraceLayer(step.layer)}
                    </span>
                    {step.detail ? ` — ${step.detail}` : null}
                  </li>
                ))}
              </ol>
            ) : null}
          </>
        ) : (
          <p className="text-muted-foreground text-xs">Pick a date and check how it resolves.</p>
        )}
      </CardContent>
    </Card>
  );
}

function initialWorkingWeekRules(version: CalendarVersion, isBranch: boolean): WorkingWeekRule[] {
  if (isBranch) {
    return version.workingWeekRules.map((rule) => ({
      dayOfWeek: rule.dayOfWeek,
      ruleMode: "OVERRIDE",
      isWorkingDay: rule.isWorkingDay,
      dayPortion: rule.dayPortion,
      reason: rule.reason ?? "",
    }));
  }
  const byDay = new Map(version.workingWeekRules.map((rule) => [rule.dayOfWeek, rule]));
  return [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => {
    const existing = byDay.get(dayOfWeek);
    return {
      dayOfWeek,
      ruleMode: "DEFINE" as const,
      isWorkingDay: existing?.isWorkingDay ?? (dayOfWeek >= 1 && dayOfWeek <= 5),
      dayPortion: existing?.dayPortion ?? "FULL_DAY",
      reason: existing?.reason ?? null,
    };
  });
}

function WorkingWeekEditor({ version, editable }: { version: CalendarVersion; editable: boolean }) {
  const isBranch = version.calendar.scope === "BRANCH";
  const save = useReplaceWorkingWeek(version.id);
  const [rules, setRules] = useState<WorkingWeekRule[]>(() =>
    initialWorkingWeekRules(version, isBranch)
  );
  const [error, setError] = useState<string | null>(null);

  async function onSave() {
    setError(null);
    try {
      await save.mutateAsync({
        rules: isBranch
          ? rules.filter((rule) => rule.reason || rule.isWorkingDay !== undefined)
          : rules,
        optimisticVersion: version.optimisticVersion,
      });
    } catch (err) {
      setError(getApiErrorMessage(err, "Save failed."));
    }
  }

  function toggleBranchDay(dayOfWeek: number, enabled: boolean) {
    setRules((current) => {
      if (!enabled) {
        return current.filter((rule) => rule.dayOfWeek !== dayOfWeek);
      }
      if (current.some((rule) => rule.dayOfWeek === dayOfWeek)) return current;
      return [
        ...current,
        {
          dayOfWeek,
          ruleMode: "OVERRIDE",
          isWorkingDay: false,
          dayPortion: "FULL_DAY",
          reason: "",
        },
      ];
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle className="text-base">Working week</CardTitle>
          <p className="text-muted-foreground text-xs">
            {isBranch
              ? "Only mark days that differ from the company calendar. Unmarked days stay inherited."
              : "Set which days of the week are working days for this company."}
          </p>
        </div>
        {editable ? (
          <Button type="button" size="sm" disabled={save.isPending} onClick={() => void onSave()}>
            Save working week
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {[0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => {
          const rule = rules.find((row) => row.dayOfWeek === dayOfWeek);
          const overridden = !!rule;
          return (
            <div
              key={dayOfWeek}
              className="border-border flex flex-col gap-2 border-b pb-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-[140px]">
                <p className="text-sm font-medium">{DAY_LABELS[dayOfWeek]}</p>
                {isBranch ? (
                  <label className="text-muted-foreground flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      disabled={!editable}
                      checked={overridden}
                      onChange={(e) => toggleBranchDay(dayOfWeek, e.target.checked)}
                    />
                    Override this day
                  </label>
                ) : (
                  <p className="text-muted-foreground text-xs">Company rule</p>
                )}
              </div>
              {(!isBranch || overridden) && rule ? (
                <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                  <div className="flex items-center gap-2">
                    <span className="text-xs">Working</span>
                    <Switch
                      checked={rule.isWorkingDay}
                      disabled={!editable}
                      onCheckedChange={(checked) =>
                        setRules((current) =>
                          current.map((row) =>
                            row.dayOfWeek === dayOfWeek ? { ...row, isWorkingDay: checked } : row
                          )
                        )
                      }
                    />
                  </div>
                  {isBranch ? (
                    <Input
                      className="sm:max-w-xs"
                      placeholder="Why this day differs (required)"
                      disabled={!editable}
                      value={rule.reason ?? ""}
                      onChange={(e) =>
                        setRules((current) =>
                          current.map((row) =>
                            row.dayOfWeek === dayOfWeek ? { ...row, reason: e.target.value } : row
                          )
                        )
                      }
                    />
                  ) : null}
                </div>
              ) : (
                <StatusBadge label="Inherited" tone="neutral" />
              )}
            </div>
          );
        })}
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </CardContent>
    </Card>
  );
}

function EventsPanel({
  version,
  events,
  editable,
  companyId,
  branchId,
  metadata,
}: {
  version: CalendarVersion;
  events: CalendarEvent[];
  editable: boolean;
  companyId: string;
  branchId: string | null;
  metadata?: {
    eventTypes: Array<{
      id: string;
      eventTypeCode: string;
      eventTypeName: string;
      allowsBusinessDayEffect: boolean;
    }>;
    categories: Array<{ id: string; categoryCode: string; categoryName: string }>;
    sources: Array<{ id: string; sourceCode: string; sourceName: string }>;
  };
}) {
  const [open, setOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const createEvent = useCreateCalendarEvent(version.id);
  const updateEvent = useUpdateCalendarEvent(version.id);
  const deleteEvent = useDeleteCalendarEvent(version.id);
  const holidayType = metadata?.eventTypes.find((type) => type.eventTypeCode === "HOLIDAY");
  const companyCategory = metadata?.categories.find(
    (category) => category.categoryCode === "COMPANY"
  );
  const manualSource = metadata?.sources.find((source) => source.sourceCode === "MANUAL");
  const isEditing = editingEventId !== null;
  const saving = createEvent.isPending || updateEvent.isPending;

  const [eventName, setEventName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [multiDay, setMultiDay] = useState(false);
  const [eventTypeId, setEventTypeId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [effect, setEffect] = useState("NON_WORKING_DAY");
  const [paidHoliday, setPaidHoliday] = useState(false);
  const [isOptionalHoliday, setIsOptionalHoliday] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const resolvedEventTypeId = eventTypeId || holidayType?.id || "";
  const resolvedCategoryId = categoryId || companyCategory?.id || "";
  const resolvedSourceId = manualSource?.id || "";

  const selectedType = metadata?.eventTypes.find((type) => type.id === resolvedEventTypeId);
  const isHoliday = selectedType?.eventTypeCode === "HOLIDAY";
  const holidayFlags = resolveHolidayEventFlags({
    isHoliday,
    isOptionalHoliday,
    multiDay,
    startDate,
    endDate,
    effect,
    paidHoliday,
  });

  const defaultTarget = useMemo(() => {
    if (version.calendar.scope === "BRANCH" && branchId) {
      return {
        targetType: "BRANCH" as const,
        companyId,
        branchId,
      };
    }
    return { targetType: "COMPANY" as const, companyId };
  }, [version.calendar.scope, companyId, branchId]);

  function resetEventForm() {
    setEditingEventId(null);
    setEventName("");
    setStartDate("");
    setEndDate("");
    setMultiDay(false);
    setEventTypeId("");
    setCategoryId("");
    setEffect("NON_WORKING_DAY");
    setPaidHoliday(false);
    setIsOptionalHoliday(false);
    setFormError(null);
  }

  function openCreateSheet() {
    resetEventForm();
    setOpen(true);
  }

  function openEditSheet(row: CalendarEvent) {
    const start = toDateInput(row.startDate);
    const end = toDateInput(row.endDate);
    setEditingEventId(row.id);
    setEventName(row.eventName);
    setStartDate(start);
    setEndDate(end !== start ? end : "");
    setMultiDay(end !== start);
    setEventTypeId(row.eventTypeId);
    setCategoryId(row.eventCategoryId);
    setEffect(row.businessDayEffect || "NON_WORKING_DAY");
    setPaidHoliday(Boolean(row.paidHoliday));
    setIsOptionalHoliday(Boolean(row.isOptionalHoliday));
    setFormError(null);
    setOpen(true);
  }

  async function submitEvent(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (holidayFlags.multiDay && holidayFlags.endDate < startDate) {
      setFormError("End date cannot be before the holiday date.");
      return;
    }
    try {
      const payload = {
        eventTypeId: resolvedEventTypeId,
        eventCategoryId: resolvedCategoryId,
        eventName: eventName.trim(),
        allDay: true,
        startDate,
        endDate: holidayFlags.endDate,
        businessDayEffect: holidayFlags.effect,
        paidHoliday: holidayFlags.paidHoliday,
        isOptionalHoliday: holidayFlags.isOptionalHoliday,
      };
      if (editingEventId) {
        // Deliberately omit eventSourceId: imported/source provenance is immutable on edit.
        await updateEvent.mutateAsync({ eventId: editingEventId, data: payload });
      } else {
        await createEvent.mutateAsync({
          ...payload,
          eventSourceId: resolvedSourceId,
          targets: [defaultTarget],
        });
      }
      setOpen(false);
      resetEventForm();
    } catch (err) {
      setFormError(getApiErrorMessage(err, isEditing ? "Could not update event." : "Could not create event."));
    }
  }

  return (
    <div className="space-y-4">
      <EventsCalendarViews events={events} timezoneLabel={version.calendar.defaultTimezone} />
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Manage holidays & events</CardTitle>
            <p className="text-muted-foreground text-xs">
              Add, edit, or remove items on a draft. Calendar views above use the same colors as Calendar
              Preview.
            </p>
          </div>
          {editable ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={openCreateSheet}>
                Add holiday / event
              </Button>
              <Button type="button" size="sm" variant="outline" asChild>
                <Link
                  href={`/administration/business-calendar/imports?companyId=${encodeURIComponent(companyId)}&calendarId=${encodeURIComponent(version.calendarId)}&versionId=${encodeURIComponent(version.id)}`}
                >
                  Import CSV / Excel
                </Link>
              </Button>
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-2">
          {events.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No holidays or events on this version yet.
            </p>
          ) : (
            events.map((row) => (
              <div
                key={row.id}
                className="border-border flex flex-wrap items-start justify-between gap-2 rounded-md border p-2"
              >
                <div>
                  <p className="text-sm font-medium">{row.eventName}</p>
                  <p className="text-muted-foreground text-xs">
                    {toDateInput(row.startDate)}
                    {toDateInput(row.endDate) !== toDateInput(row.startDate)
                      ? ` → ${toDateInput(row.endDate)} (multi-day)`
                      : ""}{" "}
                    · {friendlyBusinessDayEffect(row.businessDayEffect)}
                  </p>
                  {row.eventType?.eventTypeCode === "HOLIDAY" ? (
                    <div className="mt-1">
                      <StatusBadge
                        label={row.isOptionalHoliday ? "Optional / Floating" : "Mandatory"}
                        tone={row.isOptionalHoliday ? "progress" : "warning"}
                      />
                    </div>
                  ) : null}
                </div>
                {editable && !row.isProtected ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={saving || deleteEvent.isPending}
                      onClick={() => openEditSheet(row)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={saving || deleteEvent.isPending}
                      onClick={() => void deleteEvent.mutateAsync(row.id)}
                    >
                      Remove
                    </Button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </CardContent>

        <FormSheet
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) resetEventForm();
          }}
          title={isEditing ? "Edit holiday or event" : "Add holiday or event"}
          description="Saved to this draft only. Publishing is a separate step."
          footer={
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  resetEventForm();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" form="create-event-form" disabled={saving}>
                {isEditing ? "Save changes" : "Save"}
              </Button>
            </div>
          }
        >
          <form id="create-event-form" className="space-y-4" onSubmit={submitEvent}>
            <div className="space-y-2">
              <Label htmlFor="en">Name</Label>
              <Input
                id="en"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sd">Date</Label>
              <Input
                id="sd"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (!multiDay) setEndDate("");
                }}
                required
              />
              <p className="text-muted-foreground text-xs">
                One day by default (e.g. Independence Day = that date only). Every day from Date
                through End becomes this holiday if you turn on multi-day below.
              </p>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={holidayFlags.multiDay}
                disabled={isHoliday && isOptionalHoliday}
                onChange={(e) => {
                  const next = e.target.checked;
                  setMultiDay(next);
                  if (!next) setEndDate("");
                }}
              />
              <span>
                Spans more than one day
                <span className="text-muted-foreground block text-xs font-normal">
                  Rare — only for multi-day festivals. Leave off for normal holidays. Not available
                  for optional / floating holidays.
                </span>
              </span>
            </label>
            {holidayFlags.multiDay ? (
              <div className="space-y-2">
                <Label htmlFor="ed">End date (inclusive)</Label>
                <Input
                  id="ed"
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
                <p className="text-muted-foreground text-xs">
                  Inclusive range: the office treats each day from Date through End the same way
                  (e.g. Full day holiday).
                </p>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="et">Type</Label>
              <select
                id="et"
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                value={resolvedEventTypeId}
                onChange={(e) => {
                  const nextTypeId = e.target.value;
                  setEventTypeId(nextTypeId);
                  const nextType = metadata?.eventTypes.find((type) => type.id === nextTypeId);
                  // Holiday must change the day; default was NONE → preview still "Working".
                  setEffect(nextType?.eventTypeCode === "HOLIDAY" ? "NON_WORKING_DAY" : "NONE");
                  setPaidHoliday(false);
                  setIsOptionalHoliday(false);
                }}
              >
                {(metadata?.eventTypes ?? []).map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.eventTypeName}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ec">Category</Label>
              <select
                id="ec"
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                value={resolvedCategoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                {(metadata?.categories ?? []).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.categoryName}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Source</Label>
              <Input value="Manual entry" readOnly className="bg-muted" />
              <p className="text-muted-foreground text-xs">
                This drawer is for one holiday at a time (manual). CSV, Excel, ICS, and API imports
                are on Import Holidays — pick rows and add them to the draft there.
              </p>
              <Button type="button" variant="outline" size="sm" asChild>
                <Link
                  href={`/administration/business-calendar/imports?companyId=${encodeURIComponent(companyId)}&calendarId=${encodeURIComponent(version.calendarId)}&versionId=${encodeURIComponent(version.id)}`}
                >
                  Open Import Holidays (CSV / Excel / ICS)
                </Link>
              </Button>
            </div>
            {selectedType?.allowsBusinessDayEffect && !isOptionalHoliday ? (
              <div className="space-y-2">
                <Label htmlFor="ef">How this day should work</Label>
                <select
                  id="ef"
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                  value={effect}
                  onChange={(e) => setEffect(e.target.value)}
                >
                  <option value="NONE">{friendlyBusinessDayEffect("NONE")}</option>
                  <option value="NON_WORKING_DAY">
                    {friendlyBusinessDayEffect("NON_WORKING_DAY")}
                  </option>
                  <option value="WORKING_DAY_OVERRIDE">
                    {friendlyBusinessDayEffect("WORKING_DAY_OVERRIDE")}
                  </option>
                  <option value="FIRST_HALF_NON_WORKING">
                    {friendlyBusinessDayEffect("FIRST_HALF_NON_WORKING")}
                  </option>
                  <option value="SECOND_HALF_NON_WORKING">
                    {friendlyBusinessDayEffect("SECOND_HALF_NON_WORKING")}
                  </option>
                </select>
              </div>
            ) : null}
            {isHoliday ? (
              <>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={isOptionalHoliday}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setIsOptionalHoliday(next);
                      if (next) {
                        setMultiDay(false);
                        setEndDate("");
                        setEffect("NONE");
                        setPaidHoliday(false);
                      } else {
                        setEffect("NON_WORKING_DAY");
                      }
                    }}
                  />
                  <span>
                    Optional / Floating holiday
                    <span className="text-muted-foreground block text-xs font-normal">
                      Office stays open. Employees may choose this day within the annual holiday
                      allowance.
                    </span>
                  </span>
                </label>
                {!isOptionalHoliday ? (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={paidHoliday}
                      onChange={(e) => setPaidHoliday(e.target.checked)}
                    />
                    Paid holiday (needs a non-working day effect)
                  </label>
                ) : (
                  <p className="text-muted-foreground text-xs">
                    Optional holidays use effect NONE and are unpaid at calendar level (pay comes
                    from the Optional Holiday leave type).
                  </p>
                )}
              </>
            ) : null}
            <p className="text-muted-foreground text-xs">
              Applies to this {friendlyCalendarScope(version.calendar.scope).toLowerCase()}.
            </p>
            {formError ? <p className="text-destructive text-sm">{formError}</p> : null}
          </form>
        </FormSheet>
      </Card>
    </div>
  );
}
