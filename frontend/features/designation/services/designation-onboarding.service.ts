import { apiClient } from "@/services/api-client";

export const DesignationOnboardingService = {
  async addDepartment(
    designationId: string,
    departmentId: string,
    branchId?: string,
  ) {
    const response = await apiClient.post(
      `/designations/${designationId}/departments`,
      {
        departmentId,
        ...(branchId ? { branchId } : {}),
      },
    );

    return response.data.data;
  },
};
