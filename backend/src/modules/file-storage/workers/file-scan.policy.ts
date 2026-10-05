export function shouldProcessFileScans(
  scanWorkerEnabled: boolean,
  nodeEnv: string,
): boolean {
  return scanWorkerEnabled || nodeEnv !== 'production';
}
