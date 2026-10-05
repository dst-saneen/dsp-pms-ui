"use client";

import { useState } from "react";

import { FormSheet } from "@/components/common/form-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiErrorMessage } from "@/services/api-client";

import {
  useCreateShiftRoster,
  useGenerateShiftRoster,
} from "../hooks/use-shift-rosters";
import { friendlyGenerateSummaryKey } from "../labels";
import type {
  ShiftRoster,
  ShiftRosterGenerateResult,
  ShiftRosterGenerateWarning,
} from "../types";

interface GenerateRosterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roster?: ShiftRoster | null;
  branchId?: string;
  onGenerated?: (roster: ShiftRoster) => void;
}

const dateOnly = (value?: string) => value?.slice(0, 10) ?? "";

function warningText(warning: string | ShiftRosterGenerateWarning) {
  if (typeof warning === "string") return warning;
  return warning.message || warning.code || "Warning";
}

function warningKey(
  warning: string | ShiftRosterGenerateWarning,
  index: number,
) {
  if (typeof warning === "string") return `${index}:${warning}`;
  return [
    index,
    warning.code,
    warning.employeeId ?? "",
    warning.workDate ?? "",
    warning.message,
  ].join(":");
}

export function GenerateRosterSheet(props: GenerateRosterSheetProps) {
  return (
    <GenerateRosterSheetForm
      key={
        props.open
          ? `open-${props.roster?.id ?? "new"}-${props.roster?.periodStart ?? ""}-${props.roster?.periodEnd ?? ""}`
          : "closed"
      }
      {...props}
    />
  );
}

function GenerateRosterSheetForm({
  open,
  onOpenChange,
  roster,
  branchId,
  onGenerated,
}: GenerateRosterSheetProps) {
  const [periodStart, setPeriodStart] = useState(() =>
    dateOnly(roster?.periodStart),
  );
  const [periodEnd, setPeriodEnd] = useState(() => dateOnly(roster?.periodEnd));
  const [requirePreview, setRequirePreview] = useState(true);
  const [preview, setPreview] = useState<ShiftRosterGenerateResult | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const generate = useGenerateShiftRoster();
  const create = useCreateShiftRoster();

  const resolvedBranchId = roster?.branchId ?? branchId;
  /** Generation only mutates DRAFT rosters; published/locked ids must not be sent. */
  const draftRosterId = roster?.status === "DRAFT" ? roster.id : undefined;

  async function runGeneration(isPreviewOnly: boolean) {
    if (!resolvedBranchId || !periodStart || !periodEnd) {
      setError("Choose a branch and a start/end date first.");
      return;
    }
    setError(null);
    try {
      const result = await generate.mutateAsync({
        branchId: resolvedBranchId,
        periodStart,
        periodEnd,
        shiftRosterId: draftRosterId,
        dryRun: isPreviewOnly,
      });
      if (isPreviewOnly) {
        setPreview(result);
      } else {
        if (result.roster) onGenerated?.(result.roster);
        onOpenChange(false);
      }
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "Could not build the work schedule.",
        ),
      );
    }
  }

  async function createDraft() {
    if (!resolvedBranchId || !periodStart || !periodEnd) {
      setError("Choose a branch and a start/end date first.");
      return;
    }
    setError(null);
    try {
      const created = await create.mutateAsync({
        branchId: resolvedBranchId,
        periodStart,
        periodEnd,
      });
      onGenerated?.(created);
      onOpenChange(false);
    } catch (requestError) {
      setError(
        getApiErrorMessage(requestError, "Could not create an empty draft."),
      );
    }
  }

  const summaryEntries = Object.entries(preview?.summary ?? {}).filter(
    ([, value]) => value !== undefined && value !== null,
  );
  const canSave = Boolean(preview) || !requirePreview;
  const toCreate = Number(preview?.summary?.toCreate ?? 0);

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={roster ? "Rebuild schedule" : "Create schedule"}
      description="Fills each employee’s days from the business calendar and default shift. Preview first so you can check counts before saving."
      size="md"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={generate.isPending}
            onClick={() => void runGeneration(true)}
          >
            {generate.isPending ? "Checking…" : "Preview first"}
          </Button>
          {!roster ? (
            <Button
              type="button"
              variant="outline"
              disabled={create.isPending || generate.isPending}
              onClick={() => void createDraft()}
              title="Creates an empty draft box only. Prefer Preview first + Save schedule to fill days."
            >
              {create.isPending ? "Creating…" : "Empty draft only"}
            </Button>
          ) : null}
          <Button
            type="button"
            disabled={generate.isPending || !canSave}
            onClick={() => void runGeneration(false)}
            title={
              canSave
                ? "Writes the planned days into the draft schedule"
                : "Run Preview first (recommended)"
            }
          >
            {generate.isPending ? "Saving…" : "Save schedule"}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="roster-period-start">From date</Label>
            <Input
              id="roster-period-start"
              type="date"
              value={periodStart}
              onChange={(event) => {
                setPeriodStart(event.target.value);
                setPreview(null);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="roster-period-end">To date</Label>
            <Input
              id="roster-period-end"
              type="date"
              value={periodEnd}
              onChange={(event) => {
                setPeriodEnd(event.target.value);
                setPreview(null);
              }}
            />
          </div>
        </div>
        <p className="text-muted-foreground text-xs">
          Tip: start with a short range (this week) so the preview is easy to
          read. All active employees on the branch are included automatically.
        </p>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={requirePreview}
            onChange={(event) => setRequirePreview(event.currentTarget.checked)}
            className="border-input mt-0.5 size-4 rounded"
          />
          <span>
            Always preview before saving
            <span className="text-muted-foreground block text-xs">
              Recommended. Lets you confirm how many days will be added before
              anything is written.
            </span>
          </span>
        </label>

        {preview ? (
          <div className="space-y-3 rounded-lg border p-4">
            <div>
              <p className="font-medium">Preview result</p>
              <p className="text-muted-foreground text-xs">
                Nothing is saved yet. This is only a check of what would happen.
              </p>
            </div>
            {summaryEntries.length ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {summaryEntries.map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">
                      {friendlyGenerateSummaryKey(key)}
                    </dt>
                    <dd className="font-medium">{String(value)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-muted-foreground text-sm">
                No counts were returned for this preview.
              </p>
            )}
            <p className="text-muted-foreground text-sm">
              Planned employee-days: {preview.entries?.length ?? 0}
              {preview.includedEmployees
                ? ` · People included: ${preview.includedEmployees.length}`
                : null}
            </p>
            {toCreate === 0 ? (
              <p className="text-sm text-amber-700">
                Preview shows 0 new days to add. Check warnings below — often
                the branch has no default shift, no employees, or a timezone
                issue.
              </p>
            ) : (
              <p className="text-sm text-emerald-700">
                Ready to save {toCreate} new day
                {toCreate === 1 ? "" : "s"}. Click{" "}
                <strong>Save schedule</strong> to write them into the draft.
              </p>
            )}
            {preview.warnings?.length ? (
              <div className="space-y-1">
                <p className="text-sm font-medium text-amber-800">
                  Things to check
                </p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-amber-700">
                  {preview.warnings.map((warning, index) => (
                    <li key={warningKey(warning, index)}>
                      {warningText(warning)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-emerald-700">No warnings.</p>
            )}
            {preview.excludedEmployees?.length ? (
              <div className="space-y-1 text-sm">
                <p className="font-medium">People left out</p>
                <ul className="text-muted-foreground list-disc space-y-1 pl-5">
                  {preview.excludedEmployees.map((row, index) => (
                    <li key={`${row.employeeId}-${index}`}>
                      {row.employeeId}: {row.reason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            Click <strong>Preview first</strong> to see how many days will be
            created and any warnings — without saving yet.
          </p>
        )}
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </div>
    </FormSheet>
  );
}
