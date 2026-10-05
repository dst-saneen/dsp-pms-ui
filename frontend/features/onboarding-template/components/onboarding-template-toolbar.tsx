"use client";

import { Plus } from "lucide-react";
import Link from "next/link";

import { PageToolbar } from "@/components/common/page-toolbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  designationCreateHref,
  ONBOARDING_TEMPLATES,
} from "@/features/designation/lib/designation-navigation";
import { useAuth } from "@/providers/auth-provider";

interface Props {
  search: string;
  onSearchChange: (value: string) => void;
}

export function OnboardingTemplateToolbar({ search, onSearchChange }: Props) {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("organization.structure.manage");

  return (
    <PageToolbar>
      <Input
        placeholder="Search designation..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="max-w-sm"
      />
      {canCreate ? (
        <Button type="button" asChild>
          <Link
            href={designationCreateHref({
              source: "onboarding-templates",
              returnTo: ONBOARDING_TEMPLATES,
            })}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Designation
          </Link>
        </Button>
      ) : null}
    </PageToolbar>
  );
}
