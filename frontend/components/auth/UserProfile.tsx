"use client";

import { useState } from "react";
import { LogOut, Settings, Shield } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/auth-store";

const roleLabels = {
  admin: "Administrator",
  editor: "Editor",
  viewer: "Viewer",
};

export function UserProfile() {
  const [isEditing, setIsEditing] = useState(false);
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const logout = useAuthStore((state) => state.logout);

  if (!user) return null;

  const handleSave = (updates: { name: string }) => {
    updateUser(user.id, updates);
    setIsEditing(false);
  };

  return (
    <section aria-labelledby="profile-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="px-5 py-4">
          <CardTitle id="profile-heading" className="text-base">Your Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 px-5 pb-4">
          {/* User Info */}
          <div className="flex items-center gap-4">
            <div className="flex size-16 items-center justify-center rounded-full bg-[#032147] text-xl font-bold text-white">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              {isEditing ? (
                <EditNameForm
                  name={user.name}
                  onSave={handleSave}
                  onCancel={() => setIsEditing(false)}
                />
              ) : (
                <>
                  <p className="text-lg font-semibold">{user.name}</p>
                  <p className="text-sm text-slate-500">{user.email}</p>
                </>
              )}
            </div>
          </div>

          {/* Role & Info */}
          <div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-slate-500">Role</p>
              <div className="mt-1 flex items-center gap-2">
                <Shield className="size-4 text-slate-400" />
                <span className="text-sm font-medium">{roleLabels[user.role]}</span>
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-500">Member since</p>
              <p className="mt-1 text-sm font-medium">
                {new Date(user.createdAt).toLocaleDateString("en", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Last login</p>
              <p className="mt-1 text-sm font-medium">
                {user.lastLoginAt
                  ? new Date(user.lastLoginAt).toLocaleString("en", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Never"}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            {!isEditing && (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <Settings className="mr-1 size-4" />
                Edit Profile
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={logout} className="text-rose-600 hover:text-rose-700">
              <LogOut className="mr-1 size-4" />
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function EditNameForm({
  name,
  onSave,
  onCancel,
}: {
  name: string;
  onSave: (updates: { name: string }) => void;
  onCancel: () => void;
}) {
  const [newName, setNewName] = useState(name);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ name: newName });
      }}
      className="flex items-center gap-2"
    >
      <Input
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        className="h-8 w-48"
        autoFocus
      />
      <Button type="submit" size="sm" variant="ghost">
        Save
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
    </form>
  );
}
