import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { projects, rankTrackingKeywords } from "./app.schema";

// See src/db/pg/app.schema.ts for why timestamps are ISO-8601 UTC text.
const timestampColumn = (name: string) => text(name);
const isoNow = sql`to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

// Named keyword groups, shared by every tracker in the project. A keyword can
// belong to any number of groups (rank_tracking_keyword_groups).
export const rankTrackingGroups = pgTable(
  "rank_tracking_groups",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // Lowercased name: "Rolex" and "rolex" are one group.
    normalizedName: text("normalized_name").notNull(),
    // Palette key, as saved_keyword_tags.color. Null = derive from the id.
    color: text("color"),
    createdAt: timestampColumn("created_at").notNull().default(isoNow),
    updatedAt: timestampColumn("updated_at").notNull().default(isoNow),
  },
  (table) => [
    uniqueIndex("rank_tracking_groups_project_normalized_name_idx").on(
      table.projectId,
      table.normalizedName,
    ),
  ],
);

export const rankTrackingKeywordGroups = pgTable(
  "rank_tracking_keyword_groups",
  {
    keywordId: text("keyword_id")
      .notNull()
      .references(() => rankTrackingKeywords.id, { onDelete: "cascade" }),
    groupId: text("group_id")
      .notNull()
      .references(() => rankTrackingGroups.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.keywordId, table.groupId] }),
    index("rank_tracking_keyword_groups_group_idx").on(table.groupId),
  ],
);
