"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Inbox,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  onRowClick?: (row: TData, trigger: HTMLElement) => void;
  getRowLabel?: (row: TData) => string;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: LucideIcon;
  emptyActionLabel?: string;
  emptyActionIcon?: LucideIcon;
  onEmptyAction?: (trigger: HTMLButtonElement) => void;
  toolbar?: ReactNode;
  ariaLabel?: string;
  enablePagination?: boolean;
  pageSize?: number;
  pageSizeOptions?: number[];
}

export function DataTable<TData, TValue>({
  columns,
  data,
  onRowClick,
  getRowLabel,
  isLoading = false,
  error,
  onRetry,
  emptyTitle = "No records found",
  emptyDescription = "Try changing your search or filters.",
  emptyIcon: EmptyIcon = Inbox,
  emptyActionLabel,
  emptyActionIcon: EmptyActionIcon,
  onEmptyAction,
  toolbar,
  ariaLabel = "Data table",
  enablePagination = false,
  pageSize = 10,
  pageSizeOptions = [10, 20, 50],
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  // TanStack Table intentionally returns a stateful API that is not memoizable.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize,
      },
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: enablePagination
      ? getPaginationRowModel()
      : undefined,
  });
  const pagination = table.getState().pagination;
  const firstVisibleRow = pagination.pageIndex * pagination.pageSize + 1;
  const lastVisibleRow = Math.min(
    firstVisibleRow + table.getRowModel().rows.length - 1,
    data.length,
  );

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04),0_6px_18px_rgba(16,24,40,0.035)]">
      {toolbar ? (
        <div className="border-b border-border bg-card px-3 py-3 sm:px-4">
          {toolbar}
        </div>
      ) : null}
      <Table aria-label={ariaLabel} aria-busy={isLoading}>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>

        <TableBody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, rowIndex) => (
              <TableRow key={`loading-${rowIndex}`}>
                {columns.map((_, cellIndex) => (
                  <TableCell key={`loading-${rowIndex}-${cellIndex}`}>
                    <Skeleton
                      className={
                        cellIndex === 0 ? "h-4 w-20" : "h-4 w-28 max-w-full"
                      }
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : error ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-40 text-center">
                <div role="alert" className="mx-auto flex max-w-md flex-col items-center">
                  <AlertCircle className="mb-3 size-6 text-destructive" />
                  <p className="font-medium text-foreground">
                    Unable to load records
                  </p>
                  <p className="mt-1 whitespace-normal text-sm text-muted-foreground">
                    {error}
                  </p>
                  {onRetry ? (
                    <button
                      type="button"
                      className="mt-3 rounded-md px-2 py-1 text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/25"
                      onClick={onRetry}
                    >
                      Try again
                    </button>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          ) : table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                onClick={(event) => {
                  const target = event.target as HTMLElement;
                  if (
                    target.closest(
                      'button, a, input, textarea, select, [role="menuitem"], [data-slot="dropdown-menu"], [data-slot="dropdown-menu-content"], [data-slot="dropdown-menu-item"]',
                    )
                  ) {
                    return;
                  }
                  onRowClick?.(row.original, event.currentTarget);
                }}
                onKeyDown={(event) => {
                  if (!onRowClick || event.target !== event.currentTarget) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onRowClick(row.original, event.currentTarget);
                  }
                }}
                tabIndex={onRowClick ? 0 : undefined}
                aria-label={
                  onRowClick
                    ? getRowLabel?.(row.original) ?? "Open row details"
                    : undefined
                }
                className={
                  onRowClick
                    ? "cursor-pointer outline-none hover:bg-primary-soft/45 focus-visible:bg-primary-soft focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    : undefined
                }
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(
                      cell.column.columnDef.cell,
                      cell.getContext()
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-40 text-center"
              >
                <div className="mx-auto flex max-w-md flex-col items-center">
                  <span className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary ring-1 ring-inset ring-primary/10">
                    <EmptyIcon className="size-5" aria-hidden="true" />
                  </span>
                  <p className="text-sm font-semibold text-foreground">
                    {emptyTitle}
                  </p>
                  <p className="mt-1 whitespace-normal text-sm text-muted-foreground">
                    {emptyDescription}
                  </p>
                  {emptyActionLabel && onEmptyAction ? (
                    <Button
                      type="button"
                      size="sm"
                      className="mt-4"
                      onClick={(event) => onEmptyAction(event.currentTarget)}
                    >
                      {EmptyActionIcon ? (
                        <EmptyActionIcon className="size-4" aria-hidden="true" />
                      ) : null}
                      {emptyActionLabel}
                    </Button>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {enablePagination && !isLoading && !error && data.length > 0 ? (
        <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {firstVisibleRow}–{lastVisibleRow} of {data.length}
          </p>
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <Select
              value={`${pagination.pageSize}`}
              onValueChange={(value) => table.setPageSize(Number(value))}
            >
              <SelectTrigger
                size="sm"
                className="w-[92px]"
                aria-label="Rows per page"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {pageSizeOptions.map((option) => (
                  <SelectItem key={option} value={`${option}`}>
                    {option} rows
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                aria-label="Previous page"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="min-w-20 text-center text-xs text-muted-foreground">
                Page {pagination.pageIndex + 1} of {table.getPageCount()}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                aria-label="Next page"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
