export const employeeAssetKeys = {
  all: ["employee-assets"] as const,

  lists: () =>
    [...employeeAssetKeys.all, "list"] as const,

  byEmployee: (employeeId: string) =>
    [
      ...employeeAssetKeys.all,
      "employee",
      employeeId,
    ] as const,
};
