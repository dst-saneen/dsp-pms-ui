import { Injectable } from '@nestjs/common';

import { OfficeFinanceFeatureService } from '../../office-finance/services/office-finance-feature.service';
import { PROJECTS_PERMISSIONS } from '../constants/projects-permissions';
import type { ProjectsActorContext } from '../types/project.types';
import { ProjectsFeatureGateService } from './projects-feature-gate.service';

export interface ProjectsWorkspaceCapabilities {
  projectsEnabled: boolean;
  clientProjectsEnabled: boolean;
  financeSummaryEnabled: boolean;
  businessPartyEnabled: boolean;
  allowedProjectTypes: Array<'INTERNAL' | 'CLIENT'>;
  canCreateProject: boolean;
  canManageProjects: boolean;
  canReadProjects: boolean;
  canSubmitTimesheets: boolean;
  canApproveTimesheets: boolean;
  myTasksEnabled: boolean;
}

@Injectable()
export class ProjectsWorkspaceCapabilitiesService {
  constructor(
    private readonly gate: ProjectsFeatureGateService,
    private readonly officeFinance: OfficeFinanceFeatureService,
  ) {}

  async getCapabilities(
    actor: ProjectsActorContext,
  ): Promise<ProjectsWorkspaceCapabilities> {
    const projectsEnabled = await this.gate.isEnabledForContext(
      actor.companyId,
    );

    const canManage = actor.permissions.includes(PROJECTS_PERMISSIONS.MANAGE);
    const canRead = actor.permissions.includes(PROJECTS_PERMISSIONS.READ);
    const canSubmit = actor.permissions.includes(
      PROJECTS_PERMISSIONS.TIMESHEETS_SUBMIT,
    );
    const canApprove = actor.permissions.includes(
      PROJECTS_PERMISSIONS.TIMESHEETS_APPROVE,
    );

    const financeEnabled = await this.officeFinance.isEnabledForCompany(
      actor.companyId,
    );
    const clientProjectsEnabled = financeEnabled;
    const financeSummaryEnabled = financeEnabled;
    const businessPartyEnabled = financeEnabled;

    return {
      projectsEnabled,
      clientProjectsEnabled,
      financeSummaryEnabled,
      businessPartyEnabled,
      allowedProjectTypes: clientProjectsEnabled
        ? ['INTERNAL', 'CLIENT']
        : ['INTERNAL'],
      canCreateProject: projectsEnabled && canManage,
      canManageProjects: projectsEnabled && canManage,
      canReadProjects: projectsEnabled && canRead,
      canSubmitTimesheets: projectsEnabled && canSubmit,
      canApproveTimesheets: projectsEnabled && canApprove,
      myTasksEnabled: projectsEnabled && Boolean(actor.employeeId),
    };
  }
}
