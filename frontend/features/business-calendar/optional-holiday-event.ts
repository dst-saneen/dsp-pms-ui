/**
 * Forces calendar event fields when Optional / Floating holiday is selected.
 * Optional days keep the office open (effect NONE) and are unpaid at calendar level.
 */
export function resolveHolidayEventFlags(input: {
  isHoliday: boolean;
  isOptionalHoliday: boolean;
  multiDay: boolean;
  startDate: string;
  endDate: string;
  effect: string;
  paidHoliday: boolean;
}) {
  if (input.isHoliday && input.isOptionalHoliday) {
    return {
      multiDay: false,
      endDate: input.startDate,
      effect: "NONE",
      paidHoliday: false,
      isOptionalHoliday: true,
    };
  }

  return {
    multiDay: input.multiDay,
    endDate: input.multiDay && input.endDate ? input.endDate : input.startDate,
    effect: input.effect,
    paidHoliday: input.isHoliday ? input.paidHoliday : false,
    isOptionalHoliday: false,
  };
}
