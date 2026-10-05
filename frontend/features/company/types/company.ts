export interface Company {
  id: string;

  companyGroupId?: string;

  companyCode: string;
  companyName: string;

  registrationNo?: string;
  taxNumber?: string;
  legalCountryCode?: string | null;

  parentCompanyId?: string;

  isActive: boolean;

  companyGroup?: {
    id: string;
    groupCode: string;
    groupName: string;
  };

  parentCompany?: {
    id: string;
    companyCode: string;
    companyName: string;
  };

  createdAt: string;
  updatedAt: string;
}

export interface CreateCompanyDto {
  companyGroupId?: string;

  companyName: string;

  registrationNo?: string;
  taxNumber?: string;
  legalCountryCode: string;

  parentCompanyId?: string;

  isActive?: boolean;
}

export type UpdateCompanyDto = Partial<CreateCompanyDto>;

export type CompanyModuleCode =
  | "ASSETS"
  | "DELIVERY"
  | "FILE_STORAGE"
  | "FINANCE"
  | "ONBOARDING"
  | "PAYROLL"
  | "PROJECTS"
  | "RECRUITMENT"
  | "RECRUITMENT_SHORTLIST";

export interface CompanyModuleEntitlement {
  module: CompanyModuleCode;
  isEnabled: boolean;
}

export interface CompanyModuleEntitlementsResponse {
  companyId: string;
  entitlements: CompanyModuleEntitlement[];
}

export interface UpdateCompanyModuleEntitlementsDto {
  entitlements: CompanyModuleEntitlement[];
}
