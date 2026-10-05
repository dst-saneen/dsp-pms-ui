/** React Query key factory for employee career feature. */
export const employeeCareerKeys = {
  all: ["employee-career"] as const,
  timeline: (employeeId: string, view: "HR" | "SANITIZED") =>
    [...employeeCareerKeys.all, "timeline", employeeId, view] as const,
  probationQueue: () => [...employeeCareerKeys.all, "probation-queue"] as const,
  probationPreflight: (employeeId: string) =>
    [...employeeCareerKeys.all, "probation-preflight", employeeId] as const,
} as const;
