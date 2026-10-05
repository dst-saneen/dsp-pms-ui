"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getApiErrorMessage } from "@/services/api-client";

import { PayrollService } from "./service";
import type {
  ArchiveRecurringDeductionInput,
  CreatePayrollAdjustmentInput,
  CreatePayrollRunInput,
  CreateRecurringDeductionInput,
  CreateSalaryComponentInput,
  CreateSalaryRevisionInput,
  CreateTaxProfileInput,
  EndSalaryRevisionInput,
  EndTaxProfileInput,
  MarkPayrollPaidInput,
  PayrollRun,
  PayrollRunFilters,
  UpdateSalaryComponentInput,
  VersionedCommandInput,
} from "./types";

export const payrollKeys = {
  all: ["payroll"] as const,
  dashboard: ["payroll", "dashboard"] as const,
  preflight: (year: number, month: number) => ["payroll", "preflight", year, month] as const,
  runs: ["payroll", "runs"] as const,
  run: (id: string) => ["payroll", "runs", id] as const,
  runEmployees: (id: string) => ["payroll", "runs", id, "employees"] as const,
  runEmployee: (runId: string, employeeId: string) =>
    ["payroll", "runs", runId, "employees", employeeId] as const,
  runHistory: (id: string) => ["payroll", "runs", id, "history"] as const,
  salaryComponents: ["payroll", "salary-components"] as const,
  salaryRevisions: (employeeId: string) => ["payroll", "salary-revisions", employeeId] as const,
  taxProfiles: (employeeId: string) => ["payroll", "tax-profiles", employeeId] as const,
  deductions: (employeeId: string) => ["payroll", "deductions", employeeId] as const,
  payslips: ["me", "payslips"] as const,
  payslipOperations: ["payroll", "payslip-operations"] as const,
};

function usePayrollMutation<TInput, TOutput>(
  mutationFn: (input: TInput) => Promise<TOutput>,
  successMessage: string,
  errorMessage: string,
  invalidateKeys: readonly unknown[] = payrollKeys.all
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: invalidateKeys });
      toast.success(successMessage);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, errorMessage)),
  });
}

export function usePayrollDashboard() {
  return useQuery({
    queryKey: payrollKeys.dashboard,
    queryFn: () => PayrollService.getDashboard(),
  });
}

export function usePayrollPreflight(year: number, month: number, enabled = true) {
  return useQuery({
    queryKey: payrollKeys.preflight(year, month),
    queryFn: () => PayrollService.getPreflight(year, month),
    enabled,
  });
}

export function usePayrollRuns(filters?: PayrollRunFilters) {
  return useQuery({
    queryKey: [...payrollKeys.runs, filters ?? {}],
    queryFn: () => PayrollService.listRuns(filters),
  });
}

export function usePayrollRun(id: string, enabled = true) {
  return useQuery({
    queryKey: payrollKeys.run(id),
    queryFn: () => PayrollService.getRun(id),
    enabled: Boolean(id) && enabled,
  });
}

export function usePayrollRunEmployees(id: string, enabled = true) {
  return useQuery({
    queryKey: payrollKeys.runEmployees(id),
    queryFn: () => PayrollService.listRunEmployees(id),
    enabled: Boolean(id) && enabled,
  });
}

export function usePayrollRunEmployee(runId: string, employeeId: string, enabled = true) {
  return useQuery({
    queryKey: payrollKeys.runEmployee(runId, employeeId),
    queryFn: () => PayrollService.getRunEmployee(runId, employeeId),
    enabled: Boolean(runId) && Boolean(employeeId) && enabled,
  });
}

export function usePayrollRunHistory(id: string, enabled = true) {
  return useQuery({
    queryKey: payrollKeys.runHistory(id),
    queryFn: () => PayrollService.getRunHistory(id),
    enabled: Boolean(id) && enabled,
  });
}

export function useCreatePayrollRun() {
  return usePayrollMutation<CreatePayrollRunInput, PayrollRun>(
    (input: CreatePayrollRunInput) => PayrollService.createRun(input),
    "Payroll run created.",
    "Unable to create payroll run.",
    payrollKeys.runs
  );
}

export function useCalculatePayrollRun() {
  return usePayrollMutation(
    ({ id, data }: { id: string; data: VersionedCommandInput }) =>
      PayrollService.calculateRun(id, data),
    "Payroll run calculated.",
    "Unable to calculate payroll run.",
    payrollKeys.all
  );
}

export function useReturnPayrollRunToDraft() {
  return usePayrollMutation(
    ({ id, data }: { id: string; data: VersionedCommandInput }) =>
      PayrollService.returnRunToDraft(id, data),
    "Payroll run returned to draft.",
    "Unable to return payroll run to draft.",
    payrollKeys.all
  );
}

export function useApprovePayrollRun() {
  return usePayrollMutation(
    ({ id, data }: { id: string; data: VersionedCommandInput }) =>
      PayrollService.approveRun(id, data),
    "Payroll run approved.",
    "Unable to approve payroll run.",
    payrollKeys.all
  );
}

export function useMarkPayrollRunPaid() {
  return usePayrollMutation(
    ({ id, data }: { id: string; data: MarkPayrollPaidInput }) =>
      PayrollService.markRunPaid(id, data),
    "Payroll run marked paid.",
    "Unable to mark payroll run paid.",
    payrollKeys.all
  );
}

export function useCancelPayrollRun() {
  return usePayrollMutation(
    ({ id, data }: { id: string; data: VersionedCommandInput }) =>
      PayrollService.cancelRun(id, data),
    "Payroll run cancelled.",
    "Unable to cancel payroll run.",
    payrollKeys.all
  );
}

export function useCreatePayrollAdjustment() {
  return usePayrollMutation(
    ({ runId, data }: { runId: string; data: CreatePayrollAdjustmentInput }) =>
      PayrollService.createAdjustment(runId, data),
    "Adjustment added.",
    "Unable to add adjustment.",
    payrollKeys.all
  );
}

export function useSalaryComponents(params?: { keyword?: string }) {
  return useQuery({
    queryKey: [...payrollKeys.salaryComponents, params ?? {}],
    queryFn: () => PayrollService.listSalaryComponents(params),
  });
}

export function useCreateSalaryComponent() {
  return usePayrollMutation(
    (input: CreateSalaryComponentInput) => PayrollService.createSalaryComponent(input),
    "Salary component created.",
    "Unable to create salary component.",
    payrollKeys.salaryComponents
  );
}

export function useUpdateSalaryComponent() {
  return usePayrollMutation(
    ({ id, data }: { id: string; data: UpdateSalaryComponentInput }) =>
      PayrollService.updateSalaryComponent(id, data),
    "Salary component updated.",
    "Unable to update salary component.",
    payrollKeys.salaryComponents
  );
}

export function useSalaryRevisions(employeeId: string, enabled = true) {
  return useQuery({
    queryKey: payrollKeys.salaryRevisions(employeeId),
    queryFn: () => PayrollService.listSalaryRevisions(employeeId),
    enabled: Boolean(employeeId) && enabled,
  });
}

export function useCreateSalaryRevision() {
  return usePayrollMutation(
    ({ employeeId, data }: { employeeId: string; data: CreateSalaryRevisionInput }) =>
      PayrollService.createSalaryRevision(employeeId, data),
    "Salary revision created.",
    "Unable to create salary revision.",
    payrollKeys.all
  );
}

export function useEndSalaryRevision() {
  return usePayrollMutation(
    ({
      employeeId,
      revisionId,
      data,
    }: {
      employeeId: string;
      revisionId: string;
      data: EndSalaryRevisionInput;
    }) => PayrollService.endSalaryRevision(employeeId, revisionId, data),
    "Salary revision ended. You can create a new one.",
    "Unable to end salary revision.",
    payrollKeys.all
  );
}

export function useTaxProfiles(employeeId: string, enabled = true) {
  return useQuery({
    queryKey: payrollKeys.taxProfiles(employeeId),
    queryFn: () => PayrollService.listTaxProfiles(employeeId),
    enabled: Boolean(employeeId) && enabled,
  });
}

export function useCreateTaxProfile() {
  return usePayrollMutation(
    ({ employeeId, data }: { employeeId: string; data: CreateTaxProfileInput }) =>
      PayrollService.createTaxProfile(employeeId, data),
    "Tax profile created.",
    "Unable to create tax profile.",
    payrollKeys.all
  );
}

export function useEndTaxProfile() {
  return usePayrollMutation(
    ({
      employeeId,
      profileId,
      data,
    }: {
      employeeId: string;
      profileId: string;
      data: EndTaxProfileInput;
    }) => PayrollService.endTaxProfile(employeeId, profileId, data),
    "Tax profile ended.",
    "Unable to end tax profile.",
    payrollKeys.all
  );
}

export function useRecurringDeductions(employeeId: string, enabled = true) {
  return useQuery({
    queryKey: payrollKeys.deductions(employeeId),
    queryFn: () => PayrollService.listDeductions(employeeId),
    enabled: Boolean(employeeId) && enabled,
  });
}

export function useCreateRecurringDeduction() {
  return usePayrollMutation(
    ({ employeeId, data }: { employeeId: string; data: CreateRecurringDeductionInput }) =>
      PayrollService.createDeduction(employeeId, data),
    "Recurring deduction created.",
    "Unable to create recurring deduction.",
    payrollKeys.all
  );
}

export function useArchiveRecurringDeduction() {
  return usePayrollMutation(
    ({
      employeeId,
      deductionId,
      data,
    }: {
      employeeId: string;
      deductionId: string;
      data: ArchiveRecurringDeductionInput;
    }) => PayrollService.archiveDeduction(employeeId, deductionId, data),
    "Recurring deduction archived.",
    "Unable to archive recurring deduction.",
    payrollKeys.all
  );
}

export function useMyPayslips(enabled = true) {
  return useQuery({
    queryKey: payrollKeys.payslips,
    queryFn: () => PayrollService.listPayslips(),
    enabled,
  });
}

export function usePayrollPayslipOperations(enabled = true) {
  return useQuery({
    queryKey: payrollKeys.payslipOperations,
    queryFn: () => PayrollService.listPayslipOperations(),
    enabled,
  });
}

export function useRetryPayrollPayslip() {
  return usePayrollMutation(
    ({ id, data }: { id: string; data: VersionedCommandInput & { reason: string } }) =>
      PayrollService.retryPayslip(id, data),
    "Payslip generation queued for retry.",
    "Unable to retry payslip generation.",
    payrollKeys.payslipOperations
  );
}

export function usePayslipDownloadGrant() {
  return useMutation({
    mutationFn: (id: string) => PayrollService.requestPayslipDownload(id),
    onError: (error) => toast.error(getApiErrorMessage(error, "Unable to download payslip.")),
  });
}
