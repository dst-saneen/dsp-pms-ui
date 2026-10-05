"use client";

import { DataTable } from "@/components/tables/data-table";

import {
  onboardingTemplateTaskColumns,
} from "./onboarding-template-task-columns";

import {
  useOnboardingTemplateTasks,
} from "../hooks";

import type {
  OnboardingTemplateTask,
  OnboardingTemplateTaskSearch,
} from "../types";

interface Props {
  searchParams?: OnboardingTemplateTaskSearch;

  onSelect?: (
    task: OnboardingTemplateTask,
  ) => void;
}

export function OnboardingTemplateTaskTable({
  searchParams,
  onSelect,
}: Props) {
  const {
    data = [],
    isLoading,
  } =
    useOnboardingTemplateTasks(
      searchParams,
    );

  if (isLoading) {
    return (
      <div>
        Loading...
      </div>
    );
  }

  return (
    <DataTable
      columns={
        onboardingTemplateTaskColumns()
      }
      data={data}
      onRowClick={onSelect}
    />
  );
}