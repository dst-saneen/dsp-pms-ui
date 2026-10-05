export interface AuditEntry {
  id: string;

  action:
    | "Created"
    | "Updated"
    | "Deleted";

  user: string;

  timestamp: Date;

  description?: string;
}