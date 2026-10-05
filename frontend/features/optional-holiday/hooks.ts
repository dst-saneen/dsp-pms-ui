"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { myWorkspaceKeys } from "@/features/my-workspace/hooks/use-my-workspace";

import { OptionalHolidayService } from "./service";
import type { OptionalHolidayCatalog } from "./types";

export const optionalHolidayKeys = {
  all: ["optional-holidays"] as const,
  catalog: (year: number) => ["optional-holidays", "catalog", year] as const,
};

export function useOptionalHolidays(year: number, enabled = true) {
  return useQuery({
    queryKey: optionalHolidayKeys.catalog(year),
    queryFn: () => OptionalHolidayService.getOptionalHolidays(year),
    enabled,
  });
}

export function useUpdateOptionalHolidaySelections(year: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (eventIds: string[]) =>
      OptionalHolidayService.updateOptionalHolidaySelections(year, eventIds),
    onSuccess: async (data: OptionalHolidayCatalog) => {
      queryClient.setQueryData(optionalHolidayKeys.catalog(year), data);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: myWorkspaceKeys.leave }),
        queryClient.invalidateQueries({ queryKey: myWorkspaceKeys.calendar }),
      ]);
    },
  });
}
