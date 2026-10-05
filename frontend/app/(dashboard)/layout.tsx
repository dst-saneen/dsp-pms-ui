import { ReactNode } from "react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { AuthenticatedApp } from "@/components/auth/authenticated-app";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <AuthenticatedApp>
      <DashboardShell>{children}</DashboardShell>
    </AuthenticatedApp>
  );
}
