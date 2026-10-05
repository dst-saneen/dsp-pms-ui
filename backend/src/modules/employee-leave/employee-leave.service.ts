import { Injectable } from '@nestjs/common';

import { EmployeeLeaveBalanceService } from '../employee-leave-balance/employee-leave-balance.service';
import { LeaveRequestService } from '../leave-request/leave-request.service';

import {
  EmployeeLeaveProfileDto,
  EmployeeLeaveSummaryDto,
  EmployeeLeaveBalanceDto,
  EmployeeLeaveHistoryDto,
  EmployeeUpcomingLeaveDto,
} from './dto';

@Injectable()
export class EmployeeLeaveService {
  constructor(
    private readonly employeeLeaveBalanceService: EmployeeLeaveBalanceService,
    private readonly leaveRequestService: LeaveRequestService,
  ) {}

  async getProfile(
    employeeId: string,
    year = new Date().getFullYear(),
  ): Promise<EmployeeLeaveProfileDto> {
    return {
      summary: await this.loadSummary(employeeId, year),
      balances: await this.loadBalances(employeeId, year),
      history: await this.loadHistory(employeeId),
      upcoming: await this.loadUpcoming(employeeId),
    };
  }

  async getSummary(
    employeeId: string,
    year = new Date().getFullYear(),
  ): Promise<EmployeeLeaveSummaryDto> {
    return this.loadSummary(employeeId, year);
  }

  async getBalances(
    employeeId: string,
    year = new Date().getFullYear(),
  ): Promise<EmployeeLeaveBalanceDto[]> {
    return this.loadBalances(employeeId, year);
  }

  async getHistory(employeeId: string): Promise<EmployeeLeaveHistoryDto[]> {
    return this.loadHistory(employeeId);
  }

  async getUpcoming(employeeId: string): Promise<EmployeeUpcomingLeaveDto[]> {
    return this.loadUpcoming(employeeId);
  }

  private async loadSummary(
    employeeId: string,
    year: number,
  ): Promise<EmployeeLeaveSummaryDto> {
    const summary =
      await this.employeeLeaveBalanceService.getEmployeeBalanceSummary(
        employeeId,
        year,
      );

    return {
      totalEntitlement: summary.totalEntitlement,
      totalUsed: summary.totalUsed,
      totalPending: summary.totalPending,
      totalBalance: summary.totalBalance,
    };
  }

  private async loadBalances(
    employeeId: string,
    year: number,
  ): Promise<EmployeeLeaveBalanceDto[]> {
    const balances = await this.employeeLeaveBalanceService.getEmployeeBalances(
      employeeId,
      year,
    );

    return balances.map((balance) => ({
      leaveTypeId: balance.leaveType.id,
      leaveCode: balance.leaveType.leaveCode,
      leaveName: balance.leaveType.leaveName,

      entitlement: Number(balance.entitlement),
      used: Number(balance.used),
      pending: Number(balance.pending),
      balance: Number(balance.balance),
    }));
  }

  private async loadHistory(
    employeeId: string,
  ): Promise<EmployeeLeaveHistoryDto[]> {
    const history =
      await this.leaveRequestService.getEmployeeLeaveHistory(employeeId);

    return history.map((request) => ({
      id: request.id,

      leaveType: request.leaveType.leaveName,

      fromDate: request.fromDate,
      toDate: request.toDate,

      requestedDays: Number(request.requestedDays),

      approvedDays: request.approvedDays
        ? Number(request.approvedDays)
        : undefined,

      isHalfDay: Boolean(request.isHalfDay),

      status: request.status,

      createdAt: request.createdAt,
    }));
  }

  private async loadUpcoming(
    employeeId: string,
  ): Promise<EmployeeUpcomingLeaveDto[]> {
    const upcoming =
      await this.leaveRequestService.getUpcomingLeave(employeeId);

    return upcoming.map((request) => ({
      id: request.id,

      leaveType: request.leaveType.leaveName,

      fromDate: request.fromDate,
      toDate: request.toDate,

      approvedDays: Number(request.approvedDays ?? request.requestedDays),

      isHalfDay: Boolean(request.isHalfDay),

      status: request.status,
    }));
  }
}
