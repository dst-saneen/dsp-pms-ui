import { LucideIcon } from "lucide-react";

/** UX-02 / CORE-02 — work kind for grouping (URLs unchanged). */
export type NavigationKind = "daily" | "config" | "admin" | "ops";

export interface NavigationItem {
  title: string;

  href?: string;

  icon?: LucideIcon;

  children?: NavigationItem[];

  permissions?: string[];

  /** If set, the user needs any one of these permissions (OR). */
  anyPermissions?: string[];

  /** Server module capability — item hidden when capability is false. */
  moduleCapability?:
    | "financeNav"
    | "payrollNav"
    | "projectsNav"
    | "onboardingNav"
    | "assetsNav"
    | "deliveryOperationsNav"
    | "fileOperationsNav"
    | "recruitmentNav";

  /**
   * Daily work vs configuration vs administration vs operations.
   * Used for grouping guidance; does not change hrefs.
   */
  navKind?: NavigationKind;

  badge?: string | number;

  disabled?: boolean;

  availability?: "available" | "planned";
}

export interface NavigationGroup {
  title: string;

  items: NavigationItem[];
}
