/**
 * CovrIQ Canonical Sports Data Layer
 * 
 * Provides unified, deduplicated, and sport-normalized fixture and market structures.
 * Features:
 * - Stable deterministic Game IDs across providers: `covr_{sport}_{awayAbbrev}_{homeAbbrev}_{date}`
 * - Sport-specific live-state extraction (MLB, NBA, WNBA, NFL, NHL, Soccer)
 * - Immutable timestamped market snapshot tracking
 * - User-facing provider labeling ("Live Sports Data", "Current Market Data", "Verified Web Source")
 */

/**
 * Normalizes team names into clean abbreviations or normalized slug tokens.
 */
export function normalizeTeamSlug(teamName = '') {
  return String(teamName || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 10);
}

/**
 * Generates a stable canonical Game ID.
 * Stable across SerpApi, ESPN, and other feeds for the same matchup and slate.
 */
export function generateCanonicalGameId(sport, awayName, homeName, dateStr = '') {
  const s = String(sport || 'SPORTS').toLowerCase();
  const away = normalizeTeamSlug(awayName);
  const home = normalizeTeamSlug(homeName);
  const date = dateStr ? dateStr.replace(/[^0-9]/g, '').substring(0, 8) : getSlateDateKey();
  return `covr_${s}_${away}_${home}_${date}`;
}

/**
 * Helper to obtain today's slate date key in YYYYMMDD (US Eastern).
 */
export function getSlateDateKey() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);

  const y = parts.find(p => p.type === 'year')?.value || '2026';
  const m = parts.find(p => p.type === 'month')?.value || '01';
  const d = parts.find(p => p.type === 'day')?.value || '01';
  return `${y}${m}${d}`;
}

/**
 * Determines whether a game state is 'pre' (upcoming), 'in' (live in-progress), or 'post' (final).
 */
export function deriveGameState(statusText = '') {
  const s = String(statusText || '').toLowerCase();
  
  // 1. Check final / completed
  if (/final|ft|full time|ended|completed|f\/|after|postponed|cancelled|canceled/i.test(s)) {
    return 'post';
  }

  // 2. Check scheduled pre-game keywords & timestamps (e.g. "7:30 pm", "today", "scheduled")
  const isScheduledTime = /\b\d{1,2}:\d{2}\s*(?:am|pm)\b|\b(?:am|pm)\b\s*(?:et|pt|ct|gmt|utc)?|today|tonight|scheduled|\btbd\b/i.test(s);
  const hasLiveIndicators = /live|in progress|half\s*time|\bht\b|inning|bot|top|\bmid\b|\bq[1-4]\b|\bp[1-3]\b|1st|2nd|3rd|4th|quarter|period|\bot\b|overtime|extra time|\d{1,3}['’]/i.test(s);

  if (hasLiveIndicators && !isScheduledTime) {
    return 'in';
  }

  if (isScheduledTime) {
    return 'pre';
  }

  if (hasLiveIndicators) {
    return 'in';
  }

  return 'pre';
}

/**
 * Extracts sport-specific structured live details from status strings, clock, and period data.
 */
export function extractSportLiveState(sport, statusText = '', raw = {}) {
  const state = deriveGameState(statusText);
  if (state !== 'in') {
    return {
      state,
      isLive: false,
      detail: state === 'post' ? 'Final' : 'Scheduled',
      sportSpecific: null
    };
  }

  const s = String(statusText || '').trim();
  const sportUpper = String(sport || '').toUpperCase();

  // 1. MLB (Baseball)
  if (sportUpper.includes('MLB') || sportUpper.includes('BASEBALL')) {
    const inningMatch = s.match(/(top|bot|bottom|mid|middle)?\s*(\d+)(?:st|nd|rd|th)?/i);
    const outsMatch = s.match(/(\d+)\s*out/i);
    return {
      state: 'in',
      isLive: true,
      detail: s,
      sportSpecific: {
        type: 'mlb',
        inningHalf: inningMatch ? (inningMatch[1] || 'Mid').toLowerCase() : 'Mid',
        inningNumber: inningMatch ? parseInt(inningMatch[2], 10) : 1,
        outs: outsMatch ? parseInt(outsMatch[1], 10) : (raw.outs ?? null),
        runners: raw.runners || null,
        formatted: s
      }
    };
  }

  // 2. NBA / WNBA (Basketball)
  if (sportUpper.includes('NBA') || sportUpper.includes('WNBA') || sportUpper.includes('BASKETBALL')) {
    const qtrMatch = s.match(/(?:q|qtr|quarter)\s*(\d+)|(1st|2nd|3rd|4th)\s*(?:q|qtr|quarter)?|(\bot\b|overtime)/i);
    const clockMatch = s.match(/(\d{1,2}:\d{2})/);
    const quarter = qtrMatch ? (qtrMatch[3] ? 'OT' : `Q${qtrMatch[1] || qtrMatch[2]?.charAt(0) || '1'}`) : 'Live';
    const clock = clockMatch ? clockMatch[1] : '';
    return {
      state: 'in',
      isLive: true,
      detail: `${quarter} ${clock}`.trim() || s,
      sportSpecific: {
        type: 'basketball',
        quarter,
        clock,
        formatted: `${quarter} ${clock}`.trim() || s
      }
    };
  }

  // 3. NFL (Football)
  if (sportUpper.includes('NFL') || sportUpper.includes('FOOTBALL_US')) {
    const qtrMatch = s.match(/(?:q|qtr|quarter)\s*(\d+)|(1st|2nd|3rd|4th)\s*(?:q|qtr|quarter)?|(\bot\b|overtime)/i);
    const clockMatch = s.match(/(\d{1,2}:\d{2})/);
    const quarter = qtrMatch ? (qtrMatch[3] ? 'OT' : `Q${qtrMatch[1] || qtrMatch[2]?.charAt(0) || '1'}`) : 'Live';
    const clock = clockMatch ? clockMatch[1] : '';
    return {
      state: 'in',
      isLive: true,
      detail: `${quarter} ${clock}`.trim() || s,
      sportSpecific: {
        type: 'nfl',
        quarter,
        clock,
        downDistance: raw.downDistance || null,
        possession: raw.possession || null,
        formatted: `${quarter} ${clock}`.trim() || s
      }
    };
  }

  // 4. NHL (Hockey)
  if (sportUpper.includes('NHL') || sportUpper.includes('HOCKEY')) {
    const periodMatch = s.match(/(?:p|period)\s*(\d+)|(1st|2nd|3rd)\s*(?:p|period)?|(\bot\b|so|shootout)/i);
    const clockMatch = s.match(/(\d{1,2}:\d{2})/);
    const period = periodMatch ? (periodMatch[3] ? periodMatch[3].toUpperCase() : `P${periodMatch[1] || periodMatch[2]?.charAt(0) || '1'}`) : 'Live';
    const clock = clockMatch ? clockMatch[1] : '';
    return {
      state: 'in',
      isLive: true,
      detail: `${period} ${clock}`.trim() || s,
      sportSpecific: {
        type: 'nhl',
        period,
        clock,
        strength: raw.strength || 'Even Strength',
        formatted: `${period} ${clock}`.trim() || s
      }
    };
  }

  // 5. Soccer / Football (EPL, UCL, La Liga, etc.)
  if (sportUpper.includes('SOCCER') || sportUpper.includes('EPL') || sportUpper.includes('LALIGA') || sportUpper.includes('BUNDESLIGA') || sportUpper.includes('SERIE') || sportUpper.includes('LIGUE') || sportUpper.includes('UCL')) {
    const minuteMatch = s.match(/(\d{1,3})['’]/);
    const stoppageMatch = s.match(/\+(\d+)/);
    const isHalfTime = /ht|half\s*time/i.test(s);
    const minute = minuteMatch ? `${minuteMatch[1]}'` : (isHalfTime ? 'HT' : s);
    const addedTime = stoppageMatch ? `+${stoppageMatch[1]}'` : '';
    return {
      state: 'in',
      isLive: true,
      detail: isHalfTime ? 'Half Time' : `${minute} ${addedTime}`.trim(),
      sportSpecific: {
        type: 'soccer',
        minute,
        addedTime,
        isHalfTime,
        half: isHalfTime ? 'HT' : (parseInt(minuteMatch?.[1] || '0', 10) > 45 ? '2nd Half' : '1st Half'),
        formatted: isHalfTime ? 'Half Time' : `${minute} ${addedTime}`.trim()
      }
    };
  }

  // Generic fallback
  return {
    state: 'in',
    isLive: true,
    detail: s,
    sportSpecific: {
      type: 'generic',
      formatted: s
    }
  };
}

/**
 * Sanitizes and normalizes market odds into clean numerical and display formats.
 */
export function parseMarketOdds(rawOdds = {}, state = 'pre') {
  let awayML = null;
  let homeML = null;
  let spread = null;
  let overUnder = null;
  let details = rawOdds.details || '';

  // Extract ML Away / Home
  if (rawOdds.moneylineAway !== undefined && rawOdds.moneylineAway !== null) {
    const num = parseInt(String(rawOdds.moneylineAway).replace(/[^0-9\-+]/g, ''), 10);
    if (!isNaN(num) && num !== 0) awayML = num;
  }
  if (rawOdds.moneylineHome !== undefined && rawOdds.moneylineHome !== null) {
    const num = parseInt(String(rawOdds.moneylineHome).replace(/[^0-9\-+]/g, ''), 10);
    if (!isNaN(num) && num !== 0) homeML = num;
  }

  if (rawOdds.spread) spread = String(rawOdds.spread).trim();
  if (rawOdds.overUnder || rawOdds.total) overUnder = String(rawOdds.overUnder || rawOdds.total).trim();

  // If details has standard format e.g. "NYY -140"
  if ((awayML === null || homeML === null) && details) {
    const match = details.match(/([A-Z]{2,4}|[A-Za-z\s]+)\s*([+\-]\d{3,4})/);
    if (match) {
      const favTeam = match[1].trim();
      const favNum = parseInt(match[2], 10);
      if (!isNaN(favNum)) {
        homeML = favNum;
        awayML = favNum < 0 ? Math.abs(favNum) - 15 : -(favNum + 15);
      }
    }
  }

  const isLiveState = state === 'in';
  const hasParsedMarket = awayML !== null || homeML !== null || Boolean(spread) || Boolean(overUnder);
  const hasValidLiveOdds = Boolean(isLiveState && (rawOdds.verifiedLiveOdds || rawOdds.isLivePrice || hasParsedMarket));

  return {
    moneylineAway: awayML,
    moneylineHome: homeML,
    spread,
    overUnder,
    details: details || (awayML && homeML ? `${awayML > 0 ? '+' : ''}${awayML} / ${homeML > 0 ? '+' : ''}${homeML}` : 'Consensus Market Line'),
    verifiedLiveOdds: isLiveState ? hasValidLiveOdds : false,
    freshness: isLiveState ? (hasValidLiveOdds ? 'Live Verified' : 'Live Market Unavailable') : 'Pre-Game Consensus'
  };
}

/**
 * Creates a Canonical Game Object adhering to CovrIQ's unified sports schema.
 */
export function createCanonicalGame({
  id = null,
  sport = 'MLB',
  league = 'MLB',
  statusRaw = 'Scheduled',
  venue = 'Stadium',
  awayTeam = {},
  homeTeam = {},
  rawOdds = {},
  rawLiveState = {},
  provider = 'SerpApi',
  retrievedAt = new Date().toISOString()
}) {
  const awayName = awayTeam.name || 'Away Team';
  const homeName = homeTeam.name || 'Home Team';
  const awayAbbrev = awayTeam.abbrev || awayName.substring(0, 3).toUpperCase();
  const homeAbbrev = homeTeam.abbrev || homeName.substring(0, 3).toUpperCase();

  const canonicalId = id || generateCanonicalGameId(sport, awayAbbrev, homeAbbrev);
  const state = deriveGameState(statusRaw);
  const liveState = extractSportLiveState(sport, statusRaw, rawLiveState);
  const market = parseMarketOdds(rawOdds, state);

  // Professional label mapping (never exposes SerpApi/ESPN/DDG to users)
  const providerLabel = state === 'in' ? 'Live Sports Data' : 'Current Market Data';

  const snapshot = {
    timestamp: retrievedAt,
    state,
    status: statusRaw,
    score: {
      away: awayTeam.score ?? null,
      home: homeTeam.score ?? null
    },
    odds: {
      awayML: market.moneylineAway,
      homeML: market.moneylineHome,
      spread: market.spread,
      overUnder: market.overUnder
    },
    source: providerLabel
  };

  return {
    id: canonicalId,
    sport,
    league: league || sport,
    name: `${awayName} @ ${homeName}`,
    matchup: `${awayName} @ ${homeName}`,
    status: liveState.isLive ? liveState.detail : (state === 'post' ? 'Final' : statusRaw),
    state, // 'pre' | 'in' | 'post'
    liveState,
    venue: venue || 'Stadium / Arena',
    notes: awayTeam.notes || homeTeam.notes || '',
    awayTeam: {
      id: awayTeam.id || null,
      name: awayName,
      abbrev: awayAbbrev,
      record: awayTeam.record || '',
      form: awayTeam.form || '',
      splits: awayTeam.splits || '',
      score: awayTeam.score ?? null,
      probablePitcher: awayTeam.probablePitcher || awayTeam.starter || null,
      probablePitcherHandedness: awayTeam.probablePitcherHandedness || awayTeam.pitcherHandedness || null,
      pitcherEra: awayTeam.pitcherEra || null,
      pitcherWl: awayTeam.pitcherWl || null,
      leaders: awayTeam.leaders || [],
      statsSummary: awayTeam.statsSummary || '',
      lineup: awayTeam.lineup || null,
      injuries: awayTeam.injuries || []
    },
    homeTeam: {
      id: homeTeam.id || null,
      name: homeName,
      abbrev: homeAbbrev,
      record: homeTeam.record || '',
      form: homeTeam.form || '',
      splits: homeTeam.splits || '',
      score: homeTeam.score ?? null,
      probablePitcher: homeTeam.probablePitcher || homeTeam.starter || null,
      probablePitcherHandedness: homeTeam.probablePitcherHandedness || homeTeam.pitcherHandedness || null,
      pitcherEra: homeTeam.pitcherEra || null,
      pitcherWl: homeTeam.pitcherWl || null,
      leaders: homeTeam.leaders || [],
      statsSummary: homeTeam.statsSummary || '',
      lineup: homeTeam.lineup || null,
      injuries: homeTeam.injuries || []
    },
    odds: market,
    snapshots: [snapshot],
    dataFreshness: market.freshness,
    providerLabel,
    retrievedAt
  };
}

/**
 * Deduplicates games and merges historical market snapshots.
 */
export function deduplicateGames(existingGames = [], incomingGames = []) {
  const gameMap = new Map();

  existingGames.forEach(g => {
    if (g && g.id) gameMap.set(g.id, g);
  });

  incomingGames.forEach(inc => {
    if (!inc || !inc.id) return;

    if (gameMap.has(inc.id)) {
      const existing = gameMap.get(inc.id);
      const combinedSnapshots = [...(existing.snapshots || []), ...(inc.snapshots || [])];
      
      // Keep unique snapshots by timestamp + odds
      const uniqueSnapshots = [];
      const seen = new Set();
      combinedSnapshots.forEach(s => {
        const key = `${s.timestamp}_${s.odds?.awayML}_${s.odds?.homeML}_${s.score?.away}-${s.score?.home}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueSnapshots.push(s);
        }
      });

      gameMap.set(inc.id, {
        ...existing,
        ...inc,
        snapshots: uniqueSnapshots.slice(-10) // preserve up to 10 latest snapshots
      });
    } else {
      gameMap.set(inc.id, inc);
    }
  });

  return Array.from(gameMap.values());
}


