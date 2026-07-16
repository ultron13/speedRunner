"use client";

import { useState } from "react";
import { BookOpen, Plus, Trash2, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAPIStore } from "@/store/api-store";
import type { APIEndpoint } from "@/types";

const methodColors: Record<string, string> = {
  GET: "bg-emerald-100 text-emerald-700",
  POST: "bg-sky-100 text-sky-700",
  PUT: "bg-amber-100 text-amber-700",
  DELETE: "bg-rose-100 text-rose-700",
  PATCH: "bg-violet-100 text-violet-700",
};

export function APIDocumentation() {
  const [isCreating, setIsCreating] = useState(false);
  const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const endpoints = useAPIStore((state) => state.endpoints);
  const addEndpoint = useAPIStore((state) => state.addEndpoint);
  const deleteEndpoint = useAPIStore((state) => state.deleteEndpoint);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <section aria-labelledby="api-docs-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
          <CardTitle id="api-docs-heading" className="text-base flex items-center gap-2">
            <BookOpen className="size-4" />
            API Documentation
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setIsCreating(!isCreating)}>
            <Plus className="mr-1 size-4" />
            Add Endpoint
          </Button>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {isCreating && (
            <EndpointForm
              onSubmit={(endpoint) => {
                addEndpoint(endpoint);
                setIsCreating(false);
              }}
              onCancel={() => setIsCreating(false)}
            />
          )}

          {endpoints.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-slate-500">
              <BookOpen className="size-8 text-slate-300" />
              <p className="font-medium text-slate-700">No API endpoints documented</p>
              <p className="text-sm">Add endpoints to document your API.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {endpoints.map((endpoint) => (
                <div key={endpoint.id} className="rounded-lg border">
                  <div
                    className="flex cursor-pointer items-center justify-between p-3 hover:bg-slate-50"
                    onClick={() => setExpandedEndpoint(expandedEndpoint === endpoint.id ? null : endpoint.id)}
                  >
                    <div className="flex items-center gap-3">
                      <Badge className={methodColors[endpoint.method]}>
                        {endpoint.method}
                      </Badge>
                      <span className="font-mono text-sm">{endpoint.path}</span>
                    </div>
                    {expandedEndpoint === endpoint.id ? (
                      <ChevronUp className="size-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="size-4 text-slate-400" />
                    )}
                  </div>

                  {expandedEndpoint === endpoint.id && (
                    <div className="border-t p-3">
                      <p className="mb-2 text-sm text-slate-600">{endpoint.description}</p>

                      {endpoint.parameters.length > 0 && (
                        <div className="mb-3">
                          <p className="mb-1 text-xs font-medium text-slate-500">Parameters:</p>
                          <div className="space-y-1">
                            {endpoint.parameters.map((param) => (
                              <div key={param.name} className="flex items-center gap-2 text-xs">
                                <Badge variant="outline" className="text-xs">{param.type}</Badge>
                                <span className="font-mono">{param.name}</span>
                                {param.required && <Badge variant="destructive" className="text-xs">Required</Badge>}
                                <span className="text-slate-500">{param.description}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <p className="text-xs text-slate-500">Response Example</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy(endpoint.responseExample, endpoint.id)}
                        >
                          {copiedId === endpoint.id ? (
                            <Check className="size-3 text-emerald-600" />
                          ) : (
                            <Copy className="size-3" />
                          )}
                        </Button>
                      </div>
                      <pre className="mt-1 overflow-x-auto rounded bg-slate-100 p-2 text-xs dark:bg-slate-800">
                        {endpoint.responseExample}
                      </pre>

                      <div className="mt-2 flex justify-end">
                        <Button variant="ghost" size="sm" onClick={() => deleteEndpoint(endpoint.id)}>
                          <Trash2 className="mr-1 size-3" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function EndpointForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (endpoint: Omit<APIEndpoint, "id">) => void;
  onCancel: () => void;
}) {
  const [method, setMethod] = useState<"GET" | "POST" | "PUT" | "DELETE" | "PATCH">("GET");
  const [path, setPath] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!path.trim()) return;
    onSubmit({
      method,
      path: path.trim(),
      description: description.trim(),
      parameters: [],
      responseExample: "{}",
      tags: [],
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-lg border p-4">
      <div className="grid grid-cols-3 gap-2">
        <div className="grid gap-2">
          <Label>Method</Label>
          <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="GET">GET</SelectItem>
              <SelectItem value="POST">POST</SelectItem>
              <SelectItem value="PUT">PUT</SelectItem>
              <SelectItem value="DELETE">DELETE</SelectItem>
              <SelectItem value="PATCH">PATCH</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 grid gap-2">
          <Label>Path</Label>
          <Input value={path} onChange={(e) => setPath(e.target.value)} placeholder="/api/resource" />
        </div>
      </div>
      <div className="grid gap-2">
        <Label>Description</Label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Endpoint description" />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="sm">Add</Button>
      </div>
    </form>
  );
}
