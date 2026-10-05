"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getApiErrorMessage } from "@/services/api-client";

import { ShiftRosterService } from "../services/shift-roster-service";
import type {
  CreateShiftRosterInput,
  GenerateShiftRosterInput,
  OverrideRosterEntryInput,
  RosterVersionInput,
  ShiftRosterFilters,
} from "../types";

export const shiftRosterKeys = {
  all: ["shift-rosters"] as const,
  detail: (id: string) => ["shift-rosters", "detail", id] as const,
};

export function useShiftRosters(filters?: ShiftRosterFilters) {
  return useQuery({
    queryKey: [...shiftRosterKeys.all, "list", filters ?? {}],
    queryFn: () => ShiftRosterService.getAll(filters),
  });
}

export function useShiftRoster(id?: string) {
  return useQuery({
    queryKey: shiftRosterKeys.detail(id ?? ""),
    queryFn: () => ShiftRosterService.getById(id!),
    enabled: Boolean(id),
  });
}

function invalidateRosters(queryClient: ReturnType<typeof useQueryClient>, id?: string) {
  void queryClient.invalidateQueries({ queryKey: shiftRosterKeys.all });
  if (id) void queryClient.invalidateQueries({ queryKey: shiftRosterKeys.detail(id) });
}

export function useCreateShiftRoster() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateShiftRosterInput) => ShiftRosterService.create(input),
    onSuccess: () => {
      invalidateRosters(queryClient);
      toast.success("Schedule created.");
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Unable to create schedule.")),
  });
}

export function useGenerateShiftRoster() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GenerateShiftRosterInput) => ShiftRosterService.generate(input),
    onSuccess: (result) => {
      invalidateRosters(queryClient, result.roster?.id);
      const toCreate = result.summary?.toCreate ?? 0;
      if (result.dryRun) {
        if (toCreate === 0) {
          toast.message(
            "Preview: 0 new days. Check warnings (often missing shift).",
          );
        } else {
          toast.success(
            `Preview ready: ${toCreate} day${toCreate === 1 ? "" : "s"} would be added.`,
          );
        }
        return;
      }
      if (toCreate === 0) {
        toast.message(
          "Saved, but 0 new days were added. Check shift / warnings.",
        );
      } else {
        toast.success(
          `Schedule saved (${toCreate} new day${toCreate === 1 ? "" : "s"}).`,
        );
      }
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Unable to build schedule.")),
  });
}

function useRosterAction(
  action: "publish" | "lock" | "archive",
  successMessage: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: RosterVersionInput }) =>
      ShiftRosterService[action](id, input),
    onSuccess: (_, variables) => {
      invalidateRosters(queryClient, variables.id);
      toast.success(successMessage);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, `Unable to ${action} schedule.`)),
  });
}

export function usePublishShiftRoster() {
  return useRosterAction("publish", "Schedule published.");
}

export function useLockShiftRoster() {
  return useRosterAction("lock", "Schedule locked.");
}

export function useArchiveShiftRoster() {
  return useRosterAction("archive", "Schedule archived.");
}

export function useOverrideShiftRosterEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: OverrideRosterEntryInput }) =>
      ShiftRosterService.overrideEntry(id, input),
    onSuccess: (_, variables) => {
      invalidateRosters(queryClient, variables.id);
      toast.success("Day updated.");
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Unable to change day.")),
  });
}
