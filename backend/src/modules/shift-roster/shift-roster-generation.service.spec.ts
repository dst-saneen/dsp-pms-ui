import {
  DayPortion,
  ShiftRosterDayType,
  ShiftRosterEntrySource,
} from '@prisma/client';

import { ShiftRosterGenerationService } from './shift-roster-generation.service';

describe('ShiftRosterGenerationService', () => {
  const service = new ShiftRosterGenerationService();

  const baseBranch = {
    id: 'branch-1',
    companyId: 'company-1',
    timezone: 'Asia/Kolkata',
    workingCalendarReviewedAt: new Date('2026-01-01'),
    workingDays: [
      { dayOfWeek: 1, isWorkingDay: true, dayPortion: DayPortion.FULL_DAY },
      { dayOfWeek: 2, isWorkingDay: true, dayPortion: DayPortion.FULL_DAY },
      { dayOfWeek: 3, isWorkingDay: true, dayPortion: DayPortion.FULL_DAY },
      { dayOfWeek: 4, isWorkingDay: true, dayPortion: DayPortion.FULL_DAY },
      { dayOfWeek: 5, isWorkingDay: true, dayPortion: DayPortion.FULL_DAY },
      { dayOfWeek: 0, isWorkingDay: false, dayPortion: DayPortion.FULL_DAY },
      { dayOfWeek: 6, isWorkingDay: false, dayPortion: DayPortion.FULL_DAY },
    ],
  };

  const shift = {
    id: 'shift-1',
    companyId: 'company-1',
    shiftCode: 'GEN',
    shiftName: 'General',
    startTime: '09:00',
    endTime: '18:00',
    breakMinutes: 60,
    graceInMinutes: 30,
    graceOutMinutes: 15,
    isNightShift: false,
    isDefault: true,
    remarks: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('marks Sundays as week off and weekdays as working', () => {
    const result = service.generate({
      branch: baseBranch,
      periodStart: '2026-08-03',
      periodEnd: '2026-08-09',
      rosterId: 'roster-1',
      employees: [
        {
          id: 'emp-1',
          joiningDate: new Date('2026-01-01'),
          lastWorkingDate: null,
        },
      ],
      holidays: [],
      employeeShifts: [
        {
          employeeId: 'emp-1',
          shift,
          effectiveFrom: new Date('2026-01-01'),
          effectiveTo: null,
        },
      ],
    });

    const sunday = result.entries.find(
      (entry) => entry.workDate === '2026-08-09',
    );
    const monday = result.entries.find(
      (entry) => entry.workDate === '2026-08-03',
    );

    expect(sunday?.dayType).toBe(ShiftRosterDayType.WEEK_OFF);
    expect(monday?.dayType).toBe(ShiftRosterDayType.WORKING);
    expect(monday?.scheduledNetMinutes).toBeGreaterThan(0);
  });

  it('retains manual overrides during regeneration', () => {
    const result = service.generate({
      branch: baseBranch,
      periodStart: '2026-08-03',
      periodEnd: '2026-08-03',
      rosterId: 'roster-1',
      employees: [
        {
          id: 'emp-1',
          joiningDate: new Date('2026-01-01'),
          lastWorkingDate: null,
        },
      ],
      holidays: [],
      employeeShifts: [
        {
          employeeId: 'emp-1',
          shift,
          effectiveFrom: new Date('2026-01-01'),
          effectiveTo: null,
        },
      ],
      existingEntries: [
        {
          id: 'entry-1',
          shiftRosterId: 'roster-1',
          companyId: 'company-1',
          branchId: 'branch-1',
          employeeId: 'emp-1',
          workDate: new Date('2026-08-03T00:00:00.000Z'),
          shiftId: 'shift-override',
          scheduledStartAt: new Date('2026-08-03T04:00:00.000Z'),
          scheduledEndAt: new Date('2026-08-03T13:00:00.000Z'),
          breakMinutes: 30,
          scheduledNetMinutes: 480,
          timezone: 'Asia/Kolkata',
          dayType: ShiftRosterDayType.WORKING,
          dayPortion: DayPortion.FULL_DAY,
          source: ShiftRosterEntrySource.MANUAL_OVERRIDE,
          generationKey: 'roster-1:emp-1:2026-08-03',
          businessCalendarRuntimeDayId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].action).toBe('retain');
    expect(result.entries[0].source).toBe(
      ShiftRosterEntrySource.MANUAL_OVERRIDE,
    );
    expect(result.summary.toRetain).toBe(1);
  });

  it('uses runtime days when provided (ACTIVE office)', () => {
    const runtimeDays = new Map([
      [
        '2026-08-03',
        {
          dayType: ShiftRosterDayType.HOLIDAY,
          dayPortion: DayPortion.FULL_DAY,
          runtimeDayId: 'rd-holiday',
        },
      ],
      [
        '2026-08-04',
        {
          dayType: ShiftRosterDayType.WORKING,
          dayPortion: DayPortion.FULL_DAY,
          runtimeDayId: 'rd-work',
        },
      ],
    ]);

    const result = service.generate({
      branch: baseBranch,
      periodStart: '2026-08-03',
      periodEnd: '2026-08-04',
      rosterId: 'roster-1',
      employees: [
        {
          id: 'emp-1',
          joiningDate: new Date('2026-01-01'),
          lastWorkingDate: null,
        },
      ],
      holidays: [],
      runtimeDays,
      employeeShifts: [
        {
          employeeId: 'emp-1',
          shift,
          effectiveFrom: new Date('2026-01-01'),
          effectiveTo: null,
        },
      ],
    });

    const monday = result.entries.find((e) => e.workDate === '2026-08-03');
    const tuesday = result.entries.find((e) => e.workDate === '2026-08-04');
    expect(monday?.dayType).toBe(ShiftRosterDayType.HOLIDAY);
    expect(monday?.businessCalendarRuntimeDayId).toBe('rd-holiday');
    expect(tuesday?.dayType).toBe(ShiftRosterDayType.WORKING);
    expect(tuesday?.businessCalendarRuntimeDayId).toBe('rd-work');
  });

  it('excludes days before joining date', () => {
    const result = service.generate({
      branch: baseBranch,
      periodStart: '2026-08-03',
      periodEnd: '2026-08-05',
      rosterId: 'roster-1',
      employees: [
        {
          id: 'emp-1',
          joiningDate: new Date('2026-08-05'),
          lastWorkingDate: null,
        },
      ],
      holidays: [],
      employeeShifts: [
        {
          employeeId: 'emp-1',
          shift,
          effectiveFrom: new Date('2026-08-05'),
          effectiveTo: null,
        },
      ],
    });

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].workDate).toBe('2026-08-05');
    expect(result.includedEmployees).toEqual(['emp-1']);
  });
});
