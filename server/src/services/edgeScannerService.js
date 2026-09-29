/**
 * CovrIQ Edge Scanner Engine
 * Real-time scanner across sportsboards detecting mathematical discrepancies,
 * positive expected value (+EV), and probability edges without hardcoded rankings.
 * 
 * Separates UPCOMING, LIVE, and COMPLETED games with strict PREMATCH vs LIVE quantitative evaluation.
 * Uses sport-specific market terminology, scoring units, and never uses generic placeholders.
 */

import { getSportsIntelligenceContext } from './intelligenceRouter.js';
import { evaluateGameMarket } from './quantitativeEngine.js';
import { resolveSportContext, buildResearchContext } from '../config/sports.js';
import { getSportMarketConfig } from '../utils/sportMarkets.js';

/**
 * Scans all active/upcoming games for a sport and generates evaluated market opportunities.
 *
 * @param {object} options
 * @param {string} options.sport - Sport identifier (mlb, nba, nfl, soccer, etc.)
 * @param {string} [options.league] - League identifier
 * @param {number} [options.minEdge=0] - Filter by minimum edge %
 * @param {string} [options.marketType='all'] - 'all' | 'moneyline' | 'spread' | 'totals'
 * @param {string} [options.state='all'] - 'all' | 'upcoming' | 'live' | 'completed'
 * @param {string} [options.sortBy='edge'] - 'edge' | 'ev' | 'confidence' | 'odds'
 * @returns {Promise<object>} { scannedCount, opportunities, upcomingOpportunities, liveOpportunities, completedOpportunities, provider, retrievedAt }
 */
export async function scanBoardForEdges({
  sport = 'mlb',
  league = null,
  minEdge = 0,
  marketType = 'all',
  state = 'all',
  sortBy = 'edge'
} = {}) {
  const sportCtx = resolveSportContext(sport, league);
  const researchCtx = buildResearchContext({ sport: sportCtx.sportId, league: sportCtx.leagueId });

  const intelligence = await getSportsIntelligenceContext('today games schedule odds', sportCtx.aiSport, researchCtx);
  const games = (intelligence.allGames || []).filter(game => game.state !== 'post');
  const provider = intelligence.provider || 'Live Sports Data';
  const retrievedAt = new Date().toISOString();

  const allOpportunities = [];

  for (const game of games) {
    const away = game.awayTeam || {};
    const home = game.homeTeam || {};
    const gameState = game.state || 'pre';
    const status = game.status || 'Upcoming';
    const liveState = game.liveState || {};
    const sportConfig = getSportMarketConfig(game.sport || sportCtx.sportId);

    const gameSportLabel = game.sport || sportCtx.label;
    const gameLeagueLabel = game.league || sportCtx.aiLeagueLabel;

    // 1. Moneyline: Away Selection
    if (marketType === 'all' || marketType === 'moneyline') {
      const evalAway = evaluateGameMarket(game, 'moneyline', 'away');
      if (evalAway) {
        const meetsEdge = evalAway.edge !== null ? (evalAway.edge >= minEdge) : true;
        if (meetsEdge) {
          allOpportunities.push({
            id: `edge_${game.id}_ml_away`,
            gameId: game.id,
            matchup: `${away.name} @ ${home.name}`,
            sport: gameSportLabel,
            league: gameLeagueLabel,
            status,
            state: gameState,
            liveStateDetail: liveState.detail || null,
            venue: game.venue,
            market: sportConfig.moneylineName,
            selection: sportConfig.moneylineSelectionTemplate(away.name),
            side: 'away',
            americanOdds: evalAway.americanOdds,
            decimalOdds: evalAway.decimalOdds,
            impliedProb: evalAway.impliedProb,
            modelProb: evalAway.modelProb,
            breakEvenProb: evalAway.breakEvenProb,
            edge: evalAway.edge,
            expectedValue: evalAway.expectedValue,
            confidence: evalAway.confidence,
            marketAvailable: evalAway.marketAvailable,
            reason: evalAway.reason || null,
            modelType: evalAway.modelType,
            keyFactors: evalAway.keyFactors,
            provider,
            dataFreshness: game.dataFreshness || (gameState === 'in' ? 'Live Verified' : 'Today Pre-Game'),
            retrievedAt
          });
        }
      }
    }

    // 2. Moneyline: Home Selection
    if (marketType === 'all' || marketType === 'moneyline') {
      const evalHome = evaluateGameMarket(game, 'moneyline', 'home');
      if (evalHome) {
        const meetsEdge = evalHome.edge !== null ? (evalHome.edge >= minEdge) : true;
        if (meetsEdge) {
          allOpportunities.push({
            id: `edge_${game.id}_ml_home`,
            gameId: game.id,
            matchup: `${away.name} @ ${home.name}`,
            sport: gameSportLabel,
            league: gameLeagueLabel,
            status,
            state: gameState,
            liveStateDetail: liveState.detail || null,
            venue: game.venue,
            market: sportConfig.moneylineName,
            selection: sportConfig.moneylineSelectionTemplate(home.name),
            side: 'home',
            americanOdds: evalHome.americanOdds,
            decimalOdds: evalHome.decimalOdds,
            impliedProb: evalHome.impliedProb,
            modelProb: evalHome.modelProb,
            breakEvenProb: evalHome.breakEvenProb,
            edge: evalHome.edge,
            expectedValue: evalHome.expectedValue,
            confidence: evalHome.confidence,
            marketAvailable: evalHome.marketAvailable,
            reason: evalHome.reason || null,
            modelType: evalHome.modelType,
            keyFactors: evalHome.keyFactors,
            provider,
            dataFreshness: game.dataFreshness || (gameState === 'in' ? 'Live Verified' : 'Today Pre-Game'),
            retrievedAt
          });
        }
      }
    }

    // 3. Soccer 3-Way Moneyline: Draw Selection (where applicable)
    if (sportConfig.has3Way && (marketType === 'all' || marketType === 'moneyline')) {
      const evalDraw = evaluateGameMarket(game, 'moneyline', 'draw');
      if (evalDraw && evalDraw.marketAvailable) {
        const meetsEdge = evalDraw.edge !== null ? (evalDraw.edge >= minEdge) : true;
        if (meetsEdge) {
          allOpportunities.push({
            id: `edge_${game.id}_ml_draw`,
            gameId: game.id,
            matchup: `${away.name} @ ${home.name}`,
            sport: gameSportLabel,
            league: gameLeagueLabel,
            status,
            state: gameState,
            liveStateDetail: liveState.detail || null,
            venue: game.venue,
            market: sportConfig.moneylineName,
            selection: sportConfig.drawSelectionTemplate ? sportConfig.drawSelectionTemplate(game.matchup) : 'Draw (Tie)',
            side: 'draw',
            americanOdds: evalDraw.americanOdds,
            decimalOdds: evalDraw.decimalOdds,
            impliedProb: evalDraw.impliedProb,
            modelProb: evalDraw.modelProb,
            breakEvenProb: evalDraw.breakEvenProb,
            edge: evalDraw.edge,
            expectedValue: evalDraw.expectedValue,
            confidence: evalDraw.confidence,
            marketAvailable: evalDraw.marketAvailable,
            reason: evalDraw.reason || null,
            modelType: evalDraw.modelType,
            keyFactors: evalDraw.keyFactors,
            provider,
            dataFreshness: game.dataFreshness || (gameState === 'in' ? 'Live Verified' : 'Today Pre-Game'),
            retrievedAt
          });
        }
      }
    }

    // 4. Spread Opportunity (Only if verified spread line actually exists on the game)
    if (game.odds?.spread && (marketType === 'all' || marketType === 'spread')) {
      const spreadVal = game.odds.spread;
      const evalSpread = evaluateGameMarket(game, 'spread', 'home');
      if (evalSpread && evalSpread.marketAvailable) {
        allOpportunities.push({
          id: `edge_${game.id}_spread_home`,
          gameId: game.id,
          matchup: `${away.name} @ ${home.name}`,
          sport: gameSportLabel,
          league: gameLeagueLabel,
          status,
          state: gameState,
          liveStateDetail: liveState.detail || null,
          venue: game.venue,
          market: sportConfig.spreadName,
          selection: sportConfig.spreadSelectionTemplate(home.name, spreadVal),
          side: 'home',
          americanOdds: evalSpread.americanOdds,
          decimalOdds: evalSpread.decimalOdds,
          impliedProb: evalSpread.impliedProb,
          modelProb: evalSpread.modelProb,
          breakEvenProb: evalSpread.breakEvenProb,
          edge: evalSpread.edge,
          expectedValue: evalSpread.expectedValue,
          confidence: evalSpread.confidence,
          marketAvailable: true,
          modelType: evalSpread.modelType,
          keyFactors: evalSpread.keyFactors,
          provider,
          dataFreshness: game.dataFreshness || (gameState === 'in' ? 'Live Verified' : 'Today Pre-Game'),
          retrievedAt
        });
      }
    }

    // 5. Totals Opportunity (Only if verified over/under line actually exists on the game)
    if (game.odds?.overUnder && (marketType === 'all' || marketType === 'totals')) {
      const totalLine = game.odds.overUnder;
      const evalTotals = evaluateGameMarket(game, 'totals', 'over');
      if (evalTotals && evalTotals.marketAvailable) {
        allOpportunities.push({
          id: `edge_${game.id}_tot_over`,
          gameId: game.id,
          matchup: `${away.name} @ ${home.name}`,
          sport: gameSportLabel,
          league: gameLeagueLabel,
          status,
          state: gameState,
          liveStateDetail: liveState.detail || null,
          venue: game.venue,
          market: sportConfig.totalsName,
          selection: sportConfig.totalsSelectionTemplate(totalLine, 'over'),
          side: 'over',
          americanOdds: evalTotals.americanOdds,
          decimalOdds: evalTotals.decimalOdds,
          impliedProb: evalTotals.impliedProb,
          modelProb: evalTotals.modelProb,
          breakEvenProb: evalTotals.breakEvenProb,
          edge: evalTotals.edge,
          expectedValue: evalTotals.expectedValue,
          confidence: evalTotals.confidence,
          marketAvailable: true,
          modelType: evalTotals.modelType,
          keyFactors: evalTotals.keyFactors,
          provider,
          dataFreshness: game.dataFreshness || (gameState === 'in' ? 'Live Verified' : 'Today Pre-Game'),
          retrievedAt
        });
      }
    }
  }

  // Sort opportunities
  const sortComparator = (a, b) => {
    // Available markets sorted above unavailable ones
    if (a.marketAvailable !== b.marketAvailable) return a.marketAvailable ? -1 : 1;
    if (sortBy === 'ev') return (b.expectedValue || 0) - (a.expectedValue || 0);
    if (sortBy === 'confidence') return (b.confidence || 0) - (a.confidence || 0);
    if (sortBy === 'odds') return (b.decimalOdds || 0) - (a.decimalOdds || 0);
    return (b.edge || 0) - (a.edge || 0);
  };

  allOpportunities.sort(sortComparator);

  // Separate by state
  const upcomingOpportunities = allOpportunities.filter(o => o.state === 'pre');
  const liveOpportunities = allOpportunities.filter(o => o.state === 'in');
  const completedOpportunities = allOpportunities.filter(o => o.state === 'post');

  let filteredOpportunities = allOpportunities;
  if (state === 'upcoming') filteredOpportunities = upcomingOpportunities;
  else if (state === 'live') filteredOpportunities = liveOpportunities;
  else if (state === 'completed') filteredOpportunities = completedOpportunities;

  return {
    scannedCount: games.length,
    opportunitiesCount: filteredOpportunities.length,
    opportunities: filteredOpportunities,
    upcomingOpportunities,
    liveOpportunities,
    completedOpportunities,
    provider,
    retrievedAt,
    sources: intelligence.sources || []
  };
}

