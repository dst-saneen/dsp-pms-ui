export interface ProjectLiteClientMappingFile {
  version: 1;
  /**
   * Explicit operator mapping from legacy Client Project id → BusinessParty id.
   * Do not invent parties by name. Empty until Finance BusinessParty exists.
   */
  businessPartyByProjectId: Record<string, string>;
}

export function emptyProjectLiteClientMapping(): ProjectLiteClientMappingFile {
  return {
    version: 1,
    businessPartyByProjectId: {},
  };
}
