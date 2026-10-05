import type { OrganizationOnboardingStatus } from "./types";

export type HubChecklistState = "done" | "needed" | "later";

export interface HubChecklistItem {
  id: string;
  label: string;
  detail: string;
  state: HubChecklistState;
  /** Short “what / optional / next” line for ORG-01 */
  guide?: string;
}

export interface OnboardingHubProgress {
  /** Core required work: organization, company, branch, department, designation. */
  completedCore: number;
  totalCore: 5;
  percent: number;
  remainingCore: number;
  remainingRequired: number;
  canOpenWorkspace: boolean;
  organizationDone: boolean;
  companyDone: boolean;
  branchDone: boolean;
  departmentDone: boolean;
  hasTax: boolean;
  hasDesignations: boolean;
  hasShifts: boolean;
  headline: string;
  subheadline: string;
  timeLabel: string;
  checklist: HubChecklistItem[];
  /** Explains org levels without changing setup order (ORG-01). */
  levelGuide: Array<{ title: string; body: string }>;
}

/** Derive hub progress from server-confirmed status — real work only. */
export function getOnboardingHubProgress(
  status: OrganizationOnboardingStatus,
): OnboardingHubProgress {
  const organizationDone = status.companyGroup.groupName.trim().length >= 2;
  const companyDone = status.requirements.company;
  const branchDone = status.requirements.branch;
  const departmentDone = status.requirements.department;
  const designationDone = status.requirements.designation;
  const hasTax = Boolean(status.company?.taxNumber?.trim());
  const hasDesignations = status.counts.designations > 0;
  const hasShifts = status.counts.shifts > 0;

  const completedCore =
    Number(organizationDone) +
    Number(companyDone) +
    Number(branchDone) +
    Number(departmentDone) +
    Number(designationDone);
  const totalCore = 5 as const;
  const remainingCore = totalCore - completedCore;
  const remainingRequired =
    Number(!companyDone) +
    Number(!branchDone) +
    Number(!departmentDone) +
    Number(!designationDone);
  const percent = Math.round((completedCore / totalCore) * 100);
  const canOpenWorkspace =
    companyDone && branchDone && departmentDone && designationDone;

  const checklist: HubChecklistItem[] = [
    {
      id: "organization",
      label: "Organization",
      detail: organizationDone ? "Completed" : "Needed",
      state: organizationDone ? "done" : "needed",
      guide: "Your Company Group — the top container for all companies.",
    },
    {
      id: "company",
      label: "Company",
      detail: companyDone ? "Completed" : "Needed",
      state: companyDone ? "done" : "needed",
      guide: "Legal entity under the organization. Created at registration.",
    },
    {
      id: "branch",
      label: "Main branch",
      detail: branchDone ? "Confirmed" : "Not confirmed",
      state: branchDone ? "done" : "needed",
      guide: "Operating location. Required before departments.",
    },
    {
      id: "department",
      label: "Department",
      detail: departmentDone ? "Added" : "Not added",
      state: departmentDone ? "done" : "needed",
      guide: "First team under the branch. Unlocks workspace open.",
    },
    {
      id: "designations",
      label: "Designations",
      detail: hasDesignations ? "Added" : "Needed",
      state: hasDesignations ? "done" : "needed",
      guide: "Select a job title for the founding owner.",
    },
    {
      id: "shifts",
      label: "Shifts",
      detail: hasShifts ? "Added" : "Optional later",
      state: hasShifts ? "done" : "later",
      guide: "Working hours — optional during setup.",
    },
    {
      id: "tax",
      label: "Tax information",
      detail: hasTax ? "Added" : "Optional later",
      state: hasTax ? "done" : "later",
      guide: "Company tax number — optional during setup.",
    },
    {
      id: "next-steps",
      label: "After you open",
      detail: "Invite team later",
      state: "later",
      guide:
        "Invite users from Administration → Users. Not part of this setup progress.",
    },
  ];

  let headline = "Great start!";
  let subheadline =
    "Finish Company → Branch → Department → Designation, then open your workspace.";
  if (canOpenWorkspace) {
    headline = "You're ready!";
    subheadline =
      "Required setup is complete. Open your workspace when you like.";
  } else if (completedCore <= 1) {
    headline = "Let's finish setup";
    subheadline =
      "Your organization and company are ready. Confirm a branch, then add a department and designation.";
  } else if (remainingRequired === 1) {
    headline = "Almost there!";
    subheadline = !departmentDone
      ? "Add your first department, then you can open the workspace."
      : !designationDone
        ? "Add a designation for the owner, then you can open the workspace."
        : "One required item left, then you can open your workspace.";
  }

  const timeLabel =
    remainingRequired === 0
      ? "Ready to open"
      : remainingRequired === 1
        ? "About 1 minute"
        : "About 2 minutes";

  const levelGuide = [
    {
      title: "Organization (Company Group)",
      body: "Top level. Holds one or more companies. Already created when you registered.",
    },
    {
      title: "Company",
      body: "Legal / trading entity. Already created from registration; you can rename it here.",
    },
    {
      title: "Branch",
      body: "Physical or operating location under the company. Required next.",
    },
    {
      title: "Department",
      body: "Team under a branch. Required after the branch exists.",
    },
  ];

  return {
    completedCore,
    totalCore,
    percent,
    remainingCore,
    remainingRequired,
    canOpenWorkspace,
    organizationDone,
    companyDone,
    branchDone,
    departmentDone,
    hasTax,
    hasDesignations,
    hasShifts,
    headline,
    subheadline,
    timeLabel,
    checklist,
    levelGuide,
  };
}

/** Map server counts to the onboarding step the owner should resume (ORG-02). */
export function deriveResumeStep(
  status: OrganizationOnboardingStatus,
): OrganizationOnboardingStatus["currentStep"] {
  if (!status.requirements.company) return "COMPANY";
  if (!status.requirements.branch) return "BRANCH";
  if (!status.requirements.department) return "STRUCTURE";
  if (!status.requirements.designation) return "TEAM";
  if (status.status === "COMPLETED") return "COMPLETED";
  return "REVIEW";
}
