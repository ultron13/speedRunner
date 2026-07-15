"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAdvancedTestStore } from "@/store/advanced-test-store";
import type { LoadProfileType } from "@/types";

const typeLabels: Record<LoadProfileType, string> = {
  constant: "Constant",
  "ramp-up": "Ramp Up",
  "ramp-down": "Ramp Down",
  spike: "Spike",
  step: "Step",
  wave: "Wave",
};

const typeColors: Record<LoadProfileType, string> = {
  constant: "bg-slate-100 text-slate-700",
  "ramp-up": "bg-emerald-100 text-emerald-700",
  "ramp-down": "bg-amber-100 text-amber-700",
  spike: "bg-rose-100 text-rose-700",
  step: "bg-sky-100 text-sky-700",
  wave: "bg-violet-100 text-violet-700",
};

export function LoadProfiles() {
  const [isCreating, setIsCreating] = useState(false);
  const profiles = useAdvancedTestStore((state) => state.loadProfiles);
  const createProfile = useAdvancedTestStore((state) => state.createLoadProfile);
  const deleteProfile = useAdvancedTestStore((state) => state.deleteLoadProfile);

  return (
    <section aria-labelledby="profiles-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
          <CardTitle id="profiles-heading" className="text-base">Load Profiles</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setIsCreating(!isCreating)}>
            <Plus className="mr-1 size-4" />
            New Profile
          </Button>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {isCreating && (
            <ProfileForm
              onSubmit={(profile) => {
                createProfile(profile);
                setIsCreating(false);
              }}
              onCancel={() => setIsCreating(false)}
            />
          )}

          <div className="space-y-2">
            {profiles.map((profile) => (
              <div key={profile.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <Badge className={typeColors[profile.type]}>{typeLabels[profile.type]}</Badge>
                  <div>
                    <p className="text-sm font-medium">{profile.name}</p>
                    <p className="text-xs text-slate-500">
                      {profile.config.startUsers} → {profile.config.endUsers} users · {profile.config.duration}s
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => deleteProfile(profile.id)}>
                  <Trash2 className="size-4 text-slate-400" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function ProfileForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (profile: Omit<import("@/types").LoadProfile, "id" | "createdAt">) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<LoadProfileType>("constant");
  const [startUsers, setStartUsers] = useState("100");
  const [endUsers, setEndUsers] = useState("100");
  const [duration, setDuration] = useState("300");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSubmit({
      name: name.trim(),
      description: "",
      type,
      config: {
        startUsers: parseInt(startUsers) || 100,
        endUsers: parseInt(endUsers) || 100,
        duration: parseInt(duration) || 300,
      },
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-lg border p-4">
      <div className="grid gap-2">
        <Label htmlFor="profile-name">Profile Name</Label>
        <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Morning Rush" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-2">
          <Label>Profile Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as LoadProfileType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(typeLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Duration (seconds)</Label>
          <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-2">
          <Label>Start Users</Label>
          <Input type="number" value={startUsers} onChange={(e) => setStartUsers(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label>End Users</Label>
          <Input type="number" value={endUsers} onChange={(e) => setEndUsers(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="sm">Create</Button>
      </div>
    </form>
  );
}
