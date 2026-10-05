import type { JobOpeningStatus } from "../../types/enums";
import type { JobOpeningCriterion } from "./job-opening-criterion";

export interface JobOpeningHeadcount {
  approved: number;
  used: number;
  reserved: number;
  remaining: number;
}

export interface JobOpeningAllowedActions {
  canEdit: boolean;
  canPublish: boolean;
  canHold: boolean;
  canReopen: boolean;
  canClose: boolean;
}

export interface JobOpening {
  id: string;
  openingCode: string;
  title: string;
  description?: string;
  status: JobOpeningStatus;
  version: number;
  companyGroupId: string;
  companyId: string;
  branchId: string;
  departmentId: string;
  designationId: string;
  companyCode?: string;
  companyGroupName?: string;
  companyName?: string;
  branchName?: string;
  departmentName?: string;
  designationName?: string;
  hiringManagerEmployeeId: string;
  hiringManagerName?: string;
  employmentType: string;
  location?: string;
  headcount: JobOpeningHeadcount;
  targetJoiningDate?: string;
  applicationDeadline: string;
  publishedAt?: string;
  criteria: JobOpeningCriterion[];
  allowedActions: JobOpeningAllowedActions;
  nextAction?: string;
  createdAt: string;
  updatedAt: string;
}
