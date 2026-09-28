/**
 * CovrIQ Supported Sports / Leagues (application configuration).
 *
 * This is NOT a sports-data provider or database. It is the hardcoded set of
 * sports and leagues CovrIQ intentionally supports, used to:
 *   - persist/validate the user's selected global sport (user_preferences)
 *   - stamp the sport/league context onto conversations at creation
 *   - filter "My Chats" by the conversation's stored sport/league
 *   - build the explicit SPORT/LEAGUE research context passed to the AI engine
 *
 * Identifiers follow the agreed naming:
 *   top-level: mlb | nfl | nba | wnba | nhl | soccer
 *   soccer competitions: epl | laliga | bundesliga | serie_a | ligue_1 | ucl | uel | uecl
 */

// Top-level American sports (leaf nodes - no separate competition).
export const TOP_LEVEL_SPORTS = {
  mlb: {
    type: 'mlb',
    label: 'MLB',
    aiSport: 'MLB',
    aiSportLabel: 'MLB',
    aiLeagueLabel: 'MLB'
  },
  nfl: {
    type: 'nfl',
    label: 'NFL',
    aiSport: 'NFL',
    aiSportLabel: 'NFL',
    aiLeagueLabel: 'NFL'
  },
  nba: {
    type: 'nba',
    label: 'NBA',
    aiSport: 'NBA',
    aiSportLabel: 'NBA',
    aiLeagueLabel: 'NBA'
  },
  wnba: {
    type: 'wnba',
    label: 'WNBA',
    aiSport: 'WNBA',
    aiSportLabel: 'WNBA',
    aiLeagueLabel: 'WNBA'
  },
  nhl: {
    type: 'nhl',
    label: 'NHL',
    aiSport: 'NHL',
    aiSportLabel: 'NHL',
    aiLeagueLabel: 'NHL'
  },
  // Football/Soccer is the only top-level entry with an additional competition
  // level. Internally we ALWAYS use sport = "soccer" (never "football") so it
  // can never be confused with NFL.
  soccer: {
    type: 'soccer',
    label: 'Football',
    aiSport: 'SOCCER_EPL',
    aiSportLabel: 'soccer',
    aiLeagueLabel: 'Football'
  }
};

// Soccer / Football competitions.
export const SOCCER_LEAGUES = {
  epl: { label: 'Premier League', aiSport: 'SOCCER_EPL' },
  laliga: { label: 'La Liga', aiSport: 'SOCCER_LALIGA' },
  bundesliga: { label: 'Bundesliga', aiSport: 'SOCCER_BUNDESLIGA' },
  serie_a: { label: 'Serie A', aiSport: 'SOCCER_SERIE_A' },
  ligue_1: { label: 'Ligue 1', aiSport: 'SOCCER_LIGUE_1' },
  ucl: { label: 'UEFA Champions League', aiSport: 'SOCCER_UCL' },
  uel: { label: 'UEFA Europa League', aiSport: 'SOCCER_UEL' },
  uecl: { label: 'UEFA Conference League', aiSport: 'SOCCER_UECL' }
};

export const DEFAULT_SPORT = 'mlb';
export const DEFAULT_SOCCER_LEAGUE = 'epl';
/**
 * Sport-specific analytical detail used to keep every AI/research operation
 * locked to the user's selected sport. Maps the internal top-level sport id
 * (mlb | nfl | nba | wnba | nhl | soccer) to the terminology that is allowed
 * for that sport and the cross-sport terms that MUST NOT be injected into it.
 *
 * This is presentation/orchestration config for the AI pipeline - it is NOT a
 * sports-data provider and does not touch the database.
 */
export const SPORT_ANALYTICS = {
  mlb: {
    label: 'MLB',
    allowed: [
      'starting pitcher', 'bullpen', 'ERA', 'WHIP', 'strikeouts', 'runs',
      'park factors', 'moneyline', 'run line', 'totals', 'OPS', 'batting average',
      'home runs', 'saves', 'on-base percentage'
    ],
    forbidden: [
      'goaltender', 'save percentage', 'quarterback', 'passing yards',
      'rebounds', 'assists', 'xG', 'puck line', 'power play', 'offensive rating'
    ],
    markets: ['Moneyline', 'Run Line', 'Totals', 'Player Props']
  },
  nfl: {
    label: 'NFL',
    allowed: [
      'quarterback', 'passing', 'rushing', 'receiving', 'spread', 'total',
      'moneyline', 'injuries', 'offensive/defensive matchup', 'red zone',
      'turnovers', 'key numbers (3, 7)'
    ],
    forbidden: [
      'pitcher', 'ERA', 'bullpen', 'rebounds', 'puck line', 'goaltender', 'xG',
      'offensive rating'
    ],
    markets: ['Point Spread', 'Totals', 'Moneyline', 'Player Props']
  },
  nba: {
    label: 'NBA',
    allowed: [
      'pace', 'offensive rating', 'defensive rating', 'points', 'rebounds',
      'assists', 'usage', 'injuries', 'spread', 'moneyline', 'totals', 'player props'
    ],
    forbidden: [
      'pitcher', 'ERA', 'bullpen', 'quarterback', 'goaltender', 'puck line', 'xG'
    ],
    markets: ['Point Spread', 'Totals', 'Moneyline', 'Player Props']
  },
  wnba: {
    label: 'WNBA',
    allowed: [
      'points', 'rebounds', 'assists', 'usage', 'pace', 'offensive rating',
      'defensive rating', 'player props', 'spreads', 'totals', 'moneyline',
      'injuries', 'rotations'
    ],
    forbidden: [
      'pitcher', 'ERA', 'bullpen', 'strikeouts', 'baseball innings', 'quarterback',
      'goaltender', 'puck line'
    ],
    markets: ['Point Spread', 'Totals', 'Moneyline', 'Player Props']
  },
  nhl: {
    label: 'NHL',
    allowed: [
      'goaltender', 'save percentage', 'GAA', 'shots', 'power play',
      'penalty kill', 'goals', 'puck line', 'moneyline', 'totals', 'faceoffs'
    ],
    forbidden: [
      'pitcher', 'ERA', 'bullpen', 'quarterback', 'rebounds', 'offensive rating'
    ],
    markets: ['Moneyline', 'Puck Line', 'Totals', 'Player Props']
  },
  soccer: {
    label: 'Football',
    allowed: [
      'form', 'xG', 'goals', 'shots', 'possession', 'injuries', 'home/away',
      '1X2', 'Asian handicap', 'totals', 'player props', 'clean sheets', 'BTTS',
      'expected goals'
    ],
    forbidden: [
      'pitcher', 'ERA', 'bullpen', 'quarterback', 'goaltender', 'offensive rating',
      'puck line', 'rebounds'
    ],
    markets: ['1X2', 'Asian Handicap', 'Totals', 'BTTS', 'Player Props']
  }
};

/**
 * Display/search label keyed by the internal `aiSport` code returned from
 * resolveSportContext(). Used to build sport-qualified research queries
 * (e.g. "WNBA best bets tonight" / "UEFA Champions League best bets tonight").
 */
export const AI_SPORT_SEARCH = {
  MLB: 'MLB',
  NFL: 'NFL',
  NBA: 'NBA',
  WNBA: 'WNBA',
  NHL: 'NHL',
  SOCCER_EPL: 'Premier League',
  SOCCER_LALIGA: 'La Liga',
  SOCCER_BUNDESLIGA: 'Bundesliga',
  SOCCER_SERIE_A: 'Serie A',
  SOCCER_LIGUE_1: 'Ligue 1',
SOCCER_UCL: 'UEFA Champions League',
  SOCCER_UEL: 'UEFA Europa League',
  SOCCER_UECL: 'UEFA Conference League'
};
/** Valid top-level sport identifiers. */
export const VALID_SPORTS = Object.keys(TOP_LEVEL_SPORTS);

/** Valid soccer competition identifiers (only meaningful when sport === 'soccer'). */
export const VALID_SOCCER_LEAGUES = Object.keys(SOCCER_LEAGUES);

/** True if the given sport id is one of the supported top-level sports. */
export function isValidSport(sportId) {
  return Boolean(sportId) && Object.prototype.hasOwnProperty.call(TOP_LEVEL_SPORTS, sportId);
}

/** True if the given league id is a supported soccer competition. */
export function isValidSoccerLeague(leagueId) {
  return Boolean(leagueId) && Object.prototype.hasOwnProperty.call(SOCCER_LEAGUES, leagueId);
}

/**
 * Resolves an internal sport id (+ optional soccer league id) into a normalized
 * context object used across the backend (persistence, AI, live research).
 *
 * Returns a stable shape regardless of input:
 *   {
 *     sportId,            // 'mlb' | 'nfl' | ... | 'soccer'
 *     leagueId,           // soccer competition id or null
 *     aiSport,            // internal aiService/live code, e.g. 'MLB' | 'SOCCER_EPL'
 *     aiSportLabel,       // 'SPORT:' label for the AI research context
 *     aiLeagueLabel       // 'LEAGUE:' label for the AI research context
 *     label               // human label for status/toasts ('MLB', 'Premier League')
 *   }
 */
export function resolveSportContext(sportId, leagueId = null) {
  // Guard: invalid/missing -> safe application default (MLB) so nothing else has
  // to null-check. The frontend always sends the explicit selected sport, so
  // once the user is on WNBA/NFL/NBA/NHL/etc. this is never reached for them.
  const sport = isValidSport(sportId) ? TOP_LEVEL_SPORTS[sportId] : TOP_LEVEL_SPORTS[DEFAULT_SPORT];

  let leagueIdResolved = null;
  let league;

  if (sport.type === 'soccer' && isValidSoccerLeague(leagueId)) {
    leagueIdResolved = leagueId;
    league = SOCCER_LEAGUES[leagueId];
  }

  const aiSport = league ? league.aiSport : sport.aiSport;
  const label = league ? league.label : sport.label;
  const aiLeagueLabel = sport.type === 'soccer'
    ? (league ? league.label : DEFAULT_SOCCER_LEAGUE)
    : sport.aiLeagueLabel;

  return {
sportId: sport.type,
    leagueId: leagueIdResolved,
    aiSport,
    aiSportLabel: sport.aiSportLabel,
    aiLeagueLabel,
    label
  };
}
/**
 * Builds the explicit "SPORT / LEAGUE" research-context block injected into the
 * AI system prompt so the model knows what sport the user is researching and
 * prioritizes it (unless the user explicitly asks about another sport).
 *
 * Includes:
 *   - the exact Sport / League under analysis
 *   - a hard instruction NOT to substitute another sport
 *   - a terminology guardrail (allowed + forbidden terms for the selected sport)
 */
export function buildSportContextInstruction(sportId, leagueId = null) {
  const ctx = resolveSportContext(sportId, leagueId);
  const analytics = SPORT_ANALYTICS[ctx.sportId] || SPORT_ANALYTICS.mlb;
  const searchName = AI_SPORT_SEARCH[ctx.aiSport] || ctx.label;
  const sportLine = ctx.sportId === 'soccer' ? 'Football' : searchName;
  const leagueLine = ctx.sportId === 'soccer' ? (ctx.leagueId ? ctx.aiLeagueLabel : 'Football (N/A)') : searchName;
  const allowedLine = analytics.allowed.length > 0 ? `Use ${searchName} terminology in every market, prop and analysis: ${analytics.allowed.join(', ')}.` : '';
  const forbiddenLine = analytics.forbidden.length > 0 ? `Do NOT use or introduce ${searchName}-irrelevant vocabulary such as: ${analytics.forbidden.join(', ')}.` : '';

  return `\n\nCURRENT SPORTS CONTEXT (MANDATORY)\nSport: ${sportLine}\nLeague: ${leagueLine}\n\nIMPORTANT:\n- You are answering specifically within the selected ${searchName} context.\n- Do not substitute another sport. Do not analyze, cite, or reference another sport's games, teams, players, or standings unless the user explicitly asks about that other sport.\n- Never silently inherit assumptions from any other sport just because a value is missing.\n${forbiddenLine}\n${allowedLine}\nKeep all analysis scoped to ${searchName} and its terminology.`;
}

/**
 * Centralized, sport-aware research context used by the AI + research/search
 * pipeline. Every consumer (web research, status copy, prompt construction)
 * reads the SAME source of truth so the selected sport/league can never be lost
 * between the frontend and the model.
 *
 * Returns:
 *   { sportId, leagueId, aiSport, aiSportLabel, aiLeagueLabel, label,
 *     searchName, searchQuery, allowed, forbidden, markets, sportCtxBlock }
 */
export function buildResearchContext({ sport, league = null, userQuery = '' } = {}) {
  const ctx = resolveSportContext(sport, league);
  const analytics = SPORT_ANALYTICS[ctx.sportId] || SPORT_ANALYTICS.mlb;
  const searchName = AI_SPORT_SEARCH[ctx.aiSport] || ctx.label;
  const query = [searchName, String(userQuery || '').trim()].filter(Boolean).join(' ');
  return {
    ...ctx,
    searchName,
    searchQuery: query,
    allowed: analytics.allowed || [],
    forbidden: analytics.forbidden || [],
    markets: analytics.markets || ['Moneyline', 'Totals'],
    sportCtxBlock: buildSportContextInstruction(ctx.sportId, ctx.leagueId)
  };
}
    