import { Prisma } from '@prisma/client';

/** Line hours must be (0, 24]. */
export function isValidLineHours(
  hours: Prisma.Decimal | number | string,
): boolean {
  const value = new Prisma.Decimal(hours);
  return value.gt(0) && value.lte(24);
}

/** Adding `hours` to `existingSum` must not exceed 24. */
export function exceedsDailyHoursCap(
  existingSum: Prisma.Decimal | number | string,
  hours: Prisma.Decimal | number | string,
  cap = 24,
): boolean {
  return new Prisma.Decimal(existingSum).add(hours).gt(cap);
}

/** Exactly one of taskId or workCategoryId must be set. */
export function isXorTaskOrCategory(
  taskId?: string | null,
  workCategoryId?: string | null,
): boolean {
  return Boolean(taskId) !== Boolean(workCategoryId);
}
