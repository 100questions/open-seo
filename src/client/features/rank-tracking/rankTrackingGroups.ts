import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import {
  deleteRankTrackingGroup,
  getRankTrackingGroups,
  updateRankTrackingGroup,
} from "@/serverFunctions/rank-tracking-groups";
import type { TagColorKey } from "@/shared/tag-colors";
import type { RankTrackingRow } from "@/types/schemas/rank-tracking";

export type RankTrackingGroup = Awaited<
  ReturnType<typeof getRankTrackingGroups>
>[number];

/** The `group` search value for keywords in no group. */
export const UNGROUPED = "ungrouped";

export function useRankTrackingGroups(projectId: string) {
  return useQuery({
    queryKey: ["rankTrackingGroups", projectId],
    queryFn: () => getRankTrackingGroups({ data: { projectId } }),
  });
}

/** Rows in the selected group; every row when no (or a deleted) group is set. */
export function filterRowsByGroup(
  rows: RankTrackingRow[],
  groups: RankTrackingGroup[],
  group: string | undefined,
) {
  // Without groups the tabs are hidden, so no filter may stay applied.
  if (!group || groups.length === 0) return rows;
  if (group === UNGROUPED) return rows.filter((row) => !row.groupIds.length);
  if (!groups.some((candidate) => candidate.id === group)) return rows;
  return rows.filter((row) => row.groupIds.includes(group));
}

/** Rename, recolor and delete groups, refreshing groups and keyword rows. */
export function useRankTrackingGroupManage(projectId: string) {
  const queryClient = useQueryClient();
  const [busyGroupIds, setBusyGroupIds] = useState<Set<string>>(new Set());

  const markBusy = (groupId: string, busy: boolean) =>
    setBusyGroupIds((current) => {
      const next = new Set(current);
      if (busy) next.add(groupId);
      else next.delete(groupId);
      return next;
    });

  const invalidateGroups = () =>
    queryClient.invalidateQueries({
      queryKey: ["rankTrackingGroups", projectId],
    });

  const updateGroup = async (input: {
    tagId: string;
    name?: string;
    color?: TagColorKey | null;
  }) => {
    markBusy(input.tagId, true);
    try {
      await updateRankTrackingGroup({
        data: {
          projectId,
          groupId: input.tagId,
          name: input.name,
          color: input.color,
        },
      });
      // Rows hold group IDs only; names and colors come from the groups query.
      await invalidateGroups();
      toast.success("Group updated");
    } catch (error) {
      toast.error(getStandardErrorMessage(error, "Could not update group"));
    } finally {
      markBusy(input.tagId, false);
    }
  };

  const deleteGroup = async (groupId: string) => {
    markBusy(groupId, true);
    try {
      await deleteRankTrackingGroup({ data: { projectId, groupId } });
      await Promise.all([
        invalidateGroups(),
        queryClient.invalidateQueries({
          queryKey: ["rankTrackingResults", projectId],
        }),
      ]);
      toast.success("Group deleted");
    } catch (error) {
      toast.error(getStandardErrorMessage(error, "Could not delete group"));
    } finally {
      markBusy(groupId, false);
    }
  };

  return { busyGroupIds, updateGroup, deleteGroup };
}
