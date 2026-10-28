import { and, asc, count, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  rankTrackingGroups,
  rankTrackingKeywordGroups,
  rankTrackingKeywords,
} from "@/db/schema";

// Keep each IN list below D1's ~100 bound-parameter ceiling, leaving room for
// the groupId bind.
const ID_BATCH_SIZE = 90;
// Two binds per membership row.
const MEMBERSHIP_INSERT_BATCH_SIZE = 45;

const groupColumns = {
  id: rankTrackingGroups.id,
  name: rankTrackingGroups.name,
  normalizedName: rankTrackingGroups.normalizedName,
  color: rankTrackingGroups.color,
};

async function listGroups(projectId: string) {
  return db
    .select({
      ...groupColumns,
      keywordCount: count(rankTrackingKeywordGroups.keywordId),
    })
    .from(rankTrackingGroups)
    .leftJoin(
      rankTrackingKeywordGroups,
      eq(rankTrackingKeywordGroups.groupId, rankTrackingGroups.id),
    )
    .where(eq(rankTrackingGroups.projectId, projectId))
    .groupBy(
      rankTrackingGroups.id,
      rankTrackingGroups.name,
      rankTrackingGroups.normalizedName,
      rankTrackingGroups.color,
    )
    .orderBy(asc(rankTrackingGroups.normalizedName));
}

async function createGroup(group: {
  id: string;
  projectId: string;
  name: string;
  normalizedName: string;
}) {
  const [created] = await db
    .insert(rankTrackingGroups)
    .values(group)
    .onConflictDoNothing()
    .returning(groupColumns);
  return created ?? null;
}

async function updateGroup(
  groupId: string,
  projectId: string,
  patch: { name?: string; normalizedName?: string; color?: string | null },
) {
  const [updated] = await db
    .update(rankTrackingGroups)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(rankTrackingGroups.id, groupId),
        eq(rankTrackingGroups.projectId, projectId),
      ),
    )
    .returning(groupColumns);
  return updated ?? null;
}

async function deleteGroup(groupId: string, projectId: string) {
  const [deleted] = await db
    .delete(rankTrackingGroups)
    .where(
      and(
        eq(rankTrackingGroups.id, groupId),
        eq(rankTrackingGroups.projectId, projectId),
      ),
    )
    .returning({ id: rankTrackingGroups.id });
  return deleted ?? null;
}

async function getMembershipsForConfig(configId: string) {
  return db
    .select({
      keywordId: rankTrackingKeywordGroups.keywordId,
      groupId: rankTrackingKeywordGroups.groupId,
    })
    .from(rankTrackingKeywordGroups)
    .innerJoin(
      rankTrackingKeywords,
      eq(rankTrackingKeywords.id, rankTrackingKeywordGroups.keywordId),
    )
    .where(eq(rankTrackingKeywords.configId, configId));
}

async function addKeywordsToGroup(groupId: string, keywordIds: string[]) {
  const addedIds: string[] = [];
  for (let i = 0; i < keywordIds.length; i += MEMBERSHIP_INSERT_BATCH_SIZE) {
    const chunk = keywordIds.slice(i, i + MEMBERSHIP_INSERT_BATCH_SIZE);
    const added = await db
      .insert(rankTrackingKeywordGroups)
      .values(chunk.map((keywordId) => ({ keywordId, groupId })))
      .onConflictDoNothing()
      .returning({ keywordId: rankTrackingKeywordGroups.keywordId });
    addedIds.push(...added.map((row) => row.keywordId));
  }
  return addedIds;
}

async function removeKeywordsFromGroup(groupId: string, keywordIds: string[]) {
  const removedIds: string[] = [];
  for (let i = 0; i < keywordIds.length; i += ID_BATCH_SIZE) {
    const chunk = keywordIds.slice(i, i + ID_BATCH_SIZE);
    const removed = await db
      .delete(rankTrackingKeywordGroups)
      .where(
        and(
          eq(rankTrackingKeywordGroups.groupId, groupId),
          inArray(rankTrackingKeywordGroups.keywordId, chunk),
        ),
      )
      .returning({ keywordId: rankTrackingKeywordGroups.keywordId });
    removedIds.push(...removed.map((row) => row.keywordId));
  }
  return removedIds;
}

export const RankTrackingGroupRepository = {
  listGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  getMembershipsForConfig,
  addKeywordsToGroup,
  removeKeywordsFromGroup,
};
