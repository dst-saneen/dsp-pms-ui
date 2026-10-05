const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function inclusiveUpperDateFilter(value: string) {
  if (!DATE_ONLY_PATTERN.test(value)) {
    return { lte: new Date(value) };
  }

  const nextDay = new Date(`${value}T00:00:00.000Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  return { lt: nextDay };
}
