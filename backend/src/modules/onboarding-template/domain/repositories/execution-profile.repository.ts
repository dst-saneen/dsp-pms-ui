import { ExecutionProfile } from '../entities';

export interface ExecutionProfileRepository {
  findById(id: string): Promise<ExecutionProfile | null>;

  findByRequirement(requirementId: string): Promise<ExecutionProfile[]>;

  save(entity: ExecutionProfile): Promise<void>;

  delete(id: string): Promise<void>;
}
