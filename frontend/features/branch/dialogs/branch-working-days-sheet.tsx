"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { FormSheet } from "@/components/common/form-sheet";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { getApiErrorMessage } from "@/services/api-client";

import { BranchService } from "../services/branch-service";
import type { Branch } from "../types/branch";

const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

type WorkingDayDraft = {
  dayOfWeek: number;
  isWorkingDay: boolean;
};

interface BranchWorkingDaysSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branch: Branch | null;
}

function WorkingDaysEditor({
  branch,
  initialDays,
  needsReview,
  onOpenChange,
}: {
  branch: Branch;
  initialDays: WorkingDayDraft[];
  needsReview: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [days, setDays] = useState(initialDays);
  const [markReviewed, setMarkReviewed] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: () =>
      BranchService.replaceWorkingDays(branch.id, {
        days,
        markReviewed,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["branch-working-days", branch.id],
      });
      void queryClient.invalidateQueries({ queryKey: ["branches"] });
      toast.success("Working calendar saved.");
      onOpenChange(false);
    },
    onError: (error) => {
      setLocalError(
        getApiErrorMessage(error, "Unable to save working calendar."),
      );
    },
  });

  return (
    <div className="space-y-4">
      {needsReview ? (
        <p className="text-amber-700 text-sm">
          Defaults are Mon–Fri. Review and save before activating leave for this
          branch.
        </p>
      ) : null}

      <div className="space-y-3">
        {days
          .slice()
          .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
          .map((day) => (
            <div
              key={day.dayOfWeek}
              className="flex items-center justify-between gap-3 border-b border-border pb-2 last:border-0"
            >
              <span className="text-sm font-medium">
                {DAY_LABELS[day.dayOfWeek]}
              </span>
              <Switch
                checked={day.isWorkingDay}
                onCheckedChange={(checked) => {
                  setDays((current) =>
                    current.map((item) =>
                      item.dayOfWeek === day.dayOfWeek
                        ? { ...item, isWorkingDay: checked }
                        : item,
                    ),
                  );
                }}
              />
            </div>
          ))}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={markReviewed}
          onChange={(event) => setMarkReviewed(event.target.checked)}
        />
        Mark calendar as reviewed
      </label>

      {localError ? (
        <p className="text-destructive text-sm">{localError}</p>
      ) : null}

      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button
          type="button"
          disabled={saveMutation.isPending || days.length !== 7}
          onClick={() => saveMutation.mutate()}
        >
          {saveMutation.isPending ? "Saving…" : "Save calendar"}
        </Button>
      </div>
    </div>
  );
}

export function BranchWorkingDaysSheet({
  open,
  onOpenChange,
  branch,
}: BranchWorkingDaysSheetProps) {
  const query = useQuery({
    queryKey: ["branch-working-days", branch?.id],
    queryFn: () => BranchService.getWorkingDays(branch!.id),
    enabled: open && Boolean(branch?.id),
  });

  const initialDays =
    query.data?.days.map((day) => ({
      dayOfWeek: day.dayOfWeek,
      isWorkingDay: day.isWorkingDay,
    })) ?? [];

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Branch working calendar"
      description={
        branch
          ? `${branch.branchName} · ${branch.timezone || "timezone not set"}`
          : "Configure working days"
      }
      size="md"
    >
      <div className="space-y-4">
        {query.isLoading ? (
          <p className="text-muted-foreground text-sm">Loading calendar…</p>
        ) : null}

        {query.error ? (
          <p className="text-destructive text-sm">
            {getApiErrorMessage(query.error, "Could not load calendar.")}
          </p>
        ) : null}

        {branch && query.data ? (
          <WorkingDaysEditor
            key={`${branch.id}-${query.dataUpdatedAt}`}
            branch={branch}
            initialDays={initialDays}
            needsReview={Boolean(query.data.needsReview)}
            onOpenChange={onOpenChange}
          />
        ) : null}
      </div>
    </FormSheet>
  );
}
