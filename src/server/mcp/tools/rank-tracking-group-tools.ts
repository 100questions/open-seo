import { z } from "zod";
import { RankTrackingGroupService } from "@/server/features/rank-tracking/services/RankTrackingGroupService";
import { buildProjectMeta } from "@/server/mcp/context";
import { mcpResponse } from "@/server/mcp/formatters";
import { optionalMetaOutputSchema } from "@/server/mcp/output-schemas";
import { withMcpProjectAuth } from "@/server/mcp/project-auth";
import { projectIdSchema } from "@/server/mcp/schemas";
import { formatMcpTable, readPath } from "@/server/mcp/table";
import { AppError } from "@/server/lib/errors";
import { MAX_RANK_TRACKING_GROUP_NAME_LENGTH } from "@/shared/rank-tracking";
import { TAG_COLOR_KEYS } from "@/shared/tag-colors";

const groupIdSchema = z
  .string()
  .uuid()
  .describe("Keyword group ID from list_rank_tracking_groups.");

const groupNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_RANK_TRACKING_GROUP_NAME_LENGTH)
  .describe(
    "Group name. Unique per project, compared case-insensitively ('Rolex' and 'rolex' are the same group).",
  );

const groupOutputSchema = z
  .object({ id: z.string(), name: z.string() })
  .passthrough();

const writeAnnotations = {
  readOnlyHint: false,
  openWorldHint: false,
  destructiveHint: false,
} as const;

function rankTrackingMeta(context: { baseUrl: string }, projectId: string) {
  return buildProjectMeta(context, projectId, `/p/${projectId}/rank-tracking`);
}

const listInputSchema = { projectId: projectIdSchema } as const;

export const listRankTrackingGroupsTool = {
  name: "list_rank_tracking_groups",
  config: {
    title: "List rank tracking keyword groups",
    description:
      "Lists the project's rank tracking keyword groups with their IDs and how many tracked keywords each holds across all trackers. Groups are shared by every tracker in the project, and a keyword can be in several groups. get_rank_tracker shows each keyword's groups and can filter a tracker's keywords by groupId. Uses no credits.",
    inputSchema: listInputSchema,
    outputSchema: z
      .object({
        groups: z.array(
          groupOutputSchema.extend({ keywordCount: z.number().int() }),
        ),
        ...optionalMetaOutputSchema,
      })
      .passthrough(),
    annotations: { ...writeAnnotations, readOnlyHint: true },
  },
  handler: withMcpProjectAuth(
    async (args: z.infer<z.ZodObject<typeof listInputSchema>>, context) => {
      const groups = await RankTrackingGroupService.listGroups(args.projectId);
      return mcpResponse({
        text:
          groups.length === 0
            ? "No keyword groups in this project yet. Create one with create_rank_tracking_group."
            : `Keyword groups (${groups.length}):\n${formatMcpTable(groups, [
                { header: "name", value: (row) => readPath(row, "name") },
                {
                  header: "keywords",
                  value: (row) => readPath(row, "keywordCount"),
                },
                { header: "groupId", value: (row) => readPath(row, "id") },
              ])}`,
        meta: rankTrackingMeta(context, args.projectId),
        structuredContent: {
          groups: groups.map(({ id, name, keywordCount }) => ({
            id,
            name,
            keywordCount,
          })),
        },
      });
    },
  ),
};

const createInputSchema = {
  projectId: projectIdSchema,
  name: groupNameSchema,
} as const;

export const createRankTrackingGroupTool = {
  name: "create_rank_tracking_group",
  config: {
    title: "Create rank tracking keyword group",
    description:
      "Creates a keyword group for the project's rank trackers. Then add keywords with group_rank_tracking_keywords. Fails if a group with the same name (case-insensitive) exists. Uses no credits.",
    inputSchema: createInputSchema,
    outputSchema: z
      .object({ group: groupOutputSchema, ...optionalMetaOutputSchema })
      .passthrough(),
    annotations: writeAnnotations,
  },
  handler: withMcpProjectAuth(
    async (args: z.infer<z.ZodObject<typeof createInputSchema>>, context) => {
      const group = await RankTrackingGroupService.createGroup(
        args.projectId,
        args.name,
      );
      return mcpResponse({
        text: `Created keyword group "${group.name}" (groupId ${group.id}).`,
        meta: rankTrackingMeta(context, args.projectId),
        structuredContent: { group },
      });
    },
  ),
};

const updateInputSchema = {
  projectId: projectIdSchema,
  groupId: groupIdSchema,
  name: groupNameSchema.optional(),
  color: z
    .enum(TAG_COLOR_KEYS)
    .nullable()
    .optional()
    .describe(
      "Chip color in the app. null resets it to the color derived from the group ID.",
    ),
} as const;

export const updateRankTrackingGroupTool = {
  name: "update_rank_tracking_group",
  config: {
    title: "Rename or recolor a rank tracking keyword group",
    description:
      "Renames a keyword group and/or changes its color. Its keywords stay in it. Fails if another group already has the name (case-insensitive). Uses no credits.",
    inputSchema: updateInputSchema,
    outputSchema: z
      .object({ group: groupOutputSchema, ...optionalMetaOutputSchema })
      .passthrough(),
    annotations: writeAnnotations,
  },
  handler: withMcpProjectAuth(
    async (args: z.infer<z.ZodObject<typeof updateInputSchema>>, context) => {
      if (args.name === undefined && args.color === undefined) {
        throw new AppError("VALIDATION_ERROR", "Provide a name or a color");
      }
      const group = await RankTrackingGroupService.updateGroup(
        args.projectId,
        args.groupId,
        { name: args.name, color: args.color },
      );
      return mcpResponse({
        text: `Updated keyword group ${group.id}: "${group.name}".`,
        meta: rankTrackingMeta(context, args.projectId),
        structuredContent: { group },
      });
    },
  ),
};

const deleteInputSchema = {
  projectId: projectIdSchema,
  groupId: groupIdSchema,
} as const;

export const deleteRankTrackingGroupTool = {
  name: "delete_rank_tracking_group",
  config: {
    title: "Delete rank tracking keyword group",
    description:
      "Deletes a keyword group. Its keywords stay tracked with their history; only their membership in this group is removed. Uses no credits.",
    inputSchema: deleteInputSchema,
    outputSchema: z
      .object({ deletedGroupId: z.string(), ...optionalMetaOutputSchema })
      .passthrough(),
    annotations: { ...writeAnnotations, destructiveHint: true },
  },
  handler: withMcpProjectAuth(
    async (args: z.infer<z.ZodObject<typeof deleteInputSchema>>, context) => {
      const deleted = await RankTrackingGroupService.deleteGroup(
        args.projectId,
        args.groupId,
      );
      return mcpResponse({
        text: `Deleted keyword group ${deleted.id}. Its keywords are still tracked.`,
        meta: rankTrackingMeta(context, args.projectId),
        structuredContent: { deletedGroupId: deleted.id },
      });
    },
  ),
};

const membershipInputSchema = {
  projectId: projectIdSchema,
  trackerId: z
    .string()
    .uuid()
    .describe("Rank tracker ID from get_rank_tracker."),
  groupId: groupIdSchema,
  keywordIds: z
    .array(z.string().uuid())
    .min(1)
    .max(2000)
    .describe(
      "Tracking keyword IDs to add to or remove from the group. Use `trackingKeywordId` values returned by get_rank_tracker.",
    ),
  inGroup: z
    .boolean()
    .describe(
      "true adds the keywords to the group. false removes them from it.",
    ),
} as const;

export const groupRankTrackingKeywordsTool = {
  name: "group_rank_tracking_keywords",
  config: {
    title: "Add or remove keywords in a group",
    description:
      "Adds tracked keywords to a keyword group, or removes them from it, by their trackingKeywordId. A keyword can be in several groups; adding it to one keeps its other groups. Uses no credits. Missing, stale, foreign, and repeated IDs are ignored; `updated` is the number of keywords whose membership actually changed.",
    inputSchema: membershipInputSchema,
    outputSchema: z
      .object({
        trackerId: z.string(),
        group: groupOutputSchema,
        inGroup: z.boolean(),
        requested: z.number(),
        updated: z.number(),
        updatedIds: z.array(z.string()),
        ...optionalMetaOutputSchema,
      })
      .passthrough(),
    annotations: writeAnnotations,
  },
  handler: withMcpProjectAuth(
    async (
      args: z.infer<z.ZodObject<typeof membershipInputSchema>>,
      context,
    ) => {
      const result = await RankTrackingGroupService.setKeywordsInGroup({
        projectId: args.projectId,
        configId: args.trackerId,
        groupId: args.groupId,
        keywordIds: args.keywordIds,
        inGroup: args.inGroup,
      });
      const requested = args.keywordIds.length;
      return mcpResponse({
        text: `${args.inGroup ? "Added" : "Removed"} ${result.updated} of ${requested} requested keyword ID${requested === 1 ? "" : "s"} ${args.inGroup ? "to" : "from"} group "${result.group.name}".`,
        meta: buildProjectMeta(
          context,
          args.projectId,
          `/p/${args.projectId}/rank-tracking/${args.trackerId}`,
        ),
        structuredContent: {
          trackerId: args.trackerId,
          inGroup: args.inGroup,
          requested,
          ...result,
        },
      });
    },
  ),
};
