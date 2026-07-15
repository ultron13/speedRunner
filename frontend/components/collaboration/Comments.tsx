"use client";

import { useState } from "react";
import { MessageSquare, Plus, Trash2, Edit, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useCollaborationStore } from "@/store/collaboration-store";
import { useAuthStore } from "@/store/auth-store";
import type { Comment } from "@/types";

interface CommentsProps {
  entityType: Comment["entityType"];
  entityId: string;
}

export function Comments({ entityType, entityId }: CommentsProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const comments = useCollaborationStore((state) => state.comments);
  const addComment = useCollaborationStore((state) => state.addComment);
  const updateComment = useCollaborationStore((state) => state.updateComment);
  const deleteComment = useCollaborationStore((state) => state.deleteComment);
  const user = useAuthStore((state) => state.user);

  const entityComments = comments.filter(
    (c) => c.entityType === entityType && c.entityId === entityId,
  );

  const handleAdd = () => {
    if (!newComment.trim() || !user) return;
    addComment(entityType, entityId, newComment.trim(), user.id, user.name);
    setNewComment("");
    setIsAdding(false);
  };

  const handleUpdate = (commentId: string) => {
    if (!editContent.trim()) return;
    updateComment(commentId, editContent.trim());
    setEditingId(null);
    setEditContent("");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-sm font-medium">
          <MessageSquare className="size-4" />
          Comments ({entityComments.length})
        </h4>
        <Button variant="ghost" size="sm" onClick={() => setIsAdding(!isAdding)}>
          <Plus className="mr-1 size-3" />
          Add
        </Button>
      </div>

      {isAdding && (
        <div className="space-y-2">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setIsAdding(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleAdd} disabled={!newComment.trim()}>
              <Send className="mr-1 size-3" />
              Post
            </Button>
          </div>
        </div>
      )}

      {entityComments.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500">No comments yet</p>
      ) : (
        <div className="space-y-3">
          {entityComments.map((comment) => (
            <div key={comment.id} className="rounded-lg border p-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex size-6 items-center justify-center rounded-full bg-slate-100 text-xs font-medium text-slate-600">
                    {comment.userName.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium">{comment.userName}</span>
                  <span className="text-xs text-slate-500">
                    {new Date(comment.createdAt).toLocaleString()}
                  </span>
                  {comment.updatedAt && (
                    <Badge variant="outline" className="text-xs">edited</Badge>
                  )}
                </div>
                {user?.id === comment.userId && (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        setEditingId(comment.id);
                        setEditContent(comment.content);
                      }}
                    >
                      <Edit className="size-3 text-slate-400" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => deleteComment(comment.id)}
                    >
                      <Trash2 className="size-3 text-slate-400" />
                    </Button>
                  </div>
                )}
              </div>

              {editingId === comment.id ? (
                <div className="mt-2 space-y-2">
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={2}
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={() => handleUpdate(comment.id)}>
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-600">{comment.content}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
