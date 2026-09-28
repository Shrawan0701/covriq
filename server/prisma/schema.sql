-- ==============================================================================
-- CovrIQ Database Schema (PostgreSQL DDL)
-- Run this directly in pgAdmin Query Tool or via psql CLI.
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Drop existing tables if re-creating
DROP TABLE IF EXISTS "ai_research_logs" CASCADE;
DROP TABLE IF EXISTS "user_preferences" CASCADE;
DROP TABLE IF EXISTS "saved_items" CASCADE;
DROP TABLE IF EXISTS "messages" CASCADE;
DROP TABLE IF EXISTS "conversations" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;

-- ------------------------------------------------------------------------------
-- Table 1: USERS
-- ------------------------------------------------------------------------------
CREATE TABLE "users" (
    "id" VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "email" VARCHAR(255) UNIQUE NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" VARCHAR(255),
    "avatar_url" TEXT,
    "reset_token" TEXT,
    "reset_token_expiry" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "idx_users_email" ON "users"("email");

-- ------------------------------------------------------------------------------
-- Table 2: CONVERSATIONS
-- ------------------------------------------------------------------------------
CREATE TABLE "conversations" (
    "id" VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "user_id" VARCHAR(64) REFERENCES "users"("id") ON DELETE CASCADE,
    "title" VARCHAR(255) NOT NULL DEFAULT 'New Sports Analysis',
    "mode" VARCHAR(50) NOT NULL DEFAULT 'ai_picks',
    "sport" VARCHAR(50) NOT NULL DEFAULT 'mlb',
    "league" VARCHAR(50),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "idx_conversations_user_id" ON "conversations"("user_id");
CREATE INDEX "idx_conversations_updated_at" ON "conversations"("updated_at" DESC);
CREATE INDEX "idx_conversations_user_mode_sport_updated" ON "conversations"("user_id", "mode", "sport", "league", "updated_at" DESC);

-- ------------------------------------------------------------------------------
-- Table 3: MESSAGES
-- ------------------------------------------------------------------------------
CREATE TABLE "messages" (
    "id" VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "conversation_id" VARCHAR(64) NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
    "role" VARCHAR(50) NOT NULL, -- 'user' | 'assistant' | 'system'
    "content" TEXT NOT NULL,
    "model" VARCHAR(100) DEFAULT 'gpt-5.6',
    "response_id" VARCHAR(255),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "idx_messages_conversation_id" ON "messages"("conversation_id");
CREATE INDEX "idx_messages_created_at" ON "messages"("created_at" ASC);

-- ------------------------------------------------------------------------------
-- Table 4: SAVED_ITEMS
-- ------------------------------------------------------------------------------
CREATE TABLE "saved_items" (
    "id" VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "user_id" VARCHAR(64) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "type" VARCHAR(50) NOT NULL DEFAULT 'bet_pick',
    "title" VARCHAR(255) NOT NULL,
    "content" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "idx_saved_items_user_id" ON "saved_items"("user_id");
CREATE INDEX "idx_saved_items_created_at" ON "saved_items"("created_at" DESC);

-- ------------------------------------------------------------------------------
-- Table 5: USER_PREFERENCES
-- ------------------------------------------------------------------------------
CREATE TABLE "user_preferences" (
    "id" VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "user_id" VARCHAR(64) UNIQUE NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "theme" VARCHAR(50) NOT NULL DEFAULT 'dark',
    "odds_format" VARCHAR(50) NOT NULL DEFAULT 'both',
    "chat_font" VARCHAR(50) NOT NULL DEFAULT 'serif',
    "selected_sport" VARCHAR(50) NOT NULL DEFAULT 'mlb',
    "selected_league" VARCHAR(50),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "idx_user_preferences_user_id" ON "user_preferences"("user_id");

-- ------------------------------------------------------------------------------
-- Table 6: AI_RESEARCH_LOGS
-- ------------------------------------------------------------------------------
CREATE TABLE "ai_research_logs" (
    "id" VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "conversation_id" VARCHAR(64) NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
    "message_id" VARCHAR(64) REFERENCES "messages"("id") ON DELETE SET NULL,
    "query" TEXT NOT NULL,
    "sources" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "idx_ai_research_logs_conversation_id" ON "ai_research_logs"("conversation_id");

-- ------------------------------------------------------------------------------
-- SEED DATA (Demo User)
-- Password: covriq123!
-- ------------------------------------------------------------------------------
INSERT INTO "users" ("id", "email", "password_hash", "name", "created_at", "updated_at")
VALUES (
    'usr_demo_01',
    'pro@covriq.ai',
    '$2a$10$7r6N0t9HhP/E/qLfZB1g7eWq0U4W4L8mZ1NfJz8eH.tHqZ.u9nB2m',
    'Sharps Handicapper',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
) ON CONFLICT ("email") DO NOTHING;

INSERT INTO "user_preferences" ("id", "user_id", "theme", "odds_format", "chat_font", "updated_at")
VALUES (
    'pref_demo_01',
    'usr_demo_01',
    'dark',
    'both',
    'serif',
    CURRENT_TIMESTAMP
) ON CONFLICT ("user_id") DO NOTHING;

-- Verification
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
