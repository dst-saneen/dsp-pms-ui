export const EVALUATION_RECOMMENDATION_OPTIONS = [
  { value: "STRONG_HIRE", label: "Strong hire" },
  { value: "HIRE", label: "Hire" },
  { value: "MAYBE", label: "Maybe" },
  { value: "NO_HIRE", label: "No hire" },
] as const;

export const INTERVIEW_TIMEZONE_OPTIONS = [
  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST)" },
  { value: "Asia/Dubai", label: "Asia/Dubai (GST)" },
  { value: "UTC", label: "UTC" },
] as const;

export function resolveLocalInterviewTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export const INTERVIEW_MODE_OPTIONS = [
  { value: "IN_PERSON", label: "In person" },
  { value: "VIDEO", label: "Video" },
  { value: "PHONE", label: "Phone" },
] as const;
