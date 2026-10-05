"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import type { JobOpeningCriterionFormValues } from "../validation/job-opening-schema";
import { getCriteriaWeightTotal } from "../validation/job-opening-schema";

interface CriterionListEditorProps {
  criteria: JobOpeningCriterionFormValues[];
  onChange: (criteria: JobOpeningCriterionFormValues[]) => void;
  readOnly?: boolean;
}

function createEmptyCriterion(displayOrder: number): JobOpeningCriterionFormValues {
  return {
    name: "",
    description: "",
    weightPercentage: 0,
    displayOrder,
    isRequired: true,
    isActive: true,
  };
}

export function CriterionListEditor({
  criteria,
  onChange,
  readOnly = false,
}: CriterionListEditorProps) {
  const total = getCriteriaWeightTotal(criteria);

  const updateCriterion = (
    index: number,
    patch: Partial<JobOpeningCriterionFormValues>,
  ) => {
    onChange(
      criteria.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  };

  const addCriterion = () => {
    onChange([...criteria, createEmptyCriterion(criteria.length)]);
  };

  const removeCriterion = (index: number) => {
    onChange(
      criteria
        .filter((_, itemIndex) => itemIndex !== index)
        .map((item, itemIndex) => ({ ...item, displayOrder: itemIndex })),
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium">Evaluation criteria</p>
          <p className="text-sm text-muted-foreground">
            Active criteria must total exactly 100% before publication.
          </p>
        </div>
        <div
          className={cn(
            "rounded-md border px-3 py-1.5 text-sm font-medium",
            total === 100
              ? "border-success/20 bg-success/5 text-success-foreground"
              : "border-warning/20 bg-warning/5 text-warning-foreground",
          )}
        >
          Total: {total}%
        </div>
      </div>

      <div className="space-y-3">
        {criteria.map((criterion, index) => (
          <div
            key={criterion.id ?? `criterion-${index}`}
            className="rounded-xl border p-4"
          >
            <div className="grid gap-3 md:grid-cols-[1fr_120px_auto]">
              <Input
                placeholder="Criterion name"
                value={criterion.name}
                disabled={readOnly}
                onChange={(event) =>
                  updateCriterion(index, { name: event.target.value })
                }
              />
              <Input
                type="number"
                min={0}
                max={100}
                placeholder="Weight %"
                value={Number.isFinite(criterion.weightPercentage) ? criterion.weightPercentage : ""}
                disabled={readOnly}
                onChange={(event) =>
                  updateCriterion(index, {
                    weightPercentage: Number(event.target.value || 0),
                  })
                }
              />
              {!readOnly ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => removeCriterion(index)}
                  disabled={criteria.length <= 1}
                  aria-label="Remove criterion"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Input
                placeholder="Description (optional)"
                value={criterion.description ?? ""}
                disabled={readOnly}
                onChange={(event) =>
                  updateCriterion(index, { description: event.target.value })
                }
              />
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={criterion.isRequired}
                    disabled={readOnly}
                    onCheckedChange={(checked) =>
                      updateCriterion(index, { isRequired: checked })
                    }
                  />
                  Required
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={criterion.isActive}
                    disabled={readOnly}
                    onCheckedChange={(checked) =>
                      updateCriterion(index, { isActive: checked })
                    }
                  />
                  Active
                </label>
              </div>
            </div>
          </div>
        ))}
      </div>

      {!readOnly ? (
        <Button type="button" variant="outline" onClick={addCriterion}>
          <Plus className="mr-2 h-4 w-4" />
          Add criterion
        </Button>
      ) : null}
    </div>
  );
}
