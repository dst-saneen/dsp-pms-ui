export interface Branch {
  id: string;

  companyId: string;

  company?: {
    id: string;
    companyCode: string;
    companyName: string;
  };

  branchCode: string;
  branchName: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  countryCode?: string;
  countrySubdivisionCode?: string;
  timezone?: string;
  workingCalendarReviewedAt?: string | null;
  isActive: boolean;
}

export interface CreateBranchDto {
  companyId: string;

  branchName: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  countryCode: string;
  countrySubdivisionCode: string;
  timezone: string;
  isActive?: boolean;
}

export type UpdateBranchDto = Partial<CreateBranchDto>;
