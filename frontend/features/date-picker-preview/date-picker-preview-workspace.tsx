"use client";

import * as React from "react";
import { addDays, addMonths, subDays } from "date-fns";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import {
  AppDatePicker,
  AppDateRangePicker,
  AppDateTimePicker,
  AppTimePicker,
  type AppDateRangeValue,
  type AppDateTimeValue,
} from "@/components/date-time";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";

function ValuePreview({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-xs text-muted-foreground">
      <span className="font-medium text-foreground">{label}:</span>{" "}
      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
        {value || "—"}
      </code>
    </p>
  );
}

function PickerDemoCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

export function DatePickerPreviewWorkspace() {
  const today = React.useMemo(() => new Date(), []);
  const [basicDate, setBasicDate] = React.useState<string | undefined>();
  const [dropdownDate, setDropdownDate] = React.useState<string | undefined>();
  const [minMaxDate, setMinMaxDate] = React.useState<string | undefined>();
  const [range, setRange] = React.useState<AppDateRangeValue | undefined>();
  const [specificRange, setSpecificRange] = React.useState<
    AppDateRangeValue | undefined
  >();
  const [time, setTime] = React.useState<string | undefined>("09:30");
  const [dateTime, setDateTime] = React.useState<AppDateTimeValue | undefined>();
  const [invalidDate, setInvalidDate] = React.useState<string | undefined>();

  return (
    <PageContainer>
      <PageHeader
        title="Date & time pickers"
        description="Shared AppDatePicker / AppTimePicker preview (Sneat-style patterns on shadcn Popover + Calendar). Form values stay as yyyy-MM-dd and HH:mm."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <PickerDemoCard
          title="Basic date picker"
          description="Single date with month/year dropdown caption (default AppDatePicker)."
        >
          <div className="space-y-2">
            <Label htmlFor="basic-date">Start date</Label>
            <AppDatePicker
              id="basic-date"
              value={basicDate}
              onChange={setBasicDate}
              placeholder="MMM d, yyyy"
            />
            <ValuePreview label="value" value={basicDate ?? ""} />
          </div>
        </PickerDemoCard>

        <PickerDemoCard
          title="Month & year dropdowns"
          description="Explicit dropdown caption layout for faster year jumps."
        >
          <div className="space-y-2">
            <Label htmlFor="dropdown-date">Hire date</Label>
            <AppDatePicker
              id="dropdown-date"
              value={dropdownDate}
              onChange={setDropdownDate}
              captionLayout="dropdown"
              fromYear={1990}
              toYear={2035}
            />
            <ValuePreview label="value" value={dropdownDate ?? ""} />
          </div>
        </PickerDemoCard>

        <PickerDemoCard
          title="Min & max pickers"
          description="Only allow dates from yesterday through 30 days ahead."
        >
          <div className="space-y-2">
            <Label htmlFor="minmax-date">Constrained date</Label>
            <AppDatePicker
              id="minmax-date"
              value={minMaxDate}
              onChange={setMinMaxDate}
              minDate={subDays(today, 1)}
              maxDate={addDays(today, 30)}
              captionLayout="label"
            />
            <ValuePreview label="value" value={minMaxDate ?? ""} />
          </div>
        </PickerDemoCard>

        <PickerDemoCard
          title="Time picker"
          description="Hour/minute popover with 5-minute steps (Sneat time picker equivalent)."
        >
          <div className="space-y-2">
            <Label htmlFor="basic-time">Shift start</Label>
            <AppTimePicker
              id="basic-time"
              value={time}
              onChange={setTime}
              minuteStep={5}
            />
            <ValuePreview label="value" value={time ?? ""} />
          </div>
        </PickerDemoCard>

        <PickerDemoCard
          title="Date range picker"
          description="Two-month range selection, closes when both ends are chosen."
        >
          <div className="space-y-2">
            <Label htmlFor="date-range">Leave period</Label>
            <AppDateRangePicker
              id="date-range"
              value={range}
              onChange={setRange}
              numberOfMonths={2}
            />
            <ValuePreview
              label="value"
              value={
                range
                  ? JSON.stringify({ from: range.from ?? null, to: range.to ?? null })
                  : ""
              }
            />
          </div>
        </PickerDemoCard>

        <PickerDemoCard
          title="Specific range"
          description="Range limited to the next 3 months from today."
        >
          <div className="space-y-2">
            <Label htmlFor="specific-range">Campaign window</Label>
            <AppDateRangePicker
              id="specific-range"
              value={specificRange}
              onChange={setSpecificRange}
              minDate={today}
              maxDate={addMonths(today, 3)}
              numberOfMonths={2}
            />
            <ValuePreview
              label="value"
              value={
                specificRange
                  ? JSON.stringify({
                      from: specificRange.from ?? null,
                      to: specificRange.to ?? null,
                    })
                  : ""
              }
            />
          </div>
        </PickerDemoCard>

        <PickerDemoCard
          title="Date + time"
          description="Combined date and time fields for interview / roster scheduling."
        >
          <div className="space-y-2">
            <Label>Scheduled at</Label>
            <AppDateTimePicker value={dateTime} onChange={setDateTime} />
            <ValuePreview
              label="value"
              value={
                dateTime
                  ? JSON.stringify({
                      date: dateTime.date ?? null,
                      time: dateTime.time ?? null,
                    })
                  : ""
              }
            />
          </div>
        </PickerDemoCard>

        <PickerDemoCard
          title="Validation styling"
          description="aria-invalid mirrors Input destructive ring/border for form errors."
        >
          <div className="space-y-2">
            <Label htmlFor="invalid-date">Required date</Label>
            <AppDatePicker
              id="invalid-date"
              value={invalidDate}
              onChange={setInvalidDate}
              aria-invalid={!invalidDate}
              placeholder="Must pick a date"
            />
            <ValuePreview
              label="valid"
              value={invalidDate ? "true" : "false (showing error state)"}
            />
          </div>
        </PickerDemoCard>
      </div>
    </PageContainer>
  );
}
