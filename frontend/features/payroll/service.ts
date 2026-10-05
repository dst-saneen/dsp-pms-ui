import { API_ENDPOINTS } from "@/config/api";
import { apiClient, unwrapApiData } from "@/services/api-client";
import type { ApiResponse } from "@/types/api";

import type {
  CreatePayrollAdjustmentInput,
  CreatePayrollRunInput,
  CreateSalaryComponentInput,
  ArchiveRecurringDeductionInput,
  CreateRecurringDeductionInput,
  CreateSalaryRevisionInput,
  CreateTaxProfileInput,
  EndSalaryRevisionInput,
  EndTaxProfileInput,
  MarkPayrollPaidInput,
  RecurringDeduction,
  TaxProfile,
  PaginatedResponse,
  PayrollAdjustment,
  PayrollDashboard,
  PayrollPreflight,
  PayrollRun,
  PayrollRunEmployee,
  PayrollRunFilters,
  PayrollRunHistoryEntry,
  PayrollPayslipOperation,
  Payslip,
  SalaryComponent,
  SalaryRevision,
  UpdateSalaryComponentInput,
  VersionedCommandInput,
} from "./types";

export class PayrollService {
  static async getDashboard() {
    const response = await apiClient.get<ApiResponse<PayrollDashboard>>(
      API_ENDPOINTS.payroll.dashboard
    );
    return unwrapApiData(response.data);
  }

  static async getPreflight(year: number, month: number) {
    const response = await apiClient.get<ApiResponse<PayrollPreflight>>(
      API_ENDPOINTS.payroll.preflight,
      { params: { year, month } }
    );
    return unwrapApiData(response.data);
  }

  static async listRuns(filters?: PayrollRunFilters) {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<PayrollRun>>>(
      API_ENDPOINTS.payroll.runs,
      { params: filters }
    );
    return unwrapApiData(response.data);
  }

  static async getRun(id: string) {
    const response = await apiClient.get<ApiResponse<PayrollRun>>(
      `${API_ENDPOINTS.payroll.runs}/${id}`
    );
    return unwrapApiData(response.data);
  }

  static async createRun(dto: CreatePayrollRunInput) {
    const response = await apiClient.post<ApiResponse<PayrollRun>>(API_ENDPOINTS.payroll.runs, dto);
    return unwrapApiData(response.data);
  }

  static async listRunEmployees(id: string) {
    const response = await apiClient.get<ApiResponse<PayrollRunEmployee[]>>(
      `${API_ENDPOINTS.payroll.runs}/${id}/employees`
    );
    const data = unwrapApiData(response.data);
    return Array.isArray(data) ? data : [];
  }

  static async getRunEmployee(runId: string, employeeId: string) {
    const response = await apiClient.get<ApiResponse<PayrollRunEmployee>>(
      `${API_ENDPOINTS.payroll.runs}/${runId}/employees/${employeeId}`
    );
    return unwrapApiData(response.data);
  }

  static async getRunHistory(id: string) {
    const response = await apiClient.get<ApiResponse<PayrollRunHistoryEntry[]>>(
      `${API_ENDPOINTS.payroll.runs}/${id}/history`
    );
    const data = unwrapApiData(response.data);
    return Array.isArray(data) ? data : [];
  }

  static async downloadRegisterCsv(id: string) {
    const response = await apiClient.get<string>(
      `${API_ENDPOINTS.payroll.runs}/${id}/register.csv`,
      { responseType: "text" }
    );
    const csv = typeof response.data === "string" ? response.data : String(response.data);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `payroll-register-${id}.csv`;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
    return csv;
  }

  static async calculateRun(id: string, dto: VersionedCommandInput) {
    const response = await apiClient.post<ApiResponse<PayrollRun>>(
      `${API_ENDPOINTS.payroll.runs}/${id}/calculate`,
      dto
    );
    return unwrapApiData(response.data);
  }

  static async returnRunToDraft(id: string, dto: VersionedCommandInput) {
    const response = await apiClient.post<ApiResponse<PayrollRun>>(
      `${API_ENDPOINTS.payroll.runs}/${id}/return-to-draft`,
      dto
    );
    return unwrapApiData(response.data);
  }

  static async approveRun(id: string, dto: VersionedCommandInput) {
    const response = await apiClient.post<ApiResponse<PayrollRun>>(
      `${API_ENDPOINTS.payroll.runs}/${id}/approve`,
      dto
    );
    return unwrapApiData(response.data);
  }

  static async markRunPaid(id: string, dto: MarkPayrollPaidInput) {
    const response = await apiClient.post<ApiResponse<PayrollRun>>(
      `${API_ENDPOINTS.payroll.runs}/${id}/mark-paid`,
      dto
    );
    return unwrapApiData(response.data);
  }

  static async cancelRun(id: string, dto: VersionedCommandInput) {
    const response = await apiClient.post<ApiResponse<PayrollRun>>(
      `${API_ENDPOINTS.payroll.runs}/${id}/cancel`,
      dto
    );
    return unwrapApiData(response.data);
  }

  static async createAdjustment(runId: string, dto: CreatePayrollAdjustmentInput) {
    const response = await apiClient.post<ApiResponse<PayrollAdjustment>>(
      `${API_ENDPOINTS.payroll.runs}/${runId}/adjustments`,
      dto
    );
    return unwrapApiData(response.data);
  }

  static async listSalaryComponents(params?: { keyword?: string; page?: number; limit?: number }) {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<SalaryComponent>>>(
      API_ENDPOINTS.payroll.salaryComponents,
      { params }
    );
    return unwrapApiData(response.data);
  }

  static async createSalaryComponent(dto: CreateSalaryComponentInput) {
    const response = await apiClient.post<ApiResponse<SalaryComponent>>(
      API_ENDPOINTS.payroll.salaryComponents,
      dto
    );
    return unwrapApiData(response.data);
  }

  static async updateSalaryComponent(id: string, dto: UpdateSalaryComponentInput) {
    const response = await apiClient.patch<ApiResponse<SalaryComponent>>(
      `${API_ENDPOINTS.payroll.salaryComponents}/${id}`,
      dto
    );
    return unwrapApiData(response.data);
  }

  static async archiveSalaryComponent(id: string, dto: VersionedCommandInput) {
    const response = await apiClient.post<ApiResponse<SalaryComponent>>(
      `${API_ENDPOINTS.payroll.salaryComponents}/${id}/archive`,
      dto
    );
    return unwrapApiData(response.data);
  }

  static async listSalaryRevisions(employeeId: string) {
    const response = await apiClient.get<ApiResponse<SalaryRevision[]>>(
      API_ENDPOINTS.payroll.employeeSalaryRevisions(employeeId)
    );
    const data = unwrapApiData(response.data);
    return Array.isArray(data) ? data : [];
  }

  static async createSalaryRevision(employeeId: string, dto: CreateSalaryRevisionInput) {
    const response = await apiClient.post<ApiResponse<SalaryRevision>>(
      API_ENDPOINTS.payroll.employeeSalaryRevisions(employeeId),
      dto
    );
    return unwrapApiData(response.data);
  }

  static async endSalaryRevision(
    employeeId: string,
    revisionId: string,
    dto: EndSalaryRevisionInput
  ) {
    const response = await apiClient.post<ApiResponse<SalaryRevision>>(
      `${API_ENDPOINTS.payroll.employeeSalaryRevisions(employeeId)}/${revisionId}/end`,
      dto
    );
    return unwrapApiData(response.data);
  }

  static async listTaxProfiles(employeeId: string) {
    const response = await apiClient.get<ApiResponse<TaxProfile[]>>(
      API_ENDPOINTS.payroll.employeeTaxProfiles(employeeId)
    );
    const data = unwrapApiData(response.data);
    return Array.isArray(data) ? data : [];
  }

  static async createTaxProfile(employeeId: string, dto: CreateTaxProfileInput) {
    const response = await apiClient.post<ApiResponse<TaxProfile>>(
      API_ENDPOINTS.payroll.employeeTaxProfiles(employeeId),
      dto
    );
    return unwrapApiData(response.data);
  }

  static async endTaxProfile(employeeId: string, profileId: string, dto: EndTaxProfileInput) {
    const response = await apiClient.post<ApiResponse<TaxProfile>>(
      `${API_ENDPOINTS.payroll.employeeTaxProfiles(employeeId)}/${profileId}/end`,
      dto
    );
    return unwrapApiData(response.data);
  }

  static async listDeductions(employeeId: string) {
    const response = await apiClient.get<ApiResponse<RecurringDeduction[]>>(
      API_ENDPOINTS.payroll.employeeDeductions(employeeId)
    );
    const data = unwrapApiData(response.data);
    return Array.isArray(data) ? data : [];
  }

  static async createDeduction(employeeId: string, dto: CreateRecurringDeductionInput) {
    const response = await apiClient.post<ApiResponse<RecurringDeduction>>(
      API_ENDPOINTS.payroll.employeeDeductions(employeeId),
      dto
    );
    return unwrapApiData(response.data);
  }

  static async archiveDeduction(
    employeeId: string,
    deductionId: string,
    dto: ArchiveRecurringDeductionInput
  ) {
    const response = await apiClient.post<ApiResponse<RecurringDeduction>>(
      `${API_ENDPOINTS.payroll.employeeDeductions(employeeId)}/${deductionId}/archive`,
      dto
    );
    return unwrapApiData(response.data);
  }

  static async listPayslips() {
    const response = await apiClient.get<ApiResponse<Payslip[]>>(API_ENDPOINTS.me.payslips);
    const data = unwrapApiData(response.data);
    return Array.isArray(data) ? data : [];
  }

  static async listPayslipOperations() {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<PayrollPayslipOperation>>>(
      API_ENDPOINTS.payroll.payslipOperations
    );
    return unwrapApiData(response.data);
  }

  static async retryPayslip(id: string, dto: VersionedCommandInput & { reason: string }) {
    const response = await apiClient.post<ApiResponse<PayrollPayslipOperation>>(
      `${API_ENDPOINTS.payroll.payslips}/${id}/retry`,
      dto
    );
    return unwrapApiData(response.data);
  }

  static async requestPayslipDownload(id: string) {
    const response = await apiClient.post<ApiResponse<{ downloadUrl: string; expiresAt: string }>>(
      `${API_ENDPOINTS.me.payslips}/${id}/download-grant`
    );
    return unwrapApiData(response.data);
  }
}
