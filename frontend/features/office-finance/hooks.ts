"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getApiErrorCode, getApiErrorMessage } from "@/services/api-client";

import { toFinanceSettingsView } from "./lib/settings-view";
import { OfficeFinanceService } from "./service";
import type {
  CreateBusinessPartyInput,
  CreateFinanceCategoryInput,
  CreateFinancePaymentAccountInput,
  CreateFinancePeriodInput,
  CreateFinanceTransactionInput,
  FinanceSettings,
  FinanceTransaction,
  FinanceTransactionAttachment,
  FinanceReportFilters,
  FinanceTransactionFilters,
  LinkFinanceAttachmentInput,
  UpdateFinanceTransactionInput,
  UpdateFinancialProfileInput,
  VersionedCommandInput,
} from "./types";

export const officeFinanceKeys = {
  all: ["office-finance"] as const,
  dashboard: ["office-finance", "dashboard"] as const,
  settings: ["office-finance", "settings"] as const,
  transactions: ["office-finance", "transactions"] as const,
  transaction: (id: string) => ["office-finance", "transactions", id] as const,
  transactionHistory: (id: string) => ["office-finance", "transactions", id, "history"] as const,
  transactionAttachments: (id: string) =>
    ["office-finance", "transactions", id, "attachments"] as const,
  businessParties: ["office-finance", "business-parties"] as const,
  categories: ["office-finance", "categories"] as const,
  paymentAccounts: ["office-finance", "payment-accounts"] as const,
  periods: ["office-finance", "periods"] as const,
  reports: ["office-finance", "reports"] as const,
};

function useOfficeFinanceMutation<TInput, TOutput>(
  mutationFn: (input: TInput) => Promise<TOutput>,
  successMessage: string,
  errorMessage: string,
  invalidateKeys: readonly unknown[] = officeFinanceKeys.all
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

export function useFinanceDashboard() {
  return useQuery({
    queryKey: officeFinanceKeys.dashboard,
    queryFn: () => OfficeFinanceService.getDashboard(),
  });
}

export function isProfileNotConfigured(error: unknown) {
  return getApiErrorCode(error) === "FINANCIAL_PROFILE_NOT_CONFIGURED";
}

export function useFinanceSettings() {
  return useQuery({
    queryKey: officeFinanceKeys.settings,
    queryFn: async () => {
      try {
        const data = await OfficeFinanceService.getSettings();
        return toFinanceSettingsView(data);
      } catch (error) {
        if (isProfileNotConfigured(error)) {
          return { profile: null };
        }
        throw error;
      }
    },
    retry: (failureCount, error) => {
      if (isProfileNotConfigured(error)) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

export function useUpdateFinancialProfile() {
  return useOfficeFinanceMutation<UpdateFinancialProfileInput, FinanceSettings>(
    (input: UpdateFinancialProfileInput) => OfficeFinanceService.updateSettings(input),
    "Financial profile updated.",
    "Unable to update financial profile.",
    officeFinanceKeys.settings
  );
}

export function useFinanceTransactions(filters?: FinanceTransactionFilters) {
  return useQuery({
    queryKey: [...officeFinanceKeys.transactions, filters ?? {}],
    queryFn: () => OfficeFinanceService.listTransactions(filters),
  });
}

export function useFinanceTransaction(id: string, enabled = true) {
  return useQuery({
    queryKey: officeFinanceKeys.transaction(id),
    queryFn: () => OfficeFinanceService.getTransaction(id),
    enabled: Boolean(id) && enabled,
  });
}

export function useFinanceTransactionHistory(id: string, enabled = true) {
  return useQuery({
    queryKey: officeFinanceKeys.transactionHistory(id),
    queryFn: () => OfficeFinanceService.getTransactionHistory(id),
    enabled: Boolean(id) && enabled,
  });
}

export function useFinanceTransactionAttachments(id: string, enabled = true) {
  return useQuery({
    queryKey: officeFinanceKeys.transactionAttachments(id),
    queryFn: () => OfficeFinanceService.listAttachments(id),
    enabled: Boolean(id) && enabled,
  });
}

export function useLinkFinanceAttachment() {
  return useOfficeFinanceMutation<
    { transactionId: string; data: LinkFinanceAttachmentInput },
    FinanceTransactionAttachment
  >(
    ({ transactionId, data }: { transactionId: string; data: LinkFinanceAttachmentInput }) =>
      OfficeFinanceService.linkAttachment(transactionId, data),
    "Attachment linked.",
    "Unable to link attachment.",
    officeFinanceKeys.all
  );
}

export function useCreateFinanceTransaction() {
  return useOfficeFinanceMutation<CreateFinanceTransactionInput, FinanceTransaction>(
    (input: CreateFinanceTransactionInput) => OfficeFinanceService.createTransaction(input),
    "Transaction created.",
    "Unable to create transaction.",
    officeFinanceKeys.transactions
  );
}

export function useUpdateFinanceTransaction() {
  return useOfficeFinanceMutation<
    { id: string; data: UpdateFinanceTransactionInput },
    FinanceTransaction
  >(
    ({ id, data }: { id: string; data: UpdateFinanceTransactionInput }) =>
      OfficeFinanceService.updateTransaction(id, data),
    "Transaction updated.",
    "Unable to update transaction.",
    officeFinanceKeys.transactions
  );
}

export function useSubmitFinanceTransaction() {
  return useOfficeFinanceMutation(
    ({ id, data }: { id: string; data: VersionedCommandInput }) =>
      OfficeFinanceService.submitTransaction(id, data),
    "Transaction submitted.",
    "Unable to submit transaction.",
    officeFinanceKeys.all
  );
}

export function useApproveFinanceTransaction() {
  return useOfficeFinanceMutation(
    ({ id, data }: { id: string; data: VersionedCommandInput }) =>
      OfficeFinanceService.approveTransaction(id, data),
    "Transaction approved.",
    "Unable to approve transaction.",
    officeFinanceKeys.all
  );
}

export function useReturnFinanceTransaction() {
  return useOfficeFinanceMutation(
    ({ id, data }: { id: string; data: VersionedCommandInput }) =>
      OfficeFinanceService.returnTransaction(id, data),
    "Transaction returned to draft.",
    "Unable to return transaction.",
    officeFinanceKeys.all
  );
}

export function useCancelFinanceTransaction() {
  return useOfficeFinanceMutation(
    ({ id, data }: { id: string; data: VersionedCommandInput }) =>
      OfficeFinanceService.cancelTransaction(id, data),
    "Transaction cancelled.",
    "Unable to cancel transaction.",
    officeFinanceKeys.all
  );
}

export function useReverseFinanceTransaction() {
  return useOfficeFinanceMutation(
    ({ id, data }: { id: string; data: VersionedCommandInput }) =>
      OfficeFinanceService.reverseTransaction(id, data),
    "Transaction reversed.",
    "Unable to reverse transaction.",
    officeFinanceKeys.all
  );
}

export function useBusinessParties(params?: { keyword?: string }, enabled = true) {
  return useQuery({
    queryKey: [...officeFinanceKeys.businessParties, params ?? {}],
    queryFn: () => OfficeFinanceService.listBusinessParties(params),
    enabled,
  });
}

export function useCreateBusinessParty() {
  return useOfficeFinanceMutation(
    (input: CreateBusinessPartyInput) => OfficeFinanceService.createBusinessParty(input),
    "Business party created.",
    "Unable to create business party.",
    officeFinanceKeys.businessParties
  );
}

export function useArchiveBusinessParty() {
  return useOfficeFinanceMutation(
    ({ id, data }: { id: string; data: VersionedCommandInput }) =>
      OfficeFinanceService.archiveBusinessParty(id, data),
    "Business party archived.",
    "Unable to archive business party.",
    officeFinanceKeys.businessParties
  );
}

export function useReactivateBusinessParty() {
  return useOfficeFinanceMutation(
    ({ id, data }: { id: string; data: VersionedCommandInput }) =>
      OfficeFinanceService.reactivateBusinessParty(id, data),
    "Business party reactivated.",
    "Unable to reactivate business party.",
    officeFinanceKeys.businessParties
  );
}

export function useFinanceCategories(params?: { keyword?: string }) {
  return useQuery({
    queryKey: [...officeFinanceKeys.categories, params ?? {}],
    queryFn: () => OfficeFinanceService.listCategories(params),
  });
}

export function useCreateFinanceCategory() {
  return useOfficeFinanceMutation(
    (input: CreateFinanceCategoryInput) => OfficeFinanceService.createCategory(input),
    "Category created.",
    "Unable to create category.",
    officeFinanceKeys.categories
  );
}

export function useArchiveFinanceCategory() {
  return useOfficeFinanceMutation(
    ({ id, data }: { id: string; data: VersionedCommandInput }) =>
      OfficeFinanceService.archiveCategory(id, data),
    "Category archived.",
    "Unable to archive category.",
    officeFinanceKeys.categories
  );
}

export function useReactivateFinanceCategory() {
  return useOfficeFinanceMutation(
    ({ id, data }: { id: string; data: VersionedCommandInput }) =>
      OfficeFinanceService.reactivateCategory(id, data),
    "Category reactivated.",
    "Unable to reactivate category.",
    officeFinanceKeys.categories
  );
}

export function useFinancePaymentAccounts(params?: {
  keyword?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: [...officeFinanceKeys.paymentAccounts, params ?? {}],
    queryFn: () => OfficeFinanceService.listPaymentAccounts(params),
  });
}

export function useCreateFinancePaymentAccount() {
  return useOfficeFinanceMutation(
    (input: CreateFinancePaymentAccountInput) => OfficeFinanceService.createPaymentAccount(input),
    "Payment account created.",
    "Unable to create payment account.",
    officeFinanceKeys.paymentAccounts
  );
}

export function useFinancePeriods() {
  return useQuery({
    queryKey: officeFinanceKeys.periods,
    queryFn: () => OfficeFinanceService.listPeriods(),
  });
}

export function useCreateFinancePeriod() {
  return useOfficeFinanceMutation(
    (input: CreateFinancePeriodInput) => OfficeFinanceService.createPeriod(input),
    "Finance period created.",
    "Unable to create finance period.",
    officeFinanceKeys.periods
  );
}

export function useLockFinancePeriod() {
  return useOfficeFinanceMutation(
    ({ id, data }: { id: string; data: VersionedCommandInput }) =>
      OfficeFinanceService.lockPeriod(id, data),
    "Finance period locked.",
    "Unable to lock finance period.",
    officeFinanceKeys.periods
  );
}

export function useReopenFinancePeriod() {
  return useOfficeFinanceMutation(
    ({ id, data }: { id: string; data: VersionedCommandInput }) =>
      OfficeFinanceService.reopenPeriod(id, data),
    "Finance period reopened.",
    "Unable to reopen finance period.",
    officeFinanceKeys.periods
  );
}

export function useFinanceReports(filters?: FinanceReportFilters, reportType?: string) {
  return useQuery({
    queryKey: [...officeFinanceKeys.reports, reportType ?? "summary", filters ?? {}],
    queryFn: async () => {
      switch (reportType) {
        case "by-category":
          return OfficeFinanceService.byCategoryReport(filters);
        case "by-department":
          return OfficeFinanceService.byDepartmentReport(filters);
        case "by-project":
          return OfficeFinanceService.byProjectReport(filters);
        case "account-movements":
          return OfficeFinanceService.accountMovementsReport(filters);
        case "account-balance":
          return OfficeFinanceService.accountBalanceReport();
        default:
          return OfficeFinanceService.incomeExpenseReport(filters);
      }
    },
    enabled: Boolean(reportType),
  });
}
