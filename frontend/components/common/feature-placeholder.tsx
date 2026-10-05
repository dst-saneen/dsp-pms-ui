"use client";

import { Construction } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface FeaturePlaceholderProps {
  title: string;
  workOrder?: string;
  description?: string;
}

export function FeaturePlaceholder({
  title,
  workOrder,
  description,
}: FeaturePlaceholderProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Construction className="h-5 w-5 text-muted-foreground" />
          {title}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">
          {description ??
            "This feature will be implemented in a future work order."}
        </p>

        {workOrder && (
          <p className="text-xs font-medium text-muted-foreground">
            Planned Work Order: {workOrder}
          </p>
        )}
      </CardContent>
    </Card>
  );
}