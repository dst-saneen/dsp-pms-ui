"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ExecutionProfileToolbarProps {

  onAdd(): void;

}

export function ExecutionProfileToolbar({

  onAdd,

}: ExecutionProfileToolbarProps) {

  return (

    <div className="flex items-center justify-between">

      <div>

        <h3 className="text-lg font-semibold">

          Execution Profiles

        </h3>

        <p className="text-sm text-muted-foreground">

          Configure how this task is executed.

        </p>

      </div>

      <Button

        onClick={onAdd}

      >

        <Plus className="mr-2 h-4 w-4" />

        Add Execution Profile

      </Button>

    </div>

  );

}