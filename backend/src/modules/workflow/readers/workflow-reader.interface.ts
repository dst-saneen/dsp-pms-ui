export interface WorkflowReader<TKey, TResult> {
  find(key: TKey): Promise<TResult>;
}
