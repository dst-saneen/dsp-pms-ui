"use client";

import {
  useOnboardingDesigner,
} from "../state";

export function OnboardingCanvasHeader() {

  const {
    state,
  } = useOnboardingDesigner();

  const node =
    state.selectedNode;

  return (
    <div className="border-b px-6 py-4">

      <h2 className="text-xl font-semibold">
        {node?.title}
      </h2>

      <p className="text-sm text-muted-foreground capitalize">
        {node?.type}
      </p>

    </div>
  );
}