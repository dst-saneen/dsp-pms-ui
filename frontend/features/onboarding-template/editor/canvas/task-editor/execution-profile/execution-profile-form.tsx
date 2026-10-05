"use client";

import { useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

import type {
  ExecutionProfileRow,
} from "./execution-profile-columns";

interface ExecutionProfileFormProps {
  executionProfile?: ExecutionProfileRow;

  onSubmit(
    value: ExecutionProfileRow,
  ): void;

  onCancel(): void;
}

export function ExecutionProfileForm({
  executionProfile,
  onSubmit,
  onCancel,
}: ExecutionProfileFormProps) {

  const {
    register,
    handleSubmit,
    control,
    setValue,
  } =
    useForm<ExecutionProfileRow>({
      defaultValues: executionProfile ?? {
        id: "",
        contributionId: "",
        displayOrder: 1,
        profileCode: "",
        profileName: "",
        description: "",
        isDefault: true,
        },
    });
  const isDefault = useWatch({
    control,
    name: "isDefault",
  });

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-6"
    >
      <Input
        placeholder="Profile Code"
        {...register("profileCode")}
        />

        <Input
        placeholder="Profile Name"
        {...register("profileName", {
            required: true,
        })}
        />

        <Input
        placeholder="Description"
        {...register("description")}
        />

        <Input
        type="number"
        placeholder="Display Order"
        {...register("displayOrder", {
            valueAsNumber: true,
        })}
        />

      <div className="flex items-center justify-between rounded-md border p-3">

        <div>

          <div className="font-medium">

            Default Profile

          </div>

          <div className="text-sm text-muted-foreground">

            Use this profile by default.

          </div>

        </div>

        <Switch
          checked={isDefault}
          onCheckedChange={(
            checked,
          ) =>
            setValue(
              "isDefault",
              checked,
            )
          }
        />

      </div>

      <div className="flex justify-end gap-2">

        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
        >
          Cancel
        </Button>

        <Button type="submit">

          Save

        </Button>

      </div>

    </form>
  );
}
