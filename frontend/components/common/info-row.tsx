interface InfoRowProps {
  label: string;
  value?: React.ReactNode;
}

export function InfoRow({
  label,
  value,
}: InfoRowProps) {
  return (
    <div className="grid gap-1 border-b border-border py-3 first:pt-0 last:border-0 last:pb-0 sm:grid-cols-[minmax(120px,0.8fr)_minmax(0,1.2fr)] sm:gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>

      <span className="min-w-0 break-words text-sm font-medium sm:text-right">
        {value ?? "-"}
      </span>
    </div>
  );
}
