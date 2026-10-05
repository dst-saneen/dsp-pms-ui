"use client";

import { ReactNode } from "react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface FeatureActionPanelProps {
  title: string;
  children: ReactNode;
}

export function FeatureActionPanel({
  title,
  children,
}: FeatureActionPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>

      <CardContent>
        <div className="flex flex-wrap gap-2">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}