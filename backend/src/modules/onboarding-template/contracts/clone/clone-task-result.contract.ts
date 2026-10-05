import { DependencyMappingContract } from './dependency-mapping.contract';

export interface CloneTaskResultContract {
  taskMap: Map<string, string>;

  dependencyMappings: DependencyMappingContract[];
}
