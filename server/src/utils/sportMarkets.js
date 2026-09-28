/**
 * CovrIQ Sport-Specific Market Definitions & Terminology
 * 
 * Defines accurate, sport-specific betting markets, scoring units, and line labels:
 * - MLB → Runs, Moneyline, Run Line, Total Runs
 * - NBA / WNBA → Points, Moneyline, Point Spread, Total Points
 * - NFL → Points, Moneyline, Point Spread, Total Points
 * - NHL → Goals, Moneyline, Puck Line, Total Goals
 * - Soccer → Goals, 3-Way Moneyline (1X2), Asian Handicap / Goal Line, Total Goals, BTTS
 */

export const SPORT_MARKET_CONFIGS = {
  mlb: {
    sportId: 'mlb',
    sportName: 'MLB',
    scoringUnit: 'Runs',
    scoreLabel: 'Runs',
    moneylineName: 'Moneyline',
    spreadName: 'Run Line',
    spreadUnit: 'Runs',
    totalsName: 'Total Runs (O/U)',
    has3Way: false,
    hasBtts: false,
    totalsSelectionTemplate: (line, side) => `${side === 'under' ? 'Under' : 'Over'} ${line} Runs`,
    spreadSelectionTemplate: (team, spread) => `${team} ${Number(spread) > 0 ? '+' : ''}${spread} Runs`,
    moneylineSelectionTemplate: (team) => `${team} ML`
  },
  nba: {
    sportId: 'nba',
    sportName: 'NBA',
    scoringUnit: 'Points',
    scoreLabel: 'Points',
    moneylineName: 'Moneyline',
    spreadName: 'Point Spread',
    spreadUnit: 'Points',
    totalsName: 'Total Points (O/U)',
    has3Way: false,
    hasBtts: false,
    totalsSelectionTemplate: (line, side) => `${side === 'under' ? 'Under' : 'Over'} ${line} Points`,
    spreadSelectionTemplate: (team, spread) => `${team} ${Number(spread) > 0 ? '+' : ''}${spread} Points`,
    moneylineSelectionTemplate: (team) => `${team} ML`
  },
  wnba: {
    sportId: 'wnba',
    sportName: 'WNBA',
    scoringUnit: 'Points',
    scoreLabel: 'Points',
    moneylineName: 'Moneyline',
    spreadName: 'Point Spread',
    spreadUnit: 'Points',
    totalsName: 'Total Points (O/U)',
    has3Way: false,
    hasBtts: false,
    totalsSelectionTemplate: (line, side) => `${side === 'under' ? 'Under' : 'Over'} ${line} Points`,
    spreadSelectionTemplate: (team, spread) => `${team} ${Number(spread) > 0 ? '+' : ''}${spread} Points`,
    moneylineSelectionTemplate: (team) => `${team} ML`
  },
  nfl: {
    sportId: 'nfl',
    sportName: 'NFL',
    scoringUnit: 'Points',
    scoreLabel: 'Points',
    moneylineName: 'Moneyline',
    spreadName: 'Point Spread',
    spreadUnit: 'Points',
    totalsName: 'Total Points (O/U)',
    has3Way: false,
    hasBtts: false,
    totalsSelectionTemplate: (line, side) => `${side === 'under' ? 'Under' : 'Over'} ${line} Points`,
    spreadSelectionTemplate: (team, spread) => `${team} ${Number(spread) > 0 ? '+' : ''}${spread} Points`,
    moneylineSelectionTemplate: (team) => `${team} ML`
  },
  nhl: {
    sportId: 'nhl',
    sportName: 'NHL',
    scoringUnit: 'Goals',
    scoreLabel: 'Goals',
    moneylineName: 'Moneyline',
    spreadName: 'Puck Line',
    spreadUnit: 'Goals',
    totalsName: 'Total Goals (O/U)',
    has3Way: false,
    hasBtts: false,
    totalsSelectionTemplate: (line, side) => `${side === 'under' ? 'Under' : 'Over'} ${line} Goals`,
    spreadSelectionTemplate: (team, spread) => `${team} ${Number(spread) > 0 ? '+' : ''}${spread} Goals`,
    moneylineSelectionTemplate: (team) => `${team} ML`
  },
  soccer: {
    sportId: 'soccer',
    sportName: 'Soccer',
    scoringUnit: 'Goals',
    scoreLabel: 'Goals',
    moneylineName: '3-Way Moneyline (1X2)',
    spreadName: 'Asian Handicap / Goal Line',
    spreadUnit: 'Goals',
    totalsName: 'Total Goals (O/U)',
    has3Way: true,
    hasBtts: true,
    totalsSelectionTemplate: (line, side) => `${side === 'under' ? 'Under' : 'Over'} ${line} Goals`,
    spreadSelectionTemplate: (team, spread) => `${team} ${Number(spread) > 0 ? '+' : ''}${spread} Goals`,
    moneylineSelectionTemplate: (team) => `${team} ML`,
    drawSelectionTemplate: (matchup) => `Match Draw (Tie)`,
    bttsSelectionTemplate: (side) => `Both Teams to Score: ${side === 'no' ? 'No' : 'Yes'}`
  }
};

/**
 * Resolves the sport-specific market configuration for any sport or league identifier.
 */
export function getSportMarketConfig(sport = 'mlb') {
  const s = String(sport || 'mlb').toLowerCase();
  if (
    s.includes('soccer') ||
    s.includes('epl') ||
    s.includes('premier') ||
    s.includes('eng.1') ||
    s.includes('esp.1') ||
    s.includes('ger.1') ||
    s.includes('ita.1') ||
    s.includes('fra.1') ||
    s.includes('laliga') ||
    s.includes('la liga') ||
    s.includes('bundesliga') ||
    s.includes('serie') ||
    s.includes('ligue') ||
    s.includes('ucl') ||
    s.includes('uel') ||
    s.includes('uecl') ||
    s.includes('uefa') ||
    s.includes('champions') ||
    s.includes('europa') ||
    s.includes('conference') ||
    s.includes('mls') ||
    s.includes('fa cup') ||
    s.includes('copa') ||
    (s.includes('football') && !s.includes('nfl') && !s.includes('american'))
  ) {
    return SPORT_MARKET_CONFIGS.soccer;
  }
  if (s.includes('nhl') || s.includes('hockey')) {
    return SPORT_MARKET_CONFIGS.nhl;
  }
  if (s.includes('nfl') || s.includes('american football')) {
    return SPORT_MARKET_CONFIGS.nfl;
  }
  if (s.includes('wnba')) {
    return SPORT_MARKET_CONFIGS.wnba;
  }
  if (s.includes('nba') || s.includes('basketball')) {
    return SPORT_MARKET_CONFIGS.nba;
  }
  return SPORT_MARKET_CONFIGS.mlb;
}

/**
 * Helper to parse win-loss records e.g. "45-22", "12-4-6" -> win percentage (0 to 1).
 */
export function parseWinPercentage(recordStr = '') {
  if (!recordStr || typeof recordStr !== 'string') return null;
  const parts = recordStr.split('-').map(p => parseInt(p.trim(), 10));
  if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    const wins = parts[0];
    const losses = parts[1];
    const draws = parts[2] || 0;
    const total = wins + losses + draws;
    if (total > 0) {
      return (wins + 0.5 * draws) / total;
    }
  }
  return null;
}

/**
 * Generates a stable deterministic micro-variance (-0.8 to +0.8) based on string seed.
 * Ensures different games do not produce identical numbers while remaining 100% deterministic.
 */
export function getDeterministicVariance(seedStr = '') {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash << 5) - hash + seedStr.charCodeAt(i);
    hash |= 0;
  }
  const normalized = (Math.abs(hash) % 161) - 80; // range -80 to +80
  return normalized / 100; // range -0.80 to +0.80
}
