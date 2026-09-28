import { Router } from 'express';
import prisma from '../db.js';
import { optionalAuth } from '../middleware/auth.js';
import { streamAiAnalysis } from '../services/aiService.js';
import { resolveSportContext } from '../config/sports.js';

const router = Router();

// Discover Modes that own their own conversation history.
const KNOWN_MODES = [
  'ai_picks',
  'value_finder',
  'upset_finder',
  'compare_bets',
  'parlay_lab',
  'deep_analysis'
];

/**
 * Helper to create a smart conversation title from the first prompt.
 */
function generateTitleFromPrompt(prompt) {
  const cleaned = (prompt || 'Sports Analysis').replace(/[^\w\s@\-\.]/gi, '').trim();
  const words = cleaned.split(/\s+/).slice(0, 6);
  const title = words.join(' ');
  return title.length > 0 ? title.charAt(0).toUpperCase() + title.slice(1) : 'Sports Analysis';
}

/**
 * POST /api/chat
 * Streams AI handicapping analysis via Server-Sent Events (SSE).
 */
router.post('/', optionalAuth, async (req, res) => {
  let {
    conversationId,
    message,
    image,
    images,
    mode = 'ai_picks',
    oddsFormat = 'both',
    sport,
    league
  } = req.body;

  // Normalize the Discover Mode - unknown modes silently fall back to ai_picks.
  if (!KNOWN_MODES.includes(mode)) mode = 'ai_picks';

  // Normalize sport/league context. Invalid values safely fall back to MLB.
  // Every conversation stores the sport/league it was created under.
  const reqSportCtx = resolveSportContext(sport, league);

  const imageList = Array.isArray(images) ? images.filter(Boolean) : (image ? [image] : []);
  const primaryImage = imageList[0] || null;

  if ((!message || typeof message !== 'string' || message.trim() === '') && imageList.length === 0) {
    return res.status(400).json({ error: 'Message content or image attachment is required.' });
  }

  const promptText = (message || 'Analyze this sportsbook screenshot / bet slip:').trim();

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Helper to send SSE event
  const sendEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    let conversation;
    let history = [];

    // If conversationId is provided, look it up
    if (conversationId) {
      // IMPORTANT: order by created_at DESC + take(10) so we get the
      // MOST RECENT 10 messages, then reverse them back into
      // chronological order for the model. The previous version ordered
      // ASC before take(10), which always grabbed the OLDEST 10 messages
      // in the conversation - so once a chat passed 10 messages, the AI
      // permanently lost access to anything recent and only ever "saw"
      // the very first exchanges. This is why follow-up questions later
      // in a session appeared to have no memory of what was just asked.
      conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          messages: {
            orderBy: { created_at: 'desc' },
            take: 10
          }
        }
      });

      if (conversation) {
        conversation.messages = (conversation.messages || []).slice().reverse();
      }
    }

    // A supplied conversationId must belong to THIS Discover Mode AND (if it's
    // owned by a user) to the requesting user. If either check fails we treat
    // it as "new" rather than accidentally extending another mode's thread.
    if (conversation && conversation.mode !== mode) {
      conversation = null;
    } else if (conversation && conversation.user_id && (!req.user || req.user.id !== conversation.user_id)) {
      conversation = null;
    }

    // If not found or if it doesn't belong to this Discover Mode (or to the
    // requesting user), create a fresh conversation tagged with the active
    // mode + the current sport/league context (FIXED at creation time).
    if (!conversation) {
      const generatedTitle = generateTitleFromPrompt(promptText);
      conversation = await prisma.conversation.create({
        data: {
          user_id: req.user?.id || null,
          title: generatedTitle,
          mode,
          sport: reqSportCtx.sportId,
          league: reqSportCtx.leagueId
        }
      });
      conversationId = conversation.id;
    } else {
      history = conversation.messages || [];
    }

    // The AI always runs under the sport/league context of THIS conversation.
    // For a pre-existing conversation that is its stored context (never mutated
    // by a later global sport change). For a brand-new conversation it's the
    // sport/league it was just created under.
    const convoSportCtx = resolveSportContext(
      conversation.sport,
      conversation.league
    );

    // Notify client of current conversation ID
    sendEvent('init', {
      conversationId: conversation.id,
      title: conversation.title,
      sport: convoSportCtx.sportId,
      league: convoSportCtx.leagueId
    });

    // Save user message to database (including attached screenshot if present)
    const userMessage = await prisma.message.create({
      data: {
        conversation_id: conversation.id,
        role: 'user',
        content: promptText,
        model: 'user_input',
        metadata: imageList.length > 0 ? { image: primaryImage, images: imageList } : null
      }
    });

    // Stream from AI Service
    await streamAiAnalysis({
      prompt: promptText,
      image: primaryImage,
      images: imageList,
      conversationHistory: history,
      mode,
      oddsFormat,
      sport: convoSportCtx.sportId,
      league: convoSportCtx.leagueId,
      onStatus: (statusText) => {
        sendEvent('status', { text: statusText });
      },
      onChunk: (chunk) => {
        sendEvent('chunk', { chunk });
      },
      onComplete: async ({ fullText, structured }) => {
        // Save Assistant Message to DB with structured metadata
        const assistantMessage = await prisma.message.create({
          data: {
            conversation_id: conversation.id,
            role: 'assistant',
            content: fullText,
            model: process.env.OPENAI_MODEL || 'gpt-4o',
            metadata: structured
          }
        });

        // Save AI Research Log (sources found)
        if (structured.sources && structured.sources.length > 0) {
          await prisma.aiResearchLog.create({
            data: {
              conversation_id: conversation.id,
              message_id: assistantMessage.id,
              query: promptText.substring(0, 255),
              sources: structured.sources
            }
          });
        }

        // Update conversation timestamp
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { updated_at: new Date() }
        });

        // Send final done event with structured data and message ID
        sendEvent('done', {
          conversationId: conversation.id,
          messageId: assistantMessage.id,
          structured,
          sources: structured.sources || []
        });

        res.end();
      },
      onError: (err) => {
        console.error('[Chat Route] Streaming error:', err);
        sendEvent('error', { message: err.message || 'An error occurred during AI analysis.' });
        res.end();
      }
    });

  } catch (error) {
    console.error('[Chat Route] Fatal error:', error);
    sendEvent('error', { message: 'Failed to process sports intelligence request.' });
    res.end();
  }
});

export default router;