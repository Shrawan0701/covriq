/**
 * CovrIQ Multi-Sport Live Intelligence Engine
 * Fallback live data provider supporting MLB, NBA, WNBA, NFL, NHL, and Soccer competitions.
 * Normalizes live and upcoming events directly into the Canonical Game schema.
 */

import { createCanonicalGame, getSlateDateKey } from './canonicalSportsData.js';

const LEAGUE_CONFIG = {
  MLB: {
    endpoint: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
    sportName: 'MLB',
    statLabel: 'Starting Pitchers & ERA',
    defaultMarket: 'Moneyline'
  },
  NBA: {
    endpoint: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
    sportName: 'NBA',
    statLabel: 'Starting 5 & Top Scorers',
    defaultMarket: 'Point Spread'
  },
  NFL: {
    endpoint: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
    sportName: 'NFL',
    statLabel: 'Starting QBs & Red Zone Stats',
    defaultMarket: 'Spread & Total'
  },
  NHL: {
    endpoint: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard',
    sportName: 'NHL',
    statLabel: 'Starting Goalies & GAA',
    defaultMarket: 'Moneyline / Puckline'
  },
  SOCCER_EPL: {
    endpoint: 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard',
    sportName: 'Premier League',
    statLabel: 'Starting XI & Goalscorers',
    defaultMarket: 'Both Teams To Score (BTTS)'
  },
  SOCCER_UCL: {
    endpoint: 'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard',
    sportName: 'UEFA Champions League',
    statLabel: 'Starting XI & Attack xG',
    defaultMarket: 'Over 2.5 Goals'
  },
  SOCCER_LALIGA: {
    endpoint: 'https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard',
    sportName: 'La Liga',
    statLabel: 'Starting Lineups & Clean Sheets',
    defaultMarket: '3-Way Moneyline'
  },
  WNBA: {
    endpoint: 'https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/scoreboard',
    sportName: 'WNBA',
    statLabel: 'Starting Five & Top Scorers',
    defaultMarket: 'Point Spread'
  },
  SOCCER_BUNDESLIGA: {
    endpoint: 'https://site.api.espn.com/apis/site/v2/sports/soccer/ger.1/scoreboard',
    sportName: 'Bundesliga',
    statLabel: 'Starting XI & Goalscorers',
    defaultMarket: 'Both Teams To Score (BTTS)'
  },
  SOCCER_SERIE_A: {
    endpoint: 'https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/scoreboard',
    sportName: 'Serie A',
    statLabel: 'Starting XI & Attack xG',
    defaultMarket: 'Over 1.5 Goals'
  },
  SOCCER_LIGUE_1: {
    endpoint: 'https://site.api.espn.com/apis/site/v2/sports/soccer/fra.1/scoreboard',
    sportName: 'Ligue 1',
    statLabel: 'Starting XI & Clean Sheets',
    defaultMarket: '3-Way Moneyline'
  },
  SOCCER_UEL: {
    endpoint: 'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.europa/scoreboard',
    sportName: 'UEFA Europa League',
    statLabel: 'Starting XI & Attack xG',
    defaultMarket: 'Over 2.5 Goals'
  },
  SOCCER_UECL: {
    endpoint: 'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.uecl/scoreboard',
    sportName: 'UEFA Conference League',
    statLabel: 'Starting XI & Goalscorers',
    defaultMarket: 'Over 2.5 Goals'
  }
};

function getEasternDateStr(offsetDays = 0) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);

  const y = parts.find(p => p.type === 'year').value;
  const m = parts.find(p => p.type === 'month').value;
  const d = parts.find(p => p.type === 'day').value;

  const dateObj = new Date(`${y}-${m}-${d}T12:00:00`);
  dateObj.setDate(dateObj.getDate() + offsetDays);

  const yy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

/**
 * Fetches live scoreboard feed and normalizes to Canonical Game schema.
 */
export async function fetchLiveSchedule(sport = 'MLB') {
  const config = LEAGUE_CONFIG[sport];
  if (!config) {
    console.warn(`[LiveSportsService] No live endpoint configured for '${sport}' - returning empty slate.`);
    return [];
  }
  const todayStr = getEasternDateStr(0);

  const fetchWithDate = async (dateStr) => {
    const url = dateStr ? `${config.endpoint}?dates=${dateStr}` : config.endpoint;
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        signal: AbortSignal.timeout(4000)
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.events || [];
    } catch (err) {
      console.warn(`[LiveSportsService] Failed to fetch live ${sport} scoreboard:`, err.message);
      return [];
    }
  };

  let events = await fetchWithDate(todayStr);
  if (events.length === 0) {
    events = await fetchWithDate(null);
  }

  const parsedGames = events.map(ev => {
    const comp = ev.competitions?.[0] || {};
    const competitors = comp.competitors || [];
    const away = competitors.find(c => c.homeAway === 'away') || competitors[1] || {};
    const home = competitors.find(c => c.homeAway === 'home') || competitors[0] || {};

    const awayProbable = away.probables?.[0];
    const homeProbable = home.probables?.[0];

    const awayEra = awayProbable?.statistics?.find(s => s.name === 'ERA')?.displayValue || null;
    const homeEra = homeProbable?.statistics?.find(s => s.name === 'ERA')?.displayValue || null;

    const awayWl = awayProbable?.athlete?.records?.[0]?.summary || '';
    const homeWl = homeProbable?.athlete?.records?.[0]?.summary || '';

    const awayHand = awayProbable?.athlete?.position?.abbreviation || (awayProbable?.athlete?.jersey ? 'RHP' : null);
    const homeHand = homeProbable?.athlete?.position?.abbreviation || (homeProbable?.athlete?.jersey ? 'RHP' : null);

    const formatLeaders = (competitor) => {
      const list = [];
      (competitor.leaders || []).forEach(cat => {
        const catName = cat.displayName || cat.name || '';
        const topAthlete = cat.leaders?.[0];
        if (topAthlete && topAthlete.athlete?.displayName) {
          const val = topAthlete.displayValue ? ` (${topAthlete.displayValue})` : '';
          list.push(`${catName}: ${topAthlete.athlete.displayName}${val}`);
        }
      });
      return list;
    };

    const awayLeaders = formatLeaders(away);
    const homeLeaders = formatLeaders(home);

    const awayRecordSummary = away.records?.[0]?.summary || '';
    const homeRecordSummary = home.records?.[0]?.summary || '';

    const awaySplits = away.records?.slice(1).map(r => `${r.name || 'Split'}: ${r.summary}`).join(' • ') || '';
    const homeSplits = home.records?.slice(1).map(r => `${r.name || 'Split'}: ${r.summary}`).join(' • ') || '';

    const oddsObj = comp.odds?.[0] || {};
    const details = oddsObj.details || '';
    const overUnder = oddsObj.overUnder || null;
    const venue = comp.venue?.fullName || (home.team?.displayName ? `${home.team.displayName} Stadium` : 'Home Arena');
    const time = ev.status?.type?.shortDetail || 'Scheduled';
    const notes = comp.notes?.[0]?.headline || comp.headlines?.[0]?.description || '';

    const awayLeader = away.leaders?.[0]?.leaders?.[0]?.athlete?.displayName || null;
    const homeLeader = home.leaders?.[0]?.leaders?.[0]?.athlete?.displayName || null;

    const awayScore = away.score !== undefined && away.score !== null ? parseInt(away.score, 10) : null;
    const homeScore = home.score !== undefined && home.score !== null ? parseInt(home.score, 10) : null;

    return createCanonicalGame({
      sport: config.sportName,
      league: config.sportName,
      statusRaw: time,
      venue,
      awayTeam: {
        id: away.team?.id,
        name: away.team?.displayName || 'Away Team',
        abbrev: away.team?.abbreviation || 'AWAY',
        record: awayRecordSummary,
        splits: awaySplits,
        score: awayScore,
        probablePitcher: awayProbable?.athlete?.displayName || awayLeader || null,
        probablePitcherHandedness: awayHand,
        pitcherEra: awayEra,
        pitcherWl: awayWl,
        leaders: awayLeaders,
        notes
      },
      homeTeam: {
        id: home.team?.id,
        name: home.team?.displayName || 'Home Team',
        abbrev: home.team?.abbreviation || 'HOME',
        record: homeRecordSummary,
        splits: homeSplits,
        score: homeScore,
        probablePitcher: homeProbable?.athlete?.displayName || homeLeader || null,
        probablePitcherHandedness: homeHand,
        pitcherEra: homeEra,
        pitcherWl: homeWl,
        leaders: homeLeaders,
        notes
      },
      rawOdds: {
        details,
        overUnder,
        spread: oddsObj.spread || null,
        moneylineAway: oddsObj.awayTeamOdds?.moneyLine || null,
        moneylineHome: oddsObj.homeTeamOdds?.moneyLine || null
      },
      provider: 'Verified Live Feed',
      retrievedAt: new Date().toISOString()
    });
  });

  const notYetFinal = parsedGames.filter(g => g.state !== 'post');
  return notYetFinal.length > 0 ? notYetFinal : parsedGames;
}

/**
 * Searches DuckDuckGo for live sports odds, starting lineups, pitch reports, and weather.
 */
export async function searchDuckDuckGo(query) {
  try {
    const encoded = encodeURIComponent(query);
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encoded}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(3500)
    });

    if (!res.ok) return [];

    const html = await res.text();
    const results = [];
    const snippetRegex = /<a class="result__snippet[^>]*>([\s\S]*?)<\/a>/gi;

    let match;
    let count = 0;
    while ((match = snippetRegex.exec(html)) !== null && count < 4) {
      const cleanSnippet = match[1].replace(/<[^>]+>/g, '').trim();
      if (cleanSnippet.length > 20) {
        results.push(cleanSnippet);
        count++;
      }
    }

    return results;
  } catch (err) {
    return [];
  }
}

/**
 * Matches user query against live game schedule across all leagues.
 */
export function findMatchingGame(games, prompt) {
  if (!games || games.length === 0) return null;
  const p = prompt.toLowerCase();

  const candidates = [];

  for (const g of games) {
    const away = g.awayTeam.name.toLowerCase();
    const home = g.homeTeam.name.toLowerCase();
    const awayAbbr = g.awayTeam.abbrev.toLowerCase();
    const homeAbbr = g.homeTeam.abbrev.toLowerCase();

    const awayTokens = away.split(' ');
    const homeTokens = home.split(' ');

    const awayMatched = awayTokens.some(t => t.length > 2 && p.includes(t)) || p.includes(awayAbbr);
    const homeMatched = homeTokens.some(t => t.length > 2 && p.includes(t)) || p.includes(homeAbbr);

    if (awayMatched || homeMatched) {
      candidates.push(g);
    }
  }

  if (candidates.length > 0) {
    return candidates.find(g => g.state !== 'post') || candidates[0];
  }

  return games.find(g => g.state !== 'post') || games[0];
}

/**
 * Lightweight sport-safety filter: drops web search snippets that are clearly
 * about a DIFFERENT sport than the user's selected sport.
 */
export function filterSnippetsBySport(snippets, forbiddenTerms = []) {
  if (!snippets || snippets.length === 0) return snippets;
  const terms = forbiddenTerms.filter(Boolean).map(t => t.toLowerCase());
  if (terms.length === 0) return snippets;
  return snippets.filter(sn => {
    const lower = String(sn || '').toLowerCase();
    let hits = 0;
    for (const term of terms) {
      if (term && lower.indexOf(term) !== -1) hits++;
      if (hits >= 2) return false;
    }
    return true;
  });
}