export interface Shift {
  id: string;

  companyId: string;

  company?: {
    id: string;
    companyCode: string;
    companyName: string;
  };

  shiftCode: string;
  shiftName: string;

  startTime: string;
  endTime: string;

  breakMinutes: number;

  graceInMinutes: number;
  graceOutMinutes: number;

  isNightShift: boolean;

  isDefault: boolean;

  remarks?: string | null;

  isActive: boolean;

  createdAt: string;
  updatedAt: string;
}