"use client";

import { Button } from "@/components/ui/button";

import { Plus } from "lucide-react";

import type {
  ExplorerAction,
} from "./actions";

interface Props {

  actions: ExplorerAction[];

  onAction(
    action: ExplorerAction,
  ): void;

}

export function OnboardingTreeToolbar({

  actions,

  onAction,

}: Props) {

  return (

    <div className="flex items-center gap-2 border-b p-3">

      {

        actions.map((action) => (

          <Button

            key={action.id}

            size="sm"

            variant="outline"

            onClick={() =>
              onAction(action)
            }

          >

            <Plus className="mr-2 h-4 w-4"/>

            {action.label}

          </Button>

        ))

      }

    </div>

  );

}