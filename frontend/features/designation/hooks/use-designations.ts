"use client";

import { useQuery } from "@tanstack/react-query";

import { DesignationService } from "../services/designation-service";

export function useDesignations(
  companyId?: string,
) {
  return useQuery({
    queryKey: ["designations", companyId],
    queryFn: () =>
      DesignationService.getDesignations(
        companyId,
      ),
  });
}