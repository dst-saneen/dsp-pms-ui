"use client";

import { useEffect, useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { LookupSelect, RequiredLabel } from "@/components/forms";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useManagers } from "@/features/lookups/hooks/use-lookups";
import { JOB_APPLICATION_STATUS } from "../../types/enums";
import { useJobApplications } from "../../applications/hooks/use-job-applications";
import {
  INTERVIEW_MODE_OPTIONS,
  INTERVIEW_TIMEZONE_OPTIONS,
  resolveLocalInterviewTimezone,
} from "../constants/interview-options";
import { useScheduleInterview } from "../hooks/use-interviews";
import type { ScheduleInterviewDto } from "../types/interview";
import {
  scheduleInterviewSchema,
  type ScheduleInterviewFormValues,
} from "../validation/interview-schema";

interface ScheduleInterviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultApplicationId?: string;
}

export function ScheduleInterviewDialog({
  open,
  onOpenChange,
  defaultApplicationId,
}: ScheduleInterviewDialogProps) {
  const scheduleMutation = useScheduleInterview();
  const defaultTimezone = useMemo(
    () => resolveLocalInterviewTimezone(),
    [],
  );
  const timezoneOptions = useMemo(
    () =>
      INTERVIEW_TIMEZONE_OPTIONS.some(
        (option) => option.value === defaultTimezone,
      )
        ? INTERVIEW_TIMEZONE_OPTIONS
        : [
            { value: defaultTimezone, label: defaultTimezone },
            ...INTERVIEW_TIMEZONE_OPTIONS,
          ],
    [defaultTimezone],
  );
  const interviewApplicationsQuery = useJobApplications({
    status: JOB_APPLICATION_STATUS.INTERVIEW,
    limit: 100,
  });
  const screeningApplicationsQuery = useJobApplications({
    status: JOB_APPLICATION_STATUS.SCREENING,
    limit: 100,
  });

  const applications = useMemo(
    () => [
      ...(interviewApplicationsQuery.data?.items ?? []),
      ...(screeningApplicationsQuery.data?.items ?? []),
    ],
    [interviewApplicationsQuery.data, screeningApplicationsQuery.data],
  );

  const applicationItems = useMemo(
    () =>
      applications.map((application) => ({
        id: application.id,
        code: application.applicationNumber,
        name: `${application.candidateFirstName} ${application.candidateLastName} · ${application.openingTitle}`,
      })),
    [applications],
  );

  const form = useForm<ScheduleInterviewFormValues>({
    resolver: zodResolver(scheduleInterviewSchema),
    defaultValues: {
      jobApplicationId: defaultApplicationId ?? "",
      roundNumber: 1,
      roundName: "Technical round",
      isRequired: true,
      scheduledDate: "",
      scheduledTime: "10:00",
      durationMinutes: 60,
      timezone: defaultTimezone,
      mode: "VIDEO",
      locationOrLink: "",
      evaluationDeadline: "",
      panelMemberEmployeeIds: [],
      leadInterviewerEmployeeId: "",
    },
  });

  const applicationId = useWatch({
    control: form.control,
    name: "jobApplicationId",
  });
  const panelIds = useWatch({
    control: form.control,
    name: "panelMemberEmployeeIds",
  });
  const isRequired = useWatch({
    control: form.control,
    name: "isRequired",
  });
  const leadInterviewerEmployeeId = useWatch({
    control: form.control,
    name: "leadInterviewerEmployeeId",
  });
  const selectedApplication = applications.find(
    (item) => item.id === applicationId,
  );
  const managersQuery = useManagers(selectedApplication?.companyId);

  useEffect(() => {
    if (!open) return;
    form.reset({
      jobApplicationId: defaultApplicationId ?? "",
      roundNumber: 1,
      roundName: "Technical round",
      isRequired: true,
      scheduledDate: "",
      scheduledTime: "10:00",
      durationMinutes: 60,
      timezone: defaultTimezone,
      mode: "VIDEO",
      locationOrLink: "",
      evaluationDeadline: "",
      panelMemberEmployeeIds: [],
      leadInterviewerEmployeeId: "",
    });
  }, [open, defaultApplicationId, defaultTimezone, form]);

  const handleSubmit = async (values: ScheduleInterviewFormValues) => {
    const managers = managersQuery.data ?? [];
    const payload: ScheduleInterviewDto = {
      jobApplicationId: values.jobApplicationId,
      applicationVersion: selectedApplication?.version,
      roundNumber: values.roundNumber,
      roundName: values.roundName,
      isRequired: values.isRequired,
      scheduledDate: values.scheduledDate,
      scheduledTime: values.scheduledTime,
      durationMinutes: values.durationMinutes,
      timezone: values.timezone,
      mode: values.mode,
      locationOrLink: values.locationOrLink?.trim() || undefined,
      evaluationDeadline: values.evaluationDeadline,
      leadInterviewerEmployeeId: values.leadInterviewerEmployeeId,
      panelMembers: values.panelMemberEmployeeIds.map((employeeId) => ({
        employeeId,
        employeeName:
          managers.find((item) => item.id === employeeId)?.name ?? "Panel member",
      })),
    };

    await scheduleMutation.mutateAsync(payload);
    onOpenChange(false);
  };

  const togglePanelMember = (employeeId: string, checked: boolean) => {
    const current = form.getValues("panelMemberEmployeeIds");
    if (checked) {
      form.setValue("panelMemberEmployeeIds", [...current, employeeId]);
      return;
    }

    form.setValue(
      "panelMemberEmployeeIds",
      current.filter((id) => id !== employeeId),
    );

    if (form.getValues("leadInterviewerEmployeeId") === employeeId) {
      form.setValue("leadInterviewerEmployeeId", "");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Schedule interview</DialogTitle>
        </DialogHeader>

        <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
          <div className="space-y-2">
            <RequiredLabel>Application</RequiredLabel>
            <LookupSelect
              value={applicationId}
              onChange={(value) => form.setValue("jobApplicationId", value)}
              items={applicationItems}
              loading={
                interviewApplicationsQuery.isLoading ||
                screeningApplicationsQuery.isLoading
              }
              placeholder="Select a screening or interview application"
              clearable={false}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <RequiredLabel>Round number</RequiredLabel>
              <Input
                type="number"
                min={1}
                {...form.register("roundNumber", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <RequiredLabel>Round name</RequiredLabel>
              <Input {...form.register("roundName")} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={Boolean(isRequired)}
              onCheckedChange={(checked) => form.setValue("isRequired", checked)}
            />
            Required round
          </label>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <RequiredLabel>Date</RequiredLabel>
              <Input type="date" {...form.register("scheduledDate")} />
            </div>
            <div className="space-y-2">
              <RequiredLabel>Time</RequiredLabel>
              <Input type="time" {...form.register("scheduledTime")} />
            </div>
            <div className="space-y-2">
              <RequiredLabel>Duration (min)</RequiredLabel>
              <Input
                type="number"
                min={15}
                {...form.register("durationMinutes", { valueAsNumber: true })}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <RequiredLabel>Timezone</RequiredLabel>
              <Controller
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timezoneOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <RequiredLabel>Mode</RequiredLabel>
              <Controller
                control={form.control}
                name="mode"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INTERVIEW_MODE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Location or meeting link</label>
            <Input {...form.register("locationOrLink")} />
          </div>

          <div className="space-y-2">
            <RequiredLabel>Evaluation deadline</RequiredLabel>
            <Input type="date" {...form.register("evaluationDeadline")} />
          </div>

          <div className="space-y-3 rounded-xl border p-4">
            <RequiredLabel>Panel members</RequiredLabel>
            {(managersQuery.data ?? []).map((manager) => (
              <label key={manager.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 rounded border"
                  checked={panelIds.includes(manager.id)}
                  onChange={(event) =>
                    togglePanelMember(manager.id, event.target.checked)
                  }
                />
                {manager.name}
              </label>
            ))}
          </div>

          <div className="space-y-2">
            <RequiredLabel>Lead interviewer</RequiredLabel>
            <LookupSelect
              value={leadInterviewerEmployeeId}
              onChange={(value) => form.setValue("leadInterviewerEmployeeId", value)}
              items={(managersQuery.data ?? []).filter((item) =>
                panelIds.includes(item.id),
              )}
              loading={managersQuery.isLoading}
              placeholder="Select lead from panel"
              clearable={false}
              disabled={panelIds.length === 0}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={scheduleMutation.isPending}>
              {scheduleMutation.isPending ? "Scheduling…" : "Schedule interview"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
