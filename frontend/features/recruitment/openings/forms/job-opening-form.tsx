"use client";

import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { FormSection, LookupSelect, RequiredLabel } from "@/components/forms";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useBranches,
  useCompanies,
  useDepartments,
  useDesignations,
  useManagers,
} from "@/features/lookups/hooks/use-lookups";
import { useCompanyGroups } from "@/features/lookups/hooks/use-company-groups";
import { cn } from "@/lib/utils";

import { EMPLOYMENT_TYPE_OPTIONS } from "../constants/employment-types";
import type { JobOpening } from "../types/job-opening";
import type { CreateJobOpeningDto } from "../types/create-job-opening";
import {
  OPENING_FORM_FIELD_IDS,
  OPENING_FORM_SECTION_IDS,
  type OpeningFormFocusTarget,
} from "../utils/publication-checklist-focus";
import {
  jobOpeningSchema,
  type JobOpeningFormValues,
} from "../validation/job-opening-schema";
import { CriterionListEditor } from "../components/criterion-list-editor";

interface JobOpeningFormProps {
  opening?: JobOpening | null;
  readOnly?: boolean;
  onSubmit: (payload: CreateJobOpeningDto) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  onInvalid?: (messages: string[]) => void;
  highlightTarget?: OpeningFormFocusTarget | null;
}

function mapOpeningToFormValues(opening: JobOpening): JobOpeningFormValues {
  return {
    companyGroupId: opening.companyGroupId,
    companyId: opening.companyId,
    branchId: opening.branchId,
    departmentId: opening.departmentId,
    designationId: opening.designationId,
    hiringManagerEmployeeId: opening.hiringManagerEmployeeId,
    title: opening.title,
    description: opening.description ?? "",
    employmentType: opening.employmentType,
    location: opening.location ?? "",
    headcount: opening.headcount.approved,
    targetJoiningDate: opening.targetJoiningDate?.slice(0, 10) ?? "",
    applicationDeadline: opening.applicationDeadline.slice(0, 10),
    criteria: opening.criteria.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description ?? "",
      weightPercentage: item.weightPercentage,
      displayOrder: item.displayOrder,
      isRequired: item.isRequired,
      isActive: item.isActive,
    })),
  };
}

function createDefaultValues(): JobOpeningFormValues {
  return {
    companyGroupId: "",
    companyId: "",
    branchId: "",
    departmentId: "",
    designationId: "",
    hiringManagerEmployeeId: "",
    title: "",
    description: "",
    employmentType: "FULL_TIME",
    location: "",
    headcount: 1,
    targetJoiningDate: "",
    applicationDeadline: "",
    criteria: [
      {
        name: "Role fit",
        description: "",
        weightPercentage: 50,
        displayOrder: 0,
        isRequired: true,
        isActive: true,
      },
      {
        name: "Communication",
        description: "",
        weightPercentage: 50,
        displayOrder: 1,
        isRequired: true,
        isActive: true,
      },
    ],
  };
}

function fieldHighlightClass(
  target: OpeningFormFocusTarget | null | undefined,
  fieldId: OpeningFormFocusTarget,
) {
  return cn(
    "space-y-2 rounded-lg transition-shadow",
    target === fieldId && "ring-2 ring-warning ring-offset-2",
  );
}

export function JobOpeningForm({
  opening,
  readOnly = false,
  onSubmit,
  onDirtyChange,
  onInvalid,
  highlightTarget = null,
}: JobOpeningFormProps) {
  const form = useForm<JobOpeningFormValues>({
    resolver: zodResolver(jobOpeningSchema),
    defaultValues: createDefaultValues(),
  });

  const companyId = useWatch({ control: form.control, name: "companyId" });
  const branchId = useWatch({ control: form.control, name: "branchId" });
  const criteria = useWatch({ control: form.control, name: "criteria" });

  const companyGroupsQuery = useCompanyGroups();
  const companiesQuery = useCompanies();
  const branchesQuery = useBranches(companyId || undefined);
  const departmentsQuery = useDepartments(branchId || undefined, {
    enabled: Boolean(branchId),
  });
  const designationsQuery = useDesignations(companyId || undefined);
  const managersQuery = useManagers(companyId || undefined);

  useEffect(() => {
    if (opening) {
      form.reset(mapOpeningToFormValues(opening));
      return;
    }

    form.reset(createDefaultValues());
  }, [opening, form]);

  useEffect(() => {
    onDirtyChange?.(form.formState.isDirty);
  }, [form.formState.isDirty, onDirtyChange]);

  const isSectionHighlighted = (sectionId: OpeningFormFocusTarget) =>
    highlightTarget === sectionId;

  return (
    <form
      id="job-opening-form"
      className="space-y-5"
      onSubmit={form.handleSubmit(
        (values) =>
          onSubmit(
            buildJobOpeningPayload(values, {
              companyGroups: companyGroupsQuery.data ?? [],
              companies: companiesQuery.data ?? [],
              branches: branchesQuery.data ?? [],
              departments: departmentsQuery.data ?? [],
              designations: designationsQuery.data ?? [],
              managers: managersQuery.data ?? [],
            }),
          ),
        (errors) => {
          const messages = Object.values(errors)
            .map((error) => {
              if (!error) return undefined;
              if ("message" in error && typeof error.message === "string") {
                return error.message;
              }
              return undefined;
            })
            .filter((message): message is string => Boolean(message));
          onInvalid?.(
            messages.length
              ? messages
              : ["Fix the highlighted fields before saving."],
          );
        },
      )}
    >
      <FormSection
        id={OPENING_FORM_SECTION_IDS.role}
        title="Role"
        description="Job title, description, and employment basics."
        highlighted={isSectionHighlighted(OPENING_FORM_SECTION_IDS.role)}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div
            className={cn(
              fieldHighlightClass(highlightTarget, OPENING_FORM_FIELD_IDS.title),
              "md:col-span-2",
            )}
          >
            <RequiredLabel>Title</RequiredLabel>
            <Input
              id={OPENING_FORM_FIELD_IDS.title}
              disabled={readOnly}
              {...form.register("title")}
            />
            {form.formState.errors.title ? (
              <p className="text-sm text-destructive">
                {form.formState.errors.title.message}
              </p>
            ) : null}
          </div>

          <div
            className={cn(
              fieldHighlightClass(
                highlightTarget,
                OPENING_FORM_FIELD_IDS.description,
              ),
              "md:col-span-2",
            )}
          >
            <label
              htmlFor={OPENING_FORM_FIELD_IDS.description}
              className="text-sm font-medium"
            >
              Description
            </label>
            <Textarea
              id={OPENING_FORM_FIELD_IDS.description}
              rows={4}
              disabled={readOnly}
              {...form.register("description")}
            />
          </div>

          <div
            className={fieldHighlightClass(
              highlightTarget,
              OPENING_FORM_FIELD_IDS.employmentType,
            )}
          >
            <RequiredLabel>Employment type</RequiredLabel>
            <Controller
              control={form.control}
              name="employmentType"
              render={({ field }) => (
                <Select
                  value={field.value}
                  disabled={readOnly}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger id={OPENING_FORM_FIELD_IDS.employmentType}>
                    <SelectValue placeholder="Select employment type" />
                  </SelectTrigger>
                  <SelectContent>
                    {EMPLOYMENT_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div
            className={fieldHighlightClass(
              highlightTarget,
              OPENING_FORM_FIELD_IDS.location,
            )}
          >
            <label
              htmlFor={OPENING_FORM_FIELD_IDS.location}
              className="text-sm font-medium"
            >
              Location
            </label>
            <Input
              id={OPENING_FORM_FIELD_IDS.location}
              disabled={readOnly}
              {...form.register("location")}
            />
          </div>
        </div>
      </FormSection>

      <FormSection
        id={OPENING_FORM_SECTION_IDS.organization}
        title="Organization"
        description="Company hierarchy for this opening."
        highlighted={isSectionHighlighted(
          OPENING_FORM_SECTION_IDS.organization,
        )}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div
            id={OPENING_FORM_FIELD_IDS.companyGroupId}
            className={fieldHighlightClass(
              highlightTarget,
              OPENING_FORM_FIELD_IDS.companyGroupId,
            )}
          >
            <RequiredLabel>Company group</RequiredLabel>
            <Controller
              control={form.control}
              name="companyGroupId"
              render={({ field }) => (
                <LookupSelect
                  value={field.value}
                  onChange={field.onChange}
                  items={companyGroupsQuery.data ?? []}
                  loading={companyGroupsQuery.isLoading}
                  placeholder="Select company group"
                  disabled={readOnly}
                />
              )}
            />
          </div>

          <div
            id={OPENING_FORM_FIELD_IDS.companyId}
            className={fieldHighlightClass(
              highlightTarget,
              OPENING_FORM_FIELD_IDS.companyId,
            )}
          >
            <RequiredLabel>Company</RequiredLabel>
            <Controller
              control={form.control}
              name="companyId"
              render={({ field }) => (
                <LookupSelect
                  value={field.value}
                  onChange={(value) => {
                    field.onChange(value);
                    form.setValue("branchId", "");
                    form.setValue("departmentId", "");
                    form.setValue("designationId", "");
                    form.setValue("hiringManagerEmployeeId", "");
                  }}
                  items={companiesQuery.data ?? []}
                  loading={companiesQuery.isLoading}
                  placeholder="Select company"
                  disabled={readOnly}
                />
              )}
            />
          </div>

          <div
            id={OPENING_FORM_FIELD_IDS.branchId}
            className={fieldHighlightClass(
              highlightTarget,
              OPENING_FORM_FIELD_IDS.branchId,
            )}
          >
            <RequiredLabel>Branch</RequiredLabel>
            <Controller
              control={form.control}
              name="branchId"
              render={({ field }) => (
                <LookupSelect
                  value={field.value}
                  onChange={(value) => {
                    field.onChange(value);
                    form.setValue("departmentId", "");
                  }}
                  items={branchesQuery.data ?? []}
                  loading={branchesQuery.isLoading}
                  placeholder="Select branch"
                  disabled={readOnly || !companyId}
                />
              )}
            />
          </div>

          <div
            id={OPENING_FORM_FIELD_IDS.departmentId}
            className={fieldHighlightClass(
              highlightTarget,
              OPENING_FORM_FIELD_IDS.departmentId,
            )}
          >
            <RequiredLabel>Department</RequiredLabel>
            <Controller
              control={form.control}
              name="departmentId"
              render={({ field }) => (
                <LookupSelect
                  value={field.value}
                  onChange={field.onChange}
                  items={departmentsQuery.data ?? []}
                  loading={departmentsQuery.isLoading}
                  placeholder="Select department"
                  disabled={readOnly || !branchId}
                />
              )}
            />
          </div>

          <div
            id={OPENING_FORM_FIELD_IDS.designationId}
            className={fieldHighlightClass(
              highlightTarget,
              OPENING_FORM_FIELD_IDS.designationId,
            )}
          >
            <RequiredLabel>Designation</RequiredLabel>
            <Controller
              control={form.control}
              name="designationId"
              render={({ field }) => (
                <LookupSelect
                  value={field.value}
                  onChange={field.onChange}
                  items={designationsQuery.data ?? []}
                  loading={designationsQuery.isLoading}
                  placeholder="Select designation"
                  disabled={readOnly || !companyId}
                />
              )}
            />
          </div>
        </div>
      </FormSection>

      <FormSection
        id={OPENING_FORM_SECTION_IDS.hiring}
        title="Hiring"
        description="Hiring manager and approved headcount."
        highlighted={isSectionHighlighted(OPENING_FORM_SECTION_IDS.hiring)}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div
            id={OPENING_FORM_FIELD_IDS.hiringManagerEmployeeId}
            className={fieldHighlightClass(
              highlightTarget,
              OPENING_FORM_FIELD_IDS.hiringManagerEmployeeId,
            )}
          >
            <RequiredLabel>Hiring manager</RequiredLabel>
            <Controller
              control={form.control}
              name="hiringManagerEmployeeId"
              render={({ field }) => (
                <LookupSelect
                  value={field.value}
                  onChange={field.onChange}
                  items={managersQuery.data ?? []}
                  loading={managersQuery.isLoading}
                  placeholder="Select hiring manager"
                  disabled={readOnly || !companyId}
                />
              )}
            />
          </div>

          <div
            className={fieldHighlightClass(
              highlightTarget,
              OPENING_FORM_FIELD_IDS.headcount,
            )}
          >
            <RequiredLabel>Headcount</RequiredLabel>
            <Input
              id={OPENING_FORM_FIELD_IDS.headcount}
              type="number"
              min={1}
              disabled={readOnly}
              {...form.register("headcount", { valueAsNumber: true })}
            />
            {form.formState.errors.headcount ? (
              <p className="text-sm text-destructive">
                {form.formState.errors.headcount.message}
              </p>
            ) : null}
          </div>
        </div>
      </FormSection>

      <FormSection
        id={OPENING_FORM_SECTION_IDS.dates}
        title="Dates"
        description="Joining target and application deadline."
        highlighted={isSectionHighlighted(OPENING_FORM_SECTION_IDS.dates)}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div
            className={fieldHighlightClass(
              highlightTarget,
              OPENING_FORM_FIELD_IDS.targetJoiningDate,
            )}
          >
            <label
              htmlFor={OPENING_FORM_FIELD_IDS.targetJoiningDate}
              className="text-sm font-medium"
            >
              Target joining date
            </label>
            <Input
              id={OPENING_FORM_FIELD_IDS.targetJoiningDate}
              type="date"
              disabled={readOnly}
              {...form.register("targetJoiningDate")}
            />
          </div>

          <div
            className={fieldHighlightClass(
              highlightTarget,
              OPENING_FORM_FIELD_IDS.applicationDeadline,
            )}
          >
            <RequiredLabel>Application deadline</RequiredLabel>
            <Input
              id={OPENING_FORM_FIELD_IDS.applicationDeadline}
              type="date"
              disabled={readOnly}
              {...form.register("applicationDeadline")}
            />
            {form.formState.errors.applicationDeadline ? (
              <p className="text-sm text-destructive">
                {form.formState.errors.applicationDeadline.message}
              </p>
            ) : null}
          </div>
        </div>
      </FormSection>

      <FormSection
        id={OPENING_FORM_SECTION_IDS.criteria}
        title="Criteria"
        description="Active evaluation weights must total 100% before publish."
        highlighted={isSectionHighlighted(OPENING_FORM_SECTION_IDS.criteria)}
      >
        <div id={OPENING_FORM_FIELD_IDS.criteria}>
          <Controller
            control={form.control}
            name="criteria"
            render={({ field }) => (
              <CriterionListEditor
                criteria={criteria}
                readOnly={readOnly}
                onChange={field.onChange}
              />
            )}
          />
          {form.formState.errors.criteria?.message ? (
            <p className="mt-2 text-sm text-destructive">
              {form.formState.errors.criteria.message}
            </p>
          ) : null}
        </div>
      </FormSection>
    </form>
  );
}

export function buildJobOpeningPayload(
  values: JobOpeningFormValues,
  lookups: {
    companyGroups: { id: string; name: string }[];
    companies: { id: string; name: string; code?: string }[];
    branches: { id: string; name: string }[];
    departments: { id: string; name: string }[];
    designations: { id: string; name: string }[];
    managers: { id: string; name: string }[];
  },
) {
  return {
    ...values,
    description: values.description?.trim() || undefined,
    location: values.location?.trim() || undefined,
    targetJoiningDate: values.targetJoiningDate || undefined,
    companyGroupName: lookups.companyGroups.find(
      (item) => item.id === values.companyGroupId,
    )?.name,
    companyCode: lookups.companies.find((item) => item.id === values.companyId)
      ?.code,
    companyName: lookups.companies.find((item) => item.id === values.companyId)
      ?.name,
    branchName: lookups.branches.find((item) => item.id === values.branchId)
      ?.name,
    departmentName: lookups.departments.find(
      (item) => item.id === values.departmentId,
    )?.name,
    designationName: lookups.designations.find(
      (item) => item.id === values.designationId,
    )?.name,
    hiringManagerName: lookups.managers.find(
      (item) => item.id === values.hiringManagerEmployeeId,
    )?.name,
    criteria: values.criteria.map((item, index) => ({
      ...item,
      description: item.description?.trim() || undefined,
      displayOrder: index,
    })),
  };
}
