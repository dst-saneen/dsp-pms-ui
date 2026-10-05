import { apiClient } from "@/services/api-client";

import type { ApiResponse } from "@/types/api-response";
import type { EmployeeOnboardingTaskAllowedAction } from "@/features/onboarding/types/onboarding.types";

import type { EmployeeOnboarding } from "../types/employee-onboarding";
import type { EmployeeOnboardingSummary } from "../types/employee-onboarding-summary";
import type { EmployeeOnboardingSearch } from "../types/employee-onboarding-search";
import type { CreateEmployeeOnboarding } from "../types/create-employee-onboarding";
import type { UpdateEmployeeOnboarding } from "../types/update-employee-onboarding";

const KNOWN_TASK_ACTIONS = new Set<EmployeeOnboardingTaskAllowedAction>([
  "ASSIGN",
  "REASSIGN",
  "UNASSIGN",
  "START",
  "COMPLETE",
  "SKIP",
  "REOPEN",
  "FULFILL_ASSET",
  "WAIVE",
]);

function isTaskAllowedAction(
  action: unknown,
): action is EmployeeOnboardingTaskAllowedAction {
  return (
    typeof action === "string" &&
    KNOWN_TASK_ACTIONS.has(action as EmployeeOnboardingTaskAllowedAction)
  );
}
type PagedOnboardingList = {
  items?: unknown[];
};

function unwrapOnboardingList(data: unknown): unknown[] {
  if (Array.isArray(data)) {
    return data;
  }

  if (
    data &&
    typeof data === "object" &&
    Array.isArray((data as PagedOnboardingList).items)
  ) {
    return (data as PagedOnboardingList).items ?? [];
  }

  return [];
}

function splitDisplayName(displayName?: string) {
  const parts = (displayName ?? "").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

function normalizeTask(task: Record<string, unknown>): EmployeeOnboarding["tasks"][number] {
  const workstream = (task.workstreamDepartment ?? {}) as Record<string, unknown>;
  const assignedDepartment = (task.assignedDepartment ?? {}) as Record<
    string,
    unknown
  >;
  const requirement = (task.requirement ?? {}) as Record<string, unknown>;

  return {
    id: String(task.id ?? ""),
    onboardingId: String(task.onboardingId ?? ""),
    taskName: String(task.taskName ?? ""),
    description:
      typeof task.description === "string" ? task.description : undefined,
    status: String(task.status ?? task.legacyStatus ?? "PENDING"),
    sequenceNo:
      typeof task.sequenceNo === "number"
        ? task.sequenceNo
        : Number(task.sequenceNo ?? 0),
    priority:
      typeof task.priority === "number"
        ? task.priority
        : Number(task.priority ?? 0),
    attemptNo:
      typeof task.attemptNo === "number"
        ? task.attemptNo
        : Number(task.attemptNo ?? 1),
    isMandatory: Boolean(task.isMandatory),
    allowSkip: Boolean(task.allowSkip),
    allowReopen: Boolean(task.allowReopen ?? true),
    ownerType:
      typeof task.ownerType === "string" ? task.ownerType : undefined,
    workType: String(
      task.workType ??
        requirement.workType ??
        task.legacyWorkType ??
        "CHECKLIST",
    ),
    assignedDepartmentId:
      typeof task.assignedDepartmentId === "string"
        ? task.assignedDepartmentId
        : typeof workstream.id === "string"
          ? workstream.id
          : undefined,
    assignedDepartment:
      typeof assignedDepartment.departmentName === "string"
        ? {
            id: String(assignedDepartment.id ?? ""),
            departmentCode:
              typeof assignedDepartment.departmentCode === "string"
                ? assignedDepartment.departmentCode
                : undefined,
            departmentName: String(assignedDepartment.departmentName),
          }
        : typeof workstream.name === "string"
          ? {
              id: String(workstream.id ?? ""),
              departmentName: String(workstream.name),
            }
          : undefined,
    dueDate: typeof task.dueDate === "string" ? task.dueDate : undefined,
    startedDate:
      typeof task.startedDate === "string"
        ? task.startedDate
        : typeof task.startedAt === "string"
          ? task.startedAt
          : undefined,
    completedDate:
      typeof task.completedDate === "string"
        ? task.completedDate
        : typeof task.resolvedAt === "string"
          ? task.resolvedAt
          : undefined,
    assignedToUserId:
      typeof task.assignedToUserId === "string"
        ? task.assignedToUserId
        : undefined,
    contractVersion:
      task.contractVersion === "LEGACY_V1" || task.contractVersion === "V2"
        ? task.contractVersion
        : undefined,
    allowedActions: Array.isArray(task.allowedActions)
      ? task.allowedActions.filter(isTaskAllowedAction)
      : undefined,
    actionCapabilities: Array.isArray(task.actionCapabilities)
      ? task.actionCapabilities
      : undefined,
    assignee:
      task.assignee &&
      typeof task.assignee === "object" &&
      typeof (task.assignee as { displayName?: unknown }).displayName ===
        "string"
        ? { displayName: (task.assignee as { displayName: string }).displayName }
        : undefined,
    resolvedAt:
      typeof task.resolvedAt === "string" ? task.resolvedAt : undefined,
    createdAt: String(task.createdAt ?? ""),
    updatedAt: String(task.updatedAt ?? ""),
  };
}

function normalizeOnboarding(item: Record<string, unknown>): EmployeeOnboarding {
  const employee = (item.employee ?? {}) as Record<string, unknown>;
  const template = (item.template ??
    item.templateSnapshot ??
    {}) as Record<string, unknown>;
  const names =
    typeof employee.firstName === "string" && employee.firstName
      ? {
          firstName: employee.firstName,
          lastName:
            typeof employee.lastName === "string" ? employee.lastName : "",
        }
      : splitDisplayName(
          typeof employee.displayName === "string"
            ? employee.displayName
            : undefined,
        );
  const progress = (item.progress ?? {}) as Record<string, unknown>;

  return {
    ...(item as unknown as EmployeeOnboarding),
    id: String(item.id ?? ""),
    companyId: String(item.companyId ?? ""),
    employeeId: String(item.employeeId ?? employee.id ?? ""),
    templateId: String(
      item.templateId ?? template.templateId ?? template.id ?? "",
    ),
    status: String(
      item.status ?? item.legacyStatus ?? "IN_PROGRESS",
    ),
    version:
      typeof item.version === "number"
        ? item.version
        : typeof item.version === "string" && item.version.trim()
          ? Number(item.version)
          : undefined,
    startDate: String(item.startDate ?? ""),
    completedDate:
      (item.completedDate as string | null | undefined) ??
      (item.completedAt as string | null | undefined) ??
      null,
    createdAt: String(item.createdAt ?? item.startDate ?? ""),
    updatedAt: String(item.updatedAt ?? item.startDate ?? ""),
    employee: {
      ...(employee as unknown as EmployeeOnboarding["employee"]),
      id: String(employee.id ?? ""),
      employeeCode: String(employee.employeeCode ?? ""),
      firstName: names.firstName,
      lastName: names.lastName,
      employmentStatus:
        typeof employee.employmentStatus === "string"
          ? employee.employmentStatus
          : "ACTIVE",
      isActive:
        typeof employee.isActive === "boolean" ? employee.isActive : true,
      companyId: String(employee.companyId ?? item.companyId ?? ""),
      branchId: String(employee.branchId ?? ""),
      departmentId: String(employee.departmentId ?? ""),
    },
    template: {
      id: String(template.id ?? template.templateId ?? item.templateId ?? ""),
      templateName: String(template.templateName ?? "-"),
    },
    tasks: Array.isArray(item.tasks)
      ? item.tasks.map((task) =>
          normalizeTask((task ?? {}) as Record<string, unknown>),
        )
      : [],
    ...(typeof progress.total === "number" || typeof progress.terminal === "number"
      ? {
          progress: {
            total:
              typeof progress.total === "number" ? progress.total : null,
            terminal:
              typeof progress.terminal === "number" ? progress.terminal : null,
            percent:
              typeof progress.percent === "number" ? progress.percent : null,
          },
        }
      : {}),
  } as EmployeeOnboarding;
}

export class EmployeeOnboardingService {
  static async getAll(
    params?: EmployeeOnboardingSearch,
  ): Promise<EmployeeOnboarding[]> {
    const response = await apiClient.get<
      ApiResponse<EmployeeOnboarding[] | PagedOnboardingList>
    >("/employee-onboarding", {
      params: {
        keyword: params?.search,
        status: params?.status,
        employeeId: params?.employeeId,
        templateId: params?.templateId,
      },
    });

    return unwrapOnboardingList(response.data.data).map((item) =>
      normalizeOnboarding((item ?? {}) as Record<string, unknown>),
    );
  }

  static async getSummary(): Promise<EmployeeOnboardingSummary> {
    const response =
      await apiClient.get<
        ApiResponse<EmployeeOnboardingSummary>
      >("/employee-onboarding/summary");

    return response.data.data;
  }

  static async getById(
    id: string,
  ): Promise<EmployeeOnboarding> {
    const response =
      await apiClient.get<
        ApiResponse<EmployeeOnboarding>
      >(`/employee-onboarding/${id}`);

    return normalizeOnboarding(
      (response.data.data ?? {}) as unknown as Record<string, unknown>,
    );
  }

  static async getByEmployee(
    employeeId: string,
  ): Promise<EmployeeOnboarding> {
    const response =
      await apiClient.get<
        ApiResponse<EmployeeOnboarding>
      >(
        `/employee-onboarding/employee/${employeeId}`,
      );

    return normalizeOnboarding(
      (response.data.data ?? {}) as unknown as Record<string, unknown>,
    );
  }

  static async create(
    dto: CreateEmployeeOnboarding,
  ): Promise<EmployeeOnboarding> {
    const response =
      await apiClient.post<
        ApiResponse<EmployeeOnboarding>
      >(
        "/employee-onboarding",
        dto,
      );

    return response.data.data;
  }

  static async update(
    id: string,
    dto: UpdateEmployeeOnboarding,
  ): Promise<EmployeeOnboarding> {
    const response =
      await apiClient.patch<
        ApiResponse<EmployeeOnboarding>
      >(
        `/employee-onboarding/${id}`,
        dto,
      );

    return response.data.data;
  }

  static async delete(
    id: string,
  ): Promise<void> {
    await apiClient.delete(
      `/employee-onboarding/${id}`,
    );
  }

  static async complete(
    id: string,
    options?: { expectedOnboardingVersion?: number },
  ): Promise<EmployeeOnboarding> {
    const body =
      typeof options?.expectedOnboardingVersion === "number"
        ? {
            operationId:
              typeof globalThis.crypto?.randomUUID === "function"
                ? globalThis.crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            expectedOnboardingVersion: options.expectedOnboardingVersion,
          }
        : undefined;

    const response = await apiClient.post<ApiResponse<EmployeeOnboarding>>(
      `/employee-onboarding/${id}/complete`,
      body,
    );

    return normalizeOnboarding(
      (response.data.data ?? {}) as unknown as Record<string, unknown>,
    );
  }
}