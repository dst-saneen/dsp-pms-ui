export function formatMoney(value: string | number | null | undefined, currencyCode?: string) {
  if (value === null || value === undefined || value === "") {
    return currencyCode ? `${currencyCode} 0.00` : "0.00";
  }
  const amount = typeof value === "number" ? value : Number.parseFloat(value);
  if (Number.isNaN(amount)) {
    return typeof value === "string" ? value : "0.00";
  }
  const formatted = amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currencyCode ? `${currencyCode} ${formatted}` : formatted;
}

export function formatPeriod(year: number, month: number) {
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return "—";
  }
  return `${year}-${String(month).padStart(2, "0")}`;
}
