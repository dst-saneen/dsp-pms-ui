import type { ReactNode } from "react";

export type DataGridColumnType =
  | "text"
  | "number"
  | "lookup"
  | "checkbox"
  | "actions";

export interface DataGridLookupItem {
  id: string;
  code?: string;
  name: string;
}

export interface DataGridAction<T> {
  id: string;
  label: string;
  onClick: (row: T) => void;
}

export interface DataGridColumn<T> {
  id: keyof T | string;

  title: string;

  type: DataGridColumnType;

  width?: number | string;

  editable?: boolean;

  placeholder?: string;

  lookupItems?: DataGridLookupItem[];

  getValue?: (row: T) => unknown;

  setValue?: (
    row: T,
    value: unknown,
  ) => T;

  render?: (
    row: T,
  ) => ReactNode;

  actions?: DataGridAction<T>[];
}

export interface DataGridProps<T> {
  rows: T[];

  columns: DataGridColumn<T>[];

  selectedRowId?: string;

  getRowId: (
    row: T,
  ) => string;

  onRowSelect?: (
    row: T,
  ) => void;

  onRowChange?: (
    row: T,
  ) => void;

  className?: string;
}