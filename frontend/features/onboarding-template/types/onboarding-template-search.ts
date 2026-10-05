export interface OnboardingTemplateSearch {
  keyword?: string;

  includeInactive?: boolean;

  page?: number;

  limit?: number;

  sortBy?: string;

  sortOrder?: "ASC" | "DESC";
}