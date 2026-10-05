"use client";

import Link from "next/link";

import { designationEditHref } from "@/features/designation/lib/designation-navigation";
import { useAuth } from "@/providers/auth-provider";

interface Props {
  designationId: string;
}

export function DesignationInactiveRecovery({ designationId }: Props) {
  const { hasPermission } = useAuth();
  const canEditStructure = hasPermission("organization.structure.manage");

  if (canEditStructure) {
    return (
      <p className="text-muted-foreground text-xs">
        Inactive — activate from{" "}
        <Link
          href={designationEditHref(designationId, {
            source: "onboarding-templates",
            returnTo: "/hr/onboarding-templates",
          })}
          className="text-foreground underline underline-offset-2"
        >
          Edit designation
        </Link>{" "}
        to use this template again.
      </p>
    );
  }

  return (
    <p className="text-muted-foreground text-xs">
      Inactive — ask an Organization Owner / Company Admin to activate this
      designation before the checklist can be used again.
    </p>
  );
}
