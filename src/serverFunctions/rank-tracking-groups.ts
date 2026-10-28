import { createServerFn } from "@tanstack/react-start";
import { RankTrackingGroupService } from "@/server/features/rank-tracking/services/RankTrackingGroupService";
import { requireProjectContext } from "@/serverFunctions/middleware";
import {
  createGroupSchema,
  deleteGroupSchema,
  listGroupsSchema,
  updateGroupSchema,
  updateKeywordGroupsSchema,
} from "@/types/schemas/rank-tracking";

export const getRankTrackingGroups = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(listGroupsSchema)
  .handler(async ({ context }) => {
    return RankTrackingGroupService.listGroups(context.projectId);
  });

export const createRankTrackingGroup = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(createGroupSchema)
  .handler(async ({ data, context }) => {
    return RankTrackingGroupService.createGroup(context.projectId, data.name);
  });

export const updateRankTrackingGroup = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(updateGroupSchema)
  .handler(async ({ data, context }) => {
    return RankTrackingGroupService.updateGroup(
      context.projectId,
      data.groupId,
      { name: data.name, color: data.color },
    );
  });

export const deleteRankTrackingGroup = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(deleteGroupSchema)
  .handler(async ({ data, context }) => {
    return RankTrackingGroupService.deleteGroup(
      context.projectId,
      data.groupId,
    );
  });

export const updateRankTrackingKeywordGroups = createServerFn({
  method: "POST",
})
  .middleware(requireProjectContext)
  .validator(updateKeywordGroupsSchema)
  .handler(async ({ data, context }) => {
    return RankTrackingGroupService.updateKeywordGroups({
      projectId: context.projectId,
      configId: data.configId,
      keywordIds: data.keywordIds,
      addGroupNames: data.addGroupNames,
      removeGroupIds: data.removeGroupIds,
    });
  });
