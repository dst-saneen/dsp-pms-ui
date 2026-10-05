"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";

import {
  useOnboardingDesigner,
} from "../../state";

import {
  TaskGroupsSection,
} from "./task-groups-section";

export function DepartmentNode() {

  const {
      state,
  } = useOnboardingDesigner();

  const node =
      state.selectedNode;

  return (

    <Card>

      <CardHeader>

        <CardTitle>

          Department

        </CardTitle>

      </CardHeader>

      <CardContent className="space-y-6">

        <div>

          <Label>

            Department

          </Label>

          <Input
            value={node?.title ?? ""}
            disabled
          />

        </div>

        <TaskGroupsSection />

      </CardContent>

    </Card>

  );

}