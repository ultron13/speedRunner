/**
 * API integration for the alerting/SLA store.
 */

import { apiClient } from "@/lib/api-client";
import { useTestStore } from "./test-store";
import type { SLAThreshold } from "@/types";

export async function fetchSLAThresholdsFromAPI(projectId?: string) {
  try {
    const thresholds = await apiClient.getSLAThresholds(projectId);
    
    const slaThresholds: SLAThreshold[] = thresholds.map((t) => ({
      id: t.id as string,
      name: t.name as string,
      metric: t.metric as SLAThreshold["metric"],
      condition: t.condition as SLAThreshold["condition"],
      value: t.value as number,
      enabled: t.enabled as boolean,
    }));

    useTestStore.setState({ slaThresholds });
    return slaThresholds;
  } catch (error) {
    console.error("Failed to fetch SLA thresholds from API:", error);
    return null;
  }
}

export async function createSLAThresholdViaAPI(data: {
  name: string;
  metric: string;
  condition: string;
  value: number;
  projectId?: string;
}) {
  try {
    const threshold = await apiClient.createSLAThreshold(data);
    
    const newThreshold: SLAThreshold = {
      id: threshold.id as string,
      name: threshold.name as string,
      metric: threshold.metric as SLAThreshold["metric"],
      condition: threshold.condition as SLAThreshold["condition"],
      value: threshold.value as number,
      enabled: threshold.enabled as boolean,
    };

    useTestStore.setState((state) => ({
      slaThresholds: [...state.slaThresholds, newThreshold],
    }));

    return threshold;
  } catch (error) {
    console.error("Failed to create SLA threshold via API:", error);
    throw error;
  }
}
