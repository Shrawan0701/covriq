CREATE TABLE "community_rooms" (
  "id" TEXT NOT NULL,
  "sport" VARCHAR(50) NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "emoji" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "community_rooms_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "community_rooms_sport_key" ON "community_rooms"("sport");

CREATE TABLE "community_posts" (
  "id" TEXT NOT NULL,
  "room_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "sport" VARCHAR(50) NOT NULL,
  "content" TEXT NOT NULL,
  "quote" JSONB,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "community_posts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "community_posts_sport_created_at_idx" ON "community_posts"("sport", "created_at");
ALTER TABLE "community_posts" ADD CONSTRAINT "community_posts_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "community_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_posts" ADD CONSTRAINT "community_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "community_comments" (
  "id" TEXT NOT NULL,
  "post_id" TEXT NOT NULL,
  "parent_id" TEXT,
  "user_id" TEXT NOT NULL,
  "sport" VARCHAR(50) NOT NULL,
  "content" TEXT NOT NULL,
  "quote" JSONB,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "community_comments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "community_comments_post_id_created_at_idx" ON "community_comments"("post_id", "created_at");
CREATE INDEX "community_comments_parent_id_idx" ON "community_comments"("parent_id");
ALTER TABLE "community_comments" ADD CONSTRAINT "community_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "community_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_comments" ADD CONSTRAINT "community_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "community_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "community_comments" ADD CONSTRAINT "community_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "community_votes" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "post_id" TEXT,
  "comment_id" TEXT,
  "value" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "community_votes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "community_votes_user_id_post_id_key" ON "community_votes"("user_id", "post_id");
CREATE UNIQUE INDEX "community_votes_user_id_comment_id_key" ON "community_votes"("user_id", "comment_id");
ALTER TABLE "community_votes" ADD CONSTRAINT "community_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_votes" ADD CONSTRAINT "community_votes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "community_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_votes" ADD CONSTRAINT "community_votes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "community_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "community_reactions" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "post_id" TEXT,
  "comment_id" TEXT,
  "reaction" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "community_reactions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "community_reactions_user_id_post_id_reaction_key" ON "community_reactions"("user_id", "post_id", "reaction");
CREATE UNIQUE INDEX "community_reactions_user_id_comment_id_reaction_key" ON "community_reactions"("user_id", "comment_id", "reaction");
ALTER TABLE "community_reactions" ADD CONSTRAINT "community_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_reactions" ADD CONSTRAINT "community_reactions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "community_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_reactions" ADD CONSTRAINT "community_reactions_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "community_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "community_reports" (
  "id" TEXT NOT NULL,
  "reporter_id" TEXT NOT NULL,
  "reported_user_id" TEXT,
  "post_id" TEXT,
  "comment_id" TEXT,
  "reason" TEXT NOT NULL,
  "details" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "community_reports_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "community_reports_reporter_id_post_id_key" ON "community_reports"("reporter_id", "post_id");
CREATE UNIQUE INDEX "community_reports_reporter_id_comment_id_key" ON "community_reports"("reporter_id", "comment_id");
CREATE INDEX "community_reports_status_created_at_idx" ON "community_reports"("status", "created_at");
ALTER TABLE "community_reports" ADD CONSTRAINT "community_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_reports" ADD CONSTRAINT "community_reports_reported_user_id_fkey" FOREIGN KEY ("reported_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "community_reports" ADD CONSTRAINT "community_reports_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "community_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_reports" ADD CONSTRAINT "community_reports_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "community_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "community_blocks" (
  "id" TEXT NOT NULL,
  "blocker_id" TEXT NOT NULL,
  "blocked_user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "community_blocks_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "community_blocks_blocker_id_blocked_user_id_key" ON "community_blocks"("blocker_id", "blocked_user_id");
ALTER TABLE "community_blocks" ADD CONSTRAINT "community_blocks_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_blocks" ADD CONSTRAINT "community_blocks_blocked_user_id_fkey" FOREIGN KEY ("blocked_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "community_moderation_actions" (
  "id" TEXT NOT NULL,
  "moderator_id" TEXT NOT NULL,
  "target_user_id" TEXT,
  "post_id" TEXT,
  "comment_id" TEXT,
  "action" TEXT NOT NULL,
  "reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "community_moderation_actions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "community_moderation_actions_created_at_idx" ON "community_moderation_actions"("created_at");
ALTER TABLE "community_moderation_actions" ADD CONSTRAINT "community_moderation_actions_moderator_id_fkey" FOREIGN KEY ("moderator_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

