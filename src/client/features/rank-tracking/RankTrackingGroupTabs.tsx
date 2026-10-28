import { Plus, Settings2 } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { FormDialog } from "@/client/components/FormDialog";
import { TagDot } from "@/client/components/tags/TagChip";
import { TagManagerDialog } from "@/client/components/tags/TagManagerDialog";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { MAX_RANK_TRACKING_GROUP_NAME_LENGTH } from "@/shared/rank-tracking";
import type { TagColorKey } from "@/shared/tag-colors";
import type { RankTrackingRow } from "@/types/schemas/rank-tracking";
import { UNGROUPED, type RankTrackingGroup } from "./rankTrackingGroups";

const ALL = "all";

/**
 * Keyword count, average position and top-10 count per tab for one device,
 * in a single pass over the rows. Keys: ALL, UNGROUPED and each group ID.
 */
function tabStats(rows: RankTrackingRow[], device: "desktop" | "mobile") {
  const buckets = new Map<string, { count: number; positions: number[] }>();
  const add = (key: string, position: number | null) => {
    const bucket = buckets.get(key) ?? { count: 0, positions: [] };
    bucket.count += 1;
    if (position !== null) bucket.positions.push(position);
    buckets.set(key, bucket);
  };
  for (const row of rows) {
    const position = row[device].position;
    add(ALL, position);
    if (row.groupIds.length === 0) add(UNGROUPED, position);
    for (const groupId of row.groupIds) add(groupId, position);
  }
  return (key: string) => {
    const { count = 0, positions = [] } = buckets.get(key) ?? {};
    return {
      count,
      average:
        positions.length > 0
          ? positions.reduce((sum, position) => sum + position, 0) /
            positions.length
          : null,
      top10: positions.filter((position) => position <= 10).length,
    };
  };
}

export function RankTrackingGroupTabs({
  groups,
  rows,
  device,
  value,
  onChange,
  busyGroupIds,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
}: {
  groups: RankTrackingGroup[];
  rows: RankTrackingRow[];
  device: "desktop" | "mobile";
  value: string | undefined;
  onChange: (group: string | undefined) => void;
  busyGroupIds: Set<string>;
  /** Resolves true once the group exists. */
  onCreateGroup: (name: string) => Promise<boolean>;
  onUpdateGroup: (input: {
    tagId: string;
    name?: string;
    color?: TagColorKey | null;
  }) => void;
  onDeleteGroup: (groupId: string) => void;
}) {
  const [managing, setManaging] = useState(false);
  const [creating, setCreating] = useState(false);
  const statsFor = useMemo(() => tabStats(rows, device), [rows, device]);

  const active =
    value === UNGROUPED || groups.some((group) => group.id === value)
      ? value
      : undefined;
  const tabs = [
    { key: undefined, label: "All keywords", group: null },
    ...groups.map((group) => ({ key: group.id, label: group.name, group })),
    { key: UNGROUPED, label: "Ungrouped", group: null },
  ];

  return (
    <div className="flex items-center gap-2 border-t border-border px-4 py-2">
      <span className="shrink-0 text-xs font-medium text-muted-foreground">
        Groups
      </span>
      {groups.length === 0 ? (
        <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          None yet. Create one here, pick groups when adding keywords, or select
          keywords and click Group.
        </p>
      ) : (
        <div
          role="tablist"
          aria-label="Keyword groups"
          className="flex min-w-0 flex-1 gap-1 overflow-x-auto"
        >
          {tabs.map((tab) => {
            const stats = statsFor(tab.key ?? ALL);
            return (
              <Button
                key={tab.key ?? "all"}
                role="tab"
                variant="ghost"
                size="sm"
                aria-selected={active === tab.key}
                className="shrink-0 gap-1.5 aria-selected:bg-muted aria-selected:text-foreground"
                title={
                  stats.average === null
                    ? `${stats.count} keywords, none ranking on ${device}`
                    : `${stats.count} keywords · average ${device} position ${stats.average.toFixed(1)} · ${stats.top10} in the top 10`
                }
                onClick={() => onChange(tab.key)}
              >
                {tab.group ? <TagDot tag={tab.group} /> : null}
                <span className="max-w-40 truncate">{tab.label}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {stats.count}
                  {stats.average !== null
                    ? ` · ${stats.average.toFixed(1)} · top 10: ${stats.top10}`
                    : ""}
                </span>
              </Button>
            );
          })}
        </div>
      )}

      <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
        <Plus data-icon="inline-start" />
        New group
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Manage groups"
        title="Manage groups"
        disabled={groups.length === 0}
        onClick={() => setManaging(true)}
      >
        <Settings2 />
      </Button>

      {creating ? (
        <NewGroupDialog
          onCreate={onCreateGroup}
          onClose={() => setCreating(false)}
        />
      ) : null}

      {managing ? (
        <TagManagerDialog
          noun="group"
          tags={groups}
          busyTagIds={busyGroupIds}
          onUpdateTag={onUpdateGroup}
          onDeleteTag={onDeleteGroup}
          onClose={() => setManaging(false)}
        />
      ) : null}
    </div>
  );
}

function NewGroupDialog({
  onCreate,
  onClose,
}: {
  onCreate: (name: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const nameId = useId();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const submit = async () => {
    if (!name.trim() || pending) return;
    setPending(true);
    const created = await onCreate(name.trim());
    setPending(false);
    if (created) onClose();
  };

  return (
    <FormDialog
      title="New keyword group"
      onClose={onClose}
      actions={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            pending={pending}
            disabled={!name.trim()}
            onClick={() => void submit()}
          >
            Create
          </Button>
        </>
      }
    >
      <div className="space-y-1.5">
        <Label htmlFor={nameId}>Name</Label>
        <Input
          id={nameId}
          autoFocus
          maxLength={MAX_RANK_TRACKING_GROUP_NAME_LENGTH}
          placeholder="e.g. Rolex"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void submit();
            }
          }}
        />
        <p className="text-xs text-muted-foreground">
          Groups are shared by every tracker in this project.
        </p>
      </div>
    </FormDialog>
  );
}
