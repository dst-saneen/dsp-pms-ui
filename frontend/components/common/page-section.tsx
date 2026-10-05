import { ReactNode } from "react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface PageSectionProps {
  title?: string;
  children: ReactNode;
}

export function PageSection({
  title,
  children,
}: PageSectionProps) {
  return (
    <Card>
      {title && (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      )}

      <CardContent>{children}</CardContent>
    </Card>
  );
}