import { ExecutionRule } from '../entities';

export interface ExecutionRuleRepository {
  findById(id: string): Promise<ExecutionRule | null>;

  findByExecutionProfile(executionProfileId: string): Promise<ExecutionRule[]>;

  save(entity: ExecutionRule): Promise<void>;

  delete(id: string): Promise<void>;
}
