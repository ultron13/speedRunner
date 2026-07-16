import { create } from "zustand";

import type { SharedView, TeamMember } from "@/types";

const MEMBERS_KEY = "speedrunner-team-members";
const VIEWS_KEY = "speedrunner-shared-views";

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

const defaultMembers: TeamMember[] = [
  { id: "tm-1", userId: "user-1", name: "Admin User", email: "admin@example.com", role: "owner", joinedAt: "2025-01-01T00:00:00Z", lastActive: new Date().toISOString() },
  { id: "tm-2", userId: "user-2", name: "Editor User", email: "editor@example.com", role: "editor", joinedAt: "2025-01-15T00:00:00Z", lastActive: new Date().toISOString() },
  { id: "tm-3", userId: "user-3", name: "Viewer User", email: "viewer@example.com", role: "viewer", joinedAt: "2025-02-01T00:00:00Z", lastActive: new Date(Date.now() - 86400000).toISOString() },
];

export interface CollaborationAdvancedStore {
  members: TeamMember[];
  sharedViews: SharedView[];
  addMember: (member: Omit<TeamMember, "id" | "joinedAt" | "lastActive">) => TeamMember;
  removeMember: (id: string) => void;
  updateMemberRole: (id: string, role: TeamMember["role"]) => void;
  createSharedView: (view: Omit<SharedView, "id" | "createdAt">) => SharedView;
  deleteSharedView: (id: string) => void;
}

export const useCollaborationAdvancedStore = create<CollaborationAdvancedStore>((set, get) => ({
  members: getStored<TeamMember>(MEMBERS_KEY).length > 0
    ? getStored<TeamMember>(MEMBERS_KEY)
    : defaultMembers,
  sharedViews: getStored<SharedView>(VIEWS_KEY),

  addMember: (member) => {
    const newMember: TeamMember = {
      ...member,
      id: `tm-${Date.now()}`,
      joinedAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
    };
    const updated = [...get().members, newMember];
    save(MEMBERS_KEY, updated);
    set({ members: updated });
    return newMember;
  },

  removeMember: (id) => {
    const updated = get().members.filter((m) => m.id !== id);
    save(MEMBERS_KEY, updated);
    set({ members: updated });
  },

  updateMemberRole: (id, role) => {
    const updated = get().members.map((m) =>
      m.id === id ? { ...m, role } : m,
    );
    save(MEMBERS_KEY, updated);
    set({ members: updated });
  },

  createSharedView: (view) => {
    const newView: SharedView = {
      ...view,
      id: `sv-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    const updated = [...get().sharedViews, newView];
    save(VIEWS_KEY, updated);
    set({ sharedViews: updated });
    return newView;
  },

  deleteSharedView: (id) => {
    const updated = get().sharedViews.filter((v) => v.id !== id);
    save(VIEWS_KEY, updated);
    set({ sharedViews: updated });
  },
}));
