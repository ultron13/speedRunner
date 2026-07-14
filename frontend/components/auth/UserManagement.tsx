"use client";

import { useState } from "react";
import { Plus, Trash2, Edit } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuthStore, usePermission } from "@/store/auth-store";
import type { UserRole, User } from "@/types";

const roleLabels: Record<UserRole, string> = {
  admin: "Administrator",
  editor: "Editor",
  viewer: "Viewer",
};

const roleColors: Record<UserRole, string> = {
  admin: "bg-purple-100 text-purple-700",
  editor: "bg-sky-100 text-sky-700",
  viewer: "bg-slate-100 text-slate-700",
};

export function UserManagement() {
  const [isCreating, setIsCreating] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const currentUser = useAuthStore((state) => state.user);
  const getAllUsers = useAuthStore((state) => state.getAllUsers);
  const createUser = useAuthStore((state) => state.createUser);
  const updateUser = useAuthStore((state) => state.updateUser);
  const deleteUser = useAuthStore((state) => state.deleteUser);
  const canManageUsers = usePermission("read", "users");

  if (!canManageUsers) {
    return (
      <Card className="gap-0 py-0">
        <CardHeader className="px-5 py-4">
          <CardTitle className="text-base">User Management</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <p className="text-sm text-slate-500">You don&apos;t have permission to manage users.</p>
        </CardContent>
      </Card>
    );
  }

  const users = getAllUsers();

  const handleCreateUser = (data: { email: string; name: string; password: string; role: UserRole }) => {
    const newUser = createUser(data);
    if (newUser) {
      setIsCreating(false);
    }
  };

  const handleUpdateUser = (id: string, updates: Partial<User>) => {
    updateUser(id, updates);
    setEditingUser(null);
  };

  return (
    <section aria-labelledby="users-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
          <CardTitle id="users-heading" className="text-base">User Management</CardTitle>
          {currentUser?.role === "admin" && (
            <Button variant="ghost" size="sm" onClick={() => setIsCreating(!isCreating)}>
              <Plus className="mr-1 size-4" />
              Add User
            </Button>
          )}
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {isCreating && (
            <UserForm
              onSubmit={handleCreateUser}
              onCancel={() => setIsCreating(false)}
            />
          )}

          {editingUser && (
            <UserForm
              user={editingUser}
              onSubmit={(data) => handleUpdateUser(editingUser.id, data)}
              onCancel={() => setEditingUser(null)}
            />
          )}

          <div className="space-y-2">
            {users.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                isCurrentUser={user.id === currentUser?.id}
                canEdit={currentUser?.role === "admin" || user.id === currentUser?.id}
                canDelete={currentUser?.role === "admin" && user.id !== currentUser?.id}
                onEdit={() => setEditingUser(user)}
                onDelete={() => deleteUser(user.id)}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function UserRow({
  user,
  isCurrentUser,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: {
  user: User;
  isCurrentUser: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-full bg-slate-100 text-sm font-medium text-slate-600 dark:bg-slate-800">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-medium">
            {user.name}
            {isCurrentUser && (
              <span className="ml-2 text-xs text-slate-400">(you)</span>
            )}
          </p>
          <p className="text-xs text-slate-500">{user.email}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${roleColors[user.role]}`}>
          {roleLabels[user.role]}
        </span>
        {canEdit && (
          <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label="Edit user">
            <Edit className="size-4 text-slate-400" />
          </Button>
        )}
        {canDelete && (
          <Button variant="ghost" size="icon-sm" onClick={onDelete} aria-label="Delete user">
            <Trash2 className="size-4 text-rose-400" />
          </Button>
        )}
      </div>
    </div>
  );
}

function UserForm({
  user,
  onSubmit,
  onCancel,
}: {
  user?: User;
  onSubmit: (data: { email: string; name: string; password: string; role: UserRole }) => void;
  onCancel: () => void;
}) {
  const [email, setEmail] = useState(user?.email ?? "");
  const [name, setName] = useState(user?.name ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>(user?.role ?? "viewer");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      email,
      name,
      password: password || (user ? "no-change" : ""),
      role,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-lg border p-4">
      <h4 className="font-medium">{user ? "Edit User" : "Create User"}</h4>
      <div className="grid gap-2">
        <Label htmlFor="user-name">Name</Label>
        <Input
          id="user-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="user-email">Email</Label>
        <Input
          id="user-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={!!user}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="user-password">
          {user ? "New Password (leave blank to keep)" : "Password"}
        </Label>
        <Input
          id="user-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required={!user}
        />
      </div>
      <div className="grid gap-2">
        <Label>Role</Label>
        <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">Administrator</SelectItem>
            <SelectItem value="editor">Editor</SelectItem>
            <SelectItem value="viewer">Viewer</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm">
          {user ? "Save Changes" : "Create User"}
        </Button>
      </div>
    </form>
  );
}
