import { useQuery } from "@tanstack/react-query";

import { ShiftService } from "../services/shift-service";

export const SHIFT_QUERY_KEY = ["shifts"];

export function useShifts(
  companyId?: string,
  isActive?: boolean,
) {
  return useQuery({
    queryKey: [
      ...SHIFT_QUERY_KEY,
      companyId,
      isActive,
    ],

    queryFn: () =>
      ShiftService.getShifts(
        companyId,
        isActive,
      ),
  });
}