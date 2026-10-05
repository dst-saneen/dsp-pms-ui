export const ACTIVE_EMPLOYEE_ASSET_INCLUDE = {
  where: {
    status: 'ASSIGNED',
    returnedDate: null,
  },
  take: 1,
} as const;
