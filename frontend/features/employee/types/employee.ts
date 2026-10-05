export interface Employee {
  id: string;

  employeeCode: string;

  firstName: string;
  lastName: string;

  email?: string;
  mobile?: string;

  companyId: string;
  branchId: string;
  departmentId: string;

  designationId?: string;
  managerId?: string;

  joiningDate?: string;
  employeeType?: string;

  employmentStatus: string;
  isActive: boolean;

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

  department?: {
    id: string;
    departmentCode: string;
    departmentName: string;
  };

  designation?: {
    id: string;
    designationCode: string;
    designationName: string;
  };

  manager?: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
  };

  /** Present when this employee already has a login account. */
  user?: {
    id: string;
    status: string;
    username?: string;
  } | null;
}