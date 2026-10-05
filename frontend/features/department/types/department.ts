export interface Department {
  id: string;

  companyId: string;
  branchId: string;

  departmentCode: string;
  departmentName: string;

  isActive: boolean;

  createdAt: string;
  updatedAt: string;

  company?: {
    id: string;
    companyCode: string;
    companyName: string;
  };

  branch?: {
    id: string;
    branchCode: string;
    branchName: string;
  };
}

export interface CreateDepartmentDto {
  companyId: string;
  branchId: string;

  departmentName: string;
  isActive?: boolean;
}

export type UpdateDepartmentDto = Partial<CreateDepartmentDto>;

export interface DepartmentQuery {
  branchId?: string;
  search?: string;
}
