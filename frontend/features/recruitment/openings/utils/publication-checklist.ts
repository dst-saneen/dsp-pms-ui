import { JOB_OPENING_STATUS } from "../../types/enums";
import type { JobOpening } from "../types/job-opening";
import type {
  PublicationCheckItem,
  PublicationChecklist,
} from "../types/publication-checklist";
import { getCriteriaWeightTotal } from "../validation/job-opening-schema";

export function buildPublicationChecklist(
  opening: JobOpening,
): PublicationChecklist {
  const criteriaTotal = getCriteriaWeightTotal(opening.criteria);
  const deadline = new Date(opening.applicationDeadline);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const items: PublicationCheckItem[] = [
    {
      code: "ORGANIZATION_ACTIVE",
      label: "Organization hierarchy is complete",
      passed: Boolean(
        opening.companyGroupId &&
          opening.companyId &&
          opening.branchId &&
          opening.departmentId &&
          opening.designationId,
      ),
      message: "Company, branch, department, and designation must be selected.",
    },
    {
      code: "HIRING_MANAGER_LINKED",
      label: "Hiring manager is linked",
      passed: Boolean(opening.hiringManagerEmployeeId),
      message: "Select an active hiring manager with a linked user account.",
    },
    {
      code: "HEADCOUNT_VALID",
      label: "Headcount is valid",
      passed: opening.headcount.approved >= 1,
      message: "Approved headcount must be at least 1.",
    },
    {
      code: "DEADLINE_VALID",
      label: "Application deadline is valid",
      passed: !Number.isNaN(deadline.getTime()) && deadline >= today,
      message: "Application deadline must be today or later.",
    },
    {
      code: "CRITERIA_TOTAL_100",
      label: "Evaluation criteria total 100%",
      passed: criteriaTotal === 100,
      message: `Active criteria must total 100%. Current total: ${criteriaTotal}%.`,
    },
  ];

  return {
    items,
    canPublish: items.every((item) => item.passed),
  };
}

export function buildAllowedActions(
  opening: JobOpening,
  checklist: PublicationChecklist,
) {
  switch (opening.status) {
    case JOB_OPENING_STATUS.DRAFT:
      return {
        canEdit: true,
        canPublish: checklist.canPublish,
        canHold: false,
        canReopen: false,
        canClose: false,
      };
    case JOB_OPENING_STATUS.OPEN:
      return {
        canEdit: false,
        canPublish: false,
        canHold: true,
        canReopen: false,
        canClose: true,
      };
    case JOB_OPENING_STATUS.ON_HOLD:
      return {
        canEdit: false,
        canPublish: false,
        canHold: false,
        canReopen: true,
        canClose: true,
      };
    case JOB_OPENING_STATUS.FILLED:
      return {
        canEdit: false,
        canPublish: false,
        canHold: false,
        canReopen: false,
        canClose: true,
      };
    default:
      return {
        canEdit: false,
        canPublish: false,
        canHold: false,
        canReopen: false,
        canClose: false,
      };
  }
}

export function buildNextAction(opening: JobOpening): string | undefined {
  switch (opening.status) {
    case JOB_OPENING_STATUS.DRAFT:
      return "Publish opening";
    case JOB_OPENING_STATUS.OPEN:
      return "Accept applications";
    case JOB_OPENING_STATUS.ON_HOLD:
      return "Reopen or close";
    case JOB_OPENING_STATUS.FILLED:
      return "Position filled";
    case JOB_OPENING_STATUS.CLOSED:
      return "Closed";
    default:
      return undefined;
  }
}
