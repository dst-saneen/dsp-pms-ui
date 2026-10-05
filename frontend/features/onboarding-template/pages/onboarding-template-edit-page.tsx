"use client";

import { useRouter } from "next/navigation";

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
  ArrowLeft,
} from "lucide-react";

import {
  OnboardingTemplateForm,
} from "../forms";

import {
  useOnboardingTemplate,
  useUpdateOnboardingTemplate,
} from "../hooks";

interface Props {
  id: string;
}

export function OnboardingTemplateEditPage({
  id,
}: Props) {

  const router =
    useRouter();

  const {
    data: template,
    isLoading,
  } =
    useOnboardingTemplate(id);

  const update =
    useUpdateOnboardingTemplate();

  if (isLoading) {
    return (
      <div className="p-6">
        Loading...
      </div>
    );
  }

  if (!template) {
    return (
      <div className="p-6">
        Template not found.
      </div>
    );
  }

  return (

    <div className="space-y-6">

      <Button
        variant="ghost"
        onClick={() => router.back()}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <Card>

        <CardHeader>

          <CardTitle>

            Edit Template

          </CardTitle>

        </CardHeader>

        <CardContent>

          <OnboardingTemplateForm
            template={template}
            onSubmit={(values) =>

              update.mutate({

                id,

                dto: values,

              })

            }
          />

        </CardContent>

      </Card>

    </div>

  );

}