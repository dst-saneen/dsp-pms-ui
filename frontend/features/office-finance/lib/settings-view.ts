import type { FinanceSettings, FinancialProfile } from "../types";

export function toFinanceSettingsView(
  data: FinanceSettings | FinancialProfile | null | undefined,
): { profile: FinancialProfile | null } {
  if (!data) {
    return { profile: null };
  }
  if ("profile" in data) {
    return { profile: data.profile ?? null };
  }
  if ("baseCurrencyCode" in data && "version" in data) {
    return { profile: data };
  }
  return { profile: null };
}
