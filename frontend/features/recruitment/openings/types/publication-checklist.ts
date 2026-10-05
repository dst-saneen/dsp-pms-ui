export interface PublicationCheckItem {
  code: string;
  label: string;
  passed: boolean;
  message?: string;
}

export interface PublicationChecklist {
  items: PublicationCheckItem[];
  canPublish: boolean;
}
