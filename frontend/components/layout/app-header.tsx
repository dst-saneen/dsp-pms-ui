"use client";

import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import { useSidebar } from "@/components/layout/sidebar-provider";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { getBreadcrumbs, getPageTitle, mergeEntityBreadcrumbs } from "@/lib/shell-navigation";
import { useEntityBreadcrumbs } from "@/providers/entity-breadcrumb-provider";

export interface AppHeaderSlots {
  search?: ReactNode;
  notifications?: ReactNode;
  actions?: ReactNode;
  account?: ReactNode;
}

interface AppHeaderProps {
  slots?: AppHeaderSlots;
}

export function AppHeader({ slots }: AppHeaderProps) {
  const pathname = usePathname();
  const { setMobileOpen, setVersion, version } = useSidebar();
  const entityCrumbs = useEntityBreadcrumbs();
  const breadcrumbs = mergeEntityBreadcrumbs(getBreadcrumbs(pathname), entityCrumbs);
  const pageTitle = getPageTitle(pathname);

  return (
    <header className="border-border bg-card z-30 flex h-[60px] shrink-0 items-center border-b px-3 sm:px-4 md:px-5">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="mr-1 lg:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Open main navigation"
        aria-controls="mobile-navigation"
      >
        <Menu className="size-5" />
      </Button>

      <div className="min-w-0 flex-1">
        {breadcrumbs ? (
          <Breadcrumb>
            <BreadcrumbList className="flex-nowrap overflow-hidden">
              {breadcrumbs.map((crumb, index) => {
                const isLast = index === breadcrumbs.length - 1;
                const href = isLast ? null : crumb.href;

                return (
                  <Fragment key={`${crumb.label}-${index}`}>
                    <BreadcrumbItem className="min-w-0">
                      {href ? (
                        <BreadcrumbLink asChild>
                          <Link className="truncate" href={href}>
                            {crumb.label}
                          </Link>
                        </BreadcrumbLink>
                      ) : (
                        <BreadcrumbPage
                          className={isLast ? "text-foreground truncate font-semibold" : "truncate"}
                        >
                          {crumb.label}
                        </BreadcrumbPage>
                      )}
                    </BreadcrumbItem>
                    {!isLast ? <BreadcrumbSeparator /> : null}
                  </Fragment>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>
        ) : (
          <p className="text-foreground truncate text-sm font-semibold">{pageTitle}</p>
        )}
      </div>

      {slots?.search ? (
        <div className="ml-4 hidden max-w-md min-w-64 flex-1 lg:block">{slots.search}</div>
      ) : null}

      <div
        className="border-border bg-muted/55 ml-3 hidden items-center rounded-lg border p-0.5 sm:flex"
        role="group"
        aria-label="Sidebar version"
      >
        <button
          type="button"
          aria-label="Use V1 classic sidebar"
          aria-pressed={version === "v1"}
          title="V1 Classic navigation"
          onClick={() => setVersion("v1")}
          className={
            version === "v1"
              ? "bg-card text-foreground h-7 rounded-md px-2.5 text-xs font-semibold shadow-xs"
              : "text-muted-foreground hover:text-foreground h-7 rounded-md px-2.5 text-xs font-medium"
          }
        >
          V1
        </button>
        <button
          type="button"
          aria-label="Use V2 grouped sidebar"
          aria-pressed={version === "v2"}
          title="V2 Grouped navigation"
          onClick={() => setVersion("v2")}
          className={
            version === "v2"
              ? "bg-card text-foreground h-7 rounded-md px-2.5 text-xs font-semibold shadow-xs"
              : "text-muted-foreground hover:text-foreground h-7 rounded-md px-2.5 text-xs font-medium"
          }
        >
          V2
        </button>
      </div>

      {slots?.notifications || slots?.actions || slots?.account ? (
        <div className="ml-3 flex items-center gap-2">
          {slots.notifications}
          {slots.actions}
          {slots.account}
        </div>
      ) : null}
    </header>
  );
}
