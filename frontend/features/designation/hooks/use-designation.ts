"use client";

import { useQuery } from "@tanstack/react-query";

import { DesignationService } from "../services/designation-service";

export function useDesignation(id?: string) {
  return useQuery({
    queryKey: ["designations", "detail", id],
    queryFn: () => DesignationService.getDesignation(id!),
    enabled: Boolean(id),
  });
}
