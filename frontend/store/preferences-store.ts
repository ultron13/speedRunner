import { create } from "zustand";

import type { UserPreferences } from "@/types";

const PREFS_KEY = "speedrunner-preferences";

function getStoredPrefs(): UserPreferences {
  if (typeof window === "undefined") {
    return { theme: "system", language: "en", timezone: "UTC", notifications: true, autoRefresh: false, refreshInterval: 30 };
  }
  try {
    const stored = localStorage.getItem(PREFS_KEY);
    return stored ? JSON.parse(stored) : { theme: "system", language: "en", timezone: "UTC", notifications: true, autoRefresh: false, refreshInterval: 30 };
  } catch {
    return { theme: "system", language: "en", timezone: "UTC", notifications: true, autoRefresh: false, refreshInterval: 30 };
  }
}

export interface PreferencesStore {
  preferences: UserPreferences;
  updatePreferences: (prefs: Partial<UserPreferences>) => void;
}

export const usePreferencesStore = create<PreferencesStore>((set, get) => ({
  preferences: getStoredPrefs(),

  updatePreferences: (prefs) => {
    const updated = { ...get().preferences, ...prefs };
    if (typeof window !== "undefined") {
      localStorage.setItem(PREFS_KEY, JSON.stringify(updated));
    }
    set({ preferences: updated });
  },
}));
