import { Injectable } from '@nestjs/common';

@Injectable()
export class EmployeeWorkspaceActivityService {
  getRecentActivities(employeeId: string): Promise<never[]> {
    void employeeId;
    return Promise.resolve([]);
  }
}
