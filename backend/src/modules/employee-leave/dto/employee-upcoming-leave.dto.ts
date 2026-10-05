export class EmployeeUpcomingLeaveDto {
  id!: string;

  leaveType!: string;

  fromDate!: Date;

  toDate!: Date;

  approvedDays!: number;

  isHalfDay!: boolean;

  status!: string;
}
