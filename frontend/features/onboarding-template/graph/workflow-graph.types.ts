export interface WorkflowGraphNode {

  id: string;

  label: string;

  level: number;

}

export interface WorkflowGraphEdge {

  from: string;

  to: string;

}

export interface WorkflowGraphModel {

  nodes: WorkflowGraphNode[];

  edges: WorkflowGraphEdge[];

}