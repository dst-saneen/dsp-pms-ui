"use client";

import {
  useForm,
  useWatch,
} from "react-hook-form";

import { Button } from "@/components/ui/button";

import {
  Input,
} from "@/components/ui/input";

import { Switch } from "@/components/ui/switch";

import type {
  RequirementRow,
} from "./requirement-columns";

interface Props {

  requirement?: RequirementRow;

  onSubmit(
    value: RequirementRow,
  ): void;

  onCancel(): void;

}

export function RequirementForm({

  requirement,

  onSubmit,

  onCancel,

}: Props) {

  const {

    register,

    handleSubmit,

    setValue,

    control,

  } = useForm<RequirementRow>({

    defaultValues: requirement ?? {

      id: "",

      displayOrder: 0,

      requirementCode: "",

      requirementName: "",

      requirementType: "TEXT",

      defaultValue: "",

      isMandatory: true,

    },

  });
  const isMandatory = useWatch({
    control,
    name: "isMandatory",
  });

  return (

    <form

      onSubmit={handleSubmit(onSubmit)}

      className="space-y-6"

    >

      <Input

        placeholder="Requirement Code"

        {...register(
          "requirementCode",
        )}

      />

      <Input

        placeholder="Requirement Name"

        {...register(
          "requirementName",
          {
            required: true,
          },
        )}

      />

      <Input

        placeholder="Requirement Type"

        {...register(
          "requirementType",
        )}

      />

      <Input

        placeholder="Default Value"

        {...register(
          "defaultValue",
        )}

      />

      <div className="flex items-center justify-between rounded-md border p-3">

        <div>
            <div className="font-medium">
            Mandatory
            </div>

            <div className="text-sm text-muted-foreground">
            Employee must complete this requirement.
            </div>
        </div>

        <Switch
            checked={isMandatory}
            onCheckedChange={(checked) =>
            setValue("isMandatory", checked)
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
