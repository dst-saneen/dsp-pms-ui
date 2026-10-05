"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

export interface OnboardingTemplateTabItem {
  value: string;
  label: string;
  content: React.ReactNode;
}

interface OnboardingTemplateTabsProps {
  tabs: OnboardingTemplateTabItem[];
  defaultValue?: string;
}

export function OnboardingTemplateTabs({
  tabs,
  defaultValue,
}: OnboardingTemplateTabsProps) {
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