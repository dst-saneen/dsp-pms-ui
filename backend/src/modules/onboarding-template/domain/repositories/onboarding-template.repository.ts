import { OnboardingTemplate } from '../entities';

export interface OnboardingTemplateRepository {
  findById(id: string): Promise<OnboardingTemplate | null>;

  findByCode(
    companyId: string,
    templateCode: string,
  ): Promise<OnboardingTemplate | null>;

  save(entity: OnboardingTemplate): Promise<void>;

  delete(id: string): Promise<void>;
}
