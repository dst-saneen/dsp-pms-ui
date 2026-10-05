"use client";

import {
  Badge,
} from "@/components/ui/badge";

import {
  useOnboardingDesigner,
} from "../state";

export function OnboardingVersionBadge() {

  const {
    state,
  } = useOnboardingDesigner();

  const version =
    state.workspace.template.version;

  if (!version) {
    return (
      <Badge variant="outline">
        No Version
      </Badge>
    );
  }

  return (

    <Badge variant="secondary">

      Version {version.versionNo}

      {" • "}

      {version.status}

    </Badge>

  );

}