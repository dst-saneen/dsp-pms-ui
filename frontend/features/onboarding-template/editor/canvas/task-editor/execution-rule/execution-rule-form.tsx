"use client";

import { useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import {
  FormField,
  FormSection,
} from "@/components/forms";

import type {
  ExecutionRuleRow,
} from "./execution-rule-columns";

interface ExecutionRuleFormProps {

  executionRule?: ExecutionRuleRow;

  onSubmit(
    value: ExecutionRuleRow,
  ): Promise<void> | void;

  onCancel(): void;

}

export function ExecutionRuleForm({

  executionRule,

  onSubmit,

  onCancel,

}: ExecutionRuleFormProps) {

  const {

    register,

    handleSubmit,

    setValue,

    control,

  } = useForm<ExecutionRuleRow>({

    defaultValues:

      executionRule ?? {

        id: "",

        executionProfileId: "",

        sequenceNo: 1,

        ownerType: "",

        executionType: "",

        action: "",

        workType: "",

        approvalWorkflowId: "",

        dueDays: 0,

        reminderIntervalDays: 0,

        estimatedDurationMinutes: 0,

        conditionExpression: "",

        autoComplete: false,

        allowReopen: false,

        isActive: true,

      },

  });
  const [autoComplete, allowReopen, isActive] = useWatch({
    control,
    name: ["autoComplete", "allowReopen", "isActive"],
  });

  return (

    <form

      onSubmit={

        handleSubmit(onSubmit)

      }

      className="space-y-8"

    >

      <FormSection title="General">

        <div className="grid grid-cols-2 gap-4">

          <FormField

            label="Sequence No"

            required

          >

            <Input

              type="number"

              {...register(

                "sequenceNo",

                {

                  valueAsNumber: true,

                },

              )}

            />

          </FormField>

          <FormField

            label="Owner Type"

            required

          >

            <Input

              {...register(

                "ownerType",

              )}

            />

          </FormField>

          <FormField

            label="Execution Type"

            required

          >

            <Input

              {...register(

                "executionType",

              )}

            />

          </FormField>

          <FormField

            label="Action"

            required

          >

            <Input

              {...register(

                "action",

              )}

            />

          </FormField>

          <FormField

            label="Work Type"

            required

          >

            <Input

              {...register(

                "workType",

              )}

            />

          </FormField>

        </div>

      </FormSection>

      <FormSection title="Workflow">

        <div className="grid grid-cols-2 gap-4">

          <FormField

            label="Approval Workflow"

          >

            <Input

              {...register(

                "approvalWorkflowId",

              )}

            />

          </FormField>

          <FormField

            label="Condition Expression"

            className="col-span-2"

          >

            <Textarea

              rows={4}

              {...register(

                "conditionExpression",

              )}

            />

          </FormField>

        </div>

      </FormSection>

      <FormSection title="Timeline">

        <div className="grid grid-cols-3 gap-4">

          <FormField label="Due Days">

            <Input

              type="number"

              {...register(

                "dueDays",

                {

                  valueAsNumber: true,

                },

              )}

            />

          </FormField>

          <FormField

            label="Reminder Interval"

          >

            <Input

              type="number"

              {...register(

                "reminderIntervalDays",

                {

                  valueAsNumber: true,

                },

              )}

            />

          </FormField>

          <FormField

            label="Estimated Duration"

          >

            <Input

              type="number"

              {...register(

                "estimatedDurationMinutes",

                {

                  valueAsNumber: true,

                },

              )}

            />

          </FormField>

        </div>

      </FormSection>

      <FormSection title="Options">

        <div className="space-y-4">

          <div className="flex items-center justify-between">

            <span>

              Auto Complete

            </span>

            <Switch

              checked={

              autoComplete

              }

              onCheckedChange={

                value =>

                  setValue(

                    "autoComplete",

                    value,

                  )

              }

            />

          </div>

          <div className="flex items-center justify-between">

            <span>

              Allow Reopen

            </span>

            <Switch

              checked={

              allowReopen

              }

              onCheckedChange={

                value =>

                  setValue(

                    "allowReopen",

                    value,

                  )

              }

            />

          </div>

          <div className="flex items-center justify-between">

            <span>

              Active

            </span>

            <Switch

              checked={

              isActive

              }

              onCheckedChange={

                value =>

                  setValue(

                    "isActive",

                    value,

                  )

              }

            />

          </div>

        </div>

      </FormSection>

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
