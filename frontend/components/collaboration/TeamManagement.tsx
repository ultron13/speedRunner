"use client";

import { useState } from "react";
import { Users, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useCollaborationAdvancedStore } from "@/store/collaboration-advanced-store";
import type { TeamMember } from "@/types";

const roleColors: Record<TeamMember["role"], string> = {
  owner: "bg-purple-100 text-purple-700",
  admin: "bg-sky-100 text-sky-700",
  editor: "bg-emerald-100 text-emerald-700",
  viewer: "bg-slate-100 text-slate-700",
};

export function TeamManagement() {
  const [isAdding, setIsAdding] = useState(false);
  const members = useCollaborationAdvancedStore((state) => state.members);
  const addMember = useCollaborationAdvancedStore((state) => state.addMember);
  const removeMember = useCollaborationAdvancedStore((state) => state.removeMember);

  return (
    <section aria-labelledby="team-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
          <CardTitle id="team-heading" className="text-base flex items-center gap-2">
            <Users className="size-4" />
            Team Members
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setIsAdding(!isAdding)}>
            <Plus className="mr-1 size-4" />
            Add Member
          </Button>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {isAdding && (
            <MemberForm
              onSubmit={(member) => {
                addMember(member);
                setIsAdding(false);
              }}
              onCancel={() => setIsAdding(false)}
            />
          )}

          <div className="space-y-2">
            {members.map((member) => (
              <div key={member.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-sm font-medium text-slate-600 dark:bg-slate-800">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{member.name}</p>
                    <p className="text-xs text-slate-500">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={roleColors[member.role]}>
                    {member.role}
                  </Badge>
                  {member.role !== "owner" && (
                    <Button variant="ghost" size="icon-sm" onClick={() => removeMember(member.id)}>
                      <Trash2 className="size-4 text-slate-400" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function MemberForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (member: Omit<TeamMember, "id" | "joinedAt" | "lastActive">) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamMember["role"]>("viewer");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    onSubmit({
      userId: `user-${Date.now()}`,
      name: name.trim(),
      email: email.trim(),
      role,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-lg border p-4">
      <div className="grid gap-2">
        <Label>Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" />
      </div>
      <div className="grid gap-2">
        <Label>Email</Label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@example.com" />
      </div>
      <div className="grid gap-2">
        <Label>Role</Label>
        <Select value={role} onValueChange={(v) => setRole(v as TeamMember["role"])}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="editor">Editor</SelectItem>
            <SelectItem value="viewer">Viewer</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="sm">Add</Button>
      </div>
    </form>
  );
}
