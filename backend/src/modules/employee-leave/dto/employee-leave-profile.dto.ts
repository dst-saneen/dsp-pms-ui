import { EmployeeLeaveBalanceDto } from './employee-leave-balance.dto';
import { EmployeeLeaveHistoryDto } from './employee-leave-history.dto';
import { EmployeeLeaveSummaryDto } from './employee-leave-summary.dto';
import { EmployeeUpcomingLeaveDto } from './employee-upcoming-leave.dto';

export class EmployeeLeaveProfileDto {
  summary!: EmployeeLeaveSummaryDto;

  balances!: EmployeeLeaveBalanceDto[];

  upcoming!: EmployeeUpcomingLeaveDto[];

  history!: EmployeeLeaveHistoryDto[];
}
