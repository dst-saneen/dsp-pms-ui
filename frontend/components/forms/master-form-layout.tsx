import { cn } from "@/lib/utils";

interface MasterFormLayoutProps {
  children: React.ReactNode;
  className?: string;
  columns?: 2 | 3 | 4;
}

export function MasterFormLayout({
  children,
  className,
  columns = 2,   // <-- Default to 2
}: MasterFormLayoutProps) {
  const grid = {
    2: "grid gap-6 md:grid-cols-2",
    3: "grid gap-6 md:grid-cols-2 xl:grid-cols-3",
    4: "grid gap-6 md:grid-cols-2 xl:grid-cols-4",
  };

  return (
    <div className={cn(grid[columns], className)}>
      {children}
    </div>
  );
}