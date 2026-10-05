"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function TaskOwnerSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Owner</CardTitle>
      </CardHeader>

      <CardContent>
        <p className="text-sm text-muted-foreground">
          Owner configuration has been consolidated into the
          <strong> Execution</strong> section.
        </p>
      </CardContent>
    </Card>
  );
}