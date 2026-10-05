"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

export interface EmployeeOnboardingTabItem {
  value: string;
  label: string;
  content: React.ReactNode;
}

interface EmployeeOnboardingTabsProps {
  tabs: EmployeeOnboardingTabItem[];
  defaultValue?: string;
}

export function EmployeeOnboardingTabs({
  tabs,
  defaultValue,
}: EmployeeOnboardingTabsProps) {
  if (tabs.length === 0) {
    return null;
  }

  const selectedTab =
    defaultValue ?? tabs[0].value;

  return (
    <Tabs
      defaultValue={selectedTab}
      className="space-y-6"
    >
      <TabsList>
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {tabs.map((tab) => (
        <TabsContent
          key={tab.value}
          value={tab.value}
        >
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}