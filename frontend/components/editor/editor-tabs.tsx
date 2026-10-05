"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

interface Tab {
  value: string;
  label: string;
  content: React.ReactNode;
}

interface Props {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  tabs: Tab[];
}

export function EditorTabs({
  defaultValue,
  value,
  onValueChange,
  tabs,
}: Props) {
  return (
    <Tabs
      defaultValue={value ? undefined : defaultValue}
      value={value}
      onValueChange={onValueChange}
    >
      <TabsList>
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="pt-6">
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
