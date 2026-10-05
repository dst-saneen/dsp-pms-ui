import { ReactNode } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: ReactNode;
  trend?: number;
}

export function StatCard({
  title,
  value,
  description,
  icon,
  trend,
}: StatCardProps) {
  const positive = trend !== undefined && trend >= 0;

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>

        {icon}
      </CardHeader>

      <CardContent>
        <div className="text-3xl font-bold">
          {value}
        </div>

        {(description || trend !== undefined) && (
          <div className="mt-3 flex items-center justify-between">
            {description && (
              <p className="text-sm text-muted-foreground">
                {description}
              </p>
            )}

            {trend !== undefined && (
              <div
                className={`flex items-center gap-1 text-sm ${
                  positive ? "text-green-600" : "text-red-600"
                }`}
              >
                {positive ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}

                {Math.abs(trend)}%
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}