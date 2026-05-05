export function logDecision(event: string, data: Record<string, unknown>): void {
  const payload = {
    event,
    timestamp: new Date().toISOString(),
    ...data
  };
  // Stdout log is structured and ready for centralized ingestion.
  console.log(JSON.stringify(payload));
}
