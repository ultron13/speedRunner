"use client";

import { useState } from "react";
import { MessageSquare, Plus, Trash2, CheckCircle2, Edit } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useRealTimeStore } from "@/store/realtime-store";
import { useAuthStore } from "@/store/auth-store";
import type { Annotation } from "@/types";

const colorOptions = [
  { value: "#209dd7", label: "Blue" },
  { value: "#753991", label: "Purple" },
  { value: "#ecad0a", label: "Amber" },
  { value: "#22c55e", label: "Green" },
  { value: "#ef4444", label: "Red" },
];

interface AnnotationsProps {
  entityType: Annotation["entityType"];
  entityId: string;
}

export function Annotations({ entityType, entityId }: AnnotationsProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newColor, setNewColor] = useState("#209dd7");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const annotations = useRealTimeStore((state) => state.annotations);
  const addAnnotation = useRealTimeStore((state) => state.addAnnotation);
  const updateAnnotation = useRealTimeStore((state) => state.updateAnnotation);
  const resolveAnnotation = useRealTimeStore((state) => state.resolveAnnotation);
  const deleteAnnotation = useRealTimeStore((state) => state.deleteAnnotation);
  const user = useAuthStore((state) => state.user);

  const entityAnnotations = annotations.filter(
    (a) => a.entityType === entityType && a.entityId === entityId && !a.resolved,
  );

  const handleAdd = () => {
    if (!newContent.trim() || !user) return;
    addAnnotation({
      entityType,
      entityId,
      content: newContent.trim(),
      color: newColor,
      userId: user.id,
      userName: user.name,
    });
    setNewContent("");
    setIsAdding(false);
  };

  const handleUpdate = (annotationId: string) => {
    if (!editContent.trim()) return;
    updateAnnotation(annotationId, { content: editContent.trim() });
    setEditingId(null);
    setEditContent("");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-sm font-medium">
          <MessageSquare className="size-4" />
          Annotations ({entityAnnotations.length})
        </h4>
        <Button variant="ghost" size="sm" onClick={() => setIsAdding(!isAdding)}>
          <Plus className="mr-1 size-3" />
          Add
        </Button>
      </div>

      {isAdding && (
        <div className="space-y-2 rounded-lg border p-3">
          <Textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Add an annotation..."
            rows={2}
          />
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              {colorOptions.map((color) => (
                <button
                  key={color.value}
                  onClick={() => setNewColor(color.value)}
                  className={`size-6 rounded-full border-2 ${
                    newColor === color.value ? "border-slate-800" : "border-transparent"
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.label}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setIsAdding(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleAdd} disabled={!newContent.trim()}>
                Add
              </Button>
            </div>
          </div>
        </div>
      )}

      {entityAnnotations.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500">No annotations</p>
      ) : (
        <div className="space-y-2">
          {entityAnnotations.map((annotation) => (
            <div key={annotation.id} className="flex items-start gap-2 rounded-lg border p-2">
              <div
                className="mt-1 size-3 shrink-0 rounded-full"
                style={{ backgroundColor: annotation.color }}
              />
              <div className="min-w-0 flex-1">
                {editingId === annotation.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={2}
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={() => handleUpdate(annotation.id)}>
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm">{annotation.content}</p>
                    <p className="text-xs text-slate-500">
                      {annotation.userName} · {new Date(annotation.createdAt).toLocaleString()}
                    </p>
                  </>
                )}
              </div>
              {user?.id === annotation.userId && (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      setEditingId(annotation.id);
                      setEditContent(annotation.content);
                    }}
                  >
                    <Edit className="size-3 text-slate-400" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => resolveAnnotation(annotation.id)}
                  >
                    <CheckCircle2 className="size-3 text-emerald-400" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => deleteAnnotation(annotation.id)}
                  >
                    <Trash2 className="size-3 text-slate-400" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
