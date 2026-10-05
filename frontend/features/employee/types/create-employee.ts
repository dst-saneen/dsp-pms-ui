export interface CreateEmployee {
 
  companyId: string;

  branchId: string;

  departmentId: string;

  firstName: string;

  lastName?: string;

  email?: string;

  mobile?: string;

  designationId?: string;

  joiningDate?: string;

  employeeType?: string;

  managerId?: string;
}