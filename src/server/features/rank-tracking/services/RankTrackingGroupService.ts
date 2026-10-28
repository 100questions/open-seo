import { RankTrackingGroupRepository } from "@/server/features/rank-tracking/repositories/RankTrackingGroupRepository";
import { RankTrackingRepository } from "@/server/features/rank-tracking/repositories/RankTrackingRepository";
import { AppError } from "@/server/lib/errors";
import {
  MAX_RANK_TRACKING_GROUP_NAME_LENGTH,
  MAX_RANK_TRACKING_GROUPS_PER_PROJECT,
} from "@/shared/rank-tracking";
import { normalizeSavedKeywordTag } from "@/shared/saved-keyword-tags";
import type { TagColorKey } from "@/shared/tag-colors";

type Group = Awaited<
  ReturnType<typeof RankTrackingGroupRepository.listGroups>
>[number];
type GroupName = { name: string; normalizedName: string };

function normalizeName(raw: string): GroupName {
  const name = normalizeSavedKeywordTag(raw);
  if (!name || name.name.length > MAX_RANK_TRACKING_GROUP_NAME_LENGTH) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Group names must be 1-${MAX_RANK_TRACKING_GROUP_NAME_LENGTH} characters`,
    );
  }
  return name;
}

function nameTakenError(name: string) {
  return new AppError("CONFLICT", `A group named "${name}" already exists`);
}

function requireGroup(groups: Group[], groupId: string) {
  const group = groups.find((candidate) => candidate.id === groupId);
  if (!group) throw new AppError("NOT_FOUND", "Keyword group not found");
  return group;
}

async function createNamedGroup(
  projectId: string,
  groups: Group[],
  name: GroupName,
) {
  if (groups.length >= MAX_RANK_TRACKING_GROUPS_PER_PROJECT) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Maximum ${MAX_RANK_TRACKING_GROUPS_PER_PROJECT} keyword groups per project`,
    );
  }
  // The unique (project, normalized name) index rejects a duplicate.
  const created = await RankTrackingGroupRepository.createGroup({
    id: crypto.randomUUID(),
    projectId,
    ...name,
  });
  if (!created) throw nameTakenError(name.name);
  return created;
}

/** The given IDs that are keywords of this project's tracker, deduped. */
async function trackerKeywordIds(
  projectId: string,
  configId: string,
  keywordIds: string[],
) {
  // The project-scoped config lookup gates the configId-keyed keyword read
  // racing alongside it.
  const [config, keywords] = await Promise.all([
    RankTrackingRepository.getConfigById({ configId, projectId }),
    RankTrackingRepository.getKeywordsForConfig(configId),
  ]);
  if (!config) {
    throw new AppError("NOT_FOUND", "Rank tracking config not found");
  }
  const ownIds = new Set(keywords.map((keyword) => keyword.id));
  return [...new Set(keywordIds)].filter((id) => ownIds.has(id));
}

async function listGroups(projectId: string) {
  return RankTrackingGroupRepository.listGroups(projectId);
}

async function createGroup(projectId: string, rawName: string) {
  const name = normalizeName(rawName);
  const groups = await RankTrackingGroupRepository.listGroups(projectId);
  return createNamedGroup(projectId, groups, name);
}

async function updateGroup(
  projectId: string,
  groupId: string,
  input: { name?: string; color?: TagColorKey | null },
) {
  const name = input.name === undefined ? undefined : normalizeName(input.name);
  if (name) {
    const groups = await RankTrackingGroupRepository.listGroups(projectId);
    const taken = groups.some(
      (group) =>
        group.id !== groupId && group.normalizedName === name.normalizedName,
    );
    if (taken) throw nameTakenError(name.name);
  }
  const updated = await RankTrackingGroupRepository.updateGroup(
    groupId,
    projectId,
    { ...name, color: input.color },
  );
  if (!updated) throw new AppError("NOT_FOUND", "Keyword group not found");
  return updated;
}

async function deleteGroup(projectId: string, groupId: string) {
  const deleted = await RankTrackingGroupRepository.deleteGroup(
    groupId,
    projectId,
  );
  if (!deleted) throw new AppError("NOT_FOUND", "Keyword group not found");
  return deleted;
}

async function setKeywordsInGroup(input: {
  projectId: string;
  configId: string;
  groupId: string;
  keywordIds: string[];
  inGroup: boolean;
}) {
  const [keywordIds, groups] = await Promise.all([
    trackerKeywordIds(input.projectId, input.configId, input.keywordIds),
    RankTrackingGroupRepository.listGroups(input.projectId),
  ]);
  const group = requireGroup(groups, input.groupId);
  const updatedIds = input.inGroup
    ? (
        await RankTrackingGroupRepository.addMemberships(
          keywordIds.map((keywordId) => ({ keywordId, groupId: group.id })),
        )
      ).map((membership) => membership.keywordId)
    : await RankTrackingGroupRepository.removeKeywordsFromGroup(
        group.id,
        keywordIds,
      );
  return {
    group: { id: group.id, name: group.name },
    updated: updatedIds.length,
    updatedIds,
  };
}

/**
 * The bulk "Update groups" dialog: adds the keywords to groups by name,
 * creating the ones that don't exist yet, and removes them from groups by ID.
 */
async function updateKeywordGroups(input: {
  projectId: string;
  configId: string;
  keywordIds: string[];
  addGroupNames: string[];
  removeGroupIds: string[];
}) {
  const [keywordIds, groups] = await Promise.all([
    trackerKeywordIds(input.projectId, input.configId, input.keywordIds),
    RankTrackingGroupRepository.listGroups(input.projectId),
  ]);
  const removeGroups = input.removeGroupIds.map((id) =>
    requireGroup(groups, id),
  );
  const addGroupIds: string[] = [];
  for (const rawName of input.addGroupNames) {
    const name = normalizeName(rawName);
    const existing = groups.find(
      (group) => group.normalizedName === name.normalizedName,
    );
    if (existing) {
      addGroupIds.push(existing.id);
      continue;
    }
    const created = await createNamedGroup(input.projectId, groups, name);
    groups.push({ ...created, keywordCount: 0 });
    addGroupIds.push(created.id);
  }

  await RankTrackingGroupRepository.addMemberships(
    addGroupIds.flatMap((groupId) =>
      keywordIds.map((keywordId) => ({ keywordId, groupId })),
    ),
  );
  for (const group of removeGroups) {
    await RankTrackingGroupRepository.removeKeywordsFromGroup(
      group.id,
      keywordIds,
    );
  }
  return { keywordCount: keywordIds.length };
}

export const RankTrackingGroupService = {
  listGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  setKeywordsInGroup,
  updateKeywordGroups,
};
