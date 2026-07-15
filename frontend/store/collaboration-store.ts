import { create } from "zustand";

import type {
  Comment,
  TeamWorkspace,
  UserActivity,
  WorkspaceMember,
} from "@/types";

const WORKSPACES_KEY = "speedrunner-workspaces";
const COMMENTS_KEY = "speedrunner-comments";
const ACTIVITIES_KEY = "speedrunner-activities";

function getStoredWorkspaces(): TeamWorkspace[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(WORKSPACES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveWorkspaces(workspaces: TeamWorkspace[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(WORKSPACES_KEY, JSON.stringify(workspaces));
}

function getStoredComments(): Comment[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(COMMENTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveComments(comments: Comment[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(COMMENTS_KEY, JSON.stringify(comments.slice(0, 500)));
}

function getStoredActivities(): UserActivity[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(ACTIVITIES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveActivities(activities: UserActivity[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(activities.slice(0, 200)));
}

const defaultWorkspaces: TeamWorkspace[] = [
  {
    id: "ws-default",
    name: "Default Workspace",
    description: "Main workspace for load testing",
    ownerId: "user-1",
    members: [
      { userId: "user-1", userName: "Admin User", role: "owner", joinedAt: "2025-01-01T00:00:00Z" },
      { userId: "user-2", userName: "Editor User", role: "admin", joinedAt: "2025-01-15T00:00:00Z" },
      { userId: "user-3", userName: "Viewer User", role: "viewer", joinedAt: "2025-02-01T00:00:00Z" },
    ],
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: new Date().toISOString(),
    isDefault: true,
  },
];

export interface CollaborationStore {
  workspaces: TeamWorkspace[];
  comments: Comment[];
  activities: UserActivity[];
  activeWorkspaceId: string | null;

  createWorkspace: (name: string, description: string) => TeamWorkspace;
  updateWorkspace: (id: string, updates: Partial<TeamWorkspace>) => void;
  deleteWorkspace: (id: string) => void;
  setActiveWorkspace: (id: string) => void;
  addMember: (workspaceId: string, member: WorkspaceMember) => void;
  removeMember: (workspaceId: string, userId: string) => void;
  updateMemberRole: (workspaceId: string, userId: string, role: WorkspaceMember["role"]) => void;

  addComment: (entityType: Comment["entityType"], entityId: string, content: string, userId: string, userName: string) => Comment;
  updateComment: (commentId: string, content: string) => void;
  deleteComment: (commentId: string) => void;
  getCommentsForEntity: (entityType: Comment["entityType"], entityId: string) => Comment[];

  addActivity: (activity: Omit<UserActivity, "id" | "timestamp">) => void;
  getActivitiesForUser: (userId: string) => UserActivity[];
  clearActivities: () => void;
}

export const useCollaborationStore = create<CollaborationStore>((set, get) => ({
  workspaces: getStoredWorkspaces().length > 0 ? getStoredWorkspaces() : defaultWorkspaces,
  comments: getStoredComments(),
  activities: getStoredActivities(),
  activeWorkspaceId: null,

  createWorkspace: (name, description) => {
    const newWorkspace: TeamWorkspace = {
      id: `ws-${Date.now()}`,
      name,
      description,
      ownerId: "current-user",
      members: [
        { userId: "current-user", userName: "Current User", role: "owner", joinedAt: new Date().toISOString() },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDefault: false,
    };

    const updated = [...get().workspaces, newWorkspace];
    saveWorkspaces(updated);
    set({ workspaces: updated });
    return newWorkspace;
  },

  updateWorkspace: (id, updates) => {
    const updated = get().workspaces.map((ws) =>
      ws.id === id ? { ...ws, ...updates, updatedAt: new Date().toISOString() } : ws,
    );
    saveWorkspaces(updated);
    set({ workspaces: updated });
  },

  deleteWorkspace: (id) => {
    const ws = get().workspaces.find((w) => w.id === id);
    if (ws?.isDefault) return;

    const updated = get().workspaces.filter((w) => w.id !== id);
    saveWorkspaces(updated);
    set({ workspaces: updated });
  },

  setActiveWorkspace: (id) => {
    set({ activeWorkspaceId: id });
  },

  addMember: (workspaceId, member) => {
    const updated = get().workspaces.map((ws) =>
      ws.id === workspaceId
        ? { ...ws, members: [...ws.members, member], updatedAt: new Date().toISOString() }
        : ws,
    );
    saveWorkspaces(updated);
    set({ workspaces: updated });
  },

  removeMember: (workspaceId, userId) => {
    const updated = get().workspaces.map((ws) =>
      ws.id === workspaceId
        ? { ...ws, members: ws.members.filter((m) => m.userId !== userId), updatedAt: new Date().toISOString() }
        : ws,
    );
    saveWorkspaces(updated);
    set({ workspaces: updated });
  },

  updateMemberRole: (workspaceId, userId, role) => {
    const updated = get().workspaces.map((ws) =>
      ws.id === workspaceId
        ? {
            ...ws,
            members: ws.members.map((m) =>
              m.userId === userId ? { ...m, role } : m,
            ),
            updatedAt: new Date().toISOString(),
          }
        : ws,
    );
    saveWorkspaces(updated);
    set({ workspaces: updated });
  },

  addComment: (entityType, entityId, content, userId, userName) => {
    const newComment: Comment = {
      id: `comment-${Date.now()}`,
      entityType,
      entityId,
      userId,
      userName,
      content,
      createdAt: new Date().toISOString(),
      updatedAt: null,
      replies: [],
    };

    const updated = [newComment, ...get().comments];
    saveComments(updated);
    set({ comments: updated });
    return newComment;
  },

  updateComment: (commentId, content) => {
    const updated = get().comments.map((c) =>
      c.id === commentId
        ? { ...c, content, updatedAt: new Date().toISOString() }
        : c,
    );
    saveComments(updated);
    set({ comments: updated });
  },

  deleteComment: (commentId) => {
    const updated = get().comments.filter((c) => c.id !== commentId);
    saveComments(updated);
    set({ comments: updated });
  },

  getCommentsForEntity: (entityType, entityId) => {
    return get().comments.filter(
      (c) => c.entityType === entityType && c.entityId === entityId,
    );
  },

  addActivity: (activity) => {
    const newActivity: UserActivity = {
      ...activity,
      id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
    };

    const updated = [newActivity, ...get().activities].slice(0, 200);
    saveActivities(updated);
    set({ activities: updated });
  },

  getActivitiesForUser: (userId) => {
    return get().activities.filter((a) => a.userId === userId);
  },

  clearActivities: () => {
    saveActivities([]);
    set({ activities: [] });
  },
}));
