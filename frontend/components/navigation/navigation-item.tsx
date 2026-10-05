"use client";

import { useState } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  ChevronDown,
  ChevronRight,
} from "lucide-react";

import { cn } from "@/lib/utils";

import type { NavigationItem as NavigationItemType } from "@/types/navigation";

interface NavigationItemProps {
  item: NavigationItemType;

  level?: number;
}

export function NavigationItem({
  item,
  level = 0,
}: NavigationItemProps) {
  const pathname = usePathname();

  const [open, setOpen] = useState(true);

  const hasChildren =
    !!item.children &&
    item.children.length > 0;

  const isActive =
    item.href
      ? pathname.startsWith(item.href)
      : item.children?.some((child) =>
          pathname.startsWith(child.href ?? ""),
        ) ?? false;

  const Icon = item.icon;

  if (hasChildren) {
    return (
      <div className="space-y-1">
        <button
          type="button"
          onClick={() =>
            setOpen(!open)
          }
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            isActive
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {Icon && (
            <Icon className="h-4 w-4" />
          )}

          <span className="flex-1 text-left">
            {item.title}
          </span>

          {open ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        {open && (
          <div className="ml-6 space-y-1 border-l pl-3">
            {item.children!.map((child) => (
              <NavigationItem
                key={child.title}
                item={child}
                level={level + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href ?? "#"}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {Icon && (
        <Icon className="h-4 w-4" />
      )}

      <span className="flex-1">
        {item.title}
      </span>

      {item.badge && (
        <span className="rounded bg-primary/10 px-2 py-0.5 text-xs">
          {item.badge}
        </span>
      )}
    </Link>
  );
}