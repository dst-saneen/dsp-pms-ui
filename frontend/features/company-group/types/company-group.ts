export interface CompanyGroup {
  id: string;

  groupCode: string;
  groupName: string;
  description?: string;

  isActive: boolean;

  createdAt: string;
  updatedAt: string;
}

export interface CreateCompanyGroupDto {
  groupName: string;
  description?: string;

  isActive?: boolean;
}

export type UpdateCompanyGroupDto = Partial<CreateCompanyGroupDto>;
