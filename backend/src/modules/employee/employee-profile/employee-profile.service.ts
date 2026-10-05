import { Injectable } from '@nestjs/common';

@Injectable()
export class EmployeeProfileService {
  getProfile(employeeId: string) {
    return {
      employeeId,

      overview: null,

      employment: null,

      documents: null,

      onboarding: null,

      leave: null,

      assets: null,

      activity: null,
    };
  }
}
