"use client";

import {
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function DepartmentTaskGridHeader() {
  return (
    <TableHeader>
      <TableRow>
        <TableHead className="w-14">G#</TableHead>
        <TableHead className="w-64">Task Group</TableHead>
        <TableHead className="w-14">T#</TableHead>
        <TableHead>Task Name</TableHead>
        <TableHead className="w-40">Assigned To</TableHead>
        <TableHead className="w-24 text-center">Due</TableHead>
        <TableHead className="w-28 text-center">Mandatory</TableHead>
        <TableHead className="w-24 text-center">Actions</TableHead>
      </TableRow>
    </TableHeader>
  );
}
