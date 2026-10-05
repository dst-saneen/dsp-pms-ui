"use client";

import {
  useOnboardingDesigner,
} from "../../state";

import {
  NODE_RENDERERS,
} from "./node-renderer-registry";

import {
  TemplateNode,
} from "./template-node";

export function OnboardingNodeRenderer() {

  const {
    state,
  } = useOnboardingDesigner();

  const selectedNode =
    state.selectedNode;

  /**
   * Nothing selected
   */
  if (!selectedNode) {
    return <TemplateNode />;
  }

  /**
   * Resolve renderer
   */
  const Renderer =
    NODE_RENDERERS[
      selectedNode.type as keyof typeof NODE_RENDERERS
    ];

  /**
   * Unknown node type
   */
  if (!Renderer) {
    return <TemplateNode />;
  }

  return <Renderer />;
}