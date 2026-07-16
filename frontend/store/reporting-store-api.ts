/**
 * API integration for the reporting/templates store.
 */

import { apiClient } from "@/lib/api-client";
import { useReportingStore } from "./reporting-store";

export async function fetchTemplatesFromAPI(projectId?: string) {
  try {
    const templates = await apiClient.getTemplates(projectId);
    
    const reportTemplates = templates.map((t) => ({
      id: t.id as string,
      name: t.name as string,
      description: (t.description as string) || "",
      type: "custom" as const,
      scriptType: t.scriptType as string,
      targetUrl: t.targetUrl as string,
      virtualUsers: t.virtualUsers as number,
      sections: [],
      createdAt: t.createdAt as string,
      usageCount: t.usageCount as number,
    }));

    useReportingStore.setState({ templates: reportTemplates });
    return reportTemplates;
  } catch (error) {
    console.error("Failed to fetch templates from API:", error);
    return null;
  }
}

export async function createTemplateViaAPI(data: {
  name: string;
  description?: string;
  scriptType: string;
  targetUrl: string;
  virtualUsers: number;
  projectId?: string;
}) {
  try {
    const template = await apiClient.createTemplate(data);
    
    useReportingStore.setState((state) => ({
      templates: [
        ...state.templates,
        {
          id: template.id as string,
          name: template.name as string,
          description: (template.description as string) || "",
          type: "custom" as const,
          scriptType: template.scriptType as string,
          targetUrl: template.targetUrl as string,
          virtualUsers: template.virtualUsers as number,
          sections: [],
          createdAt: template.createdAt as string,
          usageCount: 0,
        },
      ],
    }));

    return template;
  } catch (error) {
    console.error("Failed to create template via API:", error);
    throw error;
  }
}
