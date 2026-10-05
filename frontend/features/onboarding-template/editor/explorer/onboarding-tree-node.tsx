"use client";

import {
  ChevronDown,
  ChevronRight,
  FolderTree,
  Building2,
  FolderOpen,
  ClipboardList,
} from "lucide-react";

import type {
  ExplorerNode,
} from "../../workspace";

import {
  useOnboardingDesigner,
} from "../state";

interface Props {
  node: ExplorerNode;

  level?: number;

  onNodeDoubleClick?(
    node: ExplorerNode,
  ): void;
}

function getIcon(
  type: ExplorerNode["type"],
) {
  switch (type) {
    case "template":
      return (
        <FolderTree className="h-4 w-4" />
      );

    case "department":
      return (
        <Building2 className="h-4 w-4" />
      );

    case "group":
      return (
        <FolderOpen className="h-4 w-4" />
      );

    case "task":
      return (
        <ClipboardList className="h-4 w-4" />
      );

    default:
      return (
        <ClipboardList className="h-4 w-4" />
      );
  }
}

export function OnboardingTreeNode({
  node,
  level = 0,
  onNodeDoubleClick,
}: Props) {

  const {
    state,
    dispatch,
  } = useOnboardingDesigner();

  return (
    <>
      <div
        onClick={() => {
            if (node.type === "department" || node.type === "group") {
              dispatch({
                type: "SELECT_NODE",
                payload: node,
              });
            }
          }}

          onDoubleClick={() => {
            if (node.type === "department" || node.type === "group") {
              dispatch({
                type: "SELECT_NODE",
                payload: node,
              });

              onNodeDoubleClick?.(node);
            }
          }}
        style={{
          paddingLeft: level * 20,
        }}
        className={`flex h-9 items-center gap-2 rounded-md px-2 cursor-pointer ${
          state.selectedNode?.id === node.id
            ? "bg-primary text-primary-foreground"
            : "hover:bg-muted"
        }`}
      >
        {node.children?.length ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4 opacity-30" />
        )}

        {getIcon(node.type)}

        <span>{node.title}</span>
      </div>

      {node.children?.map((child) => (
        <OnboardingTreeNode
          key={child.id}
          node={child}
          level={level + 1}
          onNodeDoubleClick={
            onNodeDoubleClick
          }
        />
      ))}
    </>
  );
}