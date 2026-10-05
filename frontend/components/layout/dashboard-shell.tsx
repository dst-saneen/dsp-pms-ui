"use client";

import type { ReactNode } from "react";

import {
  AppHeader,
  type AppHeaderSlots,
} from "@/components/layout/app-header";
import {
  AppSidebar,
  MobileSidebar,
} from "@/components/layout/app-sidebar";
import { SidebarProvider } from "@/components/layout/sidebar-provider";
import { OrganizationSwitcher } from "@/components/layout/organization-switcher";
import { UserMenu } from "@/components/navigation/user-menu";
import { EntityBreadcrumbProvider } from "@/providers/entity-breadcrumb-provider";

interface DashboardShellProps {
  children: ReactNode;
  brand?: ReactNode;
  headerSlots?: AppHeaderSlots;
}

export function DashboardShell({
  children,
  brand,
  headerSlots,
}: DashboardShellProps) {
  const resolvedHeaderSlots: AppHeaderSlots = {
    ...headerSlots,
    actions: headerSlots?.actions ?? <OrganizationSwitcher />,
    account: headerSlots?.account ?? <UserMenu />,
  };

  return (
    <SidebarProvider>
      <EntityBreadcrumbProvider>
        <a
          href="#main-content"
          className="sr-only z-[100] rounded-md bg-card px-3 py-2 text-sm font-medium shadow-md focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:ring-3 focus:ring-ring/25"
        >
          Skip to main content
        </a>

        <div className="flex min-h-0 flex-1 w-full overflow-hidden bg-[var(--shell-canvas)]">
          <AppSidebar brand={brand} />
          <MobileSidebar brand={brand} />

          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--shell-content)]">
            <AppHeader slots={resolvedHeaderSlots} />
            <main
              id="main-content"
              tabIndex={-1}
              className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 outline-none sm:px-4 md:px-5 md:py-5 xl:px-6"
            >
              {children}
            </main>
          </div>
        </div>
      </EntityBreadcrumbProvider>
    </SidebarProvider>
  );
}
