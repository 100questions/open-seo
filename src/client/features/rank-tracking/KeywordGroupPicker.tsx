import { Check, X } from "lucide-react";
import { useState } from "react";
import { TagChip } from "@/client/components/tags/TagChip";
import { Input } from "@/client/components/ui/input";
import { MAX_RANK_TRACKING_GROUP_NAME_LENGTH } from "@/shared/rank-tracking";
import type { RankTrackingGroup } from "./rankTrackingGroups";

/**
 * Picks groups by name: click an existing group to toggle it, or type a new
 * name and press Enter. New names are created when the keywords are saved.
 */
export function KeywordGroupPicker({
  groups,
  value,
  onChange,
}: {
  groups: RankTrackingGroup[];
  value: string[];
  onChange: (names: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const selected = new Set(value.map((name) => name.toLocaleLowerCase()));
  const existing = new Set(groups.map((group) => group.normalizedName));
  const newNames = value.filter(
    (name) => !existing.has(name.toLocaleLowerCase()),
  );

  const toggle = (name: string) =>
    onChange(
      selected.has(name.toLocaleLowerCase())
        ? value.filter(
            (picked) => picked.toLocaleLowerCase() !== name.toLocaleLowerCase(),
          )
        : [...value, name],
    );

  const addDraft = () => {
    const name = draft.trim().replace(/\s+/g, " ");
    if (!name) return;
    const match = groups.find(
      (group) => group.normalizedName === name.toLocaleLowerCase(),
    );
    if (!selected.has(name.toLocaleLowerCase())) {
      onChange([...value, match?.name ?? name]);
    }
    setDraft("");
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground">Groups:</span>
      {groups.map((group) => {
        const isSelected = selected.has(group.normalizedName);
        return (
          <TagChip
            key={group.id}
            tag={group}
            size="xs"
            selected={isSelected}
            onClick={() => toggle(group.name)}
            trailing={isSelected ? <Check className="size-3" /> : null}
            title={isSelected ? "Selected" : "Add the new keywords here"}
          />
        );
      })}
      {newNames.map((name) => (
        <TagChip
          key={name}
          tag={{ id: `new:${name}`, name, color: null }}
          size="xs"
          selected
          onClick={() => toggle(name)}
          trailing={<X className="size-3 opacity-70" />}
          title="New group, created on Add. Click to drop it."
        />
      ))}
      <Input
        aria-label="New group name"
        placeholder="New group…"
        className="h-6 w-32 text-xs"
        maxLength={MAX_RANK_TRACKING_GROUP_NAME_LENGTH}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            addDraft();
          }
        }}
        onBlur={addDraft}
      />
    </div>
  );
}
