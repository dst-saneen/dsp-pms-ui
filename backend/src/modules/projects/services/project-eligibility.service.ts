import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';
import type { EligibilityCandidateView } from '../types/project.types';
import { ProjectsDomainScopeService } from './projects-domain-scope.service';
import { ProjectsFeatureGateService } from './projects-feature-gate.service';

@Injectable()
export class ProjectEligibilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ProjectsDomainScopeService,
    private readonly gate: ProjectsFeatureGateService,
  ) {}

  async memberCandidates(
    projectId: string,
    keyword?: string,
  ): Promise<EligibilityCandidateView[]> {
    const project = await this.scope.requireProject(projectId);
    await this.gate.assertEnabledForContext(project.companyId);

    const activeMemberIds = await this.prisma.projectTeamMember.findMany({
      where: { projectId, statusV2: 'ACTIVE' },
      select: { employeeId: true },
    });
    const exclude = activeMemberIds.map((row) => row.employeeId);
    const term = keyword?.trim();

    const employees = await this.prisma.employee.findMany({
      where: {
        companyId: project.companyId,
        isActive: true,
        ...(exclude.length ? { id: { notIn: exclude } } : {}),
        ...(term
          ? {
              OR: [
                { firstName: { contains: term, mode: 'insensitive' } },
                { lastName: { contains: term, mode: 'insensitive' } },
                { employeeCode: { contains: term, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeCode: true,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: 50,
    });

    return employees.map((employee) => ({
      employeeId: employee.id,
      displayName: [employee.firstName, employee.lastName]
        .filter(Boolean)
        .join(' '),
      employeeCode: employee.employeeCode,
    }));
  }

  async assigneeCandidates(
    projectId: string,
    taskId: string,
    keyword?: string,
  ): Promise<EligibilityCandidateView[]> {
    const project = await this.scope.requireProject(projectId);
    await this.gate.assertEnabledForContext(project.companyId);

    const task = await this.prisma.projectTask.findFirst({
      where: { id: taskId, projectId, companyId: project.companyId },
      select: { id: true },
    });
    if (!task) {
      return [];
    }

    const activeAssignees = await this.prisma.taskParticipant.findMany({
      where: { taskId, statusV2: 'ACTIVE' },
      select: { employeeId: true },
    });
    const exclude = new Set(activeAssignees.map((row) => row.employeeId));
    const term = keyword?.trim();

    const members = await this.prisma.projectTeamMember.findMany({
      where: {
        projectId,
        companyId: project.companyId,
        statusV2: 'ACTIVE',
        ...(exclude.size ? { employeeId: { notIn: [...exclude] } } : {}),
        employee: term
          ? {
              OR: [
                { firstName: { contains: term, mode: 'insensitive' } },
                { lastName: { contains: term, mode: 'insensitive' } },
                { employeeCode: { contains: term, mode: 'insensitive' } },
              ],
            }
          : undefined,
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });

    return members.map((member) => ({
      employeeId: member.employee.id,
      displayName: [member.employee.firstName, member.employee.lastName]
        .filter(Boolean)
        .join(' '),
      employeeCode: member.employee.employeeCode,
    }));
  }

  async managerCandidates(
    companyId: string,
    keyword?: string,
  ): Promise<EligibilityCandidateView[]> {
    await this.gate.assertEnabledForContext(companyId);
    const term = keyword?.trim();

    const employees = await this.prisma.employee.findMany({
      where: {
        companyId,
        isActive: true,
        user: { is: { status: 'ACTIVE' } },
        ...(term
          ? {
              OR: [
                { firstName: { contains: term, mode: 'insensitive' } },
                { lastName: { contains: term, mode: 'insensitive' } },
                { employeeCode: { contains: term, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeCode: true,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: 50,
    });

    return employees.map((employee) => ({
      employeeId: employee.id,
      displayName: [employee.firstName, employee.lastName]
        .filter(Boolean)
        .join(' '),
      employeeCode: employee.employeeCode,
    }));
  }

  async businessPartyCandidates(companyId: string, keyword?: string) {
    await this.gate.assertEnabledForContext(companyId);
    const term = keyword?.trim();
    return this.prisma.businessParty.findMany({
      where: {
        companyId,
        isActive: true,
        archivedAt: null,
        partyType: { in: ['CUSTOMER', 'BOTH'] },
        ...(term
          ? {
              OR: [
                { displayName: { contains: term, mode: 'insensitive' } },
                { partyCode: { contains: term, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        displayName: true,
        partyCode: true,
        partyType: true,
      },
      orderBy: [{ displayName: 'asc' }, { partyCode: 'asc' }],
      take: 50,
    });
  }
}
