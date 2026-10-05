export interface EmployeeActivityItem {
  id: string;

  title: string;

  description?: string;

  module: string;

  activityType: string;

  createdAt: string;

  createdBy?: string;
}