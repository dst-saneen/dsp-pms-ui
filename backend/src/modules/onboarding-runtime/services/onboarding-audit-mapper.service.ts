import { Injectable } from '@nestjs/common';

@Injectable()
export class OnboardingAuditMapperService {
  redactReason(value: string | null | undefined): string | null {
    return value ?? null;
  }
}
