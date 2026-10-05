import { apiClient } from "@/services/api-client";

import type { ApiResponse } from "@/types/api-response";
import type {
  LookupItem,
  CompanyLookup,
  CompanyGroupLookup,
  BranchLookup,
  DepartmentLookup,
  DesignationLookup,
} from "../types";

import type { Employee } from "@/features/employee/types/employee";

export const LookupService = {
  async getCompanies(): Promise<LookupItem[]> {
    const response =
      await apiClient.get<ApiResponse<CompanyLookup[]>>("/companies");

    return response.data.data.map((company) => ({
      id: company.id,
      code: company.companyCode,
      name: company.companyName,
    }));
  },

  async getCompanyGroups(): Promise<LookupItem[]> {
    const response =
      await apiClient.get<
        ApiResponse<CompanyGroupLookup[]>
      >("/company-groups");

    return response.data.data.map((group) => ({
      id: group.id,
      code: group.groupCode,
      name: group.groupName,
    }));
  },

  async getBranches(
    companyId?: string,
  ): Promise<LookupItem[]> {

    const response =
      await apiClient.get<ApiResponse<BranchLookup[]>>(
        "/branches",
        {
          params: companyId
            ? { companyId }
            : undefined,
        },
      );

    return response.data.data.map((branch) => ({
      id: branch.id,
      code: branch.branchCode,
      name: branch.branchName,
    }));
  },

  async getDepartments(
    branchId?: string,
    companyId?: string,
  ): Promise<LookupItem[]> {

    const response =
      await apiClient.get<ApiResponse<DepartmentLookup[]>>(
        "/departments",
        {
          params: {
            ...(branchId ? { branchId } : {}),
            ...(companyId ? { companyId } : {}),
          },
        },
      );

    return response.data.data.map((department) => {
      const branchLabel = department.branch
        ? ` (${department.branch.branchCode} - ${department.branch.branchName})`
        : "";
      return {
        id: department.id,
        code: department.departmentCode,
        name: `${department.departmentName}${branchLabel}`,
        branchId: department.branchId ?? department.branch?.id,
      };
    });
  },

  async getDesignations(
    companyId?: string,
  ): Promise<LookupItem[]> {
    const response =
      await apiClient.get<ApiResponse<DesignationLookup[]>>(
        "/designations",
        {
          params: companyId
            ? { companyId }
            : undefined,
        },
      );

    return response.data.data.map((designation) => ({
      id: designation.id,
      code: designation.designationCode,
      name: designation.designationName,
    }));
  },

  async getManagers(
    companyId?: string,
  ): Promise<LookupItem[]> {
    const response = await apiClient.get<
      ApiResponse<Employee[] | { items: Employee[] }>
    >("/employees", {
      params: {
        ...(companyId ? { companyId } : {}),
        isActive: "true",
        page: 1,
        limit: 100,
      },
    });

    const payload = response.data.data;
    const employees = Array.isArray(payload)
      ? payload
      : (payload?.items ?? []);

    return employees.map((employee) => ({
      id: employee.id,
      code: employee.employeeCode,
      name: `${employee.firstName} ${employee.lastName ?? ""}`.trim(),
    }));
  },
};