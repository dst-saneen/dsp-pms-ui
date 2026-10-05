"use client";

import { useState } from "react";

import {

  useRequirements,

  useCreateRequirement,

  useUpdateRequirement,

  useDeleteRequirement,

} from "@/features/onboarding-template/services";

import {

  RequirementToolbar,

} from "./requirement-toolbar";

import {

  RequirementTable,

} from "./requirement-table";

import {

  RequirementDialog,

} from "./requirement-dialog";

import type {

  RequirementRow,

} from "./requirement-columns";

export function RequirementSection() {

  const {

    data: rows = [],

    isLoading,

  } = useRequirements();

  const createRequirement =
    useCreateRequirement();

  const updateRequirement =
    useUpdateRequirement();

  const deleteRequirement =
    useDeleteRequirement();

  const [dialogOpen, setDialogOpen] =
    useState(false);

  const [selectedRequirement, setSelectedRequirement] =
    useState<RequirementRow>();

  async function handleSave(
    requirement: RequirementRow,
  ) {

    if (requirement.id) {

      await updateRequirement.mutateAsync({

        id: requirement.id,

        dto: requirement,

      });

    } else {

      await createRequirement.mutateAsync(
        requirement,
      );

    }

  }

  function handleEdit(
    requirement: RequirementRow,
  ) {

    setSelectedRequirement(
      requirement,
    );

    setDialogOpen(true);

  }

  function handleDelete(
    requirement: RequirementRow,
  ) {

    deleteRequirement.mutate(
      requirement.id,
    );

  }

  return (

    <div className="space-y-6">

      <RequirementToolbar

        onAdd={() => {

          setSelectedRequirement(
            undefined,
          );

          setDialogOpen(true);

        }}

      />

      <RequirementTable

        rows={rows}

        loading={isLoading}

        onEdit={handleEdit}

        onDelete={handleDelete}

      />

      <RequirementDialog

        open={dialogOpen}

        requirement={selectedRequirement}

        onOpenChange={setDialogOpen}

        onSave={handleSave}

      />

    </div>

  );

}