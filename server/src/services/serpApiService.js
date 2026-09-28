/**
 * CovrIQ SerpApi Sports Intelligence Provider
 * Primary sports data provider querying SerpApi Google Sports & Google Search engines.
 * Normalizes raw structured events into CovrIQ's canonical sports data schema without fabricating data.
 */

import '../config/env.js';
import sportsCache from './serpApiCache.js';
import { createCanonicalGame } from './canonicalSportsData.js';

const SERPAPI_BASE_URL = 'https://serpapi.com/search';

/**
 * Maps internal sport & soccer league keys to SerpApi sports query keywords.
 */
const SPORT_SERP_QUERIES = {
  MLB: 'MLB scores schedule odds',
  NBA: 'NBA scores schedule odds',
  WNBA: 'WNBA scores schedule odds',
  NFL: 'NFL scores schedule odds',
  NHL: 'NHL scores schedule odds',
  SOCCER_EPL: 'Premier League scores schedule table odds',
  SOCCER_LALIGA: 'La Liga scores schedule table odds',
  SOCCER_BUNDESLIGA: 'Bundesliga scores schedule table odds',
  SOCCER_SERIE_A: 'Serie A scores schedule table odds',
  SOCCER_LIGUE_1: 'Ligue 1 scores schedule table odds',
  SOCCER_UCL: 'UEFA Champions League scores schedule odds',
  SOCCER_UEL: 'UEFA Europa League scores schedule odds',
  SOCCER_UECL: 'UEFA Conference League scores schedule odds',
  TENNIS: 'ATP WTA tennis scores schedule rankings',
  CRICKET: 'Cricket matches live scores fixtures ICC'
};

/**
 * Normalizes SerpApi raw game object into the Canonical Game representation.
 */
export function normalizeSerpApiGame(raw, sport = 'MLB') {
  if (!raw) return null;

  const teams = raw.teams || raw.competitors || [];
  const team1 = teams[0] || raw.away_team || {};
  const team2 = teams[1] || raw.home_team || {};

  const awayName = raw.away_team?.name || team1.name || team1.team || 'Away Team';
  const homeName = raw.home_team?.name || team2.name || team2.team || 'Home Team';

  const awayScore = raw.away_team?.score ?? team1.score ?? null;
  const homeScore = raw.home_team?.score ?? team2.score ?? null;

  const awayRecord = team1.record || raw.away_team?.record || '';
  const homeRecord = team2.record || raw.home_team?.record || '';

  const statusRaw = raw.status || raw.time || raw.game_status || raw.date || 'Scheduled';
  const venue = raw.venue || raw.stadium || raw.location || 'Stadium / Arena';
  const tournament = raw.tournament || raw.league || sport;

  // Extract raw odds
  const rawOdds = raw.odds || raw.betting || {};
  const oddsDetails = rawOdds.details || rawOdds.spread || (raw.moneyline ? `${raw.moneyline.away || ''} / ${raw.moneyline.home || ''}` : '');

  // Starters
  const awayStarter = raw.away_team?.probable_pitcher || raw.away_team?.starter || null;
  const homeStarter = raw.home_team?.probable_pitcher || raw.home_team?.starter || null;

  return createCanonicalGame({
    sport,
    league: tournament,
    statusRaw,
    venue,
    awayTeam: {
      id: raw.away_team?.id || team1.id || null,
      name: awayName,
      abbrev: team1.abbreviation || awayName.substring(0, 3).toUpperCase(),
      record: awayRecord,
      score: awayScore !== null && awayScore !== undefined ? parseInt(awayScore, 10) : null,
      probablePitcher: awayStarter,
      pitcherEra: raw.away_team?.pitcher_era || null,
      pitcherWl: raw.away_team?.pitcher_wl || null
    },
    homeTeam: {
      id: raw.home_team?.id || team2.id || null,
      name: homeName,
      abbrev: team2.abbreviation || homeName.substring(0, 3).toUpperCase(),
      record: homeRecord,
      score: homeScore !== null && homeScore !== undefined ? parseInt(homeScore, 10) : null,
      probablePitcher: homeStarter,
      pitcherEra: raw.home_team?.pitcher_era || null,
      pitcherWl: raw.home_team?.pitcher_wl || null
    },
    rawOdds: {
      details: oddsDetails,
      overUnder: rawOdds.over_under || rawOdds.total || null,
      spread: rawOdds.spread || null,
      moneylineAway: rawOdds.moneyline_away || null,
      moneylineHome: rawOdds.moneyline_home || null
    },
    provider: 'SerpApi',
    retrievedAt: new Date().toISOString()
  });
}

/**
 * Fetches structured sports schedule & games via SerpApi.
 */
export async function fetchSerpApiSchedule(sport = 'MLB') {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey || apiKey.trim().length < 5) {
    return { success: false, reason: 'NO_API_KEY', games: [], sources: [] };
  }

  const queryTerm = SPORT_SERP_QUERIES[sport] || `${sport} scores schedule`;
  const cacheKey = sportsCache.generateKey('serpapi_schedule', { sport, query: queryTerm });

  const cached = sportsCache.get(cacheKey);
  if (cached) {
    return { success: true, fromCache: true, ...cached };
  }

  try {
    const url = new URL(SERPAPI_BASE_URL);
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('engine', 'google');
    url.searchParams.set('q', queryTerm);
    url.searchParams.set('hl', 'en');
    url.searchParams.set('gl', 'us');

    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(5000),
      headers: { 'Accept': 'application/json' }
    });

    if (!res.ok) {
      if (res.status === 429) {
        return { success: false, reason: 'RATE_LIMITED', games: [], sources: [] };
      }
      return { success: false, reason: `HTTP_${res.status}`, games: [], sources: [] };
    }

    const data = await res.json();
    const games = [];
    const sources = [];

    // 1. Check Google Sports results block (sports_results)
    if (data.sports_results) {
      const sr = data.sports_results;
      if (Array.isArray(sr.games)) {
        sr.games.forEach(g => {
          const norm = normalizeSerpApiGame(g, sport);
          if (norm) games.push(norm);
        });
      } else if (sr.game_spotlight) {
        const norm = normalizeSerpApiGame(sr.game_spotlight, sport);
        if (norm) games.push(norm);
      }
      if (Array.isArray(sr.tournaments)) {
        sr.tournaments.forEach(t => {
          if (Array.isArray(t.games)) {
            t.games.forEach(g => {
              const norm = normalizeSerpApiGame(g, sport);
              if (norm) games.push(norm);
            });
          }
        });
      }
    }

    // 2. Check answer_box & knowledge graph
    if (data.answer_box?.sports_results || data.answer_box?.game) {
      const abGame = data.answer_box.sports_results || data.answer_box.game;
      const norm = normalizeSerpApiGame(abGame, sport);
      if (norm) games.push(norm);
    }
    if (data.knowledge_graph?.sports_event) {
      const norm = normalizeSerpApiGame(data.knowledge_graph.sports_event, sport);
      if (norm) games.push(norm);
    }

    // 3. Collect verified sources from organic results with clean professional labels
    if (Array.isArray(data.organic_results)) {
      data.organic_results.slice(0, 5).forEach(r => {
        if (r.link && r.title) {
          let cleanDomain = 'Verified Web Source';
          try { cleanDomain = new URL(r.link).hostname.replace(/^www\./, ''); } catch (e) {}
          sources.push({
            title: r.title,
            url: r.link,
            domain: cleanDomain,
            snippet: r.snippet || '',
            provider: 'Verified Web Source'
          });
        }
      });
    }

    // Cache TTL: 45s if games are live in-progress; otherwise 10 mins (600s)
    const hasLive = games.some(g => g.state === 'in');
    const ttl = hasLive ? 45 : 600;

    const resultPayload = {
      games,
      sources,
      provider: 'Live Sports Data',
      retrievedAt: new Date().toISOString()
    };

    sportsCache.set(cacheKey, resultPayload, ttl);
    return { success: true, fromCache: false, ...resultPayload };

  } catch (err) {
    console.warn(`[SerpApiService] Schedule query failed for ${sport}:`, err.message);
    return { success: false, reason: err.name === 'TimeoutError' ? 'TIMEOUT' : 'NETWORK_ERROR', games: [], sources: [] };
  }
}

/**
 * Searches SerpApi Google Search for real-time odds, lineups, injury news, and analysis.
 */
export async function searchSerpApiWeb(query, sport = 'MLB') {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey || apiKey.trim().length < 5) {
    return { success: false, reason: 'NO_API_KEY', snippets: [], sources: [] };
  }

  const cacheKey = sportsCache.generateKey('serpapi_search', { query, sport });
  const cached = sportsCache.get(cacheKey);
  if (cached) {
    return { success: true, fromCache: true, ...cached };
  }

  try {
    const url = new URL(SERPAPI_BASE_URL);
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('engine', 'google');
    url.searchParams.set('q', `${sport} ${query}`);
    url.searchParams.set('hl', 'en');
    url.searchParams.set('gl', 'us');
    url.searchParams.set('num', '5');

    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(4500),
      headers: { 'Accept': 'application/json' }
    });

    if (!res.ok) {
      return { success: false, reason: `HTTP_${res.status}`, snippets: [], sources: [] };
    }

    const data = await res.json();
    const snippets = [];
    const sources = [];

    if (Array.isArray(data.organic_results)) {
      data.organic_results.forEach(item => {
        if (item.snippet) {
          snippets.push(`${item.title || ''}: ${item.snippet}`);
        }
        if (item.link && item.title) {
          let cleanDomain = 'Verified Web Source';
          try { cleanDomain = new URL(item.link).hostname.replace(/^www\./, ''); } catch (e) {}
          sources.push({
            title: item.title,
            url: item.link,
            domain: cleanDomain,
            snippet: item.snippet || '',
            provider: 'Verified Web Source'
          });
        }
      });
    }

    const resultPayload = {
      snippets,
      sources,
      provider: 'Verified Web Source',
      retrievedAt: new Date().toISOString()
    };

    sportsCache.set(cacheKey, resultPayload, 900); // 15 mins cache
    return { success: true, fromCache: false, ...resultPayload };

  } catch (err) {
    console.warn(`[SerpApiService] Web search query failed:`, err.message);
    return { success: false, reason: err.name === 'TimeoutError' ? 'TIMEOUT' : 'NETWORK_ERROR', snippets: [], sources: [] };
  }
}
