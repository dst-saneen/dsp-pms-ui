export class EmployeeLeaveHistoryDto {
  id!: string;

  leaveType!: string;

  fromDate!: Date;

  toDate!: Date;

  requestedDays!: number;

  approvedDays?: number;

  isHalfDay!: boolean;

  status!: string;

  createdAt!: Date;
}
