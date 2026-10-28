import { Settings2 } from "lucide-react";
import { useState } from "react";
import { TagDot } from "@/client/components/tags/TagChip";
import { TagManagerDialog } from "@/client/components/tags/TagManagerDialog";
import { Button } from "@/client/components/ui/button";
import type { TagColorKey } from "@/shared/tag-colors";
import type { RankTrackingRow } from "@/types/schemas/rank-tracking";
import {
  filterRowsByGroup,
  UNGROUPED,
  type RankTrackingGroup,
} from "./rankTrackingGroups";

/** Keyword count, average position and top-10 count for one device. */
function groupStats(rows: RankTrackingRow[], device: "desktop" | "mobile") {
  const positions = rows
    .map((row) => row[device].position)
    .filter((position) => position !== null);
  const average =
    positions.length > 0
      ? positions.reduce((sum, position) => sum + position, 0) /
        positions.length
      : null;
  return {
    count: rows.length,
    average,
    top10: positions.filter((position) => position <= 10).length,
  };
}

export function RankTrackingGroupTabs({
  groups,
  rows,
  device,
  value,
  onChange,
  busyGroupIds,
  onUpdateGroup,
  onDeleteGroup,
}: {
  groups: RankTrackingGroup[];
  rows: RankTrackingRow[];
  device: "desktop" | "mobile";
  value: string | undefined;
  onChange: (group: string | undefined) => void;
  busyGroupIds: Set<string>;
  onUpdateGroup: (input: {
    tagId: string;
    name?: string;
    color?: TagColorKey | null;
  }) => void;
  onDeleteGroup: (groupId: string) => void;
}) {
  const [managing, setManaging] = useState(false);
  if (groups.length === 0) return null;

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
      <div
        role="tablist"
        aria-label="Keyword groups"
        className="flex min-w-0 flex-1 gap-1 overflow-x-auto"
      >
        {tabs.map((tab) => {
          const stats = groupStats(
            filterRowsByGroup(rows, groups, tab.key),
            device,
          );
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

      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Manage groups"
        title="Manage groups"
        onClick={() => setManaging(true)}
      >
        <Settings2 />
      </Button>

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
