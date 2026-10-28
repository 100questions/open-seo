import { Pencil } from "lucide-react";
import { useState } from "react";
import { Button } from "@/client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import type { TagColorKey } from "@/shared/tag-colors";
import type { SavedKeywordTagSummary } from "@/types/keywords";
import { ManageTagRow } from "./ManageTagRow";
import { TagDot } from "./TagChip";

type UpdateTagInput = {
  tagId: string;
  name?: string;
  color?: TagColorKey | null;
};

export function TagManagerDialog({
  tags,
  busyTagIds,
  onUpdateTag,
  onDeleteTag,
  onClose,
  noun = "tag",
}: {
  tags: SavedKeywordTagSummary[];
  busyTagIds: Set<string>;
  onUpdateTag: (input: UpdateTagInput) => void;
  onDeleteTag: (tagId: string) => void;
  onClose: () => void;
  noun?: "tag" | "group";
}) {
  const [editingTagId, setEditingTagId] = useState<string | null>(null);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage {noun}s</DialogTitle>
          <DialogDescription>
            Rename, recolor, or delete the {noun}s in this project.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-4 -mb-4 max-h-96 overflow-y-auto border-t border-border py-1">
          {tags.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No {noun}s yet. Add {noun}s from a selection of keywords.
            </p>
          ) : null}
          {tags.map((tag) => {
            const editing = editingTagId === tag.id;
            return (
              <div key={tag.id}>
                <div className="flex items-center gap-2 px-4 py-1.5 text-sm">
                  <TagDot tag={tag} />
                  <span className="min-w-0 flex-1 truncate">{tag.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {tag.keywordCount}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Edit ${tag.name}`}
                    aria-pressed={editing}
                    className="aria-pressed:bg-muted"
                    onClick={() => setEditingTagId(editing ? null : tag.id)}
                  >
                    <Pencil />
                  </Button>
                </div>
                {editing ? (
                  <ManageTagRow
                    tag={tag}
                    isBusy={busyTagIds.has(tag.id)}
                    onSave={(input) => {
                      onUpdateTag({ tagId: tag.id, ...input });
                      setEditingTagId(null);
                    }}
                    onDelete={() => {
                      onDeleteTag(tag.id);
                      setEditingTagId(null);
                    }}
                    onCancel={() => setEditingTagId(null)}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
