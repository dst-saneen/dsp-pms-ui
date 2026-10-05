import {
  TemplateNode,
} from "./template-node";

import {
  DepartmentNode,
} from "./department-node";

import {
  TaskGroupNode,
} from "./task-group-node";

import {
  TaskNode,
} from "./task-node";

export const NODE_RENDERERS = {

  template: TemplateNode,

  department: DepartmentNode,

  group: TaskGroupNode,

  task: TaskNode,

} as const;