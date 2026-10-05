"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import type {
  OnboardingTemplate,
} from "../types";

interface Props {
  template: OnboardingTemplate;
}

export function OnboardingTemplateGeneral({
  template,
}: Props) {
  return (
    <div className="grid gap-6">

      <Card>

        <CardHeader>
          <CardTitle>
            General Information
          </CardTitle>
        </CardHeader>

        <CardContent className="grid md:grid-cols-2 gap-6">

          <div>

            <label className="text-sm font-medium">
              Template Name
            </label>

            <p>{template.templateName}</p>

          </div>

          <div>

            <label className="text-sm font-medium">
              Template Code
            </label>

            <p>{template.templateCode}</p>

          </div>

          <div className="md:col-span-2">

            <label className="text-sm font-medium">
              Description
            </label>

            <p>{template.description}</p>

          </div>

        </CardContent>

      </Card>

    </div>
  );
}