"use client";

import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CompanyGroupToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  visibleCount: number;
  totalCount: number;
}

export function CompanyGroupToolbar({
  search,
  onSearchChange,
  visibleCount,
  totalCount,
}: CompanyGroupToolbarProps) {
  const hasSearch = search.trim().length > 0;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-sm">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          placeholder="Search company groups..."
          className="pr-10 pl-9"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          aria-label="Search company groups"
        />
        {hasSearch ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground"
            onClick={() => onSearchChange("")}
            aria-label="Clear company group search"
          >
            <X className="size-3.5" />
          </Button>
        ) : null}
      </div>

      <p className="shrink-0 text-xs text-muted-foreground" aria-live="polite">
        {hasSearch
          ? `${visibleCount} of ${totalCount} groups`
          : `${totalCount} ${totalCount === 1 ? "group" : "groups"}`}
      </p>
    </div>
  );
}
