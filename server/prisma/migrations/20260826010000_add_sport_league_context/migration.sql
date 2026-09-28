-- Add global sport context to conversations and user preferences.
--
-- `conversations.sport` / `conversations.league` capture the sport/league a chat
-- was CREATED under and are FIXED at creation time (changing the user's global
-- sport later never rewrites old conversations).
--
-- `user_preferences.selected_sport` / `user_preferences.selected_league` persist
-- the user's current global research sport/league.
--
-- Existing rows default to sport='mlb' / league=NULL to stay backward compatible
-- with CovrIQ's MLB-first history. No sport is ever inferred from titles.
ALTER TABLE "conversations" ADD COLUMN "sport" VARCHAR(50) NOT NULL DEFAULT 'mlb';
ALTER TABLE "conversations" ADD COLUMN "league" VARCHAR(50);

ALTER TABLE "user_preferences" ADD COLUMN "selected_sport" VARCHAR(50) NOT NULL DEFAULT 'mlb';
ALTER TABLE "user_preferences" ADD COLUMN "selected_league" VARCHAR(50);

-- Convenience index for filtering "My Chats" per mode + sport/league.
CREATE INDEX "idx_conversations_user_mode_sport_updated" ON "conversations"("user_id", "mode", "sport", "league", "updated_at" DESC);