import { cn } from "@/lib/utils";

interface TransactionFormLayoutProps {
  children: React.ReactNode;
  className?: string;
  columns?: 1 | 2 | 3;
}

export function TransactionFormLayout({
  children,
  className,
  columns = 2,
}: TransactionFormLayoutProps) {
  const grid = {
    1: "grid gap-5",
    2: "grid gap-5 md:grid-cols-2",
    3: "grid gap-5 md:grid-cols-2 xl:grid-cols-3",
  };

  return (
    <div className={cn(grid[columns], className)}>
      {children}
    </div>
  );
}