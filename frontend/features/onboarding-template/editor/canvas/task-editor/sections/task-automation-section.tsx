"use client";

import { TaskBehaviourSection } from "./task-behaviour-section";
import { TaskAdvancedSection } from "./task-advanced-section";

export function TaskAutomationSection() {
  return (
    <div className="space-y-6">
      <TaskBehaviourSection />
      <TaskAdvancedSection />
    </div>
  );
}