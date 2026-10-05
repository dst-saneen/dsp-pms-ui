export interface LookupItem {
  id: string;
  code?: string;
  name: string;
  branchId?: string;
}

export interface CompanyLookup {
  id: string;
  companyCode: string;
  companyName: string;
}

export interface CompanyGroupLookup {
  id: string;
  groupCode: string;
  groupName: string;
}

export interface BranchLookup {
  id: string;
  branchCode: string;
  branchName: string;
}

export interface DepartmentLookup {
  id: string;
  departmentCode: string;
  departmentName: string;
  branchId?: string;
  branch?: {
    id: string;
    branchCode: string;
    branchName: string;
  };
}

export interface DesignationLookup {
  id: string;
  designationCode: string;
  designationName: string;
}