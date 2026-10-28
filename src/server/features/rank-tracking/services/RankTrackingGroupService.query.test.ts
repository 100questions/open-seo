import { readFileSync } from "node:fs";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import type * as RankTrackingGroupServiceModule from "./RankTrackingGroupService";

// Real in-memory SQLite with the shipped migration, so the case-insensitive
// unique name index and the membership primary key run as in production.

vi.mock("cloudflare:workers", () => ({
  env: { DATABASE_PROVIDER: "d1" },
}));

let client: Client;
let RankTrackingGroupService: typeof RankTrackingGroupServiceModule.RankTrackingGroupService;

beforeAll(async () => {
  client = createClient({ url: "file::memory:" });
  const testDb = drizzle(client);
  // The db mock needs the client created above, so the service is imported
  // after it rather than statically.
  vi.doMock("@/db", () => ({ db: testDb }));

  await client.executeMultiple(`
    CREATE TABLE projects (id TEXT PRIMARY KEY);
    CREATE TABLE rank_tracking_configs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      domain TEXT NOT NULL,
      location_code INTEGER NOT NULL DEFAULT 2840,
      language_code TEXT NOT NULL DEFAULT 'en',
      devices TEXT NOT NULL DEFAULT 'both',
      serp_depth INTEGER NOT NULL DEFAULT 100,
      schedule_interval TEXT NOT NULL DEFAULT 'weekly',
      location_name TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      last_checked_at TEXT,
      next_check_at TEXT,
      last_skip_reason TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE rank_tracking_keywords (
      id TEXT PRIMARY KEY,
      config_id TEXT NOT NULL,
      keyword TEXT NOT NULL,
      match_case INTEGER NOT NULL DEFAULT 0,
      search_volume INTEGER,
      keyword_difficulty INTEGER,
      cpc REAL,
      metrics_fetched_at TEXT,
      pinned_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await client.executeMultiple(
    readFileSync(
      "drizzle/sqlite/0063_rank_tracking_keyword_groups.sql",
      "utf8",
    ).replaceAll("--> statement-breakpoint", ""),
  );

  ({ RankTrackingGroupService } = await import("./RankTrackingGroupService"));
});

afterAll(() => {
  client.close();
});

beforeEach(async () => {
  await client.executeMultiple(`
    DELETE FROM rank_tracking_keyword_groups;
    DELETE FROM rank_tracking_groups;
    DELETE FROM rank_tracking_keywords;
    DELETE FROM rank_tracking_configs;
    DELETE FROM projects;
    INSERT INTO projects (id) VALUES ('project_a'), ('project_b');
    INSERT INTO rank_tracking_configs (id, project_id, domain)
      VALUES ('tracker_a', 'project_a', 'a.com'), ('tracker_b', 'project_b', 'b.com');
    INSERT INTO rank_tracking_keywords (id, config_id, keyword) VALUES
      ('kw_a1', 'tracker_a', 'rolex'),
      ('kw_a2', 'tracker_a', 'watch repair'),
      ('kw_b1', 'tracker_b', 'omega');
  `);
});

async function groupCounts(projectId: string) {
  const groups = await RankTrackingGroupService.listGroups(projectId);
  return groups.map(({ name, keywordCount }) => ({ name, keywordCount }));
}

it("adds keywords to groups by name, reusing a group whatever its case", async () => {
  await RankTrackingGroupService.createGroup("project_a", "Rolex");

  await RankTrackingGroupService.updateKeywordGroups({
    projectId: "project_a",
    configId: "tracker_a",
    // kw_b1 belongs to another project's tracker and must be skipped.
    keywordIds: ["kw_a1", "kw_a2", "kw_a1", "kw_b1"],
    addGroupNames: ["rolex", "  Sửa   chữa "],
    removeGroupIds: [],
  });

  expect(await groupCounts("project_a")).toEqual([
    { name: "Rolex", keywordCount: 2 },
    { name: "Sửa chữa", keywordCount: 2 },
  ]);
});

it("rejects a group name already taken in any case", async () => {
  await RankTrackingGroupService.createGroup("project_a", "Rolex");
  const other = await RankTrackingGroupService.createGroup(
    "project_a",
    "Omega",
  );

  await expect(
    RankTrackingGroupService.createGroup("project_a", " ROLEX "),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  await expect(
    RankTrackingGroupService.updateGroup("project_a", other.id, {
      name: "rolex",
    }),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  // Names are per project.
  await expect(
    RankTrackingGroupService.createGroup("project_b", "Rolex"),
  ).resolves.toMatchObject({ name: "Rolex" });
});

it("keeps another project's groups out of reach", async () => {
  const foreign = await RankTrackingGroupService.createGroup(
    "project_b",
    "Omega",
  );

  await expect(
    RankTrackingGroupService.setKeywordsInGroup({
      projectId: "project_a",
      configId: "tracker_a",
      groupId: foreign.id,
      keywordIds: ["kw_a1"],
      inGroup: true,
    }),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  await expect(
    RankTrackingGroupService.deleteGroup("project_a", foreign.id),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(await groupCounts("project_b")).toEqual([
    { name: "Omega", keywordCount: 0 },
  ]);
});
