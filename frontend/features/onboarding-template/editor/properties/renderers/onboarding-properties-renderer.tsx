"use client";

import {
  useOnboardingDesigner,
} from "../../state";

import {
  TemplateProperties,
} from "./template-properties";

import {
  TaskProperties,
} from "./task-properties";

export function OnboardingPropertiesRenderer() {

  const {
    state,
  } = useOnboardingDesigner();

  switch (state.selectedNode?.type) {

    case "template":
      return <TemplateProperties />;

    case "task":
      return <TaskProperties />;

    default:
      return <TemplateProperties />;

  }

}