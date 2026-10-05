import type { JobApplicationSource } from "../../types/enums";

export interface Candidate {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  mobile?: string;
  primarySource: JobApplicationSource;
  employeeId?: string;
  applicationCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CandidateSearch {
  search?: string;
}
