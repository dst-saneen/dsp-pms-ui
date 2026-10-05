"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";

export interface EmployeeTabItem {
  value: string;
  label: string;
  content: React.ReactNode;
}

interface EmployeeTabsProps {
  tabs: EmployeeTabItem[];
  defaultValue?: string;
}

export function EmployeeTabs({
  tabs,
  defaultValue,
}: EmployeeTabsProps) {
  if (tabs.length === 0) return null;

  return (
    <Card className="gap-0 overflow-visible py-0">
      <Tabs defaultValue={defaultValue ?? tabs[0].value} className="gap-0">
        <div className="overflow-x-auto border-b border-border px-3 sm:px-5">
          <TabsList
            variant="line"
            className="h-12 min-w-max justify-start gap-1 p-0"
          >
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="h-full px-3.5"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <CardContent className="p-4 sm:p-5 lg:p-6">
          {tabs.map((tab) => (
            <TabsContent key={tab.value} value={tab.value}>
              {tab.content}
            </TabsContent>
          ))}
        </CardContent>
      </Tabs>
    </Card>
  );
}
