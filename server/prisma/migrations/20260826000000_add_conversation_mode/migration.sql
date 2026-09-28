-- Add per-Discover-Mode conversation scoping.
-- Each Discover Mode (/ai-picks, /value-finder, ...) owns its own
-- conversation history, so Conversation rows are tagged with a `mode`.
-- Existing rows default to 'ai_picks' to stay backward compatible.
ALTER TABLE "conversations" ADD COLUMN "mode" VARCHAR(50) NOT NULL DEFAULT 'ai_picks';

-- Convenience index for filtering "My Chats" per mode.
CREATE INDEX "idx_conversations_user_mode_updated" ON "conversations"("user_id", "mode", "updated_at" DESC);