import { InfoCard } from "@/components/common";

import type { EmployeeLeaveBalance } from "../types";

interface LeaveBalanceListProps {
  balances: EmployeeLeaveBalance[];
}

export function LeaveBalanceList({
  balances,
}: LeaveBalanceListProps) {
  return (
    <InfoCard title="Leave Balances">
      {balances.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          No leave balances available.
        </div>
      ) : (
        <div className="space-y-6">
          {balances.map((balance) => (
            <div
              key={balance.leaveTypeId}
              className="rounded-lg border p-4"
            >
              <div className="mb-4">
                <h3 className="font-semibold">
                  {balance.leaveName}
                </h3>

                <p className="text-sm text-muted-foreground">
                  {balance.leaveCode}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <BalanceItem
                  label="Entitlement"
                  value={balance.entitlement}
                />

                <BalanceItem
                  label="Used"
                  value={balance.used}
                />

                <BalanceItem
                  label="Pending"
                  value={balance.pending}
                />

                <BalanceItem
                  label="Available"
                  value={balance.balance}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </InfoCard>
  );
}

interface BalanceItemProps {
  label: string;
  value: number;
}

function BalanceItem({
  label,
  value,
}: BalanceItemProps) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">
        {label}
      </p>

      <p className="text-lg font-semibold">
        {value}
      </p>
    </div>
  );
}