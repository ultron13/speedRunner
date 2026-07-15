import { create } from "zustand";

import type {
  AdvancedTestState,
  ChaosScenario,
  LoadProfile,
  TestConfiguration,
} from "@/types";

const CONFIGS_KEY = "speedrunner-test-configs";
const CHAOS_KEY = "speedrunner-chaos";
const PROFILES_KEY = "speedrunner-load-profiles";

function getStored<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function save<T>(key: string, data: T[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(data));
}

const defaultProfiles: LoadProfile[] = [
  {
    id: "profile-constant",
    name: "Constant Load",
    description: "Maintains a steady number of virtual users throughout the test",
    type: "constant",
    config: { startUsers: 100, endUsers: 100, duration: 300 },
    createdAt: "2025-01-01T00:00:00Z",
  },
  {
    id: "profile-ramp",
    name: "Ramp Up",
    description: "Gradually increases virtual users over time",
    type: "ramp-up",
    config: { startUsers: 10, endUsers: 500, duration: 300 },
    createdAt: "2025-01-01T00:00:00Z",
  },
  {
    id: "profile-spike",
    name: "Spike Test",
    description: "Sudden increase in load to test system resilience",
    type: "spike",
    config: { startUsers: 100, endUsers: 1000, duration: 60, peakDuration: 30 },
    createdAt: "2025-01-01T00:00:00Z",
  },
];

export interface AdvancedTestStore extends AdvancedTestState {
  createConfiguration: (config: Omit<TestConfiguration, "id" | "createdAt" | "updatedAt">) => TestConfiguration;
  updateConfiguration: (id: string, updates: Partial<TestConfiguration>) => void;
  deleteConfiguration: (id: string) => void;

  createChaosScenario: (scenario: Omit<ChaosScenario, "id" | "createdAt">) => ChaosScenario;
  updateChaosScenario: (id: string, updates: Partial<ChaosScenario>) => void;
  deleteChaosScenario: (id: string) => void;
  toggleChaosScenario: (id: string) => void;

  createLoadProfile: (profile: Omit<LoadProfile, "id" | "createdAt">) => LoadProfile;
  updateLoadProfile: (id: string, updates: Partial<LoadProfile>) => void;
  deleteLoadProfile: (id: string) => void;
}

export const useAdvancedTestStore = create<AdvancedTestStore>((set, get) => ({
  configurations: getStored<TestConfiguration>(CONFIGS_KEY),
  chaosScenarios: getStored<ChaosScenario>(CHAOS_KEY),
  loadProfiles: getStored<LoadProfile>(PROFILES_KEY).length > 0
    ? getStored<LoadProfile>(PROFILES_KEY)
    : defaultProfiles,

  createConfiguration: (config) => {
    const newConfig: TestConfiguration = {
      ...config,
      id: `config-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [...get().configurations, newConfig];
    save(CONFIGS_KEY, updated);
    set({ configurations: updated });
    return newConfig;
  },

  updateConfiguration: (id, updates) => {
    const updated = get().configurations.map((c) =>
      c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c,
    );
    save(CONFIGS_KEY, updated);
    set({ configurations: updated });
  },

  deleteConfiguration: (id) => {
    const updated = get().configurations.filter((c) => c.id !== id);
    save(CONFIGS_KEY, updated);
    set({ configurations: updated });
  },

  createChaosScenario: (scenario) => {
    const newScenario: ChaosScenario = {
      ...scenario,
      id: `chaos-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    const updated = [...get().chaosScenarios, newScenario];
    save(CHAOS_KEY, updated);
    set({ chaosScenarios: updated });
    return newScenario;
  },

  updateChaosScenario: (id, updates) => {
    const updated = get().chaosScenarios.map((s) =>
      s.id === id ? { ...s, ...updates } : s,
    );
    save(CHAOS_KEY, updated);
    set({ chaosScenarios: updated });
  },

  deleteChaosScenario: (id) => {
    const updated = get().chaosScenarios.filter((s) => s.id !== id);
    save(CHAOS_KEY, updated);
    set({ chaosScenarios: updated });
  },

  toggleChaosScenario: (id) => {
    const updated = get().chaosScenarios.map((s) =>
      s.id === id ? { ...s, enabled: !s.enabled } : s,
    );
    save(CHAOS_KEY, updated);
    set({ chaosScenarios: updated });
  },

  createLoadProfile: (profile) => {
    const newProfile: LoadProfile = {
      ...profile,
      id: `profile-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    const updated = [...get().loadProfiles, newProfile];
    save(PROFILES_KEY, updated);
    set({ loadProfiles: updated });
    return newProfile;
  },

  updateLoadProfile: (id, updates) => {
    const updated = get().loadProfiles.map((p) =>
      p.id === id ? { ...p, ...updates } : p,
    );
    save(PROFILES_KEY, updated);
    set({ loadProfiles: updated });
  },

  deleteLoadProfile: (id) => {
    const updated = get().loadProfiles.filter((p) => p.id !== id);
    save(PROFILES_KEY, updated);
    set({ loadProfiles: updated });
  },
}));
