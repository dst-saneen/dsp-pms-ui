import { API_ENDPOINTS } from "@/config/api";
import { apiClient, unwrapApiData } from "@/services/api-client";
import type { ApiResponse } from "@/types/api";

import type {
  BusinessParty,
  CreateBusinessPartyInput,
  CreateFinanceCategoryInput,
  CreateFinancePaymentAccountInput,
  CreateFinancePeriodInput,
  CreateFinanceTransactionInput,
  FinanceAccountMovementRow,
  FinanceCategory,
  FinanceDashboard,
  FinancePaymentAccount,
  FinancePeriod,
  FinanceReportFilters,
  FinanceReportGroupRow,
  FinanceReportSummary,
  FinanceSettings,
  FinanceTransaction,
  FinanceTransactionAttachment,
  FinanceTransactionFilters,
  FinanceTransactionHistoryEntry,
  FinanceAttachmentDownloadGrant,
  LinkFinanceAttachmentInput,
  PaginatedResponse,
  UpdateFinanceTransactionInput,
  UpdateFinancialProfileInput,
  VersionedCommandInput,
} from "./types";

export class OfficeFinanceService {
  static async getDashboard() {
    const response = await apiClient.get<ApiResponse<FinanceDashboard>>(
      API_ENDPOINTS.officeFinance.dashboard,
    );
    return unwrapApiData(response.data);
  }

  static async getSettings() {
    const response = await apiClient.get<ApiResponse<FinanceSettings>>(
      API_ENDPOINTS.officeFinance.settings,
    );
    return unwrapApiData(response.data);
  }

  static async updateSettings(dto: UpdateFinancialProfileInput) {
    const response = await apiClient.patch<ApiResponse<FinanceSettings>>(
      API_ENDPOINTS.officeFinance.settings,
      dto,
    );
    return unwrapApiData(response.data);
  }

  static async listTransactions(filters?: FinanceTransactionFilters) {
    const response = await apiClient.get<
      ApiResponse<PaginatedResponse<FinanceTransaction>>
    >(API_ENDPOINTS.officeFinance.transactions, { params: filters });
    return unwrapApiData(response.data);
  }

  static async getTransaction(id: string) {
    const response = await apiClient.get<ApiResponse<FinanceTransaction>>(
      `${API_ENDPOINTS.officeFinance.transactions}/${id}`,
    );
    return unwrapApiData(response.data);
  }

  static async getTransactionHistory(id: string) {
    const response = await apiClient.get<
      ApiResponse<FinanceTransactionHistoryEntry[]>
    >(`${API_ENDPOINTS.officeFinance.transactions}/${id}/history`);
    const data = unwrapApiData(response.data);
    return Array.isArray(data) ? data : [];
  }

  static async listAttachments(transactionId: string) {
    const response = await apiClient.get<
      ApiResponse<FinanceTransactionAttachment[]>
    >(`${API_ENDPOINTS.officeFinance.transactions}/${transactionId}/attachments`);
    const data = unwrapApiData(response.data);
    return Array.isArray(data) ? data : [];
  }

  static async createUploadSession(
    transactionId: string,
    dto: {
      fileName: string;
      declaredMimeType: string;
      sizeBytes: number;
      checksumSha256: string;
      operationId: string;
    },
  ) {
    const response = await apiClient.post(
      `${API_ENDPOINTS.officeFinance.transactions}/${transactionId}/upload-sessions`,
      dto,
    );
    return unwrapApiData(response.data);
  }

  static async finalizeUploadSession(
    transactionId: string,
    sessionId: string,
    sessionToken?: string,
  ) {
    const response = await apiClient.post(
      `${API_ENDPOINTS.officeFinance.transactions}/${transactionId}/upload-sessions/${sessionId}/finalize`,
      {},
      {
        headers: sessionToken
          ? { "X-File-Session-Token": sessionToken }
          : undefined,
      },
    );
    return unwrapApiData(response.data);
  }

  static async getUploadSession(
    transactionId: string,
    sessionId: string,
    sessionToken?: string,
  ) {
    const response = await apiClient.get(
      `${API_ENDPOINTS.officeFinance.transactions}/${transactionId}/upload-sessions/${sessionId}`,
      {
        headers: sessionToken
          ? { "X-File-Session-Token": sessionToken }
          : undefined,
      },
    );
    return unwrapApiData(response.data);
  }

  static async linkAttachment(transactionId: string, dto: LinkFinanceAttachmentInput) {
    const response = await apiClient.post<ApiResponse<FinanceTransactionAttachment>>(
      `${API_ENDPOINTS.officeFinance.transactions}/${transactionId}/attachments`,
      dto,
    );
    return unwrapApiData(response.data);
  }

  static async createAttachmentDownloadGrant(
    transactionId: string,
    attachmentId: string,
  ) {
    const response = await apiClient.post<
      ApiResponse<FinanceAttachmentDownloadGrant>
    >(
      `${API_ENDPOINTS.officeFinance.transactions}/${transactionId}/attachments/${attachmentId}/download-grant`,
    );
    return unwrapApiData(response.data);
  }

  static async createTransaction(dto: CreateFinanceTransactionInput) {
    const response = await apiClient.post<ApiResponse<FinanceTransaction>>(
      API_ENDPOINTS.officeFinance.transactions,
      dto,
    );
    return unwrapApiData(response.data);
  }

  static async updateTransaction(id: string, dto: UpdateFinanceTransactionInput) {
    const response = await apiClient.patch<ApiResponse<FinanceTransaction>>(
      `${API_ENDPOINTS.officeFinance.transactions}/${id}`,
      dto,
    );
    return unwrapApiData(response.data);
  }

  static async submitTransaction(id: string, dto: VersionedCommandInput) {
    const response = await apiClient.post<ApiResponse<FinanceTransaction>>(
      `${API_ENDPOINTS.officeFinance.transactions}/${id}/submit`,
      dto,
    );
    return unwrapApiData(response.data);
  }

  static async approveTransaction(id: string, dto: VersionedCommandInput) {
    const response = await apiClient.post<ApiResponse<FinanceTransaction>>(
      `${API_ENDPOINTS.officeFinance.transactions}/${id}/approve`,
      dto,
    );
    return unwrapApiData(response.data);
  }

  static async returnTransaction(id: string, dto: VersionedCommandInput) {
    const response = await apiClient.post<ApiResponse<FinanceTransaction>>(
      `${API_ENDPOINTS.officeFinance.transactions}/${id}/return`,
      dto,
    );
    return unwrapApiData(response.data);
  }

  static async cancelTransaction(id: string, dto: VersionedCommandInput) {
    const response = await apiClient.post<ApiResponse<FinanceTransaction>>(
      `${API_ENDPOINTS.officeFinance.transactions}/${id}/cancel`,
      dto,
    );
    return unwrapApiData(response.data);
  }

  static async reverseTransaction(id: string, dto: VersionedCommandInput) {
    const response = await apiClient.post<ApiResponse<FinanceTransaction>>(
      `${API_ENDPOINTS.officeFinance.transactions}/${id}/reverse`,
      dto,
    );
    return unwrapApiData(response.data);
  }

  static async listBusinessParties(params?: { keyword?: string; page?: number; limit?: number }) {
    const response = await apiClient.get<
      ApiResponse<PaginatedResponse<BusinessParty>>
    >(API_ENDPOINTS.businessParties.list, { params });
    return unwrapApiData(response.data);
  }

  static async createBusinessParty(dto: CreateBusinessPartyInput) {
    const response = await apiClient.post<ApiResponse<BusinessParty>>(
      API_ENDPOINTS.businessParties.list,
      dto,
    );
    return unwrapApiData(response.data);
  }

  static async archiveBusinessParty(id: string, dto: VersionedCommandInput) {
    const response = await apiClient.post<ApiResponse<BusinessParty>>(
      `${API_ENDPOINTS.businessParties.list}/${id}/archive`,
      dto,
    );
    return unwrapApiData(response.data);
  }

  static async reactivateBusinessParty(id: string, dto: VersionedCommandInput) {
    const response = await apiClient.post<ApiResponse<BusinessParty>>(
      `${API_ENDPOINTS.businessParties.list}/${id}/reactivate`,
      dto,
    );
    return unwrapApiData(response.data);
  }

  static async listCategories(params?: { keyword?: string; page?: number; limit?: number }) {
    const response = await apiClient.get<
      ApiResponse<PaginatedResponse<FinanceCategory>>
    >(API_ENDPOINTS.officeFinance.categories, { params });
    return unwrapApiData(response.data);
  }

  static async createCategory(dto: CreateFinanceCategoryInput) {
    const response = await apiClient.post<ApiResponse<FinanceCategory>>(
      API_ENDPOINTS.officeFinance.categories,
      dto,
    );
    return unwrapApiData(response.data);
  }

  static async archiveCategory(id: string, dto: VersionedCommandInput) {
    const response = await apiClient.post<ApiResponse<FinanceCategory>>(
      `${API_ENDPOINTS.officeFinance.categories}/${id}/archive`,
      dto,
    );
    return unwrapApiData(response.data);
  }

  static async reactivateCategory(id: string, dto: VersionedCommandInput) {
    const response = await apiClient.post<ApiResponse<FinanceCategory>>(
      `${API_ENDPOINTS.officeFinance.categories}/${id}/reactivate`,
      dto,
    );
    return unwrapApiData(response.data);
  }

  static async listPaymentAccounts(params?: { keyword?: string; page?: number; limit?: number }) {
    const response = await apiClient.get<
      ApiResponse<PaginatedResponse<FinancePaymentAccount>>
    >(API_ENDPOINTS.officeFinance.paymentAccounts, { params });
    return unwrapApiData(response.data);
  }

  static async createPaymentAccount(dto: CreateFinancePaymentAccountInput) {
    const response = await apiClient.post<ApiResponse<FinancePaymentAccount>>(
      API_ENDPOINTS.officeFinance.paymentAccounts,
      dto,
    );
    return unwrapApiData(response.data);
  }

  static async getPaymentAccountBalance(id: string) {
    const response = await apiClient.get<
      ApiResponse<{ accountId: string; projectedBalance: string; asOf: string }>
    >(`${API_ENDPOINTS.officeFinance.paymentAccounts}/${id}/balance`);
    return unwrapApiData(response.data);
  }

  static async listPeriods() {
    const response = await apiClient.get<ApiResponse<FinancePeriod[]>>(
      API_ENDPOINTS.officeFinance.periods,
    );
    const data = unwrapApiData(response.data);
    return Array.isArray(data) ? data : [];
  }

  static async createPeriod(dto: CreateFinancePeriodInput) {
    const response = await apiClient.post<ApiResponse<FinancePeriod>>(
      API_ENDPOINTS.officeFinance.periods,
      dto,
    );
    return unwrapApiData(response.data);
  }

  static async lockPeriod(id: string, dto: VersionedCommandInput) {
    const response = await apiClient.post<ApiResponse<FinancePeriod>>(
      `${API_ENDPOINTS.officeFinance.periods}/${id}/lock`,
      dto,
    );
    return unwrapApiData(response.data);
  }

  static async reopenPeriod(id: string, dto: VersionedCommandInput) {
    const response = await apiClient.post<ApiResponse<FinancePeriod>>(
      `${API_ENDPOINTS.officeFinance.periods}/${id}/reopen`,
      dto,
    );
    return unwrapApiData(response.data);
  }

  static async accountBalanceReport() {
    const accounts = await this.listPaymentAccounts({ limit: 100 });
    return Promise.all(
      accounts.items.map(async (account) => {
        const balance = await this.getPaymentAccountBalance(account.id);
        return {
          accountId: account.id,
          accountCode: account.accountCode,
          accountName: account.accountName,
          accountType: account.accountType,
          currencyCode: account.currencyCode,
          projectedBalance: balance.projectedBalance,
          asOf: balance.asOf,
        };
      }),
    );
  }

  static async incomeExpenseReport(filters?: FinanceReportFilters) {
    const response = await apiClient.get<ApiResponse<FinanceReportSummary>>(
      API_ENDPOINTS.officeFinance.reports.incomeExpense,
      { params: filters },
    );
    return unwrapApiData(response.data);
  }

  static async byCategoryReport(filters?: FinanceReportFilters) {
    const response = await apiClient.get<ApiResponse<FinanceReportGroupRow[]>>(
      API_ENDPOINTS.officeFinance.reports.byCategory,
      { params: filters },
    );
    const data = unwrapApiData(response.data);
    return Array.isArray(data) ? data : [];
  }

  static async byDepartmentReport(filters?: FinanceReportFilters) {
    const response = await apiClient.get<ApiResponse<FinanceReportGroupRow[]>>(
      API_ENDPOINTS.officeFinance.reports.byDepartment,
      { params: filters },
    );
    const data = unwrapApiData(response.data);
    return Array.isArray(data) ? data : [];
  }

  static async byProjectReport(filters?: FinanceReportFilters) {
    const response = await apiClient.get<ApiResponse<FinanceReportGroupRow[]>>(
      API_ENDPOINTS.officeFinance.reports.byProject,
      { params: filters },
    );
    const data = unwrapApiData(response.data);
    return Array.isArray(data) ? data : [];
  }

  static async exportCsv(filters?: FinanceReportFilters) {
    const response = await apiClient.get(
      API_ENDPOINTS.officeFinance.reports.exportCsv,
      { params: filters, responseType: "blob" },
    );
    const blob = new Blob([response.data], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "office-finance-export.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  static async accountMovementsReport(filters?: FinanceReportFilters) {
    const response = await apiClient.get<ApiResponse<FinanceAccountMovementRow[]>>(
      API_ENDPOINTS.officeFinance.reports.accountMovements,
      { params: filters },
    );
    const data = unwrapApiData(response.data);
    return Array.isArray(data) ? data : [];
  }
}
