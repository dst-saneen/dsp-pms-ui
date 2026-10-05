"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { PageToolbar } from "@/components/common/page-toolbar";
import { StatusBadge } from "@/components/common/status-badge";
import { LookupSelect } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCompanies } from "@/features/lookups/hooks/use-companies";
import { useAuth } from "@/providers/auth-provider";
import { getApiErrorMessage } from "@/services/api-client";

import {
  useApplyImportToDraft,
  useBusinessCalendars,
  useCalendarVersions,
  useDownloadImportTemplate,
  useImportBatch,
  useImportBatches,
  useImportGovernmentPack,
  useImportJurisdictions,
  useRejectImport,
  useReviewImport,
  useUploadImport,
  useValidateImport,
} from "./hooks";
import {
  friendlyBusinessDayEffect,
  friendlyImportBatchStatus,
  friendlyImportRowStatus,
  friendlySourceKind,
  friendlyVersionStatus,
} from "./labels";
import type { ImportBatchSummary, ImportHolidayPayload } from "./types";
import { usePersistedCompanyId } from "./use-persisted-selection";
import { getScopedSelectionId } from "./selection-scope";

function batchStatusTone(
  status: string
): "success" | "warning" | "information" | "neutral" | "progress" {
  if (status === "APPLIED" || status === "APPROVED") return "success";
  if (status === "REJECTED" || status === "FAILED") return "warning";
  if (status === "VALIDATED" || status === "IN_REVIEW") return "progress";
  return "information";
}

function rowStatusTone(
  status: string
): "success" | "warning" | "information" | "neutral" | "progress" {
  if (status === "VALID" || status === "SELECTED" || status === "APPLIED") return "success";
  if (status === "INVALID" || status === "FAILED") return "warning";
  if (status === "DUPLICATE" || status === "SKIPPED") return "neutral";
  return "information";
}

function holidayTitle(payload: ImportHolidayPayload | null | undefined): string {
  if (payload?.eventName) return payload.eventName;
  return "Holiday row";
}

function holidaySubtitle(payload: ImportHolidayPayload | null | undefined): string {
  const parts: string[] = [];
  if (payload?.startDate) {
    const start = payload.startDate.slice(0, 10);
    const end = payload.endDate?.slice(0, 10);
    parts.push(end && end !== start ? `${start} → ${end}` : start);
  }
  const effect = friendlyBusinessDayEffect(payload?.businessDayEffect);
  if (effect) parts.push(effect);
  if (payload?.paidHoliday) parts.push("Paid");
  return parts.join(" · ") || "Details unavailable until validated";
}

export function BusinessCalendarImportsWorkspace() {
  const searchParams = useSearchParams();
  const initialCompanyId = searchParams.get("companyId")?.trim() || "";
  const initialCalendarId = searchParams.get("calendarId")?.trim() || "";
  const initialVersionId = searchParams.get("versionId")?.trim() || "";

  return (
    <BusinessCalendarImportsWorkspaceContent
      key={`${initialCompanyId}:${initialCalendarId}:${initialVersionId}`}
      initialCalendarId={initialCalendarId}
      initialVersionId={initialVersionId}
    />
  );
}

function BusinessCalendarImportsWorkspaceContent({
  initialCalendarId,
  initialVersionId,
}: {
  initialCalendarId: string;
  initialVersionId: string;
}) {
  const searchParams = useSearchParams();
  const { hasPermission } = useAuth();
  const canImport = hasPermission("calendar.business.import");
  const canReview = hasPermission("calendar.business.review");
  const { companyId, setCompanyId, ready: companyReady } = usePersistedCompanyId();
  const [calendarId, setCalendarId] = useState(initialCalendarId);
  const [versionId, setVersionId] = useState(initialVersionId);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [govCountry, setGovCountry] = useState("");
  const [govSubdivision, setGovSubdivision] = useState("");
  const [govYear, setGovYear] = useState(() => String(new Date().getFullYear()));
  const [localError, setLocalError] = useState<string | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);

  useEffect(() => {
    const fromQuery = searchParams.get("companyId")?.trim();
    if (fromQuery && fromQuery !== companyId) {
      setCompanyId(fromQuery);
    }
  }, [companyId, searchParams, setCompanyId]);

  const companies = useCompanies();
  const jurisdictionsQuery = useImportJurisdictions();
  const companyItems = useMemo(
    () =>
      (companies.data ?? []).map((company) => ({
        id: company.id,
        code: company.code,
        name: company.name,
      })),
    [companies.data]
  );

  const calendarsQuery = useBusinessCalendars(companyId || undefined);
  const calendarItems = useMemo(
    () =>
      (calendarsQuery.data ?? []).map((calendar) => ({
        id: calendar.id,
        code: calendar.calendarCode,
        name:
          calendar.scope === "BRANCH"
            ? `${calendar.calendarName} (branch)`
            : `${calendar.calendarName} (company)`,
      })),
    [calendarsQuery.data]
  );
  const activeCalendarId = getScopedSelectionId(calendarId, calendarItems);

  const versionsQuery = useCalendarVersions(activeCalendarId || undefined);
  const draftVersionItems = useMemo(
    () =>
      (versionsQuery.data ?? [])
        .filter((version) => version.status === "DRAFT" || version.status === "IN_REVIEW")
        .map((version) => ({
          id: version.id,
          code: `v${version.versionNumber}`,
          name: `${friendlyVersionStatus(version.status)} · from ${version.effectiveFrom.slice(0, 10)}`,
        })),
    [versionsQuery.data]
  );
  const activeVersionId = getScopedSelectionId(versionId, draftVersionItems);

  const countryItems = useMemo(() => {
    const rows = jurisdictionsQuery.data ?? [];
    const byCode = new Map<string, string>();
    for (const row of rows) {
      if (!byCode.has(row.countryCode)) {
        byCode.set(row.countryCode, row.countryName);
      }
    }
    return [...byCode.entries()].map(([id, name]) => ({
      id,
      code: id,
      name,
    }));
  }, [jurisdictionsQuery.data]);

  const subdivisionItems = useMemo(() => {
    const rows = (jurisdictionsQuery.data ?? []).filter(
      (row) => row.countryCode === govCountry && row.subdivisionCode && row.subdivisionName
    );
    return [
      { id: "", code: "ALL", name: "Whole country" },
      ...rows.map((row) => ({
        id: row.subdivisionCode as string,
        code: row.subdivisionCode as string,
        name: row.subdivisionName as string,
      })),
    ];
  }, [jurisdictionsQuery.data, govCountry]);

  const batchesQuery = useImportBatches({
    companyId: companyId || undefined,
    calendarId: activeCalendarId || undefined,
    calendarVersionId: activeVersionId || undefined,
  });
  const batchQuery = useImportBatch(selectedBatchId || undefined);
  const upload = useUploadImport();
  const downloadTemplate = useDownloadImportTemplate();
  const government = useImportGovernmentPack();
  const validate = useValidateImport();
  const review = useReviewImport();
  const apply = useApplyImportToDraft();
  const reject = useRejectImport();

  const batches = (batchesQuery.data ?? []) as ImportBatchSummary[];
  const batch = batchQuery.data;
  const selectableRows = (batch?.rows ?? []).filter(
    (row) => row.status === "VALID" || row.status === "CHANGED" || row.status === "SELECTED"
  );

  async function onUpload() {
    setLocalError(null);
    if (!activeVersionId || !file) {
      setLocalError("Choose a draft calendar and a file first.");
      return;
    }
    try {
      const created = await upload.mutateAsync({
        calendarVersionId: activeVersionId,
        file,
      });
      if (created && typeof created === "object" && "id" in created) {
        setSelectedBatchId(String((created as { id: string }).id));
      }
      setFile(null);
    } catch (error) {
      setLocalError(getApiErrorMessage(error, "Upload failed."));
    }
  }

  async function onGovernment() {
    setLocalError(null);
    if (!activeVersionId) {
      setLocalError("Select a draft calendar version first.");
      return;
    }
    try {
      const created = await government.mutateAsync({
        calendarVersionId: activeVersionId,
        countryCode: govCountry,
        subdivisionCode: govSubdivision || undefined,
        year: Number(govYear),
      });
      if (created && typeof created === "object" && "id" in created) {
        setSelectedBatchId(String((created as { id: string }).id));
      }
    } catch (error) {
      setLocalError(getApiErrorMessage(error, "Could not load holiday pack."));
    }
  }

  function toggleSelectAll() {
    const ids = selectableRows.map((row) => row.id);
    const allSelected = ids.length > 0 && ids.every((id) => selectedRowIds.includes(id));
    setSelectedRowIds(allSelected ? [] : ids);
  }

  return (
    <div className="space-y-4 overflow-x-hidden">
      <p className="text-muted-foreground text-sm">
        Bring holidays into a <strong className="text-foreground font-medium">draft</strong>{" "}
        calendar, review them, then add. Publishing stays a separate step.
      </p>

      <ol className="text-muted-foreground grid gap-2 text-xs sm:grid-cols-4">
        {[
          "1. Pick draft calendar",
          "2. Upload or load pack",
          "3. Validate & approve",
          "4. Add to draft",
        ].map((step) => (
          <li key={step} className="border-border bg-muted/30 rounded-md border px-3 py-2">
            {step}
          </li>
        ))}
      </ol>

      <PageToolbar>
        <div className="grid w-full gap-2 lg:grid-cols-3">
          <label className="sr-only" htmlFor="business-calendar-import-company">
            Company
          </label>
          <LookupSelect
            id="business-calendar-import-company"
            value={companyId}
            onChange={(value) => {
              setCompanyId(value);
              setCalendarId("");
              setVersionId("");
              setSelectedBatchId("");
              setSelectedRowIds([]);
              setFile(null);
              setLocalError(null);
            }}
            items={companyItems}
            placeholder="Company"
            loading={companies.isLoading || !companyReady}
          />
          <label className="sr-only" htmlFor="business-calendar-import-calendar">
            Calendar
          </label>
          <LookupSelect
            id="business-calendar-import-calendar"
            value={calendarId}
            onChange={(value) => {
              setCalendarId(value);
              setVersionId("");
              setSelectedBatchId("");
              setSelectedRowIds([]);
              setFile(null);
              setLocalError(null);
            }}
            items={calendarItems}
            placeholder="Calendar"
            loading={calendarsQuery.isLoading}
          />
          <label className="sr-only" htmlFor="business-calendar-import-version">
            Draft version
          </label>
          <LookupSelect
            id="business-calendar-import-version"
            value={versionId}
            onChange={(value) => {
              setVersionId(value);
              setSelectedBatchId("");
              setSelectedRowIds([]);
              setFile(null);
              setLocalError(null);
            }}
            items={draftVersionItems}
            placeholder="Draft version"
            loading={versionsQuery.isLoading}
          />
        </div>
      </PageToolbar>

      {!activeVersionId ? (
        <p className="text-muted-foreground text-sm">
          Select a company, calendar, and draft version to start importing.
        </p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload a file</CardTitle>
            <p className="text-muted-foreground text-xs">
              CSV, Excel (.xlsx / .xls), or ICS. Max 5 MB. Use the template so column names match
              exactly.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="border-border bg-muted/20 space-y-2 rounded-md border p-3 text-xs">
              <p className="text-foreground font-medium">File format</p>
              <ul className="text-muted-foreground list-disc space-y-1 pl-4">
                <li>
                  <strong className="text-foreground">Required columns:</strong>{" "}
                  <code className="text-foreground">eventName</code>,{" "}
                  <code className="text-foreground">startDate</code>,{" "}
                  <code className="text-foreground">endDate</code>,{" "}
                  <code className="text-foreground">countryCode</code>
                </li>
                <li>
                  Dates must be <code className="text-foreground">YYYY-MM-DD</code> (example{" "}
                  <code className="text-foreground">2026-09-21</code>). Excel date cells are OK. For
                  a <strong className="text-foreground">one-day holiday</strong>, set{" "}
                  <code className="text-foreground">endDate</code> the same as{" "}
                  <code className="text-foreground">startDate</code>. A later{" "}
                  <code className="text-foreground">endDate</code> makes every day in between that
                  holiday.
                </li>
                <li>
                  <code className="text-foreground">countryCode</code>:{" "}
                  <code className="text-foreground">IN</code> or Middle East (
                  <code className="text-foreground">AE</code>,{" "}
                  <code className="text-foreground">SA</code>, …). Optional state:{" "}
                  <code className="text-foreground">IN-KL</code>,{" "}
                  <code className="text-foreground">AE-DU</code>, …
                </li>
                <li>
                  Optional: <code className="text-foreground">eventCode</code>,{" "}
                  <code className="text-foreground">subdivisionCode</code>,{" "}
                  <code className="text-foreground">eventType</code> (default HOLIDAY),{" "}
                  <code className="text-foreground">category</code>,{" "}
                  <code className="text-foreground">dayPortion</code> (FULL_DAY / FIRST_HALF /
                  SECOND_HALF), <code className="text-foreground">paidHoliday</code> (true/false),{" "}
                  <code className="text-foreground">businessDayEffect</code> (default
                  NON_WORKING_DAY), <code className="text-foreground">externalReference</code>
                </li>
                <li>
                  Excel: put headers on <strong className="text-foreground">sheet 1, row 1</strong>{" "}
                  — same names as the CSV template.
                </li>
              </ul>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!canImport || downloadTemplate.isPending}
                  onClick={() => void downloadTemplate.mutateAsync("csv")}
                >
                  Download CSV template
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!canImport || downloadTemplate.isPending}
                  onClick={() => void downloadTemplate.mutateAsync("xlsx")}
                >
                  Download Excel template
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="imp-file">File</Label>
              <Input
                id="imp-file"
                type="file"
                accept=".csv,.xlsx,.xls,.ics,text/csv,text/calendar"
                disabled={!canImport || !activeVersionId}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <Button
              type="button"
              disabled={!canImport || !activeVersionId || upload.isPending}
              title={
                !activeVersionId
                  ? "Select a draft calendar version first"
                  : !file
                    ? "Choose a CSV, Excel, or ICS file first"
                    : "Upload into this draft for validation"
              }
              onClick={() => void onUpload()}
            >
              Upload file
            </Button>
            {localError ? <p className="text-destructive text-sm">{localError}</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reviewed holiday packs</CardTitle>
            <p className="text-muted-foreground text-xs">
              Reviewed 2026 packs cover India/Kerala and UAE/Dubai. For another year or location,
              upload a controlled file and complete the same review workflow.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="business-calendar-holiday-pack-country">Country</Label>
                <LookupSelect
                  id="business-calendar-holiday-pack-country"
                  value={govCountry}
                  onChange={(value) => {
                    setGovCountry(value);
                    setGovSubdivision("");
                  }}
                  items={countryItems}
                  placeholder="Country"
                  loading={jurisdictionsQuery.isLoading}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="business-calendar-holiday-pack-subdivision">State / region</Label>
                <LookupSelect
                  id="business-calendar-holiday-pack-subdivision"
                  value={govSubdivision}
                  onChange={setGovSubdivision}
                  items={subdivisionItems}
                  placeholder="State / region"
                  loading={jurisdictionsQuery.isLoading}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="gov-y">Year</Label>
                <Input id="gov-y" value={govYear} onChange={(e) => setGovYear(e.target.value)} />
              </div>
            </div>
            <Button
              type="button"
              disabled={!canImport || !activeVersionId || government.isPending}
              onClick={() => void onGovernment()}
            >
              Load reviewed pack
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[300px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Import batches</CardTitle>
            <p className="text-muted-foreground text-xs">
              Each upload or pack creates a batch you can check.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {batchesQuery.isLoading ? (
              <p className="text-muted-foreground text-sm">Loading…</p>
            ) : batches.length === 0 ? (
              <p className="text-muted-foreground text-sm">No imports yet for this selection.</p>
            ) : (
              batches.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className={`focus-visible:ring-ring w-full rounded-md border p-2 text-left text-sm focus-visible:ring-2 focus-visible:outline-none ${
                    selectedBatchId === row.id ? "border-primary bg-primary/5" : "border-border"
                  }`}
                  onClick={() => {
                    setSelectedBatchId(row.id);
                    setSelectedRowIds([]);
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">
                      {row.sourceFileName || friendlySourceKind(row.sourceKind)}
                    </span>
                    <StatusBadge
                      label={friendlyImportBatchStatus(row.status)}
                      tone={batchStatusTone(row.status)}
                    />
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {friendlySourceKind(row.sourceKind)} · {row.validRows}/{row.totalRows} ready
                  </p>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">Choose holidays</CardTitle>
              <p className="text-muted-foreground text-xs">
                Check rows → approve selected →{" "}
                <span className="text-foreground">Add to draft</span> (still not published).
              </p>
            </div>
            {batch ? (
              <div className="flex flex-wrap gap-2">
                {canImport ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={validate.isPending}
                    onClick={() => void validate.mutateAsync(batch.id)}
                  >
                    Validate
                  </Button>
                ) : null}
                {canReview ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={review.isPending || selectedRowIds.length === 0}
                    onClick={() =>
                      void review.mutateAsync({
                        batchId: batch.id,
                        selectedRowIds,
                        approve: true,
                      })
                    }
                  >
                    Approve selected
                  </Button>
                ) : null}
                {canImport ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={apply.isPending}
                    onClick={() => void apply.mutateAsync(batch.id)}
                    title="Adds approved holidays to the draft calendar. Does not publish."
                  >
                    Add to draft
                  </Button>
                ) : null}
                {canReview ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={reject.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Discard this import batch? Approved rows that were not added will be lost."
                        )
                      ) {
                        void reject.mutateAsync(batch.id);
                      }
                    }}
                  >
                    Discard
                  </Button>
                ) : null}
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-2">
            {!selectedBatchId ? (
              <p className="text-muted-foreground text-sm">
                Select a batch on the left to choose holiday rows.
              </p>
            ) : batchQuery.isLoading ? (
              <p className="text-muted-foreground text-sm">Loading batch…</p>
            ) : !batch ? (
              <p className="text-muted-foreground text-sm">This batch is unavailable.</p>
            ) : (
              <>
                {selectableRows.length > 0 ? (
                  <div className="flex items-center justify-between gap-2 pb-1">
                    <p className="text-muted-foreground text-xs">
                      {selectedRowIds.length} selected · {selectableRows.length} can be approved
                    </p>
                    <Button type="button" size="sm" variant="ghost" onClick={toggleSelectAll}>
                      {selectableRows.every((row) => selectedRowIds.includes(row.id))
                        ? "Clear selection"
                        : "Select all ready"}
                    </Button>
                  </div>
                ) : null}
                {(batch.rows ?? []).map((row) => {
                  const checked = selectedRowIds.includes(row.id);
                  const selectable =
                    row.status === "VALID" || row.status === "CHANGED" || row.status === "SELECTED";
                  const payload = row.normalizedPayload;
                  return (
                    <label
                      key={row.id}
                      className="border-border flex items-start gap-2 rounded-md border p-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        className="mt-1"
                        disabled={!selectable}
                        checked={checked}
                        onChange={(e) => {
                          setSelectedRowIds((current) =>
                            e.target.checked
                              ? [...current, row.id]
                              : current.filter((id) => id !== row.id)
                          );
                        }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{holidayTitle(payload)}</span>
                          <StatusBadge
                            label={friendlyImportRowStatus(row.status)}
                            tone={rowStatusTone(row.status)}
                          />
                        </span>
                        <span className="text-muted-foreground block text-xs">
                          {holidaySubtitle(payload)}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
