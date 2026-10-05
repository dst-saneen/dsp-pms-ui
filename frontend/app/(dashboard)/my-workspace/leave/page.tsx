import { MyLeaveWorkspace } from "@/features/my-workspace/components/my-leave-workspace";

export interface MyLeavePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parsedYear(value: string | undefined) {
  if (!value?.match(/^\d{4}$/)) return undefined;
  const year = Number(value);
  return year >= 1900 ? year : undefined;
}

function parsedDate(value: string | undefined) {
  if (!value?.match(/^\d{4}-\d{2}-\d{2}$/)) return undefined;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value
    ? undefined
    : value;
}

export default async function MyLeavePage({ searchParams }: MyLeavePageProps) {
  const query = await searchParams;
  const initialYear = parsedYear(singleValue(query.year));
  const initialApplyOpen = singleValue(query.action) === "apply";
  const initialFromDate = parsedDate(singleValue(query.fromDate));

  return <MyLeaveWorkspace
    key={`${initialYear ?? "business"}:${initialApplyOpen ? "apply" : "view"}:${initialFromDate ?? "none"}`}
    initialYear={initialYear}
    initialApplyOpen={initialApplyOpen}
    initialFromDate={initialFromDate}
  />;
}
