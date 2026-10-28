import { Settings2, Tag as TagIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/client/components/ui/button";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/client/components/ui/combobox";
import {
  resolveTagColor,
  tagChipClass,
  type TagColorKey,
} from "@/shared/tag-colors";
import type { SavedKeywordTagSummary } from "@/types/keywords";
import { TagDot } from "@/client/components/tags/TagChip";
import { TagManagerDialog } from "@/client/components/tags/TagManagerDialog";

type UpdateTagInput = {
  tagId: string;
  name?: string;
  color?: TagColorKey | null;
};

export function SavedKeywordsTagFilter({
  availableTags,
  selectedTagIds,
  busyTagIds,
  onSelectedTagIdsChange,
  onUpdateTag,
  onDeleteTag,
}: {
  availableTags: SavedKeywordTagSummary[];
  selectedTagIds: string[];
  busyTagIds: Set<string>;
  onSelectedTagIdsChange: (tagIds: string[]) => void;
  onUpdateTag: (input: UpdateTagInput) => void;
  onDeleteTag: (tagId: string) => void;
}) {
  const anchor = useComboboxAnchor();
  const [managing, setManaging] = useState(false);
  const selectedTags = availableTags.filter((tag) =>
    selectedTagIds.includes(tag.id),
  );

  return (
    <div className="flex items-center gap-1">
      <Combobox
        multiple
        items={availableTags}
        value={selectedTags}
        onValueChange={(tags) => onSelectedTagIdsChange(tags.map((t) => t.id))}
        itemToStringLabel={(tag) => tag.name}
        isItemEqualToValue={(a, b) => a.id === b.id}
      >
        <ComboboxChips ref={anchor} className="w-72 max-w-full">
          <TagIcon className="ml-1 size-3.5 shrink-0 text-muted-foreground" />
          <ComboboxValue>
            {(tags: SavedKeywordTagSummary[]) =>
              tags.map((tag) => (
                <ComboboxChip
                  key={tag.id}
                  className={tagChipClass(resolveTagColor(tag))}
                >
                  <TagDot tag={tag} />
                  {tag.name}
                </ComboboxChip>
              ))
            }
          </ComboboxValue>
          <ComboboxChipsInput
            aria-label="Filter by tag"
            placeholder={selectedTags.length > 0 ? "" : "Filter by tag…"}
          />
        </ComboboxChips>
        <ComboboxContent anchor={anchor}>
          <ComboboxEmpty className="px-3">
            {availableTags.length === 0
              ? "No tags yet. Add tags from a selection of keywords."
              : "No tags match that search."}
          </ComboboxEmpty>
          <ComboboxList>
            {(tag: SavedKeywordTagSummary) => (
              <ComboboxItem key={tag.id} value={tag}>
                <TagDot tag={tag} />
                <span className="min-w-0 flex-1 truncate">{tag.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {tag.keywordCount}
                </span>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>

      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Manage tags"
        title="Manage tags"
        disabled={availableTags.length === 0}
        onClick={() => setManaging(true)}
      >
        <Settings2 />
      </Button>

      {managing ? (
        <TagManagerDialog
          tags={availableTags}
          busyTagIds={busyTagIds}
          onUpdateTag={onUpdateTag}
          onDeleteTag={onDeleteTag}
          onClose={() => setManaging(false)}
        />
      ) : null}
    </div>
  );
}
