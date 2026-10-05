export interface ResolvedActor {
  readonly id: string;

  readonly displayName?: string;
}

export interface ActorResolutionResult {
  readonly actors: readonly ResolvedActor[];
}
