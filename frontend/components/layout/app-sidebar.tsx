"use client";

import { useState, useRef, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LayoutDashboard, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { AppBrand } from "@/components/layout/app-brand";
import { getActiveNavigationHref } from "@/components/layout/app-sidebar.utils";
import { useSidebar } from "@/components/layout/sidebar-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { classicNavigation, groupedNavigation } from "@/config/navigation";
import { useModuleCapabilities } from "@/hooks/use-module-capabilities";
import { cn } from "@/lib/utils";
import type { ModuleCapabilities } from "@/hooks/use-module-capabilities";
import type { NavigationGroup, NavigationItem } from "@/types/navigation";
import { useAuth } from "@/providers/auth-provider";

const SIDEBAR_EXPANDED = 248;
const SIDEBAR_COLLAPSED = 72;

function itemIsAllowed(item: NavigationItem, hasPermission: (permission: string) => boolean) {
  if (item.anyPermissions?.length) {
    return item.anyPermissions.some((permission) => hasPermission(permission));
  }
  if (!item.permissions?.length) return true;
  return item.permissions.every((permission) => hasPermission(permission));
}

function itemModuleCapabilityEnabled(
  item: NavigationItem,
  capabilities: ModuleCapabilities | undefined
) {
  if (!item.moduleCapability) return true;
  if (!capabilities) return false;
  return Boolean(capabilities[item.moduleCapability]);
}

function filterAvailableItems(
  items: NavigationItem[],
  hasPermission: (permission: string) => boolean,
  capabilities: ModuleCapabilities | undefined
): NavigationItem[] {
  return items
    .filter(
      (item) =>
        item.availability !== "planned" &&
        itemModuleCapabilityEnabled(item, capabilities) &&
        itemIsAllowed(item, hasPermission)
    )
    .map((item) => {
      const children = item.children
        ? filterAvailableItems(item.children, hasPermission, capabilities)
        : undefined;

      return { ...item, children };
    })
    .filter((item) => Boolean(item.href || item.children?.length));
}

function hasActiveChild(activeHref: string | undefined, item: NavigationItem): boolean {
  if (!activeHref) return false;

  return Boolean(
    item.children?.some(
      (child) => child.href === activeHref || hasActiveChild(activeHref, child)
    )
  );
}

function LabelFade({
  collapsed,
  children,
  className,
}: {
  collapsed: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "min-w-0 overflow-hidden whitespace-nowrap transition-[opacity,max-width] duration-200 motion-reduce:transition-none",
        collapsed ? "pointer-events-none max-w-0 opacity-0" : "max-w-[180px] opacity-100",
        className
      )}
      aria-hidden={collapsed}
    >
      {children}
    </span>
  );
}

function SidebarCollapseAction({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const label = collapsed ? "Expand sidebar" : "Collapse sidebar";
  const action = (
    <Button
      type="button"
      variant="ghost"
      onClick={onToggle}
      aria-label={label}
      aria-expanded={!collapsed}
      className={cn(
        "text-muted-foreground hover:bg-primary-soft/55 hover:text-primary h-9 w-full rounded-lg text-[13px] max-sm:h-11 max-sm:text-sm",
        collapsed ? "justify-center px-2" : "justify-start gap-2.5 px-2.5"
      )}
    >
      <span className="bg-muted/70 flex size-7 shrink-0 items-center justify-center rounded-md max-sm:size-8 max-sm:rounded-lg">
        {collapsed ? (
          <PanelLeftOpen className="size-4" aria-hidden="true" />
        ) : (
          <PanelLeftClose className="size-4" aria-hidden="true" />
        )}
      </span>
      <LabelFade collapsed={collapsed} className="font-medium">
        {label}
      </LabelFade>
    </Button>
  );

  return (
    <Tooltip delayDuration={collapsed ? 150 : 10_000}>
      <TooltipTrigger asChild>{action}</TooltipTrigger>
      {collapsed ? (
        <TooltipContent side="right" sideOffset={8}>
          {label}
        </TooltipContent>
      ) : null}
    </Tooltip>
  );
}

function NavLink({
  item,
  collapsed,
  active,
  depth = 0,
  onNavigate,
}: {
  item: NavigationItem;
  collapsed: boolean;
  active: boolean;
  depth?: number;
  onNavigate?: () => void;
}) {
  const Icon = item.icon ?? LayoutDashboard;
  const href = item.href ?? "#";

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (item.disabled || href === "#") {
      event.preventDefault();
      return;
    }
    onNavigate?.();
  };

  const link = (
    <Link
      href={href}
      className={cn(
        "group focus-visible:ring-sidebar-ring/25 relative flex min-h-9 w-full items-center overflow-hidden rounded-lg border border-transparent text-[13px] transition-[background-color,border-color,color,box-shadow] outline-none focus-visible:ring-3 max-sm:min-h-11 max-sm:rounded-xl max-sm:text-sm",
        collapsed ? "justify-center px-2" : "gap-2.5 px-2.5",
        active
          ? "border-primary/10 bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-[inset_0_0_0_1px_rgba(200,78,50,0.025)]"
          : "text-sidebar-foreground hover:border-border/70 hover:bg-primary-soft/45 hover:text-primary",
        depth > 0 && !collapsed && "pl-4"
      )}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? item.title : undefined}
      onClick={handleClick}
    >
      {active ? (
        <span
          className="bg-primary absolute inset-y-2 left-0 w-0.5 rounded-full"
          aria-hidden="true"
        />
      ) : null}
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-md transition-[background-color,color,box-shadow] max-sm:size-8 max-sm:rounded-lg",
          active
            ? "bg-brand text-white shadow-sm"
            : "text-muted-foreground group-hover:bg-card group-hover:text-primary group-hover:shadow-xs"
        )}
      >
        <Icon className="size-4" aria-hidden="true" />
      </span>

      <LabelFade collapsed={collapsed} className="flex flex-1 items-center gap-2">
        <span className="flex-1 truncate">{item.title}</span>
        {item.badge !== undefined ? (
          <Badge variant="secondary" className="h-5 min-w-5 rounded-md px-1.5 text-[11px]">
            {item.badge}
          </Badge>
        ) : null}
      </LabelFade>
    </Link>
  );

  return (
    <Tooltip delayDuration={collapsed ? 150 : 10_000}>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      {collapsed ? (
        <TooltipContent side="right" sideOffset={8}>
          {item.title}
        </TooltipContent>
      ) : null}
    </Tooltip>
  );
}

function NavItemNode({
  item,
  collapsed,
  activeHref,
  onNavigate,
}: {
  item: NavigationItem;
  collapsed: boolean;
  activeHref?: string;
  onNavigate?: () => void;
}) {
  const childActive = hasActiveChild(activeHref, item);
  const selfActive = Boolean(item.href && item.href === activeHref);
  const activeChildHref = item.children ? activeHref : undefined;
  const [manuallyOpen, setManuallyOpen] = useState(false);
  const open = childActive || manuallyOpen;

  if (item.children?.length) {
    if (collapsed) {
      return (
        <NavLink
          item={{ ...item, href: item.children[0]?.href ?? "#" }}
          collapsed
          active={selfActive || childActive}
          onNavigate={onNavigate}
        />
      );
    }

    const Icon = item.icon ?? LayoutDashboard;

    return (
      <div>
        <button
          type="button"
          className={cn(
            "group focus-visible:ring-sidebar-ring/25 hover:border-border/70 hover:bg-primary-soft/45 hover:text-primary flex min-h-9 w-full items-center gap-2.5 rounded-lg border border-transparent px-2.5 text-left text-[13px] transition-[background-color,border-color,color] outline-none focus-visible:ring-3 max-sm:min-h-11 max-sm:rounded-xl max-sm:text-sm",
            selfActive || childActive ? "text-foreground font-medium" : "text-sidebar-foreground"
          )}
          onClick={() => setManuallyOpen((value) => !value)}
          aria-expanded={open}
        >
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-md max-sm:size-8 max-sm:rounded-lg",
              selfActive || childActive
                ? "bg-brand text-white shadow-sm"
                : "text-muted-foreground group-hover:bg-card group-hover:text-primary group-hover:shadow-xs"
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1 truncate">{item.title}</span>
          <ChevronDown
            className={cn(
              "text-muted-foreground size-4 transition-transform motion-reduce:transition-none",
              open && "rotate-180"
            )}
            aria-hidden="true"
          />
        </button>

        <div
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-200 motion-reduce:transition-none",
            open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          )}
        >
          <div className="overflow-hidden">
            <div className="border-border mt-0.5 ml-5 space-y-0.5 border-l pl-2">
              {item.children.map((child) => (
                <Link
                  key={child.title}
                  href={child.href ?? "#"}
                  onClick={(event) => {
                    if (!child.href || child.href === "#") {
                      event.preventDefault();
                      return;
                    }
                    onNavigate?.();
                  }}
                  aria-current={activeChildHref === child.href ? "page" : undefined}
                  className={cn(
                    "focus-visible:ring-sidebar-ring/25 flex min-h-8 items-center rounded-lg px-3 text-[13px] transition-colors outline-none focus-visible:ring-3 max-sm:min-h-11 max-sm:text-sm",
                    activeChildHref === child.href
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-muted-foreground hover:bg-primary-soft/55 hover:text-foreground"
                  )}
                >
                  <span className="truncate">{child.title}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <NavLink item={item} collapsed={collapsed} active={selfActive} onNavigate={onNavigate} />;
}

function SidebarContent({
  collapsed,
  brand,
  onNavigate,
  onToggleCollapsed,
}: {
  collapsed: boolean;
  brand?: ReactNode;
  onNavigate?: () => void;
  onToggleCollapsed?: () => void;
}) {
  const pathname = usePathname();
  const { version } = useSidebar();
  const { hasPermission } = useAuth();
  const capabilitiesQuery = useModuleCapabilities();
  const capabilities = capabilitiesQuery.data;
  const configuredNavigation = version === "v2" ? groupedNavigation : classicNavigation;
  const visibleNavigation: NavigationGroup[] = configuredNavigation
    .map((group) => ({
      ...group,
      items: filterAvailableItems(group.items, hasPermission, capabilities),
    }))
    .filter((group) => group.items.length > 0);
  const activeHref = getActiveNavigationHref(
    pathname,
    visibleNavigation.flatMap((group) => group.items)
  );

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div
        className={cn(
          "border-sidebar-border flex h-[60px] shrink-0 items-center border-b",
          collapsed ? "justify-center px-2" : "px-4"
        )}
      >
        {brand ?? <AppBrand compact={collapsed} />}
      </div>

      <nav
        aria-label="Main navigation"
        aria-busy={capabilitiesQuery.isLoading || capabilitiesQuery.isPending}
        className="scrollbar-hidden min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2.5 py-3"
      >
        {!collapsed && capabilitiesQuery.isLoading ? (
          <p
            className="text-muted-foreground mb-3 rounded-lg border border-dashed px-3 py-2 text-xs"
            role="status"
          >
            Loading module access…
          </p>
        ) : null}
        {!collapsed && capabilitiesQuery.isError ? (
          <div
            className="border-destructive/30 bg-destructive/5 text-destructive mb-3 rounded-lg border px-3 py-2 text-xs"
            role="alert"
          >
            <p>Navigation is degraded. Some module links are temporarily unavailable.</p>
            <button
              type="button"
              className="mt-1 font-semibold underline underline-offset-2"
              onClick={() => void capabilitiesQuery.refetch()}
            >
              Retry module check
            </button>
          </div>
        ) : null}
        <div className="space-y-3">
          {visibleNavigation.map((group) => (
            <div key={group.title} className="space-y-0.5">
              {!collapsed ? (
                <p className="text-muted-foreground px-2.5 pb-0.5 text-[10px] font-semibold tracking-[0.11em] uppercase">
                  {group.title}
                </p>
              ) : null}
              {group.items.map((item) => (
                <NavItemNode
                  key={item.title}
                  item={item}
                  collapsed={collapsed}
                  activeHref={activeHref}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          ))}
        </div>
      </nav>

      {onToggleCollapsed ? (
        <div className="border-sidebar-border shrink-0 border-t p-2">
          <SidebarCollapseAction collapsed={collapsed} onToggle={onToggleCollapsed} />
        </div>
      ) : null}
    </div>
  );
}

interface AppSidebarProps {
  brand?: ReactNode;
}

export function AppSidebar({ brand }: AppSidebarProps) {
  const { collapsed, toggleCollapsed } = useSidebar();

  return (
    <aside
      className={cn(
        "border-sidebar-border bg-sidebar relative z-20 hidden h-dvh shrink-0 flex-col border-r shadow-[1px_0_0_rgba(16,24,40,0.02)] lg:flex",
        collapsed ? "w-[72px]" : "w-[248px]",
        "transition-[width] duration-200 motion-reduce:transition-none"
      )}
      style={
        {
          "--sidebar-expanded": `${SIDEBAR_EXPANDED}px`,
          "--sidebar-collapsed": `${SIDEBAR_COLLAPSED}px`,
        } as CSSProperties
      }
      data-collapsed={collapsed ? "true" : "false"}
    >
      <div className="flex h-full w-full">
        <SidebarContent collapsed={collapsed} brand={brand} onToggleCollapsed={toggleCollapsed} />
      </div>
    </aside>
  );
}

export function MobileSidebar({ brand }: AppSidebarProps) {
  const { mobileOpen, setMobileOpen } = useSidebar();
  const returnFocusRef = useRef<HTMLElement | null>(null);

  return (
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
      <SheetContent
        id="mobile-navigation"
        side="left"
        className="w-[min(320px,calc(100vw-24px))] gap-0 p-0 sm:max-w-[320px] lg:hidden"
        onOpenAutoFocus={() => {
          if (document.activeElement instanceof HTMLElement) {
            returnFocusRef.current = document.activeElement;
          }
        }}
        onCloseAutoFocus={(event) => {
          if (!returnFocusRef.current) return;
          event.preventDefault();
          returnFocusRef.current.focus();
          returnFocusRef.current = null;
        }}
      >
        <SheetTitle className="sr-only">Main navigation</SheetTitle>
        <SheetDescription className="sr-only">
          Navigate between available Group ERP areas.
        </SheetDescription>
        <SidebarContent collapsed={false} brand={brand} onNavigate={() => setMobileOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
