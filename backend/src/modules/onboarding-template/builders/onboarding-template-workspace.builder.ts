import { Injectable } from '@nestjs/common';
import { TemplateVersionStatus } from '@prisma/client';

import {
  OnboardingTemplateEditor,
  OnboardingExplorerNode,
  OnboardingWorkspaceExplorer,
} from '../contracts';

type OnboardingTask = {
  id: string;
  taskName: string;
  ownerType?: string | null;
};

type OnboardingTaskGroup = {
  id: string;
  groupName: string;
  tasks?: OnboardingTask[];
};

type OnboardingDepartmentTemplate = {
  id: string;
  department?: { departmentName: string } | null;
  taskGroups?: OnboardingTaskGroup[];
};

type OnboardingTemplateVersion = {
  status: TemplateVersionStatus;
  isCurrent: boolean;
  departments?: OnboardingDepartmentTemplate[];
};

type OnboardingTemplate = {
  id: string;
  companyId: string;
  templateCode: string | null;
  templateName: string;
  description: string | null;
  isActive: boolean;
  version?: OnboardingTemplateVersion | null;
};

@Injectable()
export class OnboardingTemplateWorkspaceBuilder {
  build(
    template: OnboardingTemplate,
    version: OnboardingTemplateVersion,
  ): OnboardingTemplateEditor {
    const editorTemplate = this.buildTemplate(template, version);

    return {
      template: editorTemplate,

      explorer: {
        nodes: this.buildExplorer(editorTemplate),
      },

      metadata: this.buildMetadata(version),
    };
  }

  private buildTemplate(
    template: OnboardingTemplate,
    version: OnboardingTemplateVersion,
  ) {
    return {
      id: template.id,

      companyId: template.companyId,

      templateCode: template.templateCode,

      templateName: template.templateName,

      description: template.description,

      isActive: template.isActive,

      version,
    };
  }

  private buildExplorer(
    template: OnboardingTemplate,
  ): OnboardingWorkspaceExplorer['nodes'] {
    return [
      {
        id: template.id,

        type: 'template',

        title: template.templateName,

        expanded: true,

        children: (template.version?.departments ?? []).map(
          (department): OnboardingExplorerNode => ({
            id: department.id,

            parentId: template.id,

            type: 'department',

            title: department.department?.departmentName ?? 'Department',

            expanded: true,

            children: (department.taskGroups ?? []).map(
              (group): OnboardingExplorerNode => ({
                id: group.id,

                parentId: department.id,

                type: 'group',

                title: group.groupName,

                expanded: true,

                children: (group.tasks ?? []).map(
                  (task): OnboardingExplorerNode => ({
                    id: task.id,

                    parentId: group.id,

                    type: 'task',

                    title: task.taskName,

                    subtitle: task.ownerType ?? undefined,
                  }),
                ),
              }),
            ),
          }),
        ),
      },
    ];
  }

  private buildMetadata(version: OnboardingTemplateVersion) {
    return {
      editable: version.status === TemplateVersionStatus.DRAFT,

      published: version.isCurrent,
    };
  }
}
