"use client";

import {
  Card,
  CardContent,
} from "@/components/ui/card";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

import { useTaskEditor } from "./hooks";

import {
  TaskGeneralSection,
  TaskAssignmentSection,
  TaskTimelineSection,
} from "./sections";

export function OnboardingTaskEditor() {

  const { task } = useTaskEditor();

  if (!task) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold">
            Select a Task
          </h2>

          <p className="text-muted-foreground">
            Choose a task from the task list.
          </p>
        </div>
      </div>
    );
  }

  return (

    <Card className="h-full border-0 shadow-none">

      <CardContent className="pt-6">

        <Tabs
          defaultValue="general"
          className="space-y-6"
        >

          <TabsList>

            <TabsTrigger value="general">
              General
            </TabsTrigger>

            <TabsTrigger value="assignment">
              Assignment
            </TabsTrigger>

            <TabsTrigger value="timeline">
              Timeline
            </TabsTrigger>

            <TabsTrigger value="checklist">
              Checklist
            </TabsTrigger>

            <TabsTrigger value="documents">
              Documents
            </TabsTrigger>

            <TabsTrigger value="employee-inputs">
              Employee Inputs
            </TabsTrigger>

          </TabsList>

          <TabsContent value="general">
            <TaskGeneralSection />
          </TabsContent>

          <TabsContent value="assignment">
            <TaskAssignmentSection />
          </TabsContent>

          <TabsContent value="timeline">
            <TaskTimelineSection />
          </TabsContent>

          <TabsContent value="checklist">
            <div className="py-10 text-center text-muted-foreground">
              Checklist designer (HR-0025B)
            </div>
          </TabsContent>

          <TabsContent value="documents">
            <div className="py-10 text-center text-muted-foreground">
              Required documents (HR-0025B)
            </div>
          </TabsContent>

          <TabsContent value="employee-inputs">
            <div className="py-10 text-center text-muted-foreground">
              Employee information fields (HR-0025B)
            </div>
          </TabsContent>

        </Tabs>

      </CardContent>

    </Card>

  );

}