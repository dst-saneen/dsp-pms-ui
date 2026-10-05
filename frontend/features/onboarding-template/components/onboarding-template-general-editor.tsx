"use client";

import { useState } from "react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  Button,
} from "@/components/ui/button";

import {
  InfoRow,
} from "@/components/common";

import {
  OnboardingTemplateForm,
} from "../forms";

import {
  useUpdateOnboardingTemplate,
} from "../hooks";

import type {
  OnboardingTemplate,
} from "../types";

interface Props {
  template: OnboardingTemplate;
}

export function OnboardingTemplateGeneralEditor({
  template,
}: Props) {

  const update =
    useUpdateOnboardingTemplate();

  const [editing, setEditing] =
    useState(false);

  return (

    <Card>

      <CardHeader className="flex flex-row items-center justify-between">

        <CardTitle>

          General Information

        </CardTitle>

        {!editing && (

          <Button
            variant="outline"
            onClick={() =>
              setEditing(true)
            }
          >
            Edit
          </Button>

        )}

      </CardHeader>

      <CardContent>

        {editing ? (

          <OnboardingTemplateForm
            template={template}
            onSubmit={(values) => {

              update.mutate(
                {
                  id: template.id,
                  dto: values,
                },
                {
                  onSuccess: () => {

                    setEditing(false);

                  },
                },
              );

            }}
          />

        ) : (

          <div className="space-y-4">

            <InfoRow
              label="Company"
              value={
                template.companyName ??
                "-"
              }
            />

            <InfoRow
              label="Department"
              value={
                template.departmentName ??
                "-"
              }
            />

            <InfoRow
              label="Template Code"
              value={template.templateCode}
            />

            <InfoRow
              label="Template Name"
              value={template.templateName}
            />

            <InfoRow
              label="Description"
              value={
                template.description ??
                "-"
              }
            />

            <div className="pt-2">

              <Button
                variant="outline"
                onClick={() =>
                  setEditing(true)
                }
              >
                Edit
              </Button>

            </div>

          </div>

        )}

      </CardContent>

    </Card>

  );

}