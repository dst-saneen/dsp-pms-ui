export interface OnboardingTreeItem {
  id: string;

  parentId?: string;

  type:
    | "department"
    | "contribution"
    | "requirement"
    | "execution-profile"
    | "execution-rule";

  title: string;

  expanded?: boolean;

  selected?: boolean;

  children?: OnboardingTreeItem[];
}