import { Campaign, ExecutionRun, Segment } from "./types";

export const segments = new Map<string, Segment>();
export const campaigns = new Map<string, Campaign>();
export const runs = new Map<string, ExecutionRun>();

export const sendHistory = new Map<string, string[]>();

export function resetInMemoryState(): void {
  segments.clear();
  campaigns.clear();
  runs.clear();
  sendHistory.clear();
}
