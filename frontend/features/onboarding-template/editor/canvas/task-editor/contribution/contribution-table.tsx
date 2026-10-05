"use client";

import { DataTable } from "@/components/tables";

import {
  contributionColumns,
} from "./contribution-columns";

import {
  ContributionEmpty,
} from "./contribution-empty";

import type {
  TaskContribution,
} from "@/features/onboarding-contribution/services/task-contribution.service";

interface ContributionTableProps {

  loading?: boolean;

  contributions: TaskContribution[];

  onRemove?(
    contribution: TaskContribution,
  ): void;

}

export function ContributionTable({

  loading,

  contributions,

  onRemove,

}: ContributionTableProps) {

  if (loading) {

    return (

      <div className="text-sm text-muted-foreground">

        Loading contributions...

      </div>

    );

  }

  if (contributions.length === 0) {

    return <ContributionEmpty />;

  }

  return (

    <DataTable

      columns={
        contributionColumns({

          onRemove,

        })
      }

      data={contributions}

    />

  );

}