-- ==============================================================================
-- CovrIQ Database Schema (PostgreSQL DDL)
-- Enhanced with Bet Journal, CLV Tracking, Provider Metadata, and Edge Alerts
-- ==============================================================================

-- 1. Enable UUID Extension (for gen_random_uuid() / uuid_generate_v4())
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- Table 1: USERS
-- Stores authentication, hashed passwords, profile data, and reset tokens
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "users" (
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

CREATE INDEX IF NOT EXISTS "idx_users_email" ON "users"("email");

-- ------------------------------------------------------------------------------
-- Table 2: CONVERSATIONS
-- Stores chat sessions for registered and guest users
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "conversations" (
    "id" VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "user_id" VARCHAR(64) REFERENCES "users"("id") ON DELETE CASCADE,
    "title" VARCHAR(255) NOT NULL DEFAULT 'New Sports Analysis',
    "mode" VARCHAR(50) NOT NULL DEFAULT 'ai_picks',
    "sport" VARCHAR(50) NOT NULL DEFAULT 'mlb',
    "league" VARCHAR(50),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_conversations_user_id" ON "conversations"("user_id");
CREATE INDEX IF NOT EXISTS "idx_conversations_updated_at" ON "conversations"("updated_at" DESC);

-- ------------------------------------------------------------------------------
-- Table 3: MESSAGES
-- Stores user prompts, streaming AI outputs, and structured JSONB metadata
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "messages" (
    "id" VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "conversation_id" VARCHAR(64) NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
    "role" VARCHAR(50) NOT NULL, -- 'user' | 'assistant' | 'system'
    "content" TEXT NOT NULL,
    "model" VARCHAR(100) DEFAULT 'gpt-5.6',
    "response_id" VARCHAR(255),
    "metadata" JSONB, -- Stores parsed gameHeader, marketCard, verdict, odds, provider
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_messages_conversation_id" ON "messages"("conversation_id");
CREATE INDEX IF NOT EXISTS "idx_messages_created_at" ON "messages"("created_at" ASC);

-- ------------------------------------------------------------------------------
-- Table 4: SAVED_ITEMS (Enhanced Bet Journal & CLV Tracking)
-- Stores bookmarked picks, parlay research, results, stakes, closing line value
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "saved_items" (
    "id" VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "user_id" VARCHAR(64) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "type" VARCHAR(50) NOT NULL DEFAULT 'bet_pick', -- 'bet_pick' | 'matchup_analysis' | 'parlay'
    "title" VARCHAR(255) NOT NULL,
    "content" JSONB NOT NULL,
    "stake" NUMERIC(10,2),
    "result" VARCHAR(20) DEFAULT 'pending', -- 'pending' | 'won' | 'lost' | 'push' | 'void'
    "closing_odds" VARCHAR(50),
    "clv_percent" NUMERIC(6,2),
    "profit" NUMERIC(10,2) DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_saved_items_user_id" ON "saved_items"("user_id");
CREATE INDEX IF NOT EXISTS "idx_saved_items_created_at" ON "saved_items"("created_at" DESC);

-- ------------------------------------------------------------------------------
-- Table 5: EDGE_ALERTS
-- Stores user-configured market & price movement alerts
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "edge_alerts" (
    "id" VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "user_id" VARCHAR(64) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "game_id" VARCHAR(128),
    "matchup" VARCHAR(255) NOT NULL,
    "sport" VARCHAR(50) NOT NULL DEFAULT 'MLB',
    "market" VARCHAR(50) NOT NULL DEFAULT 'Moneyline',
    "selection" VARCHAR(255) NOT NULL,
    "target_edge" NUMERIC(5,2),
    "target_odds" VARCHAR(50),
    "alert_type" VARCHAR(50) DEFAULT 'edge_threshold',
    "is_active" BOOLEAN DEFAULT TRUE,
    "triggered_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_edge_alerts_user_id" ON "edge_alerts"("user_id");

-- ------------------------------------------------------------------------------
-- Table 6: USER_PREFERENCES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "user_preferences" (
    "id" VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "user_id" VARCHAR(64) UNIQUE NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "theme" VARCHAR(50) NOT NULL DEFAULT 'dark',
    "odds_format" VARCHAR(50) NOT NULL DEFAULT 'both',
    "chat_font" VARCHAR(50) NOT NULL DEFAULT 'serif',
    "selected_sport" VARCHAR(50) NOT NULL DEFAULT 'mlb',
    "selected_league" VARCHAR(50),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_user_preferences_user_id" ON "user_preferences"("user_id");

-- ------------------------------------------------------------------------------
-- Table 7: AI_RESEARCH_LOGS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "ai_research_logs" (
    "id" VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "conversation_id" VARCHAR(64) NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
    "message_id" VARCHAR(64) REFERENCES "messages"("id") ON DELETE SET NULL,
    "query" TEXT NOT NULL,
    "sources" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_ai_research_logs_conversation_id" ON "ai_research_logs"("conversation_id");
