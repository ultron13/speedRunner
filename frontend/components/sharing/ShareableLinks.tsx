"use client";

import { useState } from "react";
import { Link, Plus, Trash2, Copy, Check, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ShareableLink } from "@/types";

export function ShareableLinks() {
  const [links, setLinks] = useState<ShareableLink[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const createLink = (name: string) => {
    const newLink: ShareableLink = {
      id: `link-${Date.now()}`,
      url: `https://speedrunner.app/shared/${btoa(name).slice(0, 12)}`,
      filters: {
        dateRange: { start: null, end: null },
        testIds: [],
        statuses: [],
        scriptTypes: [],
      },
      createdAt: new Date().toISOString(),
      expiresAt: null,
      accessCount: 0,
    };
    setLinks((prev) => [...prev, newLink]);
    setIsCreating(false);
  };

  const deleteLink = (id: string) => {
    setLinks((prev) => prev.filter((l) => l.id !== id));
  };

  const copyLink = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <section aria-labelledby="share-links-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
          <CardTitle id="share-links-heading" className="text-base">Shareable Links</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setIsCreating(!isCreating)}>
            <Plus className="mr-1 size-4" />
            Create Link
          </Button>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {isCreating && (
            <CreateLinkForm
              onSubmit={createLink}
              onCancel={() => setIsCreating(false)}
            />
          )}

          {links.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-slate-500">
              <Link className="size-8 text-slate-300" />
              <p className="font-medium text-slate-700">No shareable links</p>
              <p className="text-sm">Create links to share dashboard views with your team.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {links.map((link) => (
                <div key={link.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{link.url}</p>
                      <p className="text-xs text-slate-500">
                        Created: {new Date(link.createdAt).toLocaleDateString()}
                        {link.expiresAt && ` · Expires: ${new Date(link.expiresAt).toLocaleDateString()}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => copyLink(link.url, link.id)}
                        title="Copy link"
                      >
                        {copiedId === link.id ? (
                          <Check className="size-4 text-emerald-600" />
                        ) : (
                          <Copy className="size-4 text-slate-400" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => window.open(link.url, "_blank")}
                        title="Open link"
                      >
                        <ExternalLink className="size-4 text-slate-400" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => deleteLink(link.id)}
                        title="Delete link"
                      >
                        <Trash2 className="size-4 text-rose-400" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function CreateLinkForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit(name.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-lg border p-4">
      <div className="grid gap-2">
        <Label htmlFor="link-name">Link Name</Label>
        <Input
          id="link-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Q4 Performance Report"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm">
          Create Link
        </Button>
      </div>
    </form>
  );
}
