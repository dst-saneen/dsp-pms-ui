import { readFileSync } from 'node:fs';

import {
  emptyProjectLiteClientMapping,
  type ProjectLiteClientMappingFile,
} from './project-lite-mapping.types';

export function loadProjectLiteClientMapping(
  path: string | undefined,
): ProjectLiteClientMappingFile {
  if (!path) {
    return emptyProjectLiteClientMapping();
  }

  const raw = JSON.parse(
    readFileSync(path, 'utf8'),
  ) as ProjectLiteClientMappingFile;
  if (raw.version !== 1 || typeof raw.businessPartyByProjectId !== 'object') {
    throw new Error(
      'Project Lite client mapping must be { version: 1, businessPartyByProjectId: {} }',
    );
  }

  for (const [projectId, partyId] of Object.entries(
    raw.businessPartyByProjectId,
  )) {
    if (!projectId.trim() || !String(partyId).trim()) {
      throw new Error(
        `Invalid businessPartyByProjectId entry for "${projectId}"`,
      );
    }
  }

  return raw;
}
