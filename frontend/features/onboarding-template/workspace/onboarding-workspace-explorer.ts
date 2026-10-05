export type ExplorerNodeType =
  | "template"
  | "department"
  | "group"
  | "task";

export interface ExplorerNode {
  id: string;

  parentId?: string;

  type: ExplorerNodeType;

  title: string;

  subtitle?: string;

  expanded?: boolean;

  children?: ExplorerNode[];
}