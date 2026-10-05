export interface Contribution {
  id: string;

  contributionCode: string;

  contributionName: string;

  description?: string;

  contributionType: string;

  isActive: boolean;

  createdAt: string;
  updatedAt: string;
}

export interface CreateContributionDto {
  contributionCode: string;

  contributionName: string;

  description?: string;

  contributionType: string;

  isActive?: boolean;
}

export type UpdateContributionDto = Partial<CreateContributionDto>;

export interface ContributionQuery {
  search?: string;

  contributionType?: string;

  isActive?: boolean;
}