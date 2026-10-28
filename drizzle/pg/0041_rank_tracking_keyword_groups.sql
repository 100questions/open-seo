CREATE TABLE "rank_tracking_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"color" text,
	"created_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rank_tracking_keyword_groups" (
	"keyword_id" text NOT NULL,
	"group_id" text NOT NULL,
	CONSTRAINT "rank_tracking_keyword_groups_keyword_id_group_id_pk" PRIMARY KEY("keyword_id","group_id")
);
--> statement-breakpoint
ALTER TABLE "rank_tracking_groups" ADD CONSTRAINT "rank_tracking_groups_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rank_tracking_keyword_groups" ADD CONSTRAINT "rank_tracking_keyword_groups_keyword_id_rank_tracking_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "public"."rank_tracking_keywords"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rank_tracking_keyword_groups" ADD CONSTRAINT "rank_tracking_keyword_groups_group_id_rank_tracking_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."rank_tracking_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rank_tracking_groups_project_normalized_name_idx" ON "rank_tracking_groups" USING btree ("project_id","normalized_name");--> statement-breakpoint
CREATE INDEX "rank_tracking_keyword_groups_group_idx" ON "rank_tracking_keyword_groups" USING btree ("group_id");