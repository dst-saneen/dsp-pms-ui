"use client";

import type { OnboardingWorkspace } from "../workspace";

import { OnboardingTemplateProfileHeader } from "./onboarding-template-profile-header";
import {
  OnboardingTemplateTabs,
  type OnboardingTemplateTabItem,
} from "./onboarding-template-tabs";
import { OnboardingTemplateGeneral } from "./onboarding-template-general";
import { OnboardingTemplateDesigner } from "./designer";
import { useOnboardingTemplateActions } from "./hooks";
import { OnboardingDesignerProvider } from "./state";

export interface OnboardingTemplateEditorProps {
  workspace: OnboardingWorkspace;
}

function OnboardingTemplateEditorContent({
  workspace,
}: OnboardingTemplateEditorProps) {
  const template = workspace.template;

  const actions = useOnboardingTemplateActions(
    template.version?.id ?? "",
    template.id,
  );

  const tabs: OnboardingTemplateTabItem[] = [
    {
      value: "general",
      label: "General",
      content: <OnboardingTemplateGeneral template={template} />,
    },
    {
      value: "designer",
      label: "Designer",
      content: (
        <OnboardingTemplateDesigner
          workspace={workspace}
          embedded
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <OnboardingTemplateProfileHeader
        template={template}
        onSave={async () => {
          await actions.save();
        }}
        onValidate={actions.validate}
        onPublish={actions.publish}
        onCreateDraft={actions.createDraft}
        onArchive={actions.archive}
        validating={actions.validating}
        publishing={actions.publishing}
        creatingDraft={actions.creatingDraft}
        archiving={actions.archiving}
      />

      <OnboardingTemplateTabs tabs={tabs} defaultValue="designer" />
    </div>
  );
}

export function OnboardingTemplateEditor({
  workspace,
}: OnboardingTemplateEditorProps) {
  return (
    <OnboardingDesignerProvider workspace={workspace}>
      <OnboardingTemplateEditorContent workspace={workspace} />
    </OnboardingDesignerProvider>
  );
}
