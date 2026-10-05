import type { OnboardingTemplateTask } from "../../types";

export interface TaskMatrixColumn {
  key: keyof OnboardingTemplateTask | string;
  title: string;
  width?: string;
}

export const TASK_MATRIX_COLUMNS: TaskMatrixColumn[] = [
  {
    key: "sequenceNo",
    title: "#",
    width: "80px",
  },
  {
    key: "departmentName",
    title: "Department",
    width: "180px",
  },
  {
    key: "taskGroupName",
    title: "Phase",
    width: "180px",
  },
  {
    key: "taskName",
    title: "Task Name",
    width: "320px",
  },
  {
    key: "ownerType",
    title: "Owner",
    width: "180px",
  },
  {
    key: "workType",
    title: "Work Type",
    width: "180px",
  },
  {
    key: "priority",
    title: "Priority",
    width: "120px",
  },
  {
    key: "isMandatory",
    title: "Mandatory",
    width: "120px",
  },
  {
    key: "dueDays",
    title: "Due After",
    width: "120px",
  },
];
