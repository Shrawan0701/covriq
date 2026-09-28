/**
 * CovrIQ Supported Sports / Leagues (frontend application configuration).
 *
 * Mirrors server/src/config/sports.js - CovrIQ intentionally supports ONLY the
 * sports/leagues listed here. This is UI configuration, not a sports database.
 *
 * Identifiers:
 *   top-level: mlb | nfl | nba | wnba | nhl | soccer
 *   soccer competitions: epl | laliga | bundesliga | serie_a | ligue_1 | ucl | uel | uecl
 */

export const DEFAULT_SPORT = 'mlb';
export const DEFAULT_SOCCER_LEAGUE = 'epl';

/** Top-level sports shown in the sidebar selector. "Football" = soccer. */
export const SPORTS = [
  { id: 'mlb', label: 'MLB', emoji: '⚾' },
  { id: 'nfl', label: 'NFL', emoji: '🏈' },
  { id: 'nba', label: 'NBA', emoji: '🏀' },
  { id: 'wnba', label: 'WNBA', emoji: '🏀' },
  { id: 'nhl', label: 'NHL', emoji: '🏒' },
  { id: 'soccer', label: 'Football', emoji: '⚽' }
];

/** Soccer / Football competitions (only shown when sport === 'soccer'). */
export const SOCCER_LEAGUES = [
  { id: 'epl', label: 'Premier League' },
  { id: 'laliga', label: 'La Liga' },
  { id: 'bundesliga', label: 'Bundesliga' },
  { id: 'serie_a', label: 'Serie A' },
  { id: 'ligue_1', label: 'Ligue 1' },
  { id: 'ucl', label: 'UEFA Champions League' },
  { id: 'uel', label: 'UEFA Europa League' },
  { id: 'uecl', label: 'UEFA Conference League' }
];

export function getSportById(id) {
  return SPORTS.find(s => s.id === id) || null;
}

export function getSoccerLeagueById(id) {
  return SOCCER_LEAGUES.find(l => l.id === id) || null;
}

/** Friendly display label for the current selection (e.g. "MLB", "Premier League"). */
export function getDisplayLabel(sportId = DEFAULT_SPORT, leagueId = null) {
  const sport = getSportById(sportId);
  if (!sport) return 'MLB';
  if (sport.id === 'soccer' && leagueId) {
    return getSoccerLeagueById(leagueId)?.label || sport.label;
  }
  return sport.label;
}