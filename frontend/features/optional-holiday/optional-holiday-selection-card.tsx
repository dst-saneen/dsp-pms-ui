"use client";

import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getApiErrorMessage } from "@/services/api-client";

import { useOptionalHolidays, useUpdateOptionalHolidaySelections } from "./hooks";
import type { OptionalHolidayCatalog, OptionalHolidayCatalogHoliday } from "./types";

const CUTOFF_FOOTER =
  "You can change picks until the end of the previous day (same-day is blocked). Removing a date cancels it right away; new dates follow your company approval setting.";

/** Format API date (`YYYY-MM-DD` or `YYYY-MM-DDTHH:mm:ss`) as dd-mm-yyyy. */
function formatDisplayDate(value: string) {
  const day = value.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return value;
  const [, year, month, date] = match;
  return `${date}-${month}-${year}`;
}

function selectionStatusLabel(
  status: OptionalHolidayCatalogHoliday["selectionStatus"],
) {
  if (status === "APPROVED") return "Approved";
  if (status === "SUBMITTED") return "Pending approval";
  return null;
}

function sameIdSet(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((id) => rightSet.has(id));
}

export interface OptionalHolidaySelectionCardProps {
  /** Override year (defaults to current UTC year). */
  year?: number;
  /** Inject catalog for tests; skips the query when set. */
  catalog?: OptionalHolidayCatalog | null;
  /** Inject save handler for tests. */
  onSave?: (eventIds: string[]) => Promise<OptionalHolidayCatalog>;
  saveError?: string | null;
  isSaving?: boolean;
  embedded?: boolean;
}

export function OptionalHolidaySelectionCard({
  year: yearProp,
  catalog: catalogProp,
  onSave,
  saveError: saveErrorProp,
  isSaving: isSavingProp,
  embedded = false,
}: OptionalHolidaySelectionCardProps = {}) {
  const year = yearProp ?? new Date().getUTCFullYear();
  const query = useOptionalHolidays(year, catalogProp === undefined);
  const mutation = useUpdateOptionalHolidaySelections(year);

  const catalog = catalogProp !== undefined ? catalogProp : (query.data ?? null);
  const serverSelected = useMemo(
    () => catalog?.holidays.filter((row) => row.selected).map((row) => row.eventId) ?? [],
    [catalog]
  );
  const [selectionDraft, setSelectionDraft] = useState<{
    year: number;
    eventIds: string[];
  } | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const draftIds = selectionDraft?.year === year ? selectionDraft.eventIds : serverSelected;
  const draftSet = useMemo(() => new Set(draftIds), [draftIds]);
  const hasChanges = !sameIdSet(draftIds, serverSelected);
  const remaining = catalog ? Math.max(0, catalog.optionalAllowance - draftIds.length) : 0;

  const isSaving = isSavingProp ?? mutation.isPending;
  const saveError =
    saveErrorProp ??
    localError ??
    (mutation.error ? getApiErrorMessage(mutation.error, "Could not save selections.") : null);
  const embeddedCardClass = embedded
    ? "gap-0 overflow-visible border-0 bg-transparent py-0 shadow-none [--card-spacing:--spacing(0)]"
    : undefined;

  async function handleSave() {
    setLocalError(null);
    try {
      if (onSave) {
        await onSave(draftIds);
      } else {
        await mutation.mutateAsync(draftIds);
      }
      setSelectionDraft(null);
    } catch (error) {
      setLocalError(getApiErrorMessage(error, "Could not save selections."));
      // Keep draft unchanged on failure
    }
  }

  function toggle(eventId: string, locked: boolean) {
    if (locked) return;
    setSelectionDraft((current) => {
      const eventIds = current?.year === year ? current.eventIds : serverSelected;
      return {
        year,
        eventIds: eventIds.includes(eventId)
          ? eventIds.filter((id) => id !== eventId)
          : [...eventIds, eventId],
      };
    });
  }

  if (catalogProp === undefined && query.isLoading) {
    return (
      <div className="space-y-3" aria-label="Loading optional holidays">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (catalogProp === undefined && query.error) {
    return (
      <Card className={embeddedCardClass}>
        {!embedded ? (
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="size-4" />
              Optional / floating holidays
            </CardTitle>
          </CardHeader>
        ) : null}
        <CardContent className={cn(embedded && "px-0")}>
          <div className="border-destructive/15 bg-danger-soft/40 rounded-md border px-3 py-3">
            <p className="text-destructive text-sm font-medium">
              {getApiErrorMessage(query.error, "Could not load optional holidays.")}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!catalog) {
    return null;
  }

  return (
    <Card className={embeddedCardClass}>
      {!embedded ? (
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="size-4" />
            Optional / floating holidays ({catalog.year})
          </CardTitle>
          <p className="text-muted-foreground text-xs">
            Pick your floating holidays for the year. The office stays open on these days for
            everyone else. If your company requires approval, new picks stay pending until
            Manager/HR approve.
          </p>
        </CardHeader>
      ) : null}
      <CardContent className={cn("space-y-4", embedded && "px-0")}>
        {embedded ? (
          <p className="text-muted-foreground text-xs">
            Pick your floating holidays for {catalog.year}. The office stays open on these dates;
            new picks follow your company approval setting.
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SummaryTile label="Maximum" value={catalog.maximumHolidayDays} />
          <SummaryTile label="Mandatory" value={catalog.mandatoryWorkingDayCount} />
          <SummaryTile label="You can choose" value={catalog.optionalAllowance} />
          <SummaryTile label="Remaining" value={remaining} />
        </div>

        {catalog.holidays.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No optional holidays are available for this year yet.
          </p>
        ) : (
          <ul className="space-y-2" aria-label="Optional holiday dates">
            {catalog.holidays.map((holiday) => {
              const checked = draftSet.has(holiday.eventId);
              const statusLabel = selectionStatusLabel(holiday.selectionStatus);
              return (
                <li key={holiday.eventId}>
                  <label
                    htmlFor={`oh-select-${holiday.eventId}`}
                    className={`border-border flex items-start gap-3 rounded-lg border p-3 ${
                      holiday.locked
                        ? "bg-muted/30 cursor-not-allowed opacity-80"
                        : "hover:bg-muted/40 cursor-pointer"
                    }`}
                  >
                    <input
                      id={`oh-select-${holiday.eventId}`}
                      type="checkbox"
                      className="accent-primary mt-0.5 size-4"
                      data-testid={`oh-checkbox-${holiday.eventId}`}
                      checked={checked}
                      disabled={holiday.locked}
                      onChange={() => toggle(holiday.eventId, holiday.locked)}
                    />
                    <span className="min-w-0">
                      <span className="text-foreground flex flex-wrap items-center gap-2 text-sm font-medium">
                        {holiday.name}
                        {statusLabel && checked ? (
                          <span className="text-muted-foreground text-xs font-normal">
                            · {statusLabel}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-muted-foreground block text-xs">
                        {formatDisplayDate(holiday.date)}
                        {holiday.calendarScope === "BRANCH"
                          ? " · Branch"
                          : " · Company"}
                      </span>
                      {holiday.locked ? (
                        <span className="text-muted-foreground mt-1 block text-xs">
                          Locked (editable until{" "}
                          {formatDisplayDate(holiday.editableUntil)})
                        </span>
                      ) : (
                        <span className="text-muted-foreground mt-1 block text-xs">
                          Editable until{" "}
                          {formatDisplayDate(holiday.editableUntil)}
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        <div className="space-y-2">
          <Button
            type="button"
            disabled={isSaving || !hasChanges}
            onClick={() => void handleSave()}
          >
            {isSaving ? "Saving…" : "Save selections"}
          </Button>
          <p className="text-muted-foreground text-xs">{CUTOFF_FOOTER}</p>
          {saveError ? <p className="text-destructive text-sm">{saveError}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  const text =
    label === "Maximum"
      ? `Maximum ${value}`
      : label === "Mandatory"
        ? `Mandatory ${value}`
        : label === "You can choose"
          ? `You can choose ${value}`
          : `Remaining ${value}`;

  return (
    <div className="border-border rounded-lg border px-3 py-2">
      <p className="text-sm font-semibold">{text}</p>
    </div>
  );
}
