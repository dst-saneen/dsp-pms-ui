"use client";

import { useState } from "react";

import {
  useExecutionProfiles,
  useCreateExecutionProfile,
  useUpdateExecutionProfile,
  useDeleteExecutionProfile,
} from "@/features/onboarding-template/services";

import { ExecutionProfileToolbar } from "./execution-profile-toolbar";
import { ExecutionProfileTable } from "./execution-profile-table";
import { ExecutionProfileDialog } from "./execution-profile-dialog";

import type {
  ExecutionProfileRow,
} from "./execution-profile-columns";

export function ExecutionProfileSection() {

  const {
    data: rows = [],
    isLoading,
  } = useExecutionProfiles();

  const createExecutionProfile =
    useCreateExecutionProfile();

  const updateExecutionProfile =
    useUpdateExecutionProfile();

  const deleteExecutionProfile =
    useDeleteExecutionProfile();

  const [dialogOpen, setDialogOpen] =
    useState(false);

  const [
    selectedExecutionProfile,
    setSelectedExecutionProfile,
  ] = useState<ExecutionProfileRow>();

  async function handleSave(
    executionProfile: ExecutionProfileRow,
  ) {

    if (executionProfile.id) {

      await updateExecutionProfile.mutateAsync({

        id: executionProfile.id,

        dto: executionProfile,

      });

    } else {

      await createExecutionProfile.mutateAsync(
        executionProfile,
      );

    }

  }

  function handleEdit(
    executionProfile: ExecutionProfileRow,
  ) {

    setSelectedExecutionProfile(
      executionProfile,
    );

    setDialogOpen(true);

  }

  function handleDelete(
    executionProfile: ExecutionProfileRow,
  ) {

    deleteExecutionProfile.mutate(
      executionProfile.id,
    );

  }

  return (

    <div className="space-y-6">

      <ExecutionProfileToolbar

        onAdd={() => {

          setSelectedExecutionProfile(
            undefined,
          );

          setDialogOpen(true);

        }}

      />

      <ExecutionProfileTable

        rows={rows}

        loading={isLoading}

        onEdit={handleEdit}

        onDelete={handleDelete}

      />

      <ExecutionProfileDialog

        open={dialogOpen}

        executionProfile={
          selectedExecutionProfile
        }

        onOpenChange={
          setDialogOpen
        }

        onSave={handleSave}

      />

    </div>

  );

}