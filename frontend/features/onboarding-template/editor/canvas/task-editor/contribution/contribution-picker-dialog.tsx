"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { FormDialog } from "@/components/common/form-dialog";

import {
  useContributions,
  useCreateTaskContribution,
} from "@/features/onboarding-contribution";

interface Props {
  open: boolean;

  taskId: string;

  existingContributionIds: string[];

  onOpenChange(
    open: boolean,
  ): void;
}

export function ContributionPickerDialog({

  open,

  taskId,

  existingContributionIds,

  onOpenChange,

}: Props) {

  const [search, setSearch] =
    useState("");

  const [selectedId, setSelectedId] =
    useState<string>();

  const {
    data = [],
    isLoading,
  } = useContributions();

  const create =
    useCreateTaskContribution();

  const items = useMemo(
    () =>
      data.filter(
        contribution =>
          !existingContributionIds.includes(
            contribution.id,
          ),
      ),
    [
      data,
      existingContributionIds,
    ],
  );

  const filtered = useMemo(() => {

    if (!search) {
      return items;
    }

    const keyword =
      search.toLowerCase();

    return items.filter(
      contribution =>
        contribution.contributionName
          .toLowerCase()
          .includes(keyword) ||

        contribution.contributionCode
          .toLowerCase()
          .includes(keyword),
    );

  }, [items, search]);

  async function handleAdd() {

    if (!selectedId) {
      return;
    }

    await create.mutateAsync({

      taskId,

      contributionId: selectedId,

    });

    onOpenChange(false);

    setSelectedId(undefined);

    setSearch("");

  }

  return (

    <FormDialog

      open={open}

      onOpenChange={onOpenChange}

      title="Add Contribution"

      description="Attach an existing contribution definition to this task."

      size="lg"

      footer={

        <div className="flex justify-end gap-2">

          <Button

            variant="outline"

            onClick={() =>
              onOpenChange(false)
            }

          >
            Cancel
          </Button>

          <Button

            onClick={handleAdd}

            disabled={!selectedId}

          >
            Add
          </Button>

        </div>

      }

    >

      <div className="space-y-4">

        <Input

          placeholder="Search contribution..."

          value={search}

          onChange={e =>
            setSearch(
              e.target.value,
            )
          }

        />

        <div className="max-h-[450px] overflow-y-auto rounded-md border">

          {isLoading && (

            <div className="p-4 text-sm">
              Loading...
            </div>

          )}

          {filtered.map(item => (

            <button

              key={item.id}

              type="button"

              onClick={() =>
                setSelectedId(item.id)
              }

              className={`flex w-full flex-col border-b p-4 text-left hover:bg-muted ${
                selectedId === item.id
                  ? "bg-muted"
                  : ""
              }`}

            >

              <span className="font-medium">

                {item.contributionName}

              </span>

              <span className="text-xs text-muted-foreground">

                {item.contributionCode}

              </span>

              {item.description && (

                <span className="mt-1 text-sm text-muted-foreground">

                  {item.description}

                </span>

              )}

            </button>

          ))}

        </div>

      </div>

    </FormDialog>

  );

}