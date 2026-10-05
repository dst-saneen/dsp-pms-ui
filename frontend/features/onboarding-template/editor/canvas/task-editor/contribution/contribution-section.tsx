"use client";

import { useMemo, useState } from "react";

import { ContributionToolbar } from "./contribution-toolbar";
import { ContributionTable } from "./contribution-table";
import { ContributionPickerDialog } from "./contribution-picker-dialog";

import { useTaskEditor } from "../hooks";

import {
  useTaskContributions,
  useDeleteTaskContribution,
} from "@/features/onboarding-contribution";

export function ContributionSection() {

  const { task } =
    useTaskEditor();

  const [pickerOpen, setPickerOpen] =
    useState(false);

  const {
    data: contributions = [],
    isLoading,
  } = useTaskContributions(
    task?.id,
  );

  const deleteContribution =
    useDeleteTaskContribution(
      task?.id ?? "",
    );

  const existingContributionIds =
    useMemo(
      () =>
        contributions.map(
          item =>
            item.contributionId,
        ),
      [contributions],
    );

  if (!task) {
    return null;
  }

  return (
    <>
      <div className="space-y-6">

        <ContributionToolbar

          onAdd={() =>
            setPickerOpen(true)
          }

        />

        <ContributionTable

          loading={isLoading}

          contributions={
            contributions
          }

          onRemove={row =>

            deleteContribution.mutate(
              row.id,
            )

          }

        />

      </div>

      <ContributionPickerDialog

        open={pickerOpen}

        onOpenChange={
          setPickerOpen
        }

        taskId={task.id}

        existingContributionIds={
          existingContributionIds
        }

      />

    </>
  );

}