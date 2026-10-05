"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/services/api-client";
import { CompOffService } from "./service";
import type { CompOffCreditFilters } from "./types";

export const compOffKeys = { all: ["comp-off-credits"] as const };
export function useCompOffCredits(filters?: CompOffCreditFilters) {
  return useQuery({ queryKey: [...compOffKeys.all, filters ?? {}], queryFn: () => CompOffService.getAll(filters) });
}
export function useRevokeCompOffCredit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => CompOffService.revoke(id, reason),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: compOffKeys.all }); toast.success("Comp-off credit revoked."); },
    onError: (error) => toast.error(getApiErrorMessage(error, "Unable to revoke comp-off credit.")),
  });
}
