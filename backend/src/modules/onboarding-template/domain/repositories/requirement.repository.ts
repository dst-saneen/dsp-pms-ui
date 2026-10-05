import { Requirement } from '../entities';

export interface RequirementRepository {
  findById(id: string): Promise<Requirement | null>;

  findByDepartment(departmentId: string): Promise<Requirement[]>;

  save(entity: Requirement): Promise<void>;

  delete(id: string): Promise<void>;
}
