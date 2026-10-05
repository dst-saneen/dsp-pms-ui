"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { StatusBadge } from "@/components/common/status-badge";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/services/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PROJECTS_ROUTES } from "../constants/permissions";
import { createOperationId, hasAllowedAction } from "../lib/allowed-actions";
import { statusToneFor } from "../lib/status-tone";
import { projectsKeys } from "../hooks/query-keys";
import {
  useProject,
  useProjectCommand,
  useProjectFinanceSummary,
  useProjectStages,
  useProjectSummary,
  useProjectTasks,
  useProjectTeam,
  useProjectTimeSummary,
} from "../hooks/use-projects";
import { ProjectsApiService } from "../services/projects-api.service";
import type {
  EligibilityCandidate,
  ProjectAction,
  ProjectStage,
  ProjectTask,
  ProjectTaskAction,
  ProjectTeamMember,
} from "../types/project.types";
import { ProjectDocumentUpload } from "./project-document-upload";
import { ProjectTaskDetailDialog } from "./project-task-detail-dialog";
import { ProjectsPathBanner } from "./projects-path-banner";

const LIFECYCLE_ACTIONS: Array<{
  action: ProjectAction;
  command: "activate" | "hold" | "resume" | "complete" | "cancel" | "archive";
  label: string;
  needsReason?: boolean;
}> = [
  { action: "ACTIVATE", command: "activate", label: "Activate" },
  { action: "HOLD", command: "hold", label: "Hold", needsReason: true },
  { action: "RESUME", command: "resume", label: "Resume" },
  { action: "COMPLETE", command: "complete", label: "Complete" },
  { action: "CANCEL", command: "cancel", label: "Cancel", needsReason: true },
  {
    action: "ARCHIVE",
    command: "archive",
    label: "Archive",
    needsReason: true,
  },
];

const TASK_ACTION_BUTTONS: Array<{
  action: ProjectTaskAction;
  label: string;
  variant?: "outline" | "destructive" | "default";
}> = [
  { action: "ASSIGN", label: "Assign", variant: "outline" },
  { action: "REASSIGN", label: "Reassign", variant: "outline" },
  { action: "UNASSIGN", label: "Unassign", variant: "outline" },
  { action: "START", label: "Start", variant: "outline" },
  { action: "SUBMIT_REVIEW", label: "Submit review", variant: "outline" },
  { action: "RETURN", label: "Return", variant: "outline" },
  { action: "COMPLETE", label: "Complete" },
  { action: "CANCEL", label: "Cancel", variant: "destructive" },
];

function toDateInput(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 10);
}

function ProjectTabNext({
  nextLabel,
  onNext,
  backLabel,
  onBack,
  related,
}: {
  nextLabel?: string;
  onNext?: () => void;
  backLabel?: string;
  onBack?: () => void;
  related?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
      <p className="text-muted-foreground text-xs">{related}</p>
      <div className="flex flex-wrap gap-2">
        {onBack && backLabel ? (
          <Button type="button" size="sm" variant="outline" onClick={onBack}>
            {backLabel}
          </Button>
        ) : null}
        {onNext && nextLabel ? (
          <Button type="button" size="sm" onClick={onNext}>
            {nextLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function ProjectDetailWorkspace({ projectId }: { projectId: string }) {
  const projectQuery = useProject(projectId);
  const stagesQuery = useProjectStages(projectId);
  const teamQuery = useProjectTeam(projectId);
  const tasksQuery = useProjectTasks(projectId);
  const summaryQuery = useProjectSummary(projectId);
  const timeQuery = useProjectTimeSummary(projectId);
  const financeQuery = useProjectFinanceSummary(projectId);
  const command = useProjectCommand(projectId);
  const queryClient = useQueryClient();

  const [reasonOpen, setReasonOpen] = useState(false);
  const [pendingCommand, setPendingCommand] = useState<
    (typeof LIFECYCLE_ACTIONS)[number] | null
  >(null);
  const [reason, setReason] = useState("");
  const [activating, setActivating] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editManagerId, setEditManagerId] = useState("");
  const [editManagers, setEditManagers] = useState<EligibilityCandidate[]>([]);

  const [stageOpen, setStageOpen] = useState(false);
  const [stageName, setStageName] = useState("");
  const [sequenceNo, setSequenceNo] = useState("1");
  const [selectedStage, setSelectedStage] = useState<ProjectStage | null>(null);
  const [stageEditOpen, setStageEditOpen] = useState(false);
  const [stageActionOpen, setStageActionOpen] = useState(false);
  const [stageAction, setStageAction] = useState<
    "ACTIVATE" | "COMPLETE" | "CANCEL"
  >("ACTIVATE");
  const [stageEditName, setStageEditName] = useState("");
  const [stageEditDescription, setStageEditDescription] = useState("");
  const [stageEditSequence, setStageEditSequence] = useState("1");
  const [stageEditStartDate, setStageEditStartDate] = useState("");
  const [stageEditEndDate, setStageEditEndDate] = useState("");
  const [stageReason, setStageReason] = useState("");

  const [teamOpen, setTeamOpen] = useState(false);
  const [memberEmployeeId, setMemberEmployeeId] = useState("");
  const [memberRole, setMemberRole] = useState("MEMBER");
  const [candidates, setCandidates] = useState<EligibilityCandidate[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberResultKeyword, setMemberResultKeyword] = useState("");
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberLookupError, setMemberLookupError] = useState<string | null>(null);
  const memberRequestRef = useRef(0);
  const [selectedTeamMember, setSelectedTeamMember] =
    useState<ProjectTeamMember | null>(null);
  const [teamEditOpen, setTeamEditOpen] = useState(false);
  const [teamEndOpen, setTeamEndOpen] = useState(false);
  const [teamEditRole, setTeamEditRole] = useState("");
  const [teamEditAllocation, setTeamEditAllocation] = useState("");
  const [teamEditStartDate, setTeamEditStartDate] = useState("");
  const [teamEditEndDate, setTeamEditEndDate] = useState("");
  const [teamEndReason, setTeamEndReason] = useState("");

  const [taskOpen, setTaskOpen] = useState(false);
  const [taskName, setTaskName] = useState("");
  const [taskStageId, setTaskStageId] = useState("");
  const [taskPlannedHours, setTaskPlannedHours] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignMode, setAssignMode] = useState<"ASSIGN" | "REASSIGN">("ASSIGN");
  const [assignTask, setAssignTask] = useState<ProjectTask | null>(null);
  const [assigneeId, setAssigneeId] = useState("");
  const [assigneeRole, setAssigneeRole] = useState("ASSIGNEE");
  const [assignReason, setAssignReason] = useState("");
  const [assignees, setAssignees] = useState<EligibilityCandidate[]>([]);
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [assigneeResultKeyword, setAssigneeResultKeyword] = useState("");
  const [assigneesLoading, setAssigneesLoading] = useState(false);
  const [assigneeLookupError, setAssigneeLookupError] = useState<string | null>(null);
  const assigneeRequestRef = useRef(0);
  const [taskDetailId, setTaskDetailId] = useState<string | null>(null);
  const [taskReasonOpen, setTaskReasonOpen] = useState(false);
  const [pendingTaskCommand, setPendingTaskCommand] = useState<{
    task: ProjectTask;
    action: "RETURN" | "CANCEL";
  } | null>(null);
  const [taskReason, setTaskReason] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  const project = projectQuery.data;

  const invalidateProject = () => {
    void queryClient.invalidateQueries({
      queryKey: projectsKeys.detail(projectId),
    });
    void queryClient.invalidateQueries({
      queryKey: projectsKeys.summary(projectId),
    });
  };

  const invalidateTasks = () => {
    void queryClient.invalidateQueries({
      queryKey: projectsKeys.tasks(projectId),
    });
    void queryClient.invalidateQueries({
      queryKey: projectsKeys.summary(projectId),
    });
  };

  const invalidateStages = () => {
    void queryClient.invalidateQueries({
      queryKey: projectsKeys.stages(projectId),
    });
    void queryClient.invalidateQueries({
      queryKey: projectsKeys.summary(projectId),
    });
  };

  const invalidateTeam = () => {
    void queryClient.invalidateQueries({
      queryKey: projectsKeys.team(projectId),
    });
    void queryClient.invalidateQueries({
      queryKey: projectsKeys.summary(projectId),
    });
  };

  const updateMutation = useMutation({
    mutationFn: () =>
      ProjectsApiService.update(projectId, {
        expectedVersion: project!.actionRequirements.expectedVersion,
        operationId: createOperationId(),
        projectName: editName.trim(),
        description: editDescription.trim() || null,
        startDate: editStartDate || null,
        endDate: editEndDate || null,
        projectManagerId: editManagerId || null,
      }),
    onSuccess: () => {
      toast.success("Project updated");
      setEditOpen(false);
      invalidateProject();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const createStage = useMutation({
    mutationFn: () =>
      ProjectsApiService.createStage(projectId, {
        stageName: stageName.trim(),
        sequenceNo: Number(sequenceNo) || 1,
        operationId: createOperationId(),
      }),
    onSuccess: () => {
      toast.success("Stage created");
      setStageOpen(false);
      setStageName("");
      setSequenceNo("1");
      void queryClient.invalidateQueries({
        queryKey: projectsKeys.stages(projectId),
      });
      void queryClient.invalidateQueries({
        queryKey: projectsKeys.summary(projectId),
      });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const updateStageMutation = useMutation({
    mutationFn: () =>
      ProjectsApiService.updateStage(projectId, selectedStage!.id, {
        expectedVersion: selectedStage!.actionRequirements.expectedVersion,
        operationId: createOperationId(),
        stageName: stageEditName.trim(),
        description: stageEditDescription.trim() || null,
        sequenceNo: Number(stageEditSequence),
        startDate: stageEditStartDate || null,
        endDate: stageEditEndDate || null,
      }),
    onSuccess: () => {
      toast.success("Stage updated");
      setStageEditOpen(false);
      invalidateStages();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const stageCommandMutation = useMutation({
    mutationFn: () =>
      ProjectsApiService.stageCommand(
        projectId,
        selectedStage!.id,
        stageAction.toLowerCase() as "activate" | "complete" | "cancel",
        {
          expectedVersion: selectedStage!.actionRequirements.expectedVersion,
          operationId: createOperationId(),
          reason: stageAction === "CANCEL" ? stageReason.trim() : undefined,
        },
      ),
    onSuccess: () => {
      toast.success(
        stageAction === "COMPLETE"
          ? "Stage completed"
          : stageAction === "CANCEL"
            ? "Stage cancelled"
            : "Stage activated",
      );
      setStageActionOpen(false);
      invalidateStages();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
      invalidateStages();
    },
  });

  const addMember = useMutation({
    mutationFn: () =>
      ProjectsApiService.addTeamMember(projectId, {
        employeeId: memberEmployeeId,
        role: memberRole.trim() || "MEMBER",
        operationId: createOperationId(),
      }),
    onSuccess: () => {
      toast.success("Team member added");
      setTeamOpen(false);
      void queryClient.invalidateQueries({
        queryKey: projectsKeys.team(projectId),
      });
      void queryClient.invalidateQueries({
        queryKey: projectsKeys.summary(projectId),
      });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const updateTeamMemberMutation = useMutation({
    mutationFn: () =>
      ProjectsApiService.updateTeamMember(projectId, selectedTeamMember!.id, {
        expectedVersion: selectedTeamMember!.actionRequirements.expectedVersion,
        operationId: createOperationId(),
        role: teamEditRole.trim(),
        allocationPercentage: teamEditAllocation.trim(),
        startDate: teamEditStartDate || null,
        endDate: teamEditEndDate || null,
      }),
    onSuccess: () => {
      toast.success("Team member updated");
      setTeamEditOpen(false);
      invalidateTeam();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const endTeamMemberMutation = useMutation({
    mutationFn: () =>
      ProjectsApiService.endTeamMember(projectId, selectedTeamMember!.id, {
        expectedVersion: selectedTeamMember!.actionRequirements.expectedVersion,
        operationId: createOperationId(),
        reason: teamEndReason.trim(),
      }),
    onSuccess: () => {
      toast.success("Team member ended");
      setTeamEndOpen(false);
      invalidateTeam();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
      invalidateTeam();
    },
  });

  const createTask = useMutation({
    mutationFn: () =>
      ProjectsApiService.createTask(projectId, {
        stageId: taskStageId,
        taskName: taskName.trim(),
        plannedHours: taskPlannedHours.trim() || undefined,
        dueDate: taskDueDate || undefined,
        operationId: createOperationId(),
      }),
    onSuccess: () => {
      toast.success("Task created");
      setTaskOpen(false);
      setTaskName("");
      setTaskPlannedHours("");
      setTaskDueDate("");
      invalidateTasks();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const taskCommandMutation = useMutation({
    mutationFn: (input: {
      task: ProjectTask;
      action: "start" | "submit-review" | "return" | "complete" | "cancel";
      reason?: string;
    }) =>
      ProjectsApiService.taskCommand(projectId, input.task.id, input.action, {
        expectedVersion: input.task.actionRequirements.expectedVersion,
        operationId: createOperationId(),
        reason: input.reason,
      }),
    onSuccess: () => {
      toast.success("Task updated");
      invalidateTasks();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
      invalidateTasks();
    },
  });

  const assignMutation = useMutation({
    mutationFn: () => {
      const body = {
        employeeId: assigneeId,
        role: assigneeRole.trim() || "ASSIGNEE",
        expectedVersion: assignTask!.actionRequirements.expectedVersion,
        operationId: createOperationId(),
        reason: assignMode === "REASSIGN" ? assignReason.trim() : undefined,
      };
      return assignMode === "REASSIGN"
        ? ProjectsApiService.reassignTask(projectId, assignTask!.id, body)
        : ProjectsApiService.assignTask(projectId, assignTask!.id, body);
    },
    onSuccess: () => {
      toast.success(
        assignMode === "REASSIGN" ? "Task reassigned" : "Task assigned",
      );
      setAssignOpen(false);
      invalidateTasks();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const unassignMutation = useMutation({
    mutationFn: (task: ProjectTask) =>
      ProjectsApiService.unassignTask(projectId, task.id, {
        expectedVersion: task.actionRequirements.expectedVersion,
        operationId: createOperationId(),
      }),
    onSuccess: () => {
      toast.success("Task unassigned");
      invalidateTasks();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
      invalidateTasks();
    },
  });

  const visibleLifecycle = useMemo(
    () =>
      LIFECYCLE_ACTIONS.filter((item) =>
        hasAllowedAction(project?.allowedActions, item.action),
      ),
    [project?.allowedActions],
  );

  if (projectQuery.isLoading) {
    return <WorkspaceShell>Loading project…</WorkspaceShell>;
  }

  if (projectQuery.error || !project) {
    return (
      <WorkspaceShell>
        <p className="text-destructive">
          {projectQuery.error
            ? getApiErrorMessage(projectQuery.error)
            : "Project not found"}
        </p>
        <Button asChild variant="outline">
          <Link href={PROJECTS_ROUTES.list}>
            <ArrowLeft className="size-4" />
            Back to projects
          </Link>
        </Button>
      </WorkspaceShell>
    );
  }

  async function runLifecycle(item: (typeof LIFECYCLE_ACTIONS)[number]) {
    if (item.command === "activate") {
      setActivating(true);
      try {
        const preflight =
          await ProjectsApiService.getActivationPreflight(projectId);
        if (!preflight.ready) {
          const messages = preflight.blockers.map((b) => b.message);
          toast.error(
            messages.length
              ? `Cannot activate: ${messages.join(" · ")}`
              : "Cannot activate — preflight blockers present",
          );
          return;
        }
      } catch (error) {
        toast.error(getApiErrorMessage(error));
        return;
      } finally {
        setActivating(false);
      }
    }

    if (item.needsReason) {
      setPendingCommand(item);
      setReason("");
      setReasonOpen(true);
      return;
    }
    command.mutate({
      action: item.command,
      expectedVersion: project!.actionRequirements.expectedVersion,
      operationId: createOperationId(),
    });
  }

  async function openEditDialog() {
    setEditName(project!.projectName);
    setEditDescription(project!.description ?? "");
    setEditStartDate(toDateInput(project!.startDate));
    setEditEndDate(toDateInput(project!.endDate));
    setEditManagerId(project!.projectManagerId ?? "");
    setEditOpen(true);
    try {
      const rows = await ProjectsApiService.getManagerCandidates();
      setEditManagers(rows);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  }

  async function loadMemberCandidates(keyword?: string) {
    const request = ++memberRequestRef.current;
    setCandidates([]);
    setMemberEmployeeId("");
    setMemberLookupError(null);
    setMembersLoading(true);
    try {
      const rows = await ProjectsApiService.memberCandidates(projectId, keyword);
      if (request === memberRequestRef.current) {
        setCandidates(rows);
        setMemberResultKeyword(keyword ?? "");
      }
    } catch (error) {
      if (request === memberRequestRef.current) setMemberLookupError(getApiErrorMessage(error));
    } finally {
      if (request === memberRequestRef.current) setMembersLoading(false);
    }
  }

  async function openTeamDialog() {
    setMemberSearch("");
    setTeamOpen(true);
    await loadMemberCandidates();
  }

  function setTeamDialogOpen(open: boolean) {
    if (!open) {
      memberRequestRef.current += 1;
      setMembersLoading(false);
    }
    setTeamOpen(open);
  }

  async function loadAssigneeCandidates(taskId: string, keyword?: string) {
    const request = ++assigneeRequestRef.current;
    setAssignees([]);
    setAssigneeId("");
    setAssigneeLookupError(null);
    setAssigneesLoading(true);
    try {
      const rows = await ProjectsApiService.assigneeCandidates(projectId, taskId, keyword);
      if (request === assigneeRequestRef.current) {
        setAssignees(rows);
        setAssigneeResultKeyword(keyword ?? "");
      }
    } catch (error) {
      if (request === assigneeRequestRef.current) setAssigneeLookupError(getApiErrorMessage(error));
    } finally {
      if (request === assigneeRequestRef.current) setAssigneesLoading(false);
    }
  }

  async function openAssignDialog(
    task: ProjectTask,
    mode: "ASSIGN" | "REASSIGN",
  ) {
    setAssignTask(task);
    setAssignMode(mode);
    setAssigneeId("");
    setAssigneeRole("ASSIGNEE");
    setAssignReason("");
    setAssigneeSearch("");
    setAssignOpen(true);
    await loadAssigneeCandidates(task.id);
  }

  function setAssignDialogOpen(open: boolean) {
    if (!open) {
      assigneeRequestRef.current += 1;
      setAssigneesLoading(false);
    }
    setAssignOpen(open);
  }

  function openStageEdit(stage: ProjectStage) {
    setSelectedStage(stage);
    setStageEditName(stage.stageName);
    setStageEditDescription(stage.description ?? "");
    setStageEditSequence(String(stage.sequenceNo));
    setStageEditStartDate(toDateInput(stage.startDate));
    setStageEditEndDate(toDateInput(stage.endDate));
    setStageEditOpen(true);
  }

  function openStageAction(
    stage: ProjectStage,
    action: "ACTIVATE" | "COMPLETE" | "CANCEL",
  ) {
    setSelectedStage(stage);
    setStageAction(action);
    setStageReason("");
    setStageActionOpen(true);
  }

  function openTeamMemberEdit(member: ProjectTeamMember) {
    setSelectedTeamMember(member);
    setTeamEditRole(member.role);
    setTeamEditAllocation(member.allocationPercentage);
    setTeamEditStartDate(toDateInput(member.startDate));
    setTeamEditEndDate(toDateInput(member.endDate));
    setTeamEditOpen(true);
  }

  function openTeamMemberEnd(member: ProjectTeamMember) {
    setSelectedTeamMember(member);
    setTeamEndReason("");
    setTeamEndOpen(true);
  }

  function handleTaskAction(task: ProjectTask, action: ProjectTaskAction) {
    if (action === "ASSIGN" || action === "REASSIGN") {
      void openAssignDialog(task, action);
      return;
    }
    if (action === "UNASSIGN") {
      unassignMutation.mutate(task);
      return;
    }
    const commandMap: Partial<
      Record<
        ProjectTaskAction,
        "start" | "submit-review" | "return" | "complete" | "cancel"
      >
    > = {
      START: "start",
      SUBMIT_REVIEW: "submit-review",
      RETURN: "return",
      COMPLETE: "complete",
      CANCEL: "cancel",
    };
    const cmd = commandMap[action];
    if (!cmd) return;
    if (action === "RETURN" || action === "CANCEL") {
      setPendingTaskCommand({ task, action });
      setTaskReason("");
      setTaskReasonOpen(true);
      return;
    }
    taskCommandMutation.mutate({ task, action: cmd });
  }

  return (
    <WorkspaceShell>
      <ProjectsPathBanner
        current="detail"
        detailHref={PROJECTS_ROUTES.detail(projectId)}
        note="Setup order: Stages → Team → Tasks (assign) → Activate. Task path after Active: Assign → Start → Submit review → Return or Complete. Hold/Cancel need a reason."
      />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link href={PROJECTS_ROUTES.list}>
              <ArrowLeft className="size-4" />
              Projects
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold tracking-tight">
              {project.projectName}
            </h2>
            <StatusBadge
              label={project.status}
              tone={statusToneFor(project.status)}
            />
            <span className="text-muted-foreground text-sm">
              {project.projectCode} · {project.projectType}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasAllowedAction(project.allowedActions, "EDIT") ? (
            <Button variant="outline" onClick={() => void openEditDialog()}>
              Edit
            </Button>
          ) : null}
          {visibleLifecycle.map((item) => (
            <Button
              key={item.action}
              variant={item.action === "CANCEL" ? "destructive" : "outline"}
              disabled={command.isPending || activating}
              onClick={() => void runLifecycle(item)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="stages">Stages</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="time">Time</TabsTrigger>
          <TabsTrigger value="finance">Finance Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <p className="text-muted-foreground text-xs">
            Snapshot of the project. Follow the setup steps below in order
            before Activate.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                {
                  tab: "stages",
                  label: "1. Stages",
                  hint: "Add project phases",
                  done: (stagesQuery.data ?? []).length > 0,
                },
                {
                  tab: "team",
                  label: "2. Team",
                  hint: "Add people who will work",
                  done: (teamQuery.data ?? []).length > 0,
                },
                {
                  tab: "tasks",
                  label: "3. Tasks",
                  hint: "Create and assign work",
                  done: (tasksQuery.data ?? []).length > 0,
                },
                {
                  tab: "tasks",
                  label: "4. Activate",
                  hint: "Use Activate above when ready",
                  done: project.status === "ACTIVE" || project.status === "COMPLETED",
                },
              ] as const
            ).map((step) => (
              <button
                key={step.label}
                type="button"
                className="rounded-lg border bg-muted/20 px-3 py-2 text-left text-sm hover:bg-muted/40"
                onClick={() => setActiveTab(step.tab)}
              >
                <p className="font-medium">
                  {step.done ? "✓ " : ""}
                  {step.label}
                </p>
                <p className="text-muted-foreground text-xs">{step.hint}</p>
              </button>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Active team</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {summaryQuery.data?.team.activeMembers ?? "—"}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Documents</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {summaryQuery.data?.documents.count ?? "—"}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Description</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground text-sm">
                {project.description || "No description"}
              </CardContent>
            </Card>
          </div>
          <ProjectTabNext
            nextLabel="Next: Stages"
            onNext={() => setActiveTab("stages")}
            related={
              <>
                <Link className="underline" href={PROJECTS_ROUTES.myProjects}>
                  My projects
                </Link>
                {" · "}
                <Link className="underline" href={PROJECTS_ROUTES.list}>
                  All projects
                </Link>
              </>
            }
          />
        </TabsContent>

        <TabsContent value="stages" className="space-y-3">
          <p className="text-muted-foreground text-xs">
            Stages are phases of the project (e.g. Discovery, Delivery). Add at
            least one before creating tasks.
          </p>
          {hasAllowedAction(project.allowedActions, "MANAGE_STAGES") ||
          hasAllowedAction(project.allowedActions, "EDIT") ? (
            <Button onClick={() => setStageOpen(true)}>Add stage</Button>
          ) : null}
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(stagesQuery.data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">
                      No stages yet. Click <strong>Add stage</strong> first,
                      then add Team and Tasks.
                    </TableCell>
                  </TableRow>
                ) : (
                  (stagesQuery.data ?? []).map((stage) => (
                  <TableRow key={stage.id}>
                    <TableCell>{stage.sequenceNo}</TableCell>
                    <TableCell>{stage.stageCode}</TableCell>
                    <TableCell>{stage.stageName}</TableCell>
                    <TableCell>
                      <StatusBadge
                        label={stage.status}
                        tone={statusToneFor(stage.status)}
                      />
                    </TableCell>
                    <TableCell className="space-x-1 text-right">
                      {stage.allowedActions.includes("EDIT") ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openStageEdit(stage)}
                        >
                          Edit
                        </Button>
                      ) : null}
                      {stage.allowedActions.includes("ACTIVATE") ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openStageAction(stage, "ACTIVATE")}
                        >
                          Activate
                        </Button>
                      ) : null}
                      {stage.allowedActions.includes("COMPLETE") ? (
                        <Button
                          size="sm"
                          onClick={() => openStageAction(stage, "COMPLETE")}
                        >
                          Complete
                        </Button>
                      ) : null}
                      {stage.allowedActions.includes("CANCEL") ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => openStageAction(stage, "CANCEL")}
                        >
                          Cancel
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
                )}
              </TableBody>
            </Table>
          </div>
          <ProjectTabNext
            backLabel="Back: Overview"
            onBack={() => setActiveTab("overview")}
            nextLabel="Next: Team"
            onNext={() => setActiveTab("team")}
          />
        </TabsContent>

        <TabsContent value="team" className="space-y-3">
          <p className="text-muted-foreground text-xs">
            Only active team members can be assigned to tasks. Add the assignee
            (and usually the Project Manager) before Activate.
          </p>
          {hasAllowedAction(project.allowedActions, "MANAGE_TEAM") ? (
            <Button onClick={() => void openTeamDialog()}>Add member</Button>
          ) : null}
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Allocation</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(teamQuery.data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">
                      No team members yet. Add the employee who will do the
                      work, then create and Assign tasks.
                    </TableCell>
                  </TableRow>
                ) : (
                  (teamQuery.data ?? []).map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="font-medium">
                        {member.displayName || member.employeeId}
                      </div>
                      {member.employeeCode ? (
                        <div className="text-muted-foreground text-xs">
                          {member.employeeCode}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>{member.role}</TableCell>
                    <TableCell>{member.allocationPercentage}%</TableCell>
                    <TableCell>
                      <StatusBadge
                        label={member.status}
                        tone={statusToneFor(member.status)}
                      />
                    </TableCell>
                    <TableCell className="space-x-1 text-right">
                      {member.allowedActions.includes("EDIT") ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openTeamMemberEdit(member)}
                        >
                          Edit
                        </Button>
                      ) : null}
                      {member.allowedActions.includes("END") ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => openTeamMemberEnd(member)}
                        >
                          End
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
                )}
              </TableBody>
            </Table>
          </div>
          <ProjectTabNext
            backLabel="Back: Stages"
            onBack={() => setActiveTab("stages")}
            nextLabel="Next: Tasks"
            onNext={() => setActiveTab("tasks")}
          />
        </TabsContent>

        <TabsContent value="tasks" className="space-y-3">
          <p className="text-muted-foreground text-xs">
            Work items under a stage. Create → Assign team member → after
            Activate they Start and Submit for review. You Return or Complete.
            Related:{" "}
            <Link className="underline" href={PROJECTS_ROUTES.myProjects}>
              My projects
            </Link>
            {" · "}
            <Link className="underline" href={PROJECTS_ROUTES.myTimesheets}>
              My timesheets
            </Link>
          </p>
          {hasAllowedAction(project.allowedActions, "MANAGE_TASKS") ? (
            <Button
              disabled={(stagesQuery.data ?? []).length === 0}
              title={
                (stagesQuery.data ?? []).length === 0
                  ? "Add a stage first"
                  : undefined
              }
              onClick={() => {
                setTaskStageId(stagesQuery.data?.[0]?.id ?? "");
                setTaskOpen(true);
              }}
            >
              Add task
            </Button>
          ) : null}
          {(stagesQuery.data ?? []).length === 0 ? (
            <p className="text-muted-foreground text-xs">
              Add task is disabled until you create at least one Stage.
            </p>
          ) : null}
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(tasksQuery.data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">
                      No tasks yet. Add a stage first if needed, then{" "}
                      <strong>Add task</strong> and <strong>Assign</strong> an
                      active team member.
                    </TableCell>
                  </TableRow>
                ) : (
                  (tasksQuery.data ?? []).map((task) => (
                  <TableRow key={task.id}>
                    <TableCell>{task.taskCode}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="link"
                        className="h-auto px-0"
                        onClick={() => setTaskDetailId(task.id)}
                      >
                        {task.taskName}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        label={task.status}
                        tone={statusToneFor(task.status)}
                      />
                    </TableCell>
                    <TableCell>{task.completionPercentage ?? "0"}%</TableCell>
                    <TableCell className="space-x-1 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setTaskDetailId(task.id)}
                      >
                        Details
                      </Button>
                      {TASK_ACTION_BUTTONS.filter((item) =>
                        hasAllowedAction(task.allowedActions, item.action),
                      ).map((item) => (
                        <Button
                          key={item.action}
                          size="sm"
                          variant={item.variant ?? "default"}
                          disabled={
                            taskCommandMutation.isPending ||
                            assignMutation.isPending ||
                            unassignMutation.isPending
                          }
                          onClick={() => handleTaskAction(task, item.action)}
                        >
                          {item.label}
                        </Button>
                      ))}
                    </TableCell>
                  </TableRow>
                ))
                )}
              </TableBody>
            </Table>
          </div>
          <ProjectTabNext
            backLabel="Back: Team"
            onBack={() => setActiveTab("team")}
            nextLabel="Next: Documents"
            onNext={() => setActiveTab("documents")}
            related={
              project.status === "DRAFT" ? (
                <span>
                  When Stages, Team, and Tasks are ready, click{" "}
                  <strong>Activate</strong> at the top.
                </span>
              ) : (
                <span>
                  Assignees work in{" "}
                  <Link className="underline" href={PROJECTS_ROUTES.myProjects}>
                    My projects
                  </Link>
                  .
                </span>
              )
            }
          />
        </TabsContent>

        <TabsContent value="documents" className="space-y-3">
          <p className="text-muted-foreground text-xs">
            Project-level files (not the same as task evidence attach on
            Details).
          </p>
          <ProjectDocumentUpload projectId={projectId} />
          <ProjectTabNext
            backLabel="Back: Tasks"
            onBack={() => setActiveTab("tasks")}
            nextLabel="Next: Time"
            onNext={() => setActiveTab("time")}
          />
        </TabsContent>

        <TabsContent value="time" className="space-y-4">
          <p className="text-muted-foreground text-xs">
            Planned vs approved hours for this project. Employees log time on{" "}
            <Link className="underline" href={PROJECTS_ROUTES.myTimesheets}>
              My timesheets
            </Link>
            ; approvers use{" "}
            <Link className="underline" href={PROJECTS_ROUTES.teamTimesheets}>
              Team timesheets
            </Link>
            .
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Planned hours</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {timeQuery.data?.plannedHours ?? "—"}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Approved hours</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {timeQuery.data?.approvedHours ?? "—"}
              </CardContent>
            </Card>
          </div>
          <ProjectTabNext
            backLabel="Back: Documents"
            onBack={() => setActiveTab("documents")}
            nextLabel="Next: Finance"
            onNext={() => setActiveTab("finance")}
            related={
              <>
                <Link className="underline" href={PROJECTS_ROUTES.myTimesheets}>
                  My timesheets
                </Link>
                {" · "}
                <Link
                  className="underline"
                  href={PROJECTS_ROUTES.teamTimesheets}
                >
                  Team timesheets
                </Link>
              </>
            }
          />
        </TabsContent>

        <TabsContent value="finance" className="space-y-3">
          <p className="text-muted-foreground text-xs">
            Cash summary for <strong>Client</strong> projects (needs Office
            Finance). Internal projects usually show little here.
          </p>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Operational cash summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {financeQuery.data?.enabled ? (
                <>
                  <p>Approved income: {financeQuery.data.approvedIncome}</p>
                  <p>Approved expenses: {financeQuery.data.approvedExpenses}</p>
                  <p>
                    Net operational cash: {financeQuery.data.netOperationalCash}
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">
                  {financeQuery.data?.message ??
                    "Operational cash summary is unavailable until Office Finance is enabled."}
                </p>
              )}
            </CardContent>
          </Card>
          <ProjectTabNext
            backLabel="Back: Time"
            onBack={() => setActiveTab("time")}
            related={
              <>
                <Link className="underline" href={PROJECTS_ROUTES.myProjects}>
                  My projects (assignee)
                </Link>
                {" · "}
                <Link className="underline" href={PROJECTS_ROUTES.list}>
                  Projects list
                </Link>
              </>
            }
          />
        </TabsContent>
      </Tabs>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit project</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Start date</Label>
                <Input
                  type="date"
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>End date</Label>
                <Input
                  type="date"
                  value={editEndDate}
                  onChange={(e) => setEditEndDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Project manager</Label>
              <select
                className="flex h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                value={editManagerId}
                onChange={(e) => setEditManagerId(e.target.value)}
              >
                <option value="">Select…</option>
                {editManagers.map((candidate) => (
                  <option
                    key={candidate.employeeId}
                    value={candidate.employeeId}
                  >
                    {candidate.displayName}
                    {candidate.employeeCode
                      ? ` (${candidate.employeeCode})`
                      : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!editName.trim() || updateMutation.isPending}
              onClick={() => updateMutation.mutate()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reasonOpen} onOpenChange={setReasonOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pendingCommand?.label} project</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReasonOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                !pendingCommand ||
                command.isPending ||
                (pendingCommand.needsReason && !reason.trim())
              }
              onClick={() => {
                if (!pendingCommand) return;
                command.mutate({
                  action: pendingCommand.command,
                  expectedVersion: project.actionRequirements.expectedVersion,
                  operationId: createOperationId(),
                  reason: reason.trim() || undefined,
                });
                setReasonOpen(false);
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={stageEditOpen} onOpenChange={setStageEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit stage</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={stageEditName}
                onChange={(event) => setStageEditName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={stageEditDescription}
                onChange={(event) =>
                  setStageEditDescription(event.target.value)
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Sequence</Label>
              <Input
                inputMode="numeric"
                value={stageEditSequence}
                onChange={(event) => setStageEditSequence(event.target.value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Start date</Label>
                <Input
                  type="date"
                  value={stageEditStartDate}
                  onChange={(event) =>
                    setStageEditStartDate(event.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>End date</Label>
                <Input
                  type="date"
                  value={stageEditEndDate}
                  onChange={(event) => setStageEditEndDate(event.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStageEditOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                !selectedStage ||
                !stageEditName.trim() ||
                Number(stageEditSequence) < 1 ||
                updateStageMutation.isPending
              }
              onClick={() => updateStageMutation.mutate()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={stageActionOpen} onOpenChange={setStageActionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {stageAction[0] + stageAction.slice(1).toLowerCase()} stage
            </DialogTitle>
          </DialogHeader>
          {stageAction === "CANCEL" ? (
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea
                placeholder="Cancellation reason"
                value={stageReason}
                onChange={(event) => setStageReason(event.target.value)}
              />
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              This action is validated by the server using the current stage
              version.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setStageActionOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={stageAction === "CANCEL" ? "destructive" : "default"}
              disabled={
                !selectedStage ||
                stageCommandMutation.isPending ||
                (stageAction === "CANCEL" && !stageReason.trim())
              }
              onClick={() => stageCommandMutation.mutate()}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={stageOpen} onOpenChange={setStageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add stage</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={stageName}
                onChange={(e) => setStageName(e.target.value)}
                placeholder="e.g. Discovery"
              />
              <p className="text-muted-foreground text-xs">
                Code is generated automatically from the name.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Sequence</Label>
              <Input
                value={sequenceNo}
                onChange={(e) => setSequenceNo(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStageOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!stageName.trim() || createStage.isPending}
              onClick={() => createStage.mutate()}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={teamOpen} onOpenChange={setTeamDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add team member</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="member-search">Search eligible employees</Label>
              <form
                className="flex flex-col gap-2 sm:flex-row"
                onSubmit={(event) => {
                  event.preventDefault();
                  void loadMemberCandidates(memberSearch.trim() || undefined);
                }}
              >
                <Input
                  id="member-search"
                  className="min-w-0 flex-1"
                  value={memberSearch}
                  onChange={(event) => setMemberSearch(event.target.value)}
                  placeholder="First name, last name, or employee code"
                  disabled={membersLoading}
                />
                <Button
                  type="submit"
                  className="w-full sm:w-auto"
                  variant="outline"
                  disabled={membersLoading}
                >
                  {memberLookupError ? "Retry search" : "Search members"}
                </Button>
              </form>
              {memberLookupError ? (
                <p role="alert" className="text-destructive text-xs">
                  Could not load eligible employees: {memberLookupError}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-employee">Eligible employee</Label>
              <select
                id="member-employee"
                className="flex h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                value={memberEmployeeId}
                onChange={(e) => setMemberEmployeeId(e.target.value)}
                disabled={membersLoading}
              >
                <option value="">{membersLoading ? "Loading…" : "Select…"}</option>
                {candidates.map((candidate) => (
                  <option
                    key={candidate.employeeId}
                    value={candidate.employeeId}
                  >
                    {candidate.displayName}
                  </option>
                ))}
              </select>
              {!membersLoading && !memberLookupError && candidates.length === 0 ? (
                <p className="text-muted-foreground text-xs">
                  {memberResultKeyword
                    ? "No matching eligible employees. Try another name or code."
                    : "No eligible employees available."}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Input
                value={memberRole}
                onChange={(e) => setMemberRole(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTeamDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!memberEmployeeId || membersLoading || addMember.isPending}
              onClick={() => addMember.mutate()}
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add task</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Stage</Label>
              <select
                className="flex h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                value={taskStageId}
                onChange={(e) => setTaskStageId(e.target.value)}
              >
                <option value="">Select…</option>
                {(stagesQuery.data ?? []).map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.stageCode} — {stage.stageName}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                placeholder="e.g. Draft wireframes"
              />
              <p className="text-muted-foreground text-xs">
                Code is generated automatically from the name.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Planned hours (optional)</Label>
              <Input
                inputMode="decimal"
                placeholder="e.g. 16"
                value={taskPlannedHours}
                onChange={(e) => setTaskPlannedHours(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Due date (optional)</Label>
              <Input
                type="date"
                value={taskDueDate}
                onChange={(e) => setTaskDueDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                !taskStageId || !taskName.trim() || createTask.isPending
              }
              onClick={() => createTask.mutate()}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={teamEditOpen} onOpenChange={setTeamEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit team member</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Role</Label>
              <Input
                value={teamEditRole}
                onChange={(event) => setTeamEditRole(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Allocation percentage</Label>
              <Input
                inputMode="decimal"
                value={teamEditAllocation}
                onChange={(event) => setTeamEditAllocation(event.target.value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Start date</Label>
                <Input
                  type="date"
                  value={teamEditStartDate}
                  onChange={(event) => setTeamEditStartDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>End date</Label>
                <Input
                  type="date"
                  value={teamEditEndDate}
                  onChange={(event) => setTeamEditEndDate(event.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTeamEditOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                !selectedTeamMember ||
                !teamEditRole.trim() ||
                !teamEditAllocation.trim() ||
                updateTeamMemberMutation.isPending
              }
              onClick={() => updateTeamMemberMutation.mutate()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={teamEndOpen} onOpenChange={setTeamEndOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End team member assignment</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea
              placeholder="Why is this assignment ending?"
              value={teamEndReason}
              onChange={(event) => setTeamEndReason(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTeamEndOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={
                !selectedTeamMember ||
                !teamEndReason.trim() ||
                endTeamMemberMutation.isPending
              }
              onClick={() => endTeamMemberMutation.mutate()}
            >
              End assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {assignMode === "REASSIGN" ? "Reassign task" : "Assign task"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {assignMode === "REASSIGN" && assignTask ? (
              <p className="text-muted-foreground text-xs">
                Current assignee
                {(assignTask.activeParticipantEmployeeIds ?? []).length > 1
                  ? "s"
                  : ""}
                :{" "}
                <strong>
                  {(teamQuery.data ?? [])
                    .filter((member) =>
                      (assignTask.activeParticipantEmployeeIds ?? []).includes(
                        member.employeeId,
                      ),
                    )
                    .map(
                      (member) =>
                        member.displayName ||
                        member.employeeCode ||
                        member.employeeId,
                    )
                    .join(", ") || "—"}
                </strong>
                . Reassign only lists <em>other</em> active Team members (not
                the current assignee).
              </p>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="assignee-search">Search team members</Label>
              <form
                className="flex flex-col gap-2 sm:flex-row"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (assignTask) {
                    void loadAssigneeCandidates(assignTask.id, assigneeSearch.trim() || undefined);
                  }
                }}
              >
                <Input
                  id="assignee-search"
                  className="min-w-0 flex-1"
                  value={assigneeSearch}
                  onChange={(event) => setAssigneeSearch(event.target.value)}
                  placeholder="First name, last name, or employee code"
                  disabled={assigneesLoading}
                />
                <Button
                  type="submit"
                  className="w-full sm:w-auto"
                  variant="outline"
                  disabled={assigneesLoading}
                >
                  {assigneeLookupError ? "Retry search" : "Search assignees"}
                </Button>
              </form>
              {assigneeLookupError ? (
                <p role="alert" className="text-destructive text-xs">
                  Could not load team members: {assigneeLookupError}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-assignee">Assignee</Label>
              <select
                id="task-assignee"
                className="flex h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                disabled={assigneesLoading || assignees.length === 0}
              >
                <option value="">
                  {assigneesLoading
                    ? "Loading…"
                    : assignees.length === 0
                    ? "No other team members available"
                    : "Select…"}
                </option>
                {assignees.map((candidate) => (
                  <option
                    key={candidate.employeeId}
                    value={candidate.employeeId}
                  >
                    {candidate.displayName}
                    {candidate.employeeCode
                      ? ` (${candidate.employeeCode})`
                      : ""}
                  </option>
                ))}
              </select>
              {!assigneesLoading && !assigneeLookupError && assignees.length === 0 ? (
                <p className="text-muted-foreground text-xs">
                  {assigneeResultKeyword
                    ? "No matching active team members. Try another name or code."
                    : assignMode === "REASSIGN"
                    ? "Add another person on the Team tab first, then come back to Reassign. With only one team member (already on this task), the list stays empty."
                    : "Add people on the Team tab first, then Assign."}{" "}
                  {!assigneeResultKeyword ? (
                    <button
                      type="button"
                      className="font-medium text-primary underline"
                      onClick={() => {
                        setAssignDialogOpen(false);
                        setActiveTab("team");
                      }}
                    >
                      Go to Team
                    </button>
                  ) : null}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Input
                value={assigneeRole}
                onChange={(e) => setAssigneeRole(e.target.value)}
              />
            </div>
            {assignMode === "REASSIGN" ? (
              <div className="space-y-2">
                <Label>Reason</Label>
                <Textarea
                  placeholder="Why is this task being reassigned?"
                  value={assignReason}
                  onChange={(event) => setAssignReason(event.target.value)}
                />
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                !assigneeId ||
                assigneesLoading ||
                assignMutation.isPending ||
                (assignMode === "REASSIGN" && !assignReason.trim())
              }
              onClick={() => assignMutation.mutate()}
            >
              {assignMode === "REASSIGN" ? "Reassign" : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={taskReasonOpen} onOpenChange={setTaskReasonOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingTaskCommand?.action === "RETURN"
                ? "Return task"
                : "Cancel task"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea
              placeholder="A reason is required"
              value={taskReason}
              onChange={(event) => setTaskReason(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskReasonOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={
                pendingTaskCommand?.action === "CANCEL"
                  ? "destructive"
                  : "default"
              }
              disabled={
                !pendingTaskCommand ||
                !taskReason.trim() ||
                taskCommandMutation.isPending
              }
              onClick={() => {
                if (!pendingTaskCommand) return;
                taskCommandMutation.mutate({
                  task: pendingTaskCommand.task,
                  action:
                    pendingTaskCommand.action === "RETURN"
                      ? "return"
                      : "cancel",
                  reason: taskReason.trim(),
                });
                setTaskReasonOpen(false);
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProjectTaskDetailDialog
        projectId={projectId}
        taskId={taskDetailId}
        open={Boolean(taskDetailId)}
        onOpenChange={(open) => {
          if (!open) setTaskDetailId(null);
        }}
        onChanged={invalidateTasks}
      />
    </WorkspaceShell>
  );
}
