import type { ReactNode } from "react";

import { AuthenticatedApp } from "@/components/auth/authenticated-app";

export default function OrganizationOnboardingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <AuthenticatedApp>{children}</AuthenticatedApp>;
}
