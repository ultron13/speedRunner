"use client";

import { useState } from "react";
import { Folder, Plus, Trash2, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useCollaborationStore } from "@/store/collaboration-store";
import type { TeamWorkspace } from "@/types";

export function TeamWorkspaces() {
  const [isCreating, setIsCreating] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null);
  const workspaces = useCollaborationStore((state) => state.workspaces);
  const createWorkspace = useCollaborationStore((state) => state.createWorkspace);
  const deleteWorkspace = useCollaborationStore((state) => state.deleteWorkspace);
  const setActiveWorkspace = useCollaborationStore((state) => state.setActiveWorkspace);

  return (
    <section aria-labelledby="workspaces-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
          <CardTitle id="workspaces-heading" className="text-base">Team Workspaces</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setIsCreating(!isCreating)}>
            <Plus className="mr-1 size-4" />
            New Workspace
          </Button>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {isCreating && (
            <CreateWorkspaceForm
              onSubmit={(name, description) => {
                createWorkspace(name, description);
                setIsCreating(false);
              }}
              onCancel={() => setIsCreating(false)}
            />
          )}

          <div className="space-y-2">
            {workspaces.map((ws) => (
              <WorkspaceRow
                key={ws.id}
                workspace={ws}
                isSelected={selectedWorkspace === ws.id}
                onSelect={() => {
                  setSelectedWorkspace(ws.id);
                  setActiveWorkspace(ws.id);
                }}
                onDelete={() => deleteWorkspace(ws.id)}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function WorkspaceRow({
  workspace,
  isSelected,
  onSelect,
  onDelete,
}: {
  workspace: TeamWorkspace;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer transition-colors ${
        isSelected ? "border-sky-500 bg-sky-50 dark:bg-sky-950" : "hover:bg-slate-50"
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center gap-3">
        <div className={`flex size-8 items-center justify-center rounded-lg ${
          workspace.isDefault ? "bg-sky-100 text-sky-600" : "bg-slate-100 text-slate-600"
        }`}>
          <Folder className="size-4" />
        </div>
        <div>
          <p className="text-sm font-medium">{workspace.name}</p>
          <p className="text-xs text-slate-500">{workspace.members.length} members</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">
          <Users className="mr-1 size-3" />
          {workspace.members.length}
        </Badge>
        {!workspace.isDefault && (
          <Button variant="ghost" size="icon-sm" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
            <Trash2 className="size-4 text-slate-400" />
          </Button>
        )}
      </div>
    </div>
  );
}

function CreateWorkspaceForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (name: string, description: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit(name.trim(), description.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-lg border p-4">
      <div className="grid gap-2">
        <Label htmlFor="ws-name">Workspace Name</Label>
        <Input
          id="ws-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Q4 Performance Tests"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="ws-desc">Description</Label>
        <Input
          id="ws-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm">
          Create
        </Button>
      </div>
    </form>
  );
}
