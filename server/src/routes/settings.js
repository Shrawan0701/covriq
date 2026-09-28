import { Router } from 'express';
import prisma from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { resolveSportContext } from '../config/sports.js';

const router = Router();

/**
 * GET /api/settings
 * Fetch user preferences.
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    let pref = await prisma.userPreference.findUnique({
      where: { user_id: req.user.id }
    });

    if (!pref) {
      pref = await prisma.userPreference.create({
        data: {
          user_id: req.user.id,
          theme: 'dark',
          odds_format: 'both',
          chat_font: 'serif',
          selected_sport: 'mlb',
          selected_league: null
        }
      });
    }

    return res.json({ preferences: pref });
  } catch (error) {
    console.error('[Settings Route] Fetch error:', error);
    return res.status(500).json({ error: 'Failed to fetch settings.' });
  }
});

/**
 * PUT /api/settings
 * Update user preferences.
 */
router.put('/', requireAuth, async (req, res) => {
  try {
    const { theme, odds_format, chat_font, selected_sport, selected_league } = req.body;

    const data = {};
    if (theme && ['dark', 'light'].includes(theme)) data.theme = theme;
    if (odds_format && ['american', 'decimal', 'both'].includes(odds_format)) data.odds_format = odds_format;
    if (chat_font && ['serif', 'sans'].includes(chat_font)) data.chat_font = chat_font;

    // Persist the explicit global sport/league via the centralized resolver so
    // invalid values are normalized to a safe default instead of erroring or
    // storing junk. A soccer selection without a valid league resolves to the
    // default soccer competition (epl).
    if (selected_sport !== undefined || selected_league !== undefined) {
      const ctx = resolveSportContext(
        selected_sport !== undefined ? selected_sport : undefined,
        selected_league !== undefined ? selected_league : undefined
      );
      data.selected_sport = ctx.sportId;
      data.selected_league = ctx.leagueId;
    }

    const updated = await prisma.userPreference.upsert({
      where: { user_id: req.user.id },
      update: data,
      create: {
        user_id: req.user.id,
        theme: theme || 'dark',
        odds_format: odds_format || 'both',
        chat_font: chat_font || 'serif',
        selected_sport: data.selected_sport || 'mlb',
        selected_league: data.selected_league ?? null
      }
    });

    return res.json({ preferences: updated, message: 'Settings saved successfully.' });
  } catch (error) {
    console.error('[Settings Route] Update error:', error);
    return res.status(500).json({ error: 'Failed to update settings.' });
  }
});

export default router;
