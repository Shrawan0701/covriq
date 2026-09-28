import { DEFAULT_SPORT } from './sports.js';

/**
 * CovrIQ SPORT / LEAGUE UI CONFIGURATION (single source of truth).
 *
 * Centralized sport-aware UI copy: mode greetings, quick-prompt chips, chat
 * input placeholders, descriptions and analysis vocabulary. Every Discover
 * Mode resolves its contextual strings through getSportUIConfig() so nothing
 * else hardcodes "MLB", "NBA", "Soccer", "pitcher", "QB"... as UI copy.
 *
 * Pure presentation config - does NOT touch SportContext, providers, DB, or
 * sports-data architecture. Changing the global sport updates every consumer
 * instantly because components re-render off the SportContext state.
 */

// Per-mode prompt/greeting templates. `{X}` is replaced by the selected
// sport's display name ("MLB") or, for football, the selected competition.
const MODE_TEMPLATES = {
  ai_picks: {
    greeting: "How can I help you find today's sharpest {X} plays?",
    chips: [
      { label: '{slateLabel}', prompt: "Give me your top picks for today's {slatePhrase} with edge and EV." },
      { label: 'Best {X} Bets', prompt: 'What are your best {X} {betsNoun} picks today?' },
      { label: '{matchChip}', prompt: '{matchPrompt}' },
      { label: '{props}', prompt: "Find the sharpest {X} player props on today's card." }
    ]
  },
  value_finder: {
    greeting: "Where is today's most mispriced {X} line?",
    chips: [
      { label: 'Best {X} Value', prompt: "Find today's best {X} value on the board." },
      { label: 'Mispriced Lines', prompt: 'Which {X} lines look mispriced today?' },
      { label: 'Strongest Edges', prompt: 'Find the strongest {X} edges against market implied probability.' },
      { label: 'Compare Prices', prompt: "Compare today's {X} prices across markets." }
    ]
  },
  upset_finder: {
    greeting: 'Which {X} underdogs have the best upset potential?',
    chips: [
      { label: "Today's Dog", prompt: "Find today's highest-value live underdog (+115 or longer) worth backing." },
      { label: '{X} Upset', prompt: '{upsetPrompt}' },
      { label: 'Strongest Underdogs', prompt: "Find today's strongest {X} underdogs." },
      { label: 'Biggest Spoiler', prompt: 'Which big underdog (+150+) is statistically most likely to pull the upset tonight?' }
    ]
  },
  compare_bets: {
    greeting: 'Which {X} side of the line is the sharper play?',
    chips: [
      { label: 'Two {X} Sides', prompt: 'Compare these two {X} sides head-to-head and tell me which is sharper.' },
      { label: '{compareChip}', prompt: '{comparePrompt}' },
      { label: 'Value Line', prompt: 'Which {lineWord} has more value today?' },
      { label: 'Player Props', prompt: 'Compare these {X} player props and rank them by edge.' }
    ]
  },
  parlay_lab: {
    greeting: 'What correlated {X} legs should we stack?',
    chips: [
      { label: '{X} 3-Leg Parlay', prompt: 'Build a 3-leg {X} parlay with positive correlation and show the compound price.' },
      { label: 'Same-Game Build', prompt: "Construct a same-game {X} parlay for tonight's featured matchup with correlated legs." },
      { label: 'Correlated Legs', prompt: "Find correlated {X} legs across today's slate with the strongest combined edge." },
      { label: 'Balanced Build', prompt: 'Build a balanced {X} parlay mixing favorites and totals.' }
    ]
  },
  deep_analysis: {
    greeting: 'What should we model under the hood today?',
    chips: [
      { label: '{deepChipA}', prompt: '{deepPromptA}' },
      { label: '{deepChipB}', prompt: '{deepPromptB}' },
      { label: 'Regression Model', prompt: 'Deep dive this game with regression, splits, and situational trends before a call.' },
      { label: '{deepChipC}', prompt: '{deepExample}' }
    ]
  },
  edge_scanner: {
    greeting: "Scanning today's {X} board for quantitative edges...",
    chips: [
      { label: 'Scan {X} Board', prompt: 'Scan all available {X} games today and list the highest EV opportunities.' },
      { label: 'Top Moneyline Edges', prompt: 'Find the highest probability edge on the moneyline across today\'s {X} card.' },
      { label: 'Spread Discrepancies', prompt: 'Scan today\'s {X} point spreads for mathematical mispricings.' },
      { label: 'Totals Edge', prompt: 'Scan today\'s {X} game totals and highlight over/under value.' }
    ]
  }
};

const MODE_IDS = Object.keys(MODE_TEMPLATES);


/** Per-sport vocabulary injected into the shared mode templates above. */
const SPORT_VOCAB = {};

SPORT_VOCAB.mlb = {
  slateLabel: "Today's MLB Slate",
  props: 'MLB Player Props',
  betsNoun: 'spread, moneyline and run-line',
  matchChip: 'Pitching Matchups',
  matchPrompt: "Which starting pitching matchup gives one side a hidden edge today?",
  upsetPrompt: 'Which moneyline underdog has a pitching edge the public is undervaluing today?',
  compareChip: 'Starting Pitchers',
  comparePrompt: 'Compare the starting pitchers tonight and say which side is mispriced.',
  lineWord: 'MLB moneyline',
  deepChipA: 'Pitcher Deep Dive',
  deepPromptA: "Run a deep regression-style analysis on tonight's starting pitching matchup.",
  deepChipB: 'Bullpen Usage',
  deepPromptB: "Model how bullpen availability and usage patterns move tonight's true probability.",
  deepChipC: 'Weather & Ballpark',
  deepExample: "Analyze how weather, ballpark factors and pitching matchups should affect tonight's MLB total."
};

SPORT_VOCAB.nfl = {
  slateLabel: "Today's NFL Slate",
  props: 'NFL Player Props',
  betsNoun: 'spread, moneyline and total',
  matchChip: 'QB Matchups',
  matchPrompt: 'Which quarterback matchup creates the biggest mismatch today?',
  upsetPrompt: 'Which moneyline underdog has an injury or rest edge the public is undervaluing this week?',
  compareChip: 'Quarterbacks',
  comparePrompt: 'Compare the quarterbacks and say which side is mispriced.',
  lineWord: 'NFL moneyline',
  deepChipA: 'Injury Impact',
  deepPromptA: "Model how tonight's key offensive-line and skill-position injuries move the true probability.",
  deepChipB: 'Game Script & Pace',
  deepPromptB: "Model how game script, pace of play and situational tendencies shift tonight's projection.",
  deepChipC: 'Weather & Injuries',
  deepExample: "Analyze how weather, injuries and matchup factors should affect tonight's NFL total."
};

SPORT_VOCAB.nba = {
  slateLabel: "Today's NBA Slate",
  props: 'NBA Player Props',
  betsNoun: 'spread, moneyline and total',
  matchChip: 'Matchup Analysis',
  matchPrompt: 'Which NBA matchup has the largest style mismatch today?',
  upsetPrompt: 'Which NBA underdog has a pace or fatigue edge the public is undervaluing today?',
  compareChip: 'Team Matchups',
  comparePrompt: 'Compare the team matchups - pace, defense and rotations - and say which side is mispriced.',
  lineWord: 'NBA line',
  deepChipA: 'Pace & Efficiency',
  deepPromptA: "Model how pace, offensive rating and defensive rating differentials move tonight's true probability.",
  deepChipB: 'Usage & Rotations',
  deepPromptB: "Model how usage rates and rotation depth shifts affect tonight's projection.",
  deepChipC: 'Pace & Injuries',
  deepExample: "Analyze how pace, injuries and matchup factors should affect tonight's NBA total."
};

SPORT_VOCAB.wnba = {
  slateLabel: "Today's WNBA Slate",
  props: 'WNBA Player Props',
  betsNoun: 'spread, moneyline and total',
  matchChip: 'Matchup Analysis',
  matchPrompt: 'Which WNBA matchup has the largest style mismatch today?',
  upsetPrompt: 'Which WNBA underdog has a pace or fatigue edge the public is undervaluing today?',
  compareChip: 'Team Matchups',
  comparePrompt: 'Compare the team matchups - pace, defense and rotations - and say which side is mispriced.',
  lineWord: 'WNBA line',
  deepChipA: 'Usage & Rotations',
  deepPromptA: "Model how usage rates and rotation depth shifts affect tonight's projection.",
  deepChipB: 'Pace & Efficiency',
  deepPromptB: "Model how pace, offensive rating and defensive rating differentials move tonight's true probability.",
  deepChipC: 'Pace & Injuries',
  deepExample: "Analyze how pace, injuries and matchup factors should affect tonight's WNBA total."
};

SPORT_VOCAB.nhl = {
  slateLabel: "Today's NHL Slate",
  props: 'NHL Player Props',
  betsNoun: 'puck line, moneyline and total',
  matchChip: 'Goaltender Matchups',
  matchPrompt: 'Which goaltender matchup gives one side a hidden edge today?',
  upsetPrompt: 'Which moneyline underdog has a goaltending edge the public is undervaluing today?',
  compareChip: 'Goaltenders',
  comparePrompt: 'Compare the goaltenders - save percentage and recent form - and say which side is mispriced.',
  lineWord: 'NHL puck line',
  deepChipA: 'Goaltender Deep Dive',
  deepPromptA: "Run a deep regression-style analysis on tonight's goaltending matchup.",
  deepChipB: 'Special Teams',
  deepPromptB: "Model how power play vs penalty kill efficiency moves tonight's true probability.",
  deepChipC: 'Goaltending & Total',
  deepExample: "Analyze how goaltending, special teams and matchup factors should affect tonight's NHL total."
};

SPORT_VOCAB.soccer = {
  slateLabel: "Today's Matches",
  props: 'Player Props',
  slateNounLower: 'matches',
  betsNoun: '1X2, Asian handicap and goals-total',
  matchChip: 'Matchup Analysis',
  matchPrompt: 'Which fixture has the biggest tactical mismatch today?',
  upsetPrompt: 'Which underdog has the xG and form profile to pull off an upset today?',
  compareChip: 'Form Head-to-Head',
  comparePrompt: 'Compare the two teams and their recent form, then say which side is mispriced.',
  lineWord: 'side',
  deepChipA: 'xG Model',
  deepPromptA: "Run a deep expected-goals model on tonight's featured fixture.",
  deepChipB: 'Form & Fatigue',
  deepPromptB: 'Model how fixture congestion, travel and rotation risk move the true probability.',
  deepChipC: 'Form & Injuries',
  deepExample: "Analyze how injuries, form and matchup factors should affect tonight's match."
};

/** Display metadata per sport. */
const SPORT_META = {
  mlb: { label: 'MLB', word: 'baseball', placeholderTail: "today's MLB slate", eventNoun: 'game', lineNoun: 'run line' },
  nfl: { label: 'NFL', word: 'football', placeholderTail: "today's NFL slate", eventNoun: 'game', lineNoun: 'spread' },
  nba: { label: 'NBA', word: 'basketball', placeholderTail: "today's NBA slate", eventNoun: 'game', lineNoun: 'spread' },
  wnba: { label: 'WNBA', word: 'basketball', placeholderTail: "today's WNBA slate", eventNoun: 'game', lineNoun: 'spread' },
  nhl: { label: 'NHL', word: 'hockey', placeholderTail: "today's NHL slate", eventNoun: 'game', lineNoun: 'puck line' },
  soccer: { label: 'Football', word: 'football', placeholderTail: "today's football matches", eventNoun: 'match', lineNoun: 'Asian handicap' }
};

/** Football competition display names (short + long). */
const LEAGUE_LABELS = {
  epl: { name: 'Premier League', short: 'Premier League' },
  laliga: { name: 'La Liga', short: 'La Liga' },
  bundesliga: { name: 'Bundesliga', short: 'Bundesliga' },
  serie_a: { name: 'Serie A', short: 'Serie A' },
  ligue_1: { name: 'Ligue 1', short: 'Ligue 1' },
  ucl: { name: 'Champions League', short: 'UCL' },
  uel: { name: 'Europa League', short: 'UEL' },
  uecl: { name: 'Conference League', short: 'UECL' }
};

/** Interpolate `{token}` placeholders in a template string. */
function fill(str, tokens) {
  return str.replace(/\{(\w+)\}/g, (_, key) => (tokens[key] !== undefined ? tokens[key] : `{${key}}`));
}

/** Resolve one mode's greeting + prompt chips against the sport vocabulary. */
function buildMode(modeId, tokens) {
  const tpl = MODE_TEMPLATES[modeId];
  return {
    greeting: fill(tpl.greeting, tokens),
    prompts: tpl.chips.map(({ label, prompt }) => ({ label: fill(label, tokens), prompt: fill(prompt, tokens) }))
  };
}

/**
 * SINGLE ENTRY POINT for all sport-aware UI copy.
 *
 * @param {string} sportId   mlb | nfl | nba | wnba | nhl | soccer
 * @param {string|null} leagueId football competition id (epl | ucl | ...) or null
 * @returns {{
 *   displayName: string,
 *   shortName: string,
 *   word: string,
 *   placeholder: string,
 *   eventNoun: string,
 *   lineNoun: string,
 *   deepExample: string,
 *   modes: Record<string, { greeting: string, prompts: Array<{label: string, prompt: string}> }>
 * }}
 */
export function getSportUIConfig(sportId = DEFAULT_SPORT, leagueId = null) {
  const vocabKey = SPORT_VOCAB[sportId] ? sportId : DEFAULT_SPORT;
  const meta = SPORT_META[vocabKey] || SPORT_META[DEFAULT_SPORT];

  // Football competitions swap the generic "Football" label for the selected
  // competition everywhere ("Premier League" / "Champions League" / ...).
  let X = meta.label;
  let shortName = meta.label;
  if (vocabKey === 'soccer' && leagueId && LEAGUE_LABELS[leagueId]) {
    X = LEAGUE_LABELS[leagueId].name;
    shortName = LEAGUE_LABELS[leagueId].short;
  }

  const slatePhrase = vocabKey === 'soccer'
    ? `${X} matches`
    : `${X} slate`;
  const tokens = { ...SPORT_VOCAB[vocabKey], slateLabel: fill(SPORT_VOCAB[vocabKey].slateLabel, { X }), slatePhrase };

  const modes = {};
  MODE_IDS.forEach((id) => {
    const m = buildMode(id, { ...tokens, X });
    // Templates that embed {X} inside vocabulary-sourced strings get filled here.
    m.prompts.forEach((p) => {
      p.label = fill(p.label, { ...tokens, X });
      p.prompt = fill(p.prompt, { ...tokens, X });
    });
    m.greeting = fill(m.greeting, { ...tokens, X });
    modes[id] = m;
  });

  const eventWord = vocabKey === 'soccer' ? 'matches' : 'slate';
  return {
    displayName: X,
    shortName,
    word: meta.word,
    placeholder: `Ask about today's ${X} ${eventWord} or paste a betting screenshot...`,

    eventNoun: meta.eventNoun,
    lineNoun: meta.lineNoun,
    deepExample: modes.deep_analysis.prompts[3].prompt,
    modes
  };
}



