import { create } from "zustand";

import type {
  Annotation,
  OnlineUser,
  RealTimeNotification,
  RealTimeState,
} from "@/types";

const NOTIFICATIONS_KEY = "speedrunner-notifications";
const ANNOTATIONS_KEY = "speedrunner-annotations";

function getStoredNotifications(): RealTimeNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(NOTIFICATIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveNotifications(notifications: RealTimeNotification[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications.slice(0, 100)));
}

function getStoredAnnotations(): Annotation[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(ANNOTATIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveAnnotations(annotations: Annotation[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ANNOTATIONS_KEY, JSON.stringify(annotations));
}

const mockOnlineUsers: OnlineUser[] = [
  { id: "user-1", name: "Admin User", status: "online", lastSeen: new Date().toISOString(), currentPage: "Dashboard" },
  { id: "user-2", name: "Editor User", status: "online", lastSeen: new Date().toISOString(), currentPage: "Tests" },
  { id: "user-3", name: "Viewer User", status: "away", lastSeen: new Date(Date.now() - 300000).toISOString(), currentPage: "Analytics" },
];

export interface RealTimeStore extends RealTimeState {
  addNotification: (notification: Omit<RealTimeNotification, "id" | "timestamp" | "read">) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;
  unreadCount: () => number;

  addAnnotation: (annotation: Omit<Annotation, "id" | "createdAt" | "resolved">) => Annotation;
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  resolveAnnotation: (id: string) => void;
  deleteAnnotation: (id: string) => void;
  getAnnotationsForEntity: (entityType: Annotation["entityType"], entityId: string) => Annotation[];

  updateUserStatus: (userId: string, status: OnlineUser["status"]) => void;
  updateUserCursor: (userId: string, cursor: { x: number; y: number }) => void;
  simulatePresence: () => void;
}

export const useRealTimeStore = create<RealTimeStore>((set, get) => ({
  onlineUsers: mockOnlineUsers,
  notifications: getStoredNotifications(),
  annotations: getStoredAnnotations(),
  isConnected: true,
  lastPing: new Date().toISOString(),

  addNotification: (notification) => {
    const newNotification: RealTimeNotification = {
      ...notification,
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      read: false,
    };
    const updated = [newNotification, ...get().notifications].slice(0, 100);
    saveNotifications(updated);
    set({ notifications: updated });
  },

  markNotificationRead: (id) => {
    const updated = get().notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n,
    );
    saveNotifications(updated);
    set({ notifications: updated });
  },

  markAllNotificationsRead: () => {
    const updated = get().notifications.map((n) => ({ ...n, read: true }));
    saveNotifications(updated);
    set({ notifications: updated });
  },

  clearNotifications: () => {
    saveNotifications([]);
    set({ notifications: [] });
  },

  unreadCount: () => {
    return get().notifications.filter((n) => !n.read).length;
  },

  addAnnotation: (annotation) => {
    const newAnnotation: Annotation = {
      ...annotation,
      id: `annotation-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
      resolved: false,
    };
    const updated = [...get().annotations, newAnnotation];
    saveAnnotations(updated);
    set({ annotations: updated });
    return newAnnotation;
  },

  updateAnnotation: (id, updates) => {
    const updated = get().annotations.map((a) =>
      a.id === id ? { ...a, ...updates } : a,
    );
    saveAnnotations(updated);
    set({ annotations: updated });
  },

  resolveAnnotation: (id) => {
    const updated = get().annotations.map((a) =>
      a.id === id ? { ...a, resolved: true } : a,
    );
    saveAnnotations(updated);
    set({ annotations: updated });
  },

  deleteAnnotation: (id) => {
    const updated = get().annotations.filter((a) => a.id !== id);
    saveAnnotations(updated);
    set({ annotations: updated });
  },

  getAnnotationsForEntity: (entityType, entityId) => {
    return get().annotations.filter(
      (a) => a.entityType === entityType && a.entityId === entityId,
    );
  },

  updateUserStatus: (userId, status) => {
    set((state) => ({
      onlineUsers: state.onlineUsers.map((u) =>
        u.id === userId ? { ...u, status, lastSeen: new Date().toISOString() } : u,
      ),
    }));
  },

  updateUserCursor: (userId, cursor) => {
    set((state) => ({
      onlineUsers: state.onlineUsers.map((u) =>
        u.id === userId ? { ...u, cursor } : u,
      ),
    }));
  },

  simulatePresence: () => {
    // Simulate users going online/offline
    set((state) => ({
      onlineUsers: state.onlineUsers.map((u) => ({
        ...u,
        lastSeen: Math.random() > 0.1 ? new Date().toISOString() : u.lastSeen,
        status: Math.random() > 0.9 ? "away" : u.status,
      })),
      lastPing: new Date().toISOString(),
    }));
  },
}));