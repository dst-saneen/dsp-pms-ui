"use client";

import Link from "next/link";


import {
  MoreHorizontal,
  Trash2,
  Workflow,
} from "lucide-react";

import {
  Button,
} from "@/components/ui/button";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  useDeleteOnboardingTemplate,
} from "../hooks";

import type {
  OnboardingTemplate,
} from "../types";

interface Props {
  template: OnboardingTemplate;
}

export function OnboardingTemplateActions({
  template,
}: Props) {

  const remove =
    useDeleteOnboardingTemplate();

  return (

    <DropdownMenu>

      <DropdownMenuTrigger asChild>

        <Button
          variant="ghost"
          size="icon"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>

      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">

        <DropdownMenuItem asChild>

          <Link
            href={`/hr/onboarding-templates/${template.id}`}
          >

            <Workflow className="mr-2 h-4 w-4" />

            Designer

          </Link>

        </DropdownMenuItem>

        
  
        <DropdownMenuItem
          className="text-red-600"
          onClick={() =>
            remove.mutate(template.id)
          }
        >

          <Trash2 className="mr-2 h-4 w-4" />

          Delete

        </DropdownMenuItem>

      </DropdownMenuContent>

    </DropdownMenu>

  );

}