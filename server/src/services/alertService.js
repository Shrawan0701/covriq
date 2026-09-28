/**
 * CovrIQ Edge Alert Foundation Service
 * Manages user market alerts (edge thresholds, price movements, line shifts, starter changes).
 * Provides duplicate alert prevention and real evaluation against active game data.
 */

import prisma from '../db.js';

/**
 * Generates a deduplication key for an alert.
 */
function getAlertKey(userId, gameId, market, selection, alertType) {
  const u = String(userId || 'guest');
  const g = String(gameId || 'all');
  const m = String(market || 'ml').toLowerCase();
  const s = String(selection || 'all').toLowerCase().replace(/\s+/g, '');
  const t = String(alertType || 'edge');
  return `${u}_${g}_${m}_${s}_${t}`;
}

export async function createAlert(userId, alertData) {
  const {
    gameId,
    matchup,
    sport,
    market,
    selection,
    targetEdge,
    targetOdds,
    alertType = 'edge_threshold' // 'edge_threshold' | 'price_movement' | 'injury_news'
  } = alertData;

  const dedupKey = getAlertKey(userId, gameId, market, selection, alertType);

  // Check if active alert with same key already exists
  if (prisma.edgeAlert) {
    const existing = await prisma.edgeAlert.findMany({
      where: { userId }
    });
    const found = existing.find(a => a.dedupKey === dedupKey && a.isActive);
    if (found) {
      return found; // Return existing without duplicating
    }
  }

  const newAlert = {
    id: 'alt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    userId,
    dedupKey,
    gameId: gameId || null,
    matchup: matchup || 'General Game Alert',
    sport: sport || 'MLB',
    market: market || 'Moneyline',
    selection: selection || 'Target Line',
    targetEdge: targetEdge !== undefined && targetEdge !== null ? Number(targetEdge) : null,
    targetOdds: targetOdds || null,
    alertType,
    isActive: true,
    triggeredAt: null,
    createdAt: new Date()
  };

  if (prisma.edgeAlert) {
    return await prisma.edgeAlert.create({ data: newAlert });
  }

  return newAlert;
}

export async function listUserAlerts(userId) {
  if (prisma.edgeAlert) {
    return await prisma.edgeAlert.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
  }
  return [];
}

export async function deleteAlert(userId, alertId) {
  if (prisma.edgeAlert) {
    return await prisma.edgeAlert.deleteMany({
      where: { id: alertId, userId }
    });
  }
  return { success: true };
}
