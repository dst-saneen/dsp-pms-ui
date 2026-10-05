"use client";

import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

import type { DeliveryMessage } from "../types/delivery";
import { DeliveryStatusBadge } from "./delivery-status-badge";

interface DeliveryMessageTableProps {
  messages: DeliveryMessage[];
  detailBasePath: string;
  onRetry?: (message: DeliveryMessage) => void;
  onCancel?: (message: DeliveryMessage) => void;
  isRetrying?: boolean;
  isCancelling?: boolean;
  emptyHint?: string;
}

export function DeliveryMessageTable({
  messages,
  detailBasePath,
  onRetry,
  onCancel,
  isRetrying,
  isCancelling,
  emptyHint,
}: DeliveryMessageTableProps) {
  if (messages.length === 0) {
    return (
      <div className="text-muted-foreground space-y-2 py-8 text-center text-sm">
        <p>No messages found for this filter.</p>
        {emptyHint ? <p className="text-xs">{emptyHint}</p> : null}
        <p className="text-xs">
          Platform queue needs Delivery Operations enabled and traffic that creates
          messages. HR candidate mail also appears under{" "}
          <Link href="/hr/recruitment/delivery" className="underline">
            Recruitment → Delivery
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Event type</TableHead>
          <TableHead>Recipient</TableHead>
          <TableHead>Channel</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Attempts</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {messages.map((msg) => {
          const allowed = new Set(msg.allowedActions ?? []);
          const canRetry = Boolean(onRetry) && allowed.has("RETRY");
          const canCancel = Boolean(onCancel) && allowed.has("CANCEL");
          return (
            <TableRow key={msg.id}>
              <TableCell className="font-mono text-xs">
                {msg.eventType ?? msg.outboxEventType}
              </TableCell>
              <TableCell className="text-muted-foreground max-w-[160px] truncate text-xs">
                {msg.recipientDisplay ?? msg.toDisplayName ?? msg.recipientKind}
              </TableCell>
              <TableCell className="text-xs">{msg.channel}</TableCell>
              <TableCell>
                <DeliveryStatusBadge status={msg.status} />
              </TableCell>
              <TableCell className="text-xs tabular-nums">
                {msg.attemptCount}
              </TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {formatDistanceToNow(new Date(msg.createdAt), {
                  addSuffix: true,
                })}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`${detailBasePath}/${msg.id}`}>View</Link>
                  </Button>
                  {onRetry ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!canRetry || isRetrying}
                      title={
                        canRetry
                          ? undefined
                          : "Retry is not allowed in this status (or you lack delivery manage)."
                      }
                      onClick={() => {
                        if (canRetry) onRetry(msg);
                      }}
                    >
                      Retry
                    </Button>
                  ) : null}
                  {onCancel ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!canCancel || isCancelling}
                      title={
                        canCancel
                          ? undefined
                          : "Cancel is not allowed in this status (or you lack delivery manage)."
                      }
                      onClick={() => {
                        if (canCancel) onCancel(msg);
                      }}
                    >
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
