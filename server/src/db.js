import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Real Prisma client for PostgreSQL
const realPrisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

let isPostgresConnected = false;

// Initialize connection check
realPrisma.$connect()
  .then(() => {
    isPostgresConnected = true;
    console.log('âœ… Connected to PostgreSQL database via Prisma.');
  })
  .catch((err) => {
    isPostgresConnected = false;
    console.warn('âš ï¸ PostgreSQL connection failed:', err.message);
    console.log('ðŸ’¡ CovrIQ is operating in resilient Local-Store mode (fully functional & persisted). Update DATABASE_URL in server/.env with your Postgres credentials whenever ready.');
  });

// Resilient Local Persistence for offline/dev zero-friction execution
const dataFilePath = path.join(__dirname, '../covriq_local_db.json');

function loadLocalData() {
  try {
    if (fs.existsSync(dataFilePath)) {
      const data = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
      migrateLocalData(data);
      return data;
    }
  } catch (e) {}
  return {
    users: [],
    conversations: [],
    messages: [],
    saved_items: [],
    user_preferences: [],
    ai_research_logs: [],
    community_rooms: [],
    community_posts: [],
    community_comments: [],
    community_votes: [],
    community_reactions: [],
    community_reports: [],
    community_blocks: [],
    community_moderation_actions: []
  };
}

/**
 * Lightweight in-place migration for the resilient local JSON store.
 *
 * Mirrors the SQL migration that backfills `conversations.sport = 'mlb'` and
 * `user_preferences.selected_sport = 'mlb'` for rows created before this
 * feature existed. Sport is NEVER inferred from titles - legacy conversations
 * simply default to MLB. Only writes when something actually changed.
 */
function migrateLocalData(data) {
  let changed = false;
  (data.conversations || []).forEach((c) => {
    if (c.sport === undefined || c.sport === null) { c.sport = 'mlb'; changed = true; }
    if (c.league === undefined) { c.league = null; changed = true; }
    if (c.mode === undefined || c.mode === null) { c.mode = 'ai_picks'; changed = true; }
    if (c.created_at && !(c.created_at instanceof Date)) { /* leave as-is */ }
  });
  (data.user_preferences || []).forEach((p) => {
    if (p.selected_sport === undefined || p.selected_sport === null) { p.selected_sport = 'mlb'; changed = true; }
    if (p.selected_league === undefined) { p.selected_league = null; changed = true; }
  });
    ['community_rooms', 'community_posts', 'community_comments', 'community_votes', 'community_reactions', 'community_reports', 'community_blocks', 'community_moderation_actions'].forEach((key) => {
    if (!Array.isArray(data[key])) { data[key] = []; changed = true; }
  });
  if (changed) saveLocalData(data);
}

function saveLocalData(data) {
  try {
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving local db:', e);
  }
}

// Resilient fallback proxy that mirrors Prisma model operations
const fallbackStore = {
  user: {
    findMany: async ({ take } = {}) => {
      const data = loadLocalData();
      const users = data.users || [];
      return typeof take === 'number' ? users.slice(0, take) : users;
    },
    findUnique: async ({ where }) => {
      const data = loadLocalData();
      if (where.id) return data.users.find(u => u.id === where.id) || null;
      if (where.email) return data.users.find(u => u.email === where.email) || null;
      return null;
    },
    create: async ({ data, include }) => {
      const db = loadLocalData();
      const newUser = {
        id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        email: data.email,
        password_hash: data.password_hash,
        name: data.name || data.email.split('@')[0],
        avatar_url: data.avatar_url || null,
        reset_token: null,
        reset_token_expiry: null,
        created_at: new Date(),
        updated_at: new Date()
      };
      db.users.push(newUser);
      
            let pref = null;
      if (data.preference?.create) {
        pref = {
          id: 'pref_' + Date.now(),
          user_id: newUser.id,
          theme: data.preference.create.theme || 'dark',
          odds_format: data.preference.create.odds_format || 'both',
          chat_font: data.preference.create.chat_font || 'serif',
          selected_sport: data.preference.create.selected_sport || 'mlb',
          selected_league: data.preference.create.selected_league || null,
          updated_at: new Date()
        };
        db.user_preferences.push(pref);
      }
      saveLocalData(db);
      return { ...newUser, preference: pref };
    },
    upsert: async ({ where, create, update }) => {
      const existing = await fallbackStore.user.findUnique({ where });
      if (existing) return existing;
      return await fallbackStore.user.create({ data: create });
    },
    update: async ({ where, data }) => {
      const db = loadLocalData();
      const idx = db.users.findIndex(u => u.id === where.id || u.email === where.email);
      if (idx !== -1) {
        db.users[idx] = { ...db.users[idx], ...data, updated_at: new Date() };
        saveLocalData(db);
        return db.users[idx];
      }
      return null;
    }
  },
  conversation: {
    findMany: async ({ where, orderBy, include }) => {
      const db = loadLocalData();
      let convs = db.conversations;
      if (where?.user_id) {
        convs = convs.filter(c => c.user_id === where.user_id);
      }
      if (where?.mode) {
        convs = convs.filter(c => c.mode === where.mode);
      }
      if (where?.sport) {
        convs = convs.filter(c => c.sport === where.sport);
      }
      if (where?.league !== undefined) {
        convs = convs.filter(c => (c.league || null) === (where.league || null));
      }
      convs.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
      return convs.map(c => ({
        ...c,
        messages: db.messages.filter(m => m.conversation_id === c.id).slice(-1)
      }));
    },
    findUnique: async ({ where, include }) => {
      const db = loadLocalData();
      const conv = db.conversations.find(c => c.id === where.id);
      if (!conv) return null;
      return {
        ...conv,
        messages: db.messages.filter(m => m.conversation_id === conv.id).sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
        research_logs: db.ai_research_logs.filter(l => l.conversation_id === conv.id)
      };
    },
    create: async ({ data }) => {
      const db = loadLocalData();
      const newConv = {
        id: 'conv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        user_id: data.user_id || null,
        title: data.title || 'New Sports Analysis',
        mode: data.mode || 'ai_picks',
        sport: data.sport || 'mlb',
        league: data.league || null,
        created_at: new Date(),
        updated_at: new Date()
      };
      db.conversations.unshift(newConv);
      saveLocalData(db);
      return newConv;
    },
    update: async ({ where, data }) => {
      const db = loadLocalData();
      const idx = db.conversations.findIndex(c => c.id === where.id);
      if (idx !== -1) {
        db.conversations[idx] = { ...db.conversations[idx], ...data, updated_at: new Date() };
        saveLocalData(db);
        return db.conversations[idx];
      }
      return null;
    },
    delete: async ({ where }) => {
      const db = loadLocalData();
      db.conversations = db.conversations.filter(c => c.id !== where.id);
      db.messages = db.messages.filter(m => m.conversation_id !== where.id);
      db.ai_research_logs = db.ai_research_logs.filter(l => l.conversation_id !== where.id);
      saveLocalData(db);
      return { success: true };
    }
  },
  message: {
    create: async ({ data }) => {
      const db = loadLocalData();
      const newMsg = {
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        conversation_id: data.conversation_id,
        role: data.role,
        content: data.content,
        model: data.model || 'gpt-5.6',
        metadata: data.metadata || null,
        created_at: new Date()
      };
      db.messages.push(newMsg);
      saveLocalData(db);
      return newMsg;
    }
  },
  savedItem: {
    findMany: async ({ where, orderBy }) => {
      const db = loadLocalData();
      return db.saved_items.filter(s => s.user_id === where.user_id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },
    findUnique: async ({ where }) => {
      const db = loadLocalData();
      return db.saved_items.find(s => s.id === where.id) || null;
    },
    create: async ({ data }) => {
      const db = loadLocalData();
      const newItem = {
        id: 'saved_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        user_id: data.user_id,
        type: data.type || 'bet_pick',
        title: data.title,
        content: data.content,
        stake: data.stake || null,
        result: data.result || 'pending',
        closing_odds: data.closing_odds || null,
        clv_percent: data.clv_percent || null,
        profit: data.profit || 0,
        notes: data.notes || null,
        created_at: new Date()
      };
      db.saved_items.unshift(newItem);
      saveLocalData(db);
      return newItem;
    },
    update: async ({ where, data }) => {
      const db = loadLocalData();
      const idx = db.saved_items.findIndex(s => s.id === where.id);
      if (idx !== -1) {
        db.saved_items[idx] = { ...db.saved_items[idx], ...data, updated_at: new Date() };
        saveLocalData(db);
        return db.saved_items[idx];
      }
      return null;
    },
    delete: async ({ where }) => {
      const db = loadLocalData();
      db.saved_items = db.saved_items.filter(s => s.id !== where.id);
      saveLocalData(db);
      return { success: true };
    }
  },
  edgeAlert: {
    findMany: async ({ where, orderBy }) => {
      const db = loadLocalData();
      if (!db.edge_alerts) db.edge_alerts = [];
      let alerts = db.edge_alerts;
      if (where?.userId) alerts = alerts.filter(a => a.userId === where.userId);
      return alerts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },
    create: async ({ data }) => {
      const db = loadLocalData();
      if (!db.edge_alerts) db.edge_alerts = [];
      const newAlert = {
        id: 'alt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        ...data,
        createdAt: new Date()
      };
      db.edge_alerts.unshift(newAlert);
      saveLocalData(db);
      return newAlert;
    },
    deleteMany: async ({ where }) => {
      const db = loadLocalData();
      if (!db.edge_alerts) db.edge_alerts = [];
      db.edge_alerts = db.edge_alerts.filter(a => !(a.id === where.id && a.userId === where.userId));
      saveLocalData(db);
      return { count: 1 };
    }
  },
  communityRoom: {
    findMany: async () => {
      const db = loadLocalData();
      return (db.community_rooms || []).sort((a, b) => String(a.sport).localeCompare(String(b.sport)));
    },
    findUnique: async ({ where }) => {
      const db = loadLocalData();
      return (db.community_rooms || []).find(r => r.id === where.id || r.sport === where.sport) || null;
    },
    upsert: async ({ where, create, update }) => {
      const db = loadLocalData();
      db.community_rooms ||= [];
      let room = db.community_rooms.find(r => r.sport === where.sport || r.id === where.id);
      if (room) Object.assign(room, update || {}, { updated_at: new Date() });
      else {
        room = { id: 'room_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), ...create, created_at: new Date(), updated_at: new Date() };
        db.community_rooms.push(room);
      }
      saveLocalData(db);
      return room;
    }
  },
  communityPost: {
    findMany: async ({ where = {} } = {}) => {
      const db = loadLocalData();
      let rows = db.community_posts || [];
      if (where.sport) rows = rows.filter(p => p.sport === where.sport);
      if (where.id) rows = rows.filter(p => p.id === where.id);
      rows = rows.filter(p => p.is_deleted !== true);
      return rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(p => ({ ...p, user: db.users.find(u => u.id === p.user_id) || null }));
    },
    findUnique: async ({ where }) => {
      const db = loadLocalData();
      const p = (db.community_posts || []).find(x => x.id === where.id);
      return p ? { ...p, user: db.users.find(u => u.id === p.user_id) || null } : null;
    },
    create: async ({ data }) => {
      const db = loadLocalData();
      db.community_posts ||= [];
      const row = { id: 'post_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), ...data, is_deleted: false, created_at: new Date(), updated_at: new Date() };
      db.community_posts.unshift(row);
      saveLocalData(db);
      return { ...row, user: db.users.find(u => u.id === row.user_id) || null };
    },
    update: async ({ where, data }) => {
      const db = loadLocalData();
      const row = (db.community_posts || []).find(p => p.id === where.id);
      if (!row) return null;
      Object.assign(row, data, { updated_at: new Date() });
      saveLocalData(db);
      return row;
    }
  },
  communityComment: {
    findMany: async ({ where = {} } = {}) => {
      const db = loadLocalData();
      let rows = db.community_comments || [];
      if (where.post_id) rows = rows.filter(c => c.post_id === where.post_id);
      if (where.id) rows = rows.filter(c => c.id === where.id);
      rows = rows.filter(c => c.is_deleted !== true);
      return rows.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).map(c => ({ ...c, user: db.users.find(u => u.id === c.user_id) || null }));
    },
    findUnique: async ({ where }) => {
      const db = loadLocalData();
      const c = (db.community_comments || []).find(x => x.id === where.id);
      return c ? { ...c, user: db.users.find(u => u.id === c.user_id) || null } : null;
    },
    create: async ({ data }) => {
      const db = loadLocalData();
      db.community_comments ||= [];
      const row = { id: 'cmt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), ...data, is_deleted: false, created_at: new Date(), updated_at: new Date() };
      db.community_comments.push(row);
      saveLocalData(db);
      return { ...row, user: db.users.find(u => u.id === row.user_id) || null };
    },
    update: async ({ where, data }) => {
      const db = loadLocalData();
      const row = (db.community_comments || []).find(c => c.id === where.id);
      if (!row) return null;
      Object.assign(row, data, { updated_at: new Date() });
      saveLocalData(db);
      return row;
    }
  },
  communityVote: {
    findMany: async ({ where = {} } = {}) => {
      const db = loadLocalData();
      let rows = db.community_votes || [];
      if (where.post_id) rows = rows.filter(v => v.post_id === where.post_id);
      if (where.comment_id) rows = rows.filter(v => v.comment_id === where.comment_id);
      if (where.user_id) rows = rows.filter(v => v.user_id === where.user_id);
      return rows;
    },
    findFirst: async ({ where = {} } = {}) => {
      const rows = await fallbackStore.communityVote.findMany({ where });
      return rows[0] || null;
    },
    create: async ({ data }) => {
      const db = loadLocalData(); db.community_votes ||= [];
      const row = { id: 'vote_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), ...data, created_at: new Date(), updated_at: new Date() };
      db.community_votes.push(row); saveLocalData(db); return row;
    },
    update: async ({ where, data }) => {
      const db = loadLocalData();
      const row = (db.community_votes || []).find(v => v.id === where.id);
      if (!row) return null; Object.assign(row, data, { updated_at: new Date() }); saveLocalData(db); return row;
    },
    delete: async ({ where }) => {
      const db = loadLocalData(); db.community_votes = (db.community_votes || []).filter(v => v.id !== where.id); saveLocalData(db); return { success: true };
    }
  },
  communityReaction: {
    findMany: async ({ where = {} } = {}) => {
      const db = loadLocalData(); let rows = db.community_reactions || [];
      if (where.post_id) rows = rows.filter(r => r.post_id === where.post_id);
      if (where.comment_id) rows = rows.filter(r => r.comment_id === where.comment_id);
      if (where.user_id) rows = rows.filter(r => r.user_id === where.user_id);
      if (where.reaction) rows = rows.filter(r => r.reaction === where.reaction);
      return rows;
    },
    findFirst: async ({ where = {} } = {}) => (await fallbackStore.communityReaction.findMany({ where }))[0] || null,
    create: async ({ data }) => { const db = loadLocalData(); db.community_reactions ||= []; const row = { id: 'react_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), ...data, created_at: new Date() }; db.community_reactions.push(row); saveLocalData(db); return row; },
    delete: async ({ where }) => { const db = loadLocalData(); db.community_reactions = (db.community_reactions || []).filter(r => r.id !== where.id); saveLocalData(db); return { success: true }; }
  },
  communityReport: {
    findFirst: async ({ where = {} } = {}) => {
      const db = loadLocalData(); return (db.community_reports || []).find(r => (!where.reporter_id || r.reporter_id === where.reporter_id) && (!where.post_id || r.post_id === where.post_id) && (!where.comment_id || r.comment_id === where.comment_id)) || null;
    },
    create: async ({ data }) => { const db = loadLocalData(); db.community_reports ||= []; const row = { id: 'rep_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), status: 'pending', ...data, created_at: new Date(), updated_at: new Date() }; db.community_reports.push(row); saveLocalData(db); return row; }
  },
  communityBlock: {
    findMany: async ({ where = {} } = {}) => { const db = loadLocalData(); let rows = db.community_blocks || []; if (where.blocker_id) rows = rows.filter(b => b.blocker_id === where.blocker_id); return rows; },
    findFirst: async ({ where = {} } = {}) => (await fallbackStore.communityBlock.findMany({ where })).find(b => !where.blocked_user_id || b.blocked_user_id === where.blocked_user_id) || null,
    create: async ({ data }) => { const db = loadLocalData(); db.community_blocks ||= []; const existing = db.community_blocks.find(b => b.blocker_id === data.blocker_id && b.blocked_user_id === data.blocked_user_id); if (existing) return existing; const row = { id: 'blk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), ...data, created_at: new Date() }; db.community_blocks.push(row); saveLocalData(db); return row; },
    deleteMany: async ({ where = {} } = {}) => { const db = loadLocalData(); const before = (db.community_blocks || []).length; db.community_blocks = (db.community_blocks || []).filter(b => !(b.blocker_id === where.blocker_id && b.blocked_user_id === where.blocked_user_id)); saveLocalData(db); return { count: before - db.community_blocks.length }; }
  },
  userPreference: {
    findUnique: async ({ where }) => {
      const db = loadLocalData();
      return db.user_preferences.find(p => p.user_id === where.user_id) || null;
    },
    create: async ({ data }) => {
      const db = loadLocalData();
      const newPref = {
        id: 'pref_' + Date.now(),
        user_id: data.user_id,
        theme: data.theme || 'dark',
        odds_format: data.odds_format || 'both',
        chat_font: data.chat_font || 'serif',
        selected_sport: data.selected_sport || 'mlb',
        selected_league: data.selected_league || null,
        updated_at: new Date()
      };
      db.user_preferences.push(newPref);
      saveLocalData(db);
      return newPref;
    },
    upsert: async ({ where, update, create }) => {
      const db = loadLocalData();
      let pref = db.user_preferences.find(p => p.user_id === where.user_id);
      if (pref) {
        Object.assign(pref, update, { updated_at: new Date() });
      } else {
        pref = {
          id: 'pref_' + Date.now(),
          user_id: create.user_id,
          theme: create.theme || 'dark',
          odds_format: create.odds_format || 'both',
          chat_font: create.chat_font || 'serif',
          selected_sport: create.selected_sport || 'mlb',
          selected_league: create.selected_league || null,
          updated_at: new Date()
        };
        db.user_preferences.push(pref);
      }
      saveLocalData(db);
      return pref;
    }
  },
  aiResearchLog: {
    create: async ({ data }) => {
      const db = loadLocalData();
      const newLog = {
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        conversation_id: data.conversation_id,
        message_id: data.message_id || null,
        query: data.query,
        sources: data.sources,
        created_at: new Date()
      };
      db.ai_research_logs.push(newLog);
      saveLocalData(db);
      return newLog;
    }
  },
  $connect: async () => {},
  $disconnect: async () => {}
};

// Resilient wrapper: calls real Prisma if Postgres is connected, otherwise uses local store seamlessly
const prisma = new Proxy(realPrisma, {
  get(target, prop) {
    if (isPostgresConnected && target[prop]) {
      return target[prop];
    }
    if (fallbackStore[prop]) {
      return fallbackStore[prop];
    }
    return target[prop];
  }
});

export default prisma;






