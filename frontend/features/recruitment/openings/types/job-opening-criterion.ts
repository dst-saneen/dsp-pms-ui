export interface JobOpeningCriterion {
  id: string;
  name: string;
  description?: string;
  weightPercentage: number;
  displayOrder: number;
  isRequired: boolean;
  isActive: boolean;
}

export interface JobOpeningCriterionInput {
  id?: string;
  name: string;
  description?: string;
  weightPercentage: number;
  displayOrder: number;
  isRequired: boolean;
  isActive: boolean;
}
