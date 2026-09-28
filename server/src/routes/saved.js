import { Router } from 'express';
import prisma from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { calculateCLV, calculatePayout, americanToDecimalPrecise, americanToDecimal } from '../utils/odds.js';

const router = Router();

/**
 * Helper to compute performance metrics strictly from real stored items.
 */
function toJsonSafe(value) {
  if (value === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(value, (_key, val) => val === undefined ? null : val));
  } catch (e) {
    return {};
  }
}

function normalizeSavedContent(content) {
  if (!content) return {};
  if (typeof content === 'string') {
    try {
      return toJsonSafe(JSON.parse(content));
    } catch (e) {
      return {};
    }
  }
  if (typeof content === 'object') return toJsonSafe(content);
  return {};
}

function computePerformanceSummary(items = []) {
  let totalBets = 0;
  let won = 0;
  let lost = 0;
  let push = 0;
  let voidCount = 0;
  let pending = 0;

  let totalStaked = 0;
  let totalProfit = 0;
  let totalEdge = 0;
  let edgeCount = 0;
  let totalCLV = 0;
  let clvCount = 0;

  const bySport = {};
  const byMarket = {};
  const byBetState = {
    prematch: { total: 0, won: 0, lost: 0, push: 0, staked: 0, profit: 0, totalEdge: 0, edgeCount: 0 },
    live: { total: 0, won: 0, lost: 0, push: 0, staked: 0, profit: 0, totalEdge: 0, edgeCount: 0 }
  };

  items.forEach(item => {
    const c = normalizeSavedContent(item.content);
    const result = (item.result || c.result || 'pending').toLowerCase();
    const sport = (c.gameHeader?.sport || item.sport || 'Other').toUpperCase();
    const market = c.marketCard?.market || item.market || 'Moneyline';
    const stake = Number(item.stake || c.stake) || 0;
    const profit = Number(item.profit ?? c.profit ?? 0);
    const statusText = String(c.gameHeader?.status || '');
    const stateAtBet = String(c.stateAtBet || c.state || (statusText.toUpperCase().includes('LIVE') ? 'in' : 'pre')).toLowerCase() === 'in' ? 'live' : 'prematch';

    totalBets++;
    if (result === 'won') won++;
    else if (result === 'lost') lost++;
    else if (result === 'push') push++;
    else if (result === 'void') voidCount++;
    else pending++;

    if (stake > 0) {
      totalStaked += stake;
      totalProfit += profit;
    }

    // Edge tracking
    const rawEdge = parseFloat(String(c.marketCard?.edge || item.edge || c.edgeAtBet || '').replace(/[^0-9.\-]/g, ''));
    if (!isNaN(rawEdge)) {
      totalEdge += rawEdge;
      edgeCount++;
    }

    // CLV tracking
    const rawCLV = Number(item.clv_percent ?? c.clv_percent);
    if (!isNaN(rawCLV) && rawCLV !== null) {
      totalCLV += rawCLV;
      clvCount++;
    }

    // Sport aggregation
    if (!bySport[sport]) bySport[sport] = { total: 0, won: 0, lost: 0, profit: 0 };
    bySport[sport].total++;
    if (result === 'won') bySport[sport].won++;
    if (result === 'lost') bySport[sport].lost++;
    bySport[sport].profit += profit;

    // Market aggregation
    if (!byMarket[market]) byMarket[market] = { total: 0, won: 0, lost: 0 };
    byMarket[market].total++;
    if (result === 'won') byMarket[market].won++;
    if (result === 'lost') byMarket[market].lost++;

    // Bet State aggregation (PREMATCH vs LIVE)
    const targetState = byBetState[stateAtBet] || byBetState.prematch;
    targetState.total++;
    if (result === 'won') targetState.won++;
    if (result === 'lost') targetState.lost++;
    if (result === 'push') targetState.push++;
    if (stake > 0) {
      targetState.staked += stake;
      targetState.profit += profit;
    }
    if (!isNaN(rawEdge)) {
      targetState.totalEdge += rawEdge;
      targetState.edgeCount++;
    }
  });

  const gradedTotal = won + lost;
  const winRate = gradedTotal > 0 ? Math.round((won / gradedTotal) * 1000) / 10 : null;
  const roi = totalStaked > 0 ? Math.round((totalProfit / totalStaked) * 10000) / 100 : null;
  const avgEdge = edgeCount > 0 ? Math.round((totalEdge / edgeCount) * 100) / 100 : null;
  const avgCLV = clvCount > 0 ? Math.round((totalCLV / clvCount) * 100) / 100 : null;

  // Compute breakdown for Prematch vs Live
  const prematchGraded = byBetState.prematch.won + byBetState.prematch.lost;
  const prematchWinRate = prematchGraded > 0 ? Math.round((byBetState.prematch.won / prematchGraded) * 1000) / 10 : null;
  const prematchROI = byBetState.prematch.staked > 0 ? Math.round((byBetState.prematch.profit / byBetState.prematch.staked) * 10000) / 100 : null;
  const prematchAvgEdge = byBetState.prematch.edgeCount > 0 ? Math.round((byBetState.prematch.totalEdge / byBetState.prematch.edgeCount) * 100) / 100 : null;

  const liveGraded = byBetState.live.won + byBetState.live.lost;
  const liveWinRate = liveGraded > 0 ? Math.round((byBetState.live.won / liveGraded) * 1000) / 10 : null;
  const liveROI = byBetState.live.staked > 0 ? Math.round((byBetState.live.profit / byBetState.live.staked) * 10000) / 100 : null;
  const liveAvgEdge = byBetState.live.edgeCount > 0 ? Math.round((byBetState.live.totalEdge / byBetState.live.edgeCount) * 100) / 100 : null;

  return {
    totalBets,
    won,
    lost,
    push,
    voidCount,
    pending,
    winRate: winRate !== null ? `${winRate}%` : 'N/A',
    winRateNum: winRate,
    totalStaked: Math.round(totalStaked * 100) / 100,
    totalProfit: Math.round(totalProfit * 100) / 100,
    roi: roi !== null ? `${roi >= 0 ? '+' : ''}${roi}%` : 'N/A',
    roiNum: roi,
    avgEdge: avgEdge !== null ? `${avgEdge >= 0 ? '+' : ''}${avgEdge}%` : 'N/A',
    avgCLV: avgCLV !== null ? `${avgCLV >= 0 ? '+' : ''}${avgCLV}%` : 'N/A',
    bySport,
    byMarket,
    byBetState: {
      prematch: {
        total: byBetState.prematch.total,
        won: byBetState.prematch.won,
        lost: byBetState.prematch.lost,
        winRate: prematchWinRate !== null ? `${prematchWinRate}%` : 'N/A',
        staked: Math.round(byBetState.prematch.staked * 100) / 100,
        profit: Math.round(byBetState.prematch.profit * 100) / 100,
        roi: prematchROI !== null ? `${prematchROI >= 0 ? '+' : ''}${prematchROI}%` : 'N/A',
        avgEdge: prematchAvgEdge !== null ? `+${prematchAvgEdge}%` : 'N/A'
      },
      live: {
        total: byBetState.live.total,
        won: byBetState.live.won,
        lost: byBetState.live.lost,
        winRate: liveWinRate !== null ? `${liveWinRate}%` : 'N/A',
        staked: Math.round(byBetState.live.staked * 100) / 100,
        profit: Math.round(byBetState.live.profit * 100) / 100,
        roi: liveROI !== null ? `${liveROI >= 0 ? '+' : ''}${liveROI}%` : 'N/A',
        avgEdge: liveAvgEdge !== null ? `+${liveAvgEdge}%` : 'N/A'
      }
    }
  };
}

/**
 * GET /api/saved
 * List all saved betting items/picks with bet journal metadata.
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const items = await prisma.savedItem.findMany({
      where: { user_id: req.user.id },
      orderBy: { created_at: 'desc' }
    });

    const performance = computePerformanceSummary(items);
    return res.json({ items, performance });
  } catch (error) {
    console.error('[Saved Route] Fetch error:', error);
    return res.status(500).json({ error: 'Failed to fetch saved items.' });
  }
});

/**
 * GET /api/saved/performance
 * Returns detailed performance analytics calculated strictly from real stored data.
 */
router.get('/performance', requireAuth, async (req, res) => {
  try {
    const items = await prisma.savedItem.findMany({
      where: { user_id: req.user.id }
    });

    const performance = computePerformanceSummary(items);
    return res.json({ performance });
  } catch (error) {
    console.error('[Saved Route] Performance error:', error);
    return res.status(500).json({ error: 'Failed to compute performance analytics.' });
  }
});

/**
 * POST /api/saved
 * Save a new pick with preserved immutable snapshot of game state and model calculations.
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const {
      type = 'bet_pick',
      title,
      content,
      stake = null,
      result = 'pending',
      notes = ''
    } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required.' });
    }

    const normalizedContent = normalizeSavedContent(content);

    // Preserve exact immutable snapshot at time of bet placement
    const stateAtBet = normalizedContent.state || (String(normalizedContent.gameHeader?.status || '').toLowerCase().includes('live') ? 'in' : 'pre');
    const oddsAtBet = normalizedContent.marketCard?.americanOdds || '+100';
    const modelProbAtBet = normalizedContent.marketCard?.aiEstimatedProb || null;
    const edgeAtBet = normalizedContent.marketCard?.edge || null;
    const evAtBet = normalizedContent.marketCard?.expectedValue || null;
    const confidenceAtBet = normalizedContent.verdict?.confidence || null;

    const enrichedContent = {
      ...normalizedContent,
      stateAtBet,
      oddsAtBet,
      modelProbAtBet,
      edgeAtBet,
      evAtBet,
      confidenceAtBet,
      provider: 'Live Sports Data',
      savedAt: new Date().toISOString()
    };

    const saved = await prisma.savedItem.create({
      data: {
        user_id: req.user.id,
        type,
        title: title.trim(),
        content: {
          ...enrichedContent,
          stake: stake ? Number(stake) : null,
          result: result || 'pending',
          notes: notes || null
        }
      }
    });

    return res.status(201).json({ item: saved, message: 'Saved to your Bet Journal!' });
  } catch (error) {
    console.error('[Saved Route] Create error:', error);
    return res.status(500).json({ error: 'Failed to save item.' });
  }
});

/**
 * PATCH /api/saved/:id
 * Update bet journal entry: grade result (won/lost/push/void), record closing odds for CLV, update stake/notes.
 */
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { result, stake, closing_odds, notes } = req.body;

    const existing = await prisma.savedItem.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Saved item not found.' });
    }

    if (existing.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized to update this item.' });
    }

    const currentContent = existing.content || {};
    // Entry odds are preserved immutably from oddsAtBet or original marketCard
    const entryOdds = currentContent.oddsAtBet || currentContent.marketCard?.americanOdds || '+100';

    // Calculate CLV if closing odds provided
    let clvData = { clvPercent: null, beatClosingLine: null };
    if (closing_odds) {
      clvData = calculateCLV(entryOdds, closing_odds, true);
    }

    // Calculate profit/payout if stake and result provided
    const numericStake = stake !== undefined && stake !== null ? Number(stake) : (existing.stake || 0);
    let profit = 0;
    let totalReturn = 0;

    if (numericStake > 0) {
      const payoutCalc = calculatePayout(numericStake, entryOdds, true);
      if (result === 'won') {
        profit = payoutCalc.profit;
        totalReturn = payoutCalc.totalPayout;
      } else if (result === 'lost') {
        profit = -numericStake;
        totalReturn = 0;
      } else if (result === 'push' || result === 'void') {
        profit = 0;
        totalReturn = numericStake;
      }
    }

    const updatedContent = {
      ...currentContent,
      result: result !== undefined ? result : existing.result,
      stake: numericStake > 0 ? numericStake : null,
      closing_odds: closing_odds || currentContent.closing_odds || null,
      clv_percent: clvData.clvPercent ?? currentContent.clv_percent ?? null,
      beat_closing_line: clvData.beatClosingLine ?? currentContent.beat_closing_line ?? null,
      profit,
      total_return: totalReturn,
      notes: notes !== undefined ? notes : (existing.notes || '')
    };

    const updated = await prisma.savedItem.update({
      where: { id },
      data: {
        content: updatedContent
      }
    });

    return res.json({ item: updated, message: 'Bet updated successfully!' });
  } catch (error) {
    console.error('[Saved Route] Update error:', error);
    return res.status(500).json({ error: 'Failed to update bet entry.' });
  }
});

/**
 * DELETE /api/saved/:id
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const item = await prisma.savedItem.findUnique({
      where: { id }
    });

    if (!item) {
      return res.status(404).json({ error: 'Saved item not found.' });
    }

    if (item.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized to delete this item.' });
    }

    await prisma.savedItem.delete({
      where: { id }
    });

    return res.json({ message: 'Saved item removed.' });
  } catch (error) {
    console.error('[Saved Route] Delete error:', error);
    return res.status(500).json({ error: 'Failed to delete saved item.' });
  }
});

export default router;
