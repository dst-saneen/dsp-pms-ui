"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/services/api-client";
import { HolidayService } from "./service";
import type { HolidayPayload } from "./types";

export const holidayKeys = { all: ["holidays"] as const };
export function useHolidays(filters?: { companyId?: string; branchId?: string; year?: number }) {
  return useQuery({ queryKey: [...holidayKeys.all, filters ?? {}], queryFn: () => HolidayService.getAll(filters) });
}
export function useHolidayDirectory(filters?: {
  companyId?: string;
  branchId?: string;
  year?: number;
}) {
  return useQuery({
    queryKey: [...holidayKeys.all, "directory", filters ?? {}],
    queryFn: () => HolidayService.getDirectory(filters),
  });
}
export function useHolidaySources() {
  return useQuery({
    queryKey: [...holidayKeys.all, "source"],
    queryFn: () => HolidayService.getSources(),
  });
}
function useHolidayMutation<T>(mutationFn: (value: T) => Promise<unknown>, successMessage: string, errorMessage: string) {
  const client = useQueryClient();
  return useMutation({ mutationFn, onSuccess: () => { void client.invalidateQueries({ queryKey: holidayKeys.all }); toast.success(successMessage); }, onError: (error) => toast.error(getApiErrorMessage(error, errorMessage)) });
}
export function useCreateHoliday() { return useHolidayMutation((data: HolidayPayload) => HolidayService.create(data), "Holiday created.", "Unable to create holiday."); }
export function useUpdateHoliday() { return useHolidayMutation(({ id, data }: { id: string; data: Partial<HolidayPayload> }) => HolidayService.update(id, data), "Holiday updated.", "Unable to update holiday."); }
export function useDeleteHoliday() { return useHolidayMutation((id: string) => HolidayService.remove(id), "Holiday deleted.", "Unable to delete holiday."); }
