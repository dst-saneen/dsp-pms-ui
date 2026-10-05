"use client";

import { Button } from "@/components/ui/button";

import {
  Save,
  Trash2,
} from "lucide-react";

export function TaskGroupToolbar() {
  return (
    <div className="flex items-center justify-between border-b px-6 py-3">

      <h2 className="font-semibold">
        Task Group
      </h2>

      <div className="flex gap-2">

        <Button
          size="sm"
          variant="destructive"
        >
          <Trash2 className="mr-2 h-4 w-4"/>

          Delete
        </Button>

        <Button size="sm">

          <Save className="mr-2 h-4 w-4"/>

          Save

        </Button>

      </div>

    </div>
  );
}