export interface DependencyMappingContract {
  oldTaskId: string;

  newTaskId: string;

  oldDependsOnTaskId?: string | null;
}
