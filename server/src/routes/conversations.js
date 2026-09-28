import { Router } from 'express';
import prisma from '../db.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { resolveSportContext } from '../config/sports.js';

const router = Router();

/**
 * GET /api/conversations
 * List all conversations for the authenticated user, scoped to the active
 * Discover Mode AND the current sport/league context.
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const { mode, sport, league } = req.query;

    // Resolve/normalize sport context so filtering is stable and sports without
    // a league (MLB, NBA, ...) always match league = null. Invalid values safely
    // fall back to the MLB default rather than erroring.
    const ctx = resolveSportContext(sport, league);

    const where = {
      user_id: req.user.id,
      ...(mode ? { mode: String(mode) } : {}),
      sport: ctx.sportId,
      league: ctx.leagueId
    };

    const conversations = await prisma.conversation.findMany({
      where,
      orderBy: { updated_at: 'desc' },
      include: {
        messages: {
          take: 1,
          orderBy: { created_at: 'desc' },
          select: { content: true, role: true, created_at: true }
        }
      }
    });

    const formatted = conversations.map(c => ({
      id: c.id,
      title: c.title,
      mode: c.mode,
      sport: c.sport,
      league: c.league,
      created_at: c.created_at,
      updated_at: c.updated_at,
      lastMessage: c.messages[0]?.content || 'Empty conversation'
    }));

    return res.json({ conversations: formatted });
  } catch (error) {
    console.error('[Conversations Route] Fetch error:', error);
    return res.status(500).json({ error: 'Failed to fetch conversations.' });
  }
});

/**
 * POST /api/conversations
 * Create a new conversation (can be guest or authenticated).
 * The sport/league context is stamped at creation time and stays FIXED.
 */
router.post('/', optionalAuth, async (req, res) => {
  try {
    const { title, mode, sport, league } = req.body;
    const ctx = resolveSportContext(sport, league);

    const conversation = await prisma.conversation.create({
      data: {
        user_id: req.user?.id || null,
        title: title || 'New Sports Analysis',
        mode: mode || 'ai_picks',
        sport: ctx.sportId,
        league: ctx.leagueId
      }
    });

    return res.status(201).json({ conversation });
  } catch (error) {
    console.error('[Conversations Route] Create error:', error);
    return res.status(500).json({ error: 'Failed to create conversation.' });
  }
});

/**
 * GET /api/conversations/:id
 * Fetch conversation details, all messages, and research logs.
 */
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { created_at: 'asc' }
        },
        research_logs: {
          orderBy: { created_at: 'desc' }
        }
      }
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    // If conversation belongs to a user, ensure authorized
    if (conversation.user_id && (!req.user || req.user.id !== conversation.user_id)) {
      return res.status(403).json({ error: 'Access denied to this conversation.' });
    }

    return res.json({ conversation });
  } catch (error) {
    console.error('[Conversations Route] Get ID error:', error);
    return res.status(500).json({ error: 'Failed to retrieve conversation.' });
  }
});

/**
 * DELETE /api/conversations/:id
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const conversation = await prisma.conversation.findUnique({
      where: { id }
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    if (conversation.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized to delete this conversation.' });
    }

    await prisma.conversation.delete({
      where: { id }
    });

    return res.json({ message: 'Conversation deleted successfully.' });
  } catch (error) {
    console.error('[Conversations Route] Delete error:', error);
    return res.status(500).json({ error: 'Failed to delete conversation.' });
  }
});

export default router;
