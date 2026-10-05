import { OnboardingDepartment } from '../entities';

export interface OnboardingDepartmentRepository {
  findById(id: string): Promise<OnboardingDepartment | null>;

  findByTemplate(templateId: string): Promise<OnboardingDepartment[]>;

  save(entity: OnboardingDepartment): Promise<void>;

  delete(id: string): Promise<void>;
}
