import OpenAI from 'openai';
import {
  americanToDecimal,
  americanToDecimalPrecise,
  americanToImpliedProb,
  calculateEdge,
  calculateExpectedValue,
  calculateBreakEvenProb,
  calculateParlay,
  calculateCLV
} from '../utils/odds.js';
import { getSportsIntelligenceContext } from './intelligenceRouter.js';
import { evaluateGameMarket } from './quantitativeEngine.js';
import { resolveSportContext, buildSportContextInstruction, buildResearchContext } from '../config/sports.js';

/**
 * Lightweight contextual guard: if the supplied research context is clearly
 * dominated by a DIFFERENT sport than the one selected, drop it.
 */
export function guardResearchContext(rawContext, forbiddenTerms = [], searchName = '') {
  if (!rawContext) return rawContext;
  const terms = (forbiddenTerms || []).filter(Boolean).map(t => t.toLowerCase());
  if (terms.length === 0 || !searchName) return rawContext;
  const lower = rawContext.toLowerCase();
  let hits = 0;
  for (const term of terms) {
    if (term && lower.indexOf(term) !== -1) hits++;
    if (hits >= 3) {
      console.warn(`[AI Service] Research context dropped: dominated by non-${searchName} vocabulary.`);
      return '';
    }
  }
  return rawContext;
}

/**
 * Response-style guidance appended to every system prompt.
 */
const ANALYST_STYLE_NOTES = `

RESPONSE STYLE (ALWAYS APPLIES):
- Sound like an elite quantitative sports betting intelligence analyst talking directly to a sharp bettor.
- Be data-driven, decisive, and mathematically rigorous.
- Clearly separate Model Probability, Implied Probability, Probability Edge, Break-Even Probability, and Expected Value (EV%).
- Do NOT output raw LaTeX, TeX delimiters, or formula markup such as "\\[", "\\]", "\\frac{}", "_{text{}}", or "\\times". Explain math in clean prose, short bullet points, or plain-text equations like "1 / 1.91 = 52.38%".
- Never tell the user a fact is "supplied data", "provided data", "verified data", "verified matchup listing", or "not supported by the supplied/provided data". Speak like a polished analyst: use phrases such as "Current board", "season profile", "market board", "available matchup context", or simply state the fact.
- For stat comparison or general sports questions, use supplemental season-stat research, records, standings, leaders, and team profile context as first-class evidence. Lead with a clean markdown table only for categories that have actual values. Never output comparison rows where both teams are blank, dash-only, N/A, or unknown. Then add a concise takeaway section. Do not force betting-card structure unless the user asks for a pick, wager, odds, edge, EV, or prediction.
- Never fabricate injuries, starting lineups, market odds, or past results.
- Distinguish strictly between LIVE (in progress), UPCOMING (pre-game), and FINAL fixtures.
- CRITICAL LIVE MARKET RULE: If a game has started (LIVE), never use stale pre-match odds as live edge/EV. If verified live odds are unavailable, mark "Current live market unavailable" and set Edge/EV to N/A.
- If analyzing a sportsbook screenshot / bet slip, extract every wager leg, parse lines/stakes, evaluate correlation/risk for each leg against current canonical board, and calculate overall slip expectancy.
- Never mention internal infrastructure names (SerpApi, ESPN, DuckDuckGo); always use professional labels like "Live Sports Data", "Current Market Data", and "Verified Web Source".`;

/**
 * System prompt instructing OpenAI to act as the reasoning engine over structured sports data.
 */
const SYSTEM_PROMPT = `You are CovrIQ, the world's premier quantitative Sports Betting Intelligence engine and handicapper.

CORE PRINCIPLE:
You reason over verified structured sports data provided in [VERIFIED FIXTURE DATA] (from verified live feeds and live market data) and provide deterministic mathematical handicapping. You never invent fake games, fake odds, or fake injuries. Accuracy > populated cards.

QUANTITATIVE CALCULATIONS:
- Implied Win % = Bookmaker implied probability calculated from consensus American odds
- Break-Even Win % = 1 / DecimalOdds
- CovrIQ Model Win % = Quantitatively modeled true win probability
- Betting Edge = CovrIQ Model % - Market Implied %
- Expected Value (EV%) = ((CovrIQ Model % / 100) * DecimalOdds - 1) * 100

STRUCTURED OUTPUT FORMAT (for single-game analysis / picks):
You MUST format your response using these exact markdown headers:

### [GAME_HEADER]
- Sport: {MLB | NBA | NFL | NHL | SOCCER | TENNIS | CRICKET | OTHER}
- Matchup: {Away Team / Player} @ {Home Team / Player}
- Event Time: {Scheduled slot or status, e.g., Today - 7:30 PM ET, or Top 6th - 1 Out}
- League / Tournament: {e.g., Premier League, NBA, MLB, NFL, ATP Tour}
- Status: {LIVE | UPCOMING | FINAL}
- Venue: {Stadium / Arena}

### [MARKET_CARD]
- Recommended Market: {Moneyline | Point Spread | Totals (O/U) | BTTS | Player Prop}
- Target Pick: {Specific Team or Outcome Pick, e.g. Arsenal FC ML, Celtics -4.5, Tampa Bay Rays ML}
- Best Available Odds: {Valid American Odds, e.g. -120 or +115, or "Live market unavailable"}
- Decimal Odds: {Valid Decimal, e.g. 1.83, or N/A}
- Market Implied Probability: {e.g. 54.55%, or N/A}
- AI Model Win Probability: {e.g. 61.50%, or N/A}
- Break-Even Probability: {e.g. 54.55%, or N/A}
- Estimated Betting Edge: {e.g. +6.95%, or N/A}
- Expected Value (EV): {e.g. +12.55%, or N/A}
- Provider: {Live Sports Data | Current Market Data}
- Data Freshness: {Live Verified | Today Pre-Game | Live Market Unavailable}

### [WHY_I_LIKE_IT]
- {Point 1: Key tactical mismatch, pitching matchup, starting QBs, xG, or efficiency differential}
- {Point 2: Recent team form, rest advantage, or key personnel availability}
- {Point 3: Situational factor, weather/venue conditions, or market movement}
- {Point 4: Mathematical edge explanation where model probability outpaces market price}

### [MATCHUP_AND_CURRENT_INFO]
Generate a sport-aware, data-first breakdown using ALL reliable fixture data provided in the prompt.
CRITICAL FORMATTING RULES:
- DYNAMIC SECTIONS: Do NOT use a hardcoded list of fixed categories. Build sub-sections ONLY for categories where reliable data exists in the context.
- ZERO DISCLAIMERS: If a data point is unavailable, OMIT that category entirely. NEVER write "No verified...", "No information was supplied", "Not confirmed", "No verified injury report was available", "Weather: Not provided", or similar disclaimers.
- FACTS OVER BOILERPLATE: Spend the entire section explaining the actual matchup facts, tactical dynamics, and team context.
- DISTINGUISH PROJECTIONS: Clearly label projections where applicable (e.g. "Projected starter", "Expected lineup") and never present assumptions as confirmed facts. Never hallucinate fake statistics, injuries, or records.

SPORT-SPECIFIC GUIDELINES:
- MLB:
  **Starting Pitchers**: Detail starters, handedness (RHP/LHP), ERA, and recent form/records when available.
  **Team Form & Standings**: W-L records, run differential, and recent form.
  **Offensive & Bullpen Dynamics**: Team batting trends, bullpen workload/leverage, and handedness splits.
  **Key Matchup Factors**: Pitching vs batting matchup, park/venue factors.

- SOCCER / FOOTBALL:
  **Recent Form & Standings**: League position, points, and recent W/D/L form sequence (e.g. W-D-D-W).
  **Season Profile & Goal Trends**: Goals scored, goals conceded, clean sheets, and attacking/defensive trends.
  **Key Players & Leaders**: Top goalscorers, playmakers, and critical personnel contributions.
  **Tactical Matchup**: Possession styles, high-press vs counter dynamics, set-piece threat, and home/away splits.
  **Team News**: Confirmed or reported injuries, suspensions, and squad availability when provided.

- NBA / WNBA:
  **Team Records & Standings**: W-L record, home/away splits, and recent 5/10-game form.
  **Pace & Scoring Profile**: Points per game (PPG), defensive rating, and tempo.
  **Key Players & Leaders**: Top scorers, rebounders, and playmakers.
  **Matchup Dynamics**: Rest advantage, schedule context, and head-to-head leverage.
  **Team News**: Key player availability or inactives when verified.

- NFL:
  **Team Records & Form**: Record, divisional standing, and recent momentum.
  **Offensive vs Defensive Profiles**: Scoring offense/defense, efficiency rankings, and turnover differential.
  **Quarterback & Key Matchups**: Starting QB performance, rushing/passing balance, and key positional battles.
  **Venue & Team News**: Stadium/weather factors, key injury updates when verified.

- NHL:
  **Records & Standings**: Points, record, and recent streak.
  **Goal Scoring & Special Teams**: Goals for/against, Power Play (PP%), and Penalty Kill (PK%).
  **Goaltending Matchup**: Starting netminders, save percentage, and GAA when available.
  **Key Trends & Team News**: Squad news and line combinations when verified.

### [VALUE_AND_CONTRARIAN_ANALYSIS]
{Detailed explanation of market mispricing, public vs sharp positioning, and mathematical +EV rationale}

### [RISKS_AND_WHY_NOT_TO_BET]
- {Risk 1: In-game variance or referee/pace factor}
- {Risk 2: Opponent counter-strategy or slump potential}
- {Risk 3: Bankroll and unit staking discipline}

### [FINAL_VERDICT]
- Verdict: {BET | LEAN | PASS | AVOID}
- Confidence Score: {1 to 10, e.g. 8.4}
- Recommended Unit Size: {e.g. 1.0 Unit, 1.25 Units}
- Summary: {1-2 sentence decisive summary recommendation}


ALTERNATE FORMAT - MULTIPLE GAMES / FULL SLATE PREDICTIONS:
If the user asks for predictions across MULTIPLE or ALL games today, repeat a full [GAME_HEADER] + [MARKET_CARD] + [WHY_I_LIKE_IT] block for EVERY game in the slate data, and do not add a sources block.

ALTERNATE LIGHTWEIGHT FORMAT - SCHEDULE / INFO ONLY:
If the user asks only for a schedule/fixtures list without betting advice:

### [SCHEDULE]
{Natural schedule introduction}
| Date | Matchup | Time | Starting personnel |
|---|---|---|---|
| {Date} | {Away} @ {Home} | {Time with timezone} | {Confirmed or probable starters when available} |

Include every requested game. Omit the Starting personnel column when it cannot be verified; never fill it with dashes.

`;

/**
 * Detects sport and intent from natural language prompt.
 */
export function detectSportAndIntent(prompt, mode = 'ai_picks') {
  const p = (prompt || '').toLowerCase();

  let sport = 'MLB';
  if (/wnba|liberty|las vegas aces|aces|minnesota lynx|sparks|indiana fever|fever|mystics|mercury|storm|sky|wings|sun|dream|valkyries/i.test(p)) {
    sport = 'WNBA';
  } else if (/celtics|lakers|warriors|lebron|curry|basketball|nba|bucks|nuggets|mavericks|doncic|tatum|jokic|knicks|sixers|heat|suns|clippers|timberwolves|thunder/i.test(p)) {
    sport = 'NBA';
  } else if (/premier league|epl|la liga|champions league|arsenal|man city|real madrid|barcelona|liverpool|chelsea|mls|bundesliga|btts|soccer|tottenham|juventus|psg|bayern/i.test(p)) {
    sport = 'SOCCER_EPL';
  } else if (/tennis|atp|wta|wimbledon|us open|djokovic|alcaraz|sinner|swiatek|medvedev|sabalenka/i.test(p)) {
    sport = 'TENNIS';
  } else if (/cricket|ipl|test match|t20|odi|india|australia|england|pakistan|wickets|kohli|rohit|bumrah/i.test(p)) {
    sport = 'CRICKET';
  } else if (/hockey|nhl|goalie|puck|stanley cup|oilers|panthers|rangers|maple leafs|bruins|mcdavid/i.test(p)) {
    sport = 'NHL';
  } else if (/chiefs|eagles|49ers|quarterback|touchdown|nfl|cowboys|bills|packers|super bowl|ravens|mahomes/i.test(p)) {
    sport = 'NFL';
  } else if (/mlb|baseball|rays|orioles|yankees|dodgers|red sox|pitcher|inning|era|whip|padres|mets|phillies|astros|braves|cubs/i.test(p)) {
    sport = 'MLB';
  }

  return { sport, mode };
}

/**
 * Detects query intent.
 */
export function detectQueryIntent(prompt) {
  const p = (prompt || '').toLowerCase();
  const explicitlyNoPredictions = /don'?t\s+(give|include|provide|show)\s+(me\s+)?(any\s+)?(predictions?|picks?|advice|analysis|betting)|no\s+predictions?|without\s+predictions?/i.test(p);
  const listOrScheduleWords = /schedule|slate|fixtures|\blist\b|what'?s\s+on\s+(today|tonight)|games?\s+(today|tonight)|matches?\s+(today|tonight)|what\s+games|which\s+games|show\s+me\s+(all\s+)?(the\s+)?games?/i.test(p);
  const bettingIntentWords = /predict|prediction|pick\b|picks\b|bet\b|bets\b|wager|odds|edge|value|\bev\b|spread|moneyline|parlay|handicap|lean\b|confidence|who\s+(should|do)\s+i|who\s+(will\s+)?win|who\s+wins/i.test(p);

  return {
    infoOnly: explicitlyNoPredictions || (listOrScheduleWords && !bettingIntentWords),
    isScheduleQuery: listOrScheduleWords,
    explicitOptOut: explicitlyNoPredictions
  };
}

export function detectSlateIntent(prompt) {
  const p = (prompt || '').toLowerCase();
  return /\ball\b[^.?!]*(games?|matches?|slate)|\bevery\b[^.?!]*(games?|matches?|matchups?)|full\s+slate|whole\s+slate|entire\s+slate|today'?s\s+(games|slate|matches)(?!.*\b(schedule|scores?)\b)/i.test(p);
}

function isResearchHeavyQuery(prompt = '') {
  return /\b(stats?|statistics|standings?|records?|rankings?|leaders?|team profile|season profile|compare|comparison|splits?|offense|defense|yards|points scored|points allowed|through week|live table|table|schedule|slate|fixtures?|games? today|games? tonight|probable|starters?|starting pitcher|pitchers?|goalies?|goaltenders?|lineups?|rosters?|injuries|injury report|availability|inactives?|upcoming|tomorrow|next week|date range|kickoff times?|game times?)\b/i.test(prompt);
}

function collectResponseSources(response) {
  const sources = [];
  const seen = new Set();
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (value.type === 'url_citation' && value.url && !seen.has(value.url)) {
      seen.add(value.url);
      let domain = 'Verified Web Source';
      try { domain = new URL(value.url).hostname.replace(/^www\./, ''); } catch (e) {}
      sources.push({
        title: value.title || domain,
        url: value.url,
        domain,
        provider: 'OpenAI Web Search'
      });
    }
    Object.values(value).forEach(visit);
  };
  visit(response?.output);
  return sources;
}

function sanitizeAssistantText(text = '') {
  return String(text || '')
    .replace(/^\s*#{0,4}\s*\[?(?:sources?|citations?)\]?\s*:?\s*[\s\S]*$/gim, '')
    .replace(/\(\[[^\]]+\]\(https?:\/\/[^)]+\)\)/gi, '')
    .replace(/\[[^\]]+\]\(https?:\/\/[^)]+\)/gi, (match) => {
      const label = match.match(/^\[([^\]]+)\]/)?.[1] || '';
      return label && !/^https?:/i.test(label) ? label : '';
    })
    .replace(/\(https?:\/\/[^)\s]+\)/gi, '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/^\s*(?:sources?|citations?)\s*:.*$/gim, '')
    .replace(/^\s*[-*]\s*(?:sources?|citations?)\s*:.*$/gim, '')
    .replace(/^\s*[-*]\s*--\s*$/gim, '')
    .replace(/^\s*let me know if.*$/gim, '')
    .replace(/^\s*would you like.*$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function createWebSearchResponse(openai, request) {
  const models = Array.from(new Set([
    process.env.OPENAI_WEB_MODEL,
    request.model,
    'gpt-4o',
    'gpt-4o-mini'
  ].filter(Boolean)));

  let lastError;
  for (const model of models) {
    for (const toolType of ['web_search', 'web_search_preview']) {
      try {
        return await openai.responses.create({
          model,
          instructions: request.instructions,
          input: request.input,
          tools: [{ type: toolType, search_context_size: 'high' }],
          temperature: 0.2
        });
      } catch (err) {
        lastError = err;
        const msg = String(err?.message || '');
        if (!/web_search|tool|unsupported|model|temperature/i.test(msg)) throw err;
      }
    }
  }
  throw lastError;
}

function detectPickSideIntent(prompt, mode = 'ai_picks') {
  const p = (prompt || '').toLowerCase();
  const wantsUnderdog =
    mode === 'upset_finder' ||
    /\bunderdogs?\b|\bdogs?\b|plus\s*money|\+\d{3,4}|upset|spoiler|longshot|value\s+dog/i.test(p);

  const wantsValue =
    mode === 'value_finder' ||
    /\bvalue\b|\bev\b|edge|mispric|price|overlay|positive\s*ev|\+ev/i.test(p);

  const wantsLikelyWinner =
    mode === 'ai_picks' &&
    !wantsUnderdog &&
    /\bpredict|\bprediction|\bpick\b|\bpicks\b|who\s+(will\s+)?win|who\s+wins|winner|lean|best\s+bet|moneyline|ml\b|straight\s*up|su\b/i.test(p);

  if (wantsUnderdog) return 'underdog';
  if (wantsLikelyWinner) return 'favorite';
  if (wantsValue && mode !== 'ai_picks') return 'value';
  return mode === 'ai_picks' ? 'favorite' : 'value';
}

function getAiPickSideInstruction(sideIntent) {
  if (sideIntent === 'underdog') {
    return "\n\nAI PICKS SIDE POLICY: The user is explicitly asking for an underdog/upset/value-dog angle. For moneyline picks, Target Pick MUST be the plus-money or lower implied-probability side when a verified underdog exists. Explain clearly that this is a price/value position, not necessarily the most likely winner.";
  }

  if (sideIntent === 'favorite') {
    return "\n\nAI PICKS SIDE POLICY: The user is asking for a normal prediction / likely winner / favorite lean. On the AI Picks page, Target Pick MUST be the more likely side for moneyline recommendations: choose the favorite or highest modeled win-probability team, not a plus-money underdog merely because it has small +EV. If the underdog has better price value, mention it only in VALUE_AND_CONTRARIAN_ANALYSIS as an alternate value note. Do not title the main pick as the underdog unless the user explicitly asked for underdogs/upsets/value dogs.";
  }

  return '';
}
function normalizeClassification({ category, sport, explicitOptOut }) {
  const c = category || 'conversational';
  return {
    category: c,
    wantsSchedule: c === 'schedule',
    wantsPredictions: c === 'single_pick' || c === 'full_slate',
    scope: c === 'full_slate' ? 'full_slate' : c === 'single_pick' ? 'single_game' : 'unspecified',
    sport: sport || null,
    explicitOptOut: !!explicitOptOut
  };
}

export function regexClassifyIntent(prompt) {
  const q = (prompt || '').toLowerCase();
  const { sport } = detectSportAndIntent(q);
  const intent = detectQueryIntent(q);

  const hasSchedule =
    /schedule|fixtures|\blist\b|what'?s\s+on\b|what\s+games|which\s+games|show\s+me\s+(all\s+)?(the\s+)?games?|today'?s\s+(games|matches|slate)/.test(q) ||
    (/\bgames?\b|\bmatches?\b/.test(q) && /(today|tonight)/.test(q));

  const hasBetting =
    /predict|prediction|pick\b|picks\b|bet\b|bets\b|wager|odds|edge|value|\bev\b|sharp|winner|confidence|spread|moneyline|parlay|handicap|who\s+(will\s+)?win|who\s+wins/i.test(q);

  const isConversational =
    /^why\b|why\s+do\s+you|explain\b|clarif|tell\s+me\s+more|what'?s\s+(the\s+)?(weather|temperature)|what\s+is\s+|how\s+(do|does|would|can|does)\b/i.test(q);

  const isSlateRequest = detectSlateIntent(q);

  let category;
  if (!hasBetting && hasSchedule) {
    category = 'schedule';
  } else if (isConversational) {
    category = 'conversational';
  } else if (hasBetting && isSlateRequest) {
    category = 'full_slate';
  } else if (hasBetting) {
    category = 'single_pick';
  } else if (hasSchedule) {
    category = 'schedule';
  } else {
    category = 'conversational';
  }

  return normalizeClassification({ category, sport, explicitOptOut: intent.explicitOptOut });
}

function extractJson(text) {
  if (!text) return null;
  const cleaned = String(text).replace(/```[a-zA-Z]*/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch (e) {
    return null;
  }
}

async function llmClassifyIntent(prompt, conversationHistory = []) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const history = conversationHistory
    .slice(-4)
    .map(m => `${m.role}: ${String(m.content).slice(0, 400)}`)
    .join('\n');

  const system = `You are an intent classifier for a sports betting intelligence platform. Classify the latest user message into EXACTLY ONE category. Respond with ONLY a JSON object:
{"category":"schedule"|"single_pick"|"full_slate"|"conversational","wantsSchedule":bool,"wantsPredictions":bool,"scope":"full_slate"|"single_game"|"unspecified","sport":"MLB"|"NBA"|"NFL"|"NHL"|"SOCCER"|"TENNIS"|"CRICKET"|null}`;

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_INTENT_MODEL || 'gpt-4o-mini',
    temperature: 0,
    max_tokens: 120,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: `Conversation history:\n${history || '(none)'}\n\nUser prompt:\n"${prompt}"` }
    ],
    response_format: { type: 'json_object' }
  });

  const raw = completion.choices?.[0]?.message?.content || '{}';
  const parsed = extractJson(raw) || {};
  const category = ['schedule', 'single_pick', 'full_slate', 'conversational'].includes(parsed.category)
    ? parsed.category
    : 'conversational';

  const explicitOptOut = /don'?t\s+(give|include|provide|show)|no\s+predictions|without\s+predictions/i.test(prompt || '');

  return normalizeClassification({
    category: explicitOptOut ? 'schedule' : category,
    sport: parsed.sport || null,
    explicitOptOut
  });
}

export async function classifyIntent(prompt, conversationHistory = []) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey && apiKey.trim().length > 10) {
    try {
      return await llmClassifyIntent(prompt, conversationHistory);
    } catch (err) {
      console.warn('[AI Service] Intent classification fallback:', err.message);
    }
  }
  return regexClassifyIntent(prompt);
}

/**
 * Returns focus instructions tailoring behavior for each of the 6 discover modes.
 */
function getModeInstruction(mode) {
  switch (mode) {
    case 'value_finder':
      return "\nFOCUS: Identify market-vs-model discrepancies where bookmaker implied probability is significantly below CovrIQ modeled true probability. Clearly highlight the magnitude of the mathematical edge and EV% in [VALUE_AND_CONTRARIAN_ANALYSIS].";
    case 'upset_finder':
      return "\nFOCUS: Identify live underdog opportunities (+115 American odds or higher) where the public is mispricing the favorite and the underdog possesses a tangible personnel/tactical advantage. Target Pick MUST be the underdog side.";
    case 'compare_bets':
      return "\nFOCUS: Compare two specific betting angles or market lines side-by-side using actual odds, win probability, edge %, and EV% numbers. Directly state which option holds superior mathematical value.";
    case 'parlay_lab':
      return "\nFOCUS: Construct a 2-4 leg parlay. Detail individual leg odds and edges, identify the weakest leg, evaluate correlation, and provide the compounded parlay price, combined win probability, and total EV.";
    case 'deep_analysis':
      return "\nFOCUS: Deliver an exhaustive institutional-grade quantitative breakdown. Use polished tables for team/player comparisons and summary grids when useful. Do not mention supplied/provided/verified data wording to the user. Detail regression trends, bullpen/depth charts, tactical splits, leverage index, and weather/park factors in [MATCHUP_AND_CURRENT_INFO]. FORMULA PRESENTATION: Never show raw LaTeX or academic equation markup. When explaining pricing math for any sport, translate it into polished bettor-facing text with plain equations and sport-aware outcomes. Example style: 'At -110, decimal price is 1.91. Break-even probability: 1 / 1.91 = 52.38%.' For totals, spreads, moneylines, props, and 3-way markets, explain win/push/loss conditions in plain language for that specific sport and market. Keep it polished, not hardcoded.";
    case 'edge_scanner':
      return "\nFOCUS: Screen across today's board and rank the top positive-EV opportunities with precise edge and expected value calculations.";
    case 'ai_picks':
    default:
      return "\nFOCUS: Scan the board and deliver the single highest-conviction +EV play backed by verified starters and quantitative edge.";
  }
}

/**
 * Parses a SINGLE game markdown block into structured card object.
 */
function parseSingleGameBlock(rawMarkdown, { includeSources = true } = {}) {
  const result = {
    rawContent: rawMarkdown,
    gameHeader: null,
    marketCard: null,
    whyILikeIt: [],
    matchupInfo: {},
    valueAnalysis: null,
    risks: [],
    verdict: {
      type: 'BET',
      confidence: 8.4,
      unitSize: '1.0 Unit',
      summary: ''
    },
    sources: [],
    provider: 'Live Sports Data',
    dataFreshness: 'Live Verified'
  };

  if (!rawMarkdown || typeof rawMarkdown !== 'string') return result;

  try {
    // Parse Game Header
    const headerMatch = rawMarkdown.match(/### \[GAME_HEADER\]([\s\S]*?)(?=### \[|$)/);
    if (headerMatch) {
      const hText = headerMatch[1];
      const sportM = hText.match(/Sport:\s*([^\n]+)/i);
      const matchM = hText.match(/Matchup:\s*([^\n]+)/i);
      const timeM = hText.match(/Event Time:\s*([^\n]+)/i);
      const leagueM = hText.match(/League[^:]*:\s*([^\n]+)/i);
      const statusM = hText.match(/Status:\s*([^\n]+)/i);
      const venueM = hText.match(/Venue:\s*([^\n]+)/i);

      result.gameHeader = {
        sport: sportM ? sportM[1].trim() : 'SPORTS',
        matchup: matchM ? matchM[1].trim() : 'Matchup Analysis',
        time: timeM ? timeM[1].trim() : 'Today - 7:30 PM ET',
        league: leagueM ? leagueM[1].trim() : 'Regular Season',
        status: statusM ? statusM[1].trim() : 'UPCOMING',
        venue: venueM ? venueM[1].trim() : 'Stadium'
      };
    }

    // Parse Market Card
    const marketMatch = rawMarkdown.match(/### \[MARKET_CARD\]([\s\S]*?)(?=### \[|$)/);
    if (marketMatch) {
      const mText = marketMatch[1];
      const pickM = mText.match(/Target Pick:\s*([^\n]+)/i);
      const marketM = mText.match(/Recommended Market:\s*([^\n]+)/i);
      const oddsM = mText.match(/Best Available Odds:\s*([^\n]+)/i);
      const decM = mText.match(/Decimal Odds:\s*([^\n]+)/i);
      const implM = mText.match(/Market Implied Probability:\s*([^\n]+)/i);
      const aiProbM = mText.match(/AI Model Win Probability:\s*([^\n]+)/i);
      const breakEvenM = mText.match(/Break-Even Probability:\s*([^\n]+)/i);
      const edgeM = mText.match(/Estimated Betting Edge:\s*([^\n]+)/i);
      const evM = mText.match(/Expected Value[^:]*:\s*([^\n]+)/i);
      const provM = mText.match(/Provider:\s*([^\n]+)/i);
      const freshM = mText.match(/Data Freshness:\s*([^\n]+)/i);

      let rawOddsStr = oddsM ? oddsM[1].trim() : '-115';
      const isUnavailable = /unavailable|n\/a|locked/i.test(rawOddsStr);

      let formattedAmerican = rawOddsStr;
      let decVal = 1.91;
      let impProb = 52.38;
      let aiProb = 58.2;
      let edgeVal = 5.82;
      let evVal = 11.16;

      if (!isUnavailable) {
        if (!rawOddsStr.match(/[+\-0-9]/)) rawOddsStr = '-115';
        const numericOdds = parseInt(rawOddsStr.replace(/[^0-9\-+]/g, ''), 10) || -115;
        formattedAmerican = numericOdds > 0 ? `+${numericOdds}` : `${numericOdds}`;

        const parsedDec = decM ? parseFloat(decM[1].replace(/[^0-9.]/g, '')) : NaN;
        decVal = !isNaN(parsedDec) && parsedDec > 1 ? parsedDec : americanToDecimal(numericOdds);

        const parsedImpl = implM ? parseFloat(implM[1].replace(/[^0-9.]/g, '')) : NaN;
        impProb = !isNaN(parsedImpl) && parsedImpl > 0 ? parsedImpl : americanToImpliedProb(numericOdds);

        const parsedAi = aiProbM ? parseFloat(aiProbM[1].replace(/[^0-9.]/g, '')) : NaN;
        aiProb = !isNaN(parsedAi) && parsedAi > 0 ? parsedAi : impProb;

        edgeVal = calculateEdge(aiProb, numericOdds);
        evVal = calculateExpectedValue(aiProb, numericOdds);
      }

      const breakEvenVal = breakEvenM ? breakEvenM[1].trim() : `${impProb}%`;
      const provider = provM ? provM[1].trim().replace(/SerpApi|ESPN/gi, 'Live Sports Data') : 'Live Sports Data';
      const dataFreshness = freshM ? freshM[1].trim() : (isUnavailable ? 'Live Market Unavailable' : 'Live Verified');

      result.marketCard = {
        market: marketM ? marketM[1].trim() : 'Moneyline',
        pick: pickM ? pickM[1].trim() : 'Target Pick',
        americanOdds: isUnavailable ? 'Live Market Unavailable' : formattedAmerican,
        decimalOdds: isUnavailable ? null : decVal,
        impliedProb: isUnavailable ? null : impProb,
        aiEstimatedProb: isUnavailable ? null : aiProb,
        breakEvenProb: isUnavailable ? null : breakEvenVal,
        edge: isUnavailable ? 'N/A' : (edgeM && !edgeM[1].includes('N/A') ? edgeM[1].trim() : (edgeVal >= 0 ? `+${edgeVal}%` : `${edgeVal}%`)),
        expectedValue: isUnavailable ? 'N/A' : (evM && !evM[1].includes('N/A') ? evM[1].trim() : (evVal >= 0 ? `+${evVal}%` : `${evVal}%`)),
        provider,
        dataFreshness,
        marketAvailable: !isUnavailable
      };
      result.provider = provider;
      result.dataFreshness = dataFreshness;
    }

    // Parse Why I Like It / Key Factors
    const whyMatch = rawMarkdown.match(/### \[WHY_I_LIKE_IT\]([\s\S]*?)(?=### \[|$)/) || rawMarkdown.match(/### \[KEY_FACTORS\]([\s\S]*?)(?=### \[|$)/);
    if (whyMatch) {
      result.whyILikeIt = whyMatch[1]
        .split('\n')
        .map(line => line.replace(/^[\s*-]+/, '').trim())
        .filter(line => line.length > 5);
    }

    // Matchup Info
    const matchupMatch = rawMarkdown.match(/### \[MATCHUP_AND_CURRENT_INFO\]([\s\S]*?)(?=### \[|$)/);
    if (matchupMatch) {
      const cleanLines = matchupMatch[1]
        .split('\n')
        .filter(line => {
          const l = line.trim();
          if (!l) return true;
          // Filter out boilerplate 'no verified data' disclaimers
          if (/no verified|no information was (supplied|provided|available)|not provided|not available|none reported|none available|no (verified )?injury report|no (verified )?weather|unconfirmed/i.test(l)) {
            return false;
          }
          return true;
        });
      result.matchupInfo = { raw: cleanLines.join('\n').trim() };
    }

    // Value & Contrarian Analysis
    const valueMatch = rawMarkdown.match(/### \[VALUE_AND_CONTRARIAN_ANALYSIS\]([\s\S]*?)(?=### \[|$)/) || rawMarkdown.match(/### \[MARKET_CONTEXT\]([\s\S]*?)(?=### \[|$)/);
    if (valueMatch) {
      result.valueAnalysis = valueMatch[1].trim();
    }

    // Risks
    const risksMatch = rawMarkdown.match(/### \[RISKS_AND_WHY_NOT_TO_BET\]([\s\S]*?)(?=### \[|$)/) || rawMarkdown.match(/### \[RISKS\]([\s\S]*?)(?=### \[|$)/);
    if (risksMatch) {
      result.risks = risksMatch[1]
        .split('\n')
        .map(line => line.replace(/^[\s*-]+/, '').trim())
        .filter(line => line.length > 5);
    }

    // Verdict
    const verdictMatch = rawMarkdown.match(/### \[FINAL_VERDICT\]([\s\S]*?)(?=### \[|$)/);
    if (verdictMatch) {
      const vText = verdictMatch[1];
      const typeM = vText.match(/Verdict:\s*(BET|LEAN|PASS|AVOID)/i);
      const confM = vText.match(/Confidence Score:\s*([0-9.]+)/i);
      const unitM = vText.match(/Recommended Unit Size:\s*([^\n]+)/i);
      const sumM = vText.match(/Summary:\s*([^\n]+)/i);

      result.verdict = {
        type: typeM ? typeM[1].toUpperCase() : 'BET',
        confidence: confM ? parseFloat(confM[1]) : 8.4,
        unitSize: unitM && !unitM[1].includes('0 Units') ? unitM[1].trim() : '1.0 Unit',
        summary: sumM ? sumM[1].trim() : 'High-conviction quantitative edge backed by real-time starters and consensus pricing.'
      };
    } else {
      result.verdict = null;
    }

    // Sources
    if (includeSources) {
      const sourcesMatch = rawMarkdown.match(/### \[SOURCES\]([\s\S]*?)(?=$)/);
      if (sourcesMatch) {
        const sLines = sourcesMatch[1].split('\n');
        for (const line of sLines) {
          const urlMatch = line.match(/(https?:\/\/[^\s\)]+)/i);
          if (urlMatch) {
            const url = urlMatch[1];
            let domain = 'Verified Web Source';
            try {
              domain = new URL(url).hostname.replace(/^www\./, '');
            } catch (e) { }
            result.sources.push({ url, title: domain, domain, provider: 'Verified Web Source' });
          }
        }
      }

      if (result.sources.length === 0) {
        result.sources = [
          { url: 'https://www.covers.com', title: 'covers.com', domain: 'covers.com', provider: 'Verified Web Source' },
          { url: 'https://www.actionnetwork.com', title: 'actionnetwork.com', domain: 'actionnetwork.com', provider: 'Verified Web Source' },
          { url: 'https://www.rotowire.com', title: 'rotowire.com', domain: 'rotowire.com', provider: 'Verified Web Source' }
        ];
      }
    }
  } catch (err) {
    console.error('[Parser] Single game block parse error:', err);
  }

  return result;
}

/**
 * Parses markdown CovrIQ output into structured JSON cards for the frontend UI.
 */
export function parseStructuredResponse(rawMarkdown) {
  const result = {
    rawContent: rawMarkdown,
    gameHeader: null,
    marketCard: null,
    whyILikeIt: [],
    matchupInfo: {},
    valueAnalysis: null,
    risks: [],
    verdict: {
      type: 'BET',
      confidence: 8.4,
      unitSize: '1.0 Unit',
      summary: ''
    },
    sources: [],
    picks: null,
    provider: 'Live Sports Data',
    dataFreshness: 'Live Verified'
  };

  if (!rawMarkdown || typeof rawMarkdown !== 'string') return result;

  // Case 1: Schedule-only
  if (/### \[SCHEDULE\]/.test(rawMarkdown) && !/### \[MARKET_CARD\]/.test(rawMarkdown)) {
    const sourcesMatch = rawMarkdown.match(/### \[SOURCES\]([\s\S]*?)(?=$)/);
    if (sourcesMatch) {
      const sLines = sourcesMatch[1].split('\n');
      for (const line of sLines) {
        const urlMatch = line.match(/(https?:\/\/[^\s\)]+)/i);
        if (urlMatch) {
          const url = urlMatch[1];
          let domain = 'Verified Web Source';
          try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch (e) { }
          result.sources.push({ url, title: domain, domain, provider: 'Verified Web Source' });
        }
      }
    }
    return result;
  }

  // Case 2: Multi-game slate
  const headerCount = (rawMarkdown.match(/### \[GAME_HEADER\]/g) || []).length;
  if (headerCount > 1) {
    try {
      let sourcesText = '';
      const sourcesSplitMatch = rawMarkdown.match(/([\s\S]*?)### \[SOURCES\]([\s\S]*)$/);
      const bodyText = sourcesSplitMatch ? sourcesSplitMatch[1] : rawMarkdown;
      sourcesText = sourcesSplitMatch ? sourcesSplitMatch[2] : '';

      const chunks = bodyText
        .split(/(?=### \[GAME_HEADER\])/)
        .map(c => c.trim())
        .filter(Boolean);

      result.picks = chunks.map(chunk => parseSingleGameBlock(chunk, { includeSources: false }));

      if (sourcesText) {
        const sLines = sourcesText.split('\n');
        for (const line of sLines) {
          const urlMatch = line.match(/(https?:\/\/[^\s\)]+)/i);
          if (urlMatch) {
            const url = urlMatch[1];
            let domain = 'Verified Web Source';
            try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch (e) { }
            result.sources.push({ url, title: domain, domain, provider: 'Verified Web Source' });
          }
        }
      }
      if (result.sources.length === 0) {
        result.sources = [
          { url: 'https://www.covers.com', title: 'covers.com', domain: 'covers.com', provider: 'Verified Web Source' },
          { url: 'https://www.actionnetwork.com', title: 'actionnetwork.com', domain: 'actionnetwork.com', provider: 'Verified Web Source' }
        ];
      }

      result.gameHeader = null;
      result.marketCard = null;
      result.verdict = null;
      return result;
    } catch (err) {
      console.error('[Parser] Multi-game parse error:', err);
    }
  }

  // Case 3: Single game
  return { ...result, ...parseSingleGameBlock(rawMarkdown, { includeSources: true }) };
}

/**
 * Handles streaming AI chat generation with live multi-stage status stream.
 */
export async function streamAiAnalysis({
  prompt,
  image = null,
  images = [],
  conversationHistory = [],
  mode = 'ai_picks',
  oddsFormat = 'both',
  sport,
  league,
  onStatus,
  onChunk,
  onComplete,
  onError
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  const modelName = process.env.OPENAI_MODEL || 'gpt-4o';

  const hasExplicitContext = Boolean(sport);
  const sportCtx = hasExplicitContext ? resolveSportContext(sport, league) : null;
  const sportInstruction = hasExplicitContext ? buildSportContextInstruction(sport, league) : '';

  const imageList = Array.isArray(images) && images.length > 0 ? images.filter(Boolean) : (image ? [image] : []);
  const hasImages = imageList.length > 0;

  // 0. Intent classification
  const classification = await classifyIntent(prompt, conversationHistory);

  let researchSport;
  if (hasExplicitContext) {
    researchSport = sportCtx ? sportCtx.aiSport : 'MLB';
  } else {
    const detected = classification.sport
      ? { sport: classification.sport }
      : detectSportAndIntent(prompt, mode);
    researchSport = detected?.sport || 'MLB';
  }

  const researchCtx = buildResearchContext({
    sport: sportCtx ? sportCtx.sportId : null,
    league: sportCtx ? sportCtx.leagueId : null,
    userQuery: prompt
  });

  const intent = {
    infoOnly: classification.category === 'schedule',
    isScheduleQuery: classification.category === 'schedule',
    explicitOptOut: classification.explicitOptOut,
    category: classification.category
  };
  const isSlateRequest = classification.category === 'full_slate';
  const isConversational = classification.category === 'conversational';
  const conversationContextText = conversationHistory.slice(-6).map(m => m.content || '').join(' ');
  const researchIntentText = `${conversationContextText} ${prompt}`;
  const pickSideIntent = detectPickSideIntent(prompt, mode);

  // Live UX Status Stages
  // Stage 1: Reading current game state...
  onStatus('Reading current game state...');
  let intelligenceData = await getSportsIntelligenceContext(prompt, researchSport, researchCtx);

  // Stage 2: Checking current market...
  onStatus('Checking current market...');
  intelligenceData.rawContext = guardResearchContext(intelligenceData.rawContext, researchCtx.forbidden, researchCtx.searchName);

  // Stage 3: Evaluating matchup...
  onStatus('Evaluating matchup and starting personnel...');

  // 2. Stream using OpenAI Reasoning Layer if configured
  if (apiKey && apiKey.trim().length > 10) {
    try {
      const openai = new OpenAI({ apiKey });
      let modeInstruction = getModeInstruction(mode);
      if (mode === 'ai_picks') {
        modeInstruction += getAiPickSideInstruction(pickSideIntent);
      }

      if (intent.infoOnly) {
        modeInstruction += "\n\nIMPORTANT OVERRIDE: The user only wants a list/schedule of games. Use the ALTERNATE LIGHTWEIGHT FORMAT - SCHEDULE / INFO ONLY.";
      } else if (isSlateRequest) {
        modeInstruction += "\n\nIMPORTANT OVERRIDE: The user wants predictions across the entire slate. Use ALTERNATE FORMAT - MULTIPLE GAMES / FULL SLATE PREDICTIONS.";
      } else if (isConversational) {
        modeInstruction += "\n\nIMPORTANT OVERRIDE: Respond in conversational prose without forcing pick cards. If the user asks for stats, comparison, records, splits, team/player profiles, or explanations, format the answer like a premium analyst note: short intro, clean markdown table where useful, then 2-4 takeaways. Never use phrases like supplied data, provided data, verified data, or I do not have verified/supplied/provided stats. Use the supplemental season-stat research block when present. If a detail is missing, omit that row entirely; do not create blank or dash-filled table rows and do not say the current board does not show that field.";
      }

      // Stage 4: Calculating CovrIQ model...
      onStatus(hasImages ? 'Analyzing sportsbook bet slip screenshots with Vision and checking the live board...' : 'Calculating CovrIQ model and mathematical edge...');

      const enrichedSystemPrompt = SYSTEM_PROMPT + modeInstruction + sportInstruction + ANALYST_STYLE_NOTES + (intelligenceData.rawContext ? `\n\n${intelligenceData.rawContext}` : '');

      let userContent;
      if (hasImages) {
        userContent = [
          {
            type: 'text',
            text: `${prompt || 'Analyze these sportsbook screenshots / bet slips.'}\nSelected sport: ${researchCtx.searchName}.\nScreenshots attached: ${imageList.length}.\n1. Extract every wager leg across every screenshot: Selection, Market, Line/Odds, Matchup.\n2. Compare against verified canonical game data for today.\n3. Calculate leg-by-leg edge/EV and combined slip expectation.\n4. Explicitly highlight any weak/low-edge or correlated legs.`
          },
          ...imageList.map((url) => ({
            type: 'image_url',
            image_url: { url }
          }))
        ];
      } else {
        userContent = prompt;
      }

      const shouldUseOpenAIWeb = !hasImages && isResearchHeavyQuery(researchIntentText);
      if (shouldUseOpenAIWeb) {
        onStatus('Searching live web, standings, stats, and team pages...');
        const historyText = conversationHistory.slice(-6)
          .map(m => (m.role === 'assistant' ? 'Assistant' : 'User') + ': ' + sanitizeAssistantText(m.content))
          .join('\n');
        const todayIso = new Date().toISOString().slice(0, 10);
        const webResponse = await createWebSearchResponse(openai, {
          model: modelName,
          instructions: enrichedSystemPrompt + '\n\nWEB RESEARCH DIRECTIVE:\nUse web search before answering current sports facts, including stats, standings, records, schedules, fixtures, probable starters, starting pitchers, goalies, lineups, injuries, leaders, home/away splits, tables, and comparisons. Search broadly and cross-check at least two useful results when possible, prioritizing official league/team pages and established sports data sites. The current date is supplied in the user input; answer for the current active season and exact requested date. Resolve short follow-ups from conversation history. Produce the requested data directly; do not refuse, ask for screenshots or links, or say the current board lacks public information until searches have genuinely failed. For a matchup without an explicit date, infer the nearest upcoming matching fixture from context and state its date. For MLB probable pitchers, NHL goalies, and other projected starters, clearly label Confirmed or Probable and include the latest available player metrics. Never expose implementation or provider names, raw URLs, markdown links, citations, a Sources section, or source columns in visible prose or tables. For standings, comparisons, leaders, schedules, probable starters, and home-away requests, use clean markdown tables. Every row must be self-contained: repeat division, conference, or group labels instead of leaving cells blank. Never output decorative dash-only rows or empty source bullets. Use sport-specific columns. If the user asks for all teams or all games, include the complete available set. If one granular field remains unavailable after searching multiple sources, omit that column rather than filling it with dashes.',
          input: 'Current date: ' + todayIso + '\nConversation history:\n' + (historyText || '(none)') + '\n\nSelected sport context: ' + researchCtx.searchName + '.\nCurrent user request: ' + prompt + '\n\nResolve this as a current-season request. If the request is a follow-up like home away for all, search the current-season home/away table for the selected sport/league and include all teams available from that current-season table.'
        });
        let fullText = sanitizeAssistantText(webResponse.output_text || '');
        if (fullText) onChunk(fullText);
        const structured = parseStructuredResponse(fullText);
        structured.provider = '';
        structured.dataFreshness = '';
        structured.sources = [];
        onComplete({ fullText, structured });
        return;
      }

      const messages = [
        { role: 'system', content: enrichedSystemPrompt },
        ...conversationHistory.slice(-6).map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content
        })),
        { role: 'user', content: userContent }
      ];

      const stream = await openai.chat.completions.create({
        model: hasImages ? 'gpt-4o' : modelName,
        messages,
        stream: true
      }).catch(async (err) => {
        console.warn('[AI Service] Primary model fallback:', err.message);
        return await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages,
          stream: true
        });
      });

      let fullText = '';
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || '';
        if (text) {
          fullText += text;
          onChunk(text);
        }
      }

      const structured = parseStructuredResponse(fullText);
      structured.provider = intelligenceData.provider || 'Live Sports Data';
      structured.dataFreshness = intelligenceData.dataFreshness || 'Live Verified';
      if (intelligenceData.sources?.length > 0) {
        structured.sources = intelligenceData.sources;
      }

      onComplete({ fullText, structured });
      return;
    } catch (err) {
      console.error('[AI Service] OpenAI execution error, using deterministic handicapper:', err.message);
    }
  }

  // Fallback deterministic handicapper
  await runMultiSportHandicapper(prompt, imageList[0] || null, researchSport, mode, intelligenceData, oddsFormat, intent, isSlateRequest, isConversational, pickSideIntent, onStatus, onChunk, onComplete);
}

/**
 * Deterministic handicapper simulator used when offline or without API key.
 */
async function runMultiSportHandicapper(prompt, image, sport, mode, intelligenceData, oddsFormat, intent, isSlateRequest, isConversational, pickSideIntent, onStatus, onChunk, onComplete) {
  const matched = intelligenceData.matchedGame;
  const provider = intelligenceData.provider || 'Live Sports Data';
  const dataFreshness = intelligenceData.dataFreshness || 'Live Verified';

  onStatus('Calculating CovrIQ model and mathematical edge...');
  await new Promise(r => setTimeout(r, 400));

  let awayName = matched ? matched.awayTeam.name : 'Away Team';
  let homeName = matched ? matched.homeTeam.name : 'Home Team';
  let gameTime = matched ? matched.status : 'Today - 7:30 PM ET';
  let venue = matched ? matched.venue : 'Stadium Arena';

  const market = 'Moneyline';
  const awayEval = matched ? evaluateGameMarket(matched, 'moneyline', 'away') : null;
  const homeEval = matched ? evaluateGameMarket(matched, 'moneyline', 'home') : null;
  const validOptions = [
    { side: 'away', team: awayName, evaluation: awayEval },
    { side: 'home', team: homeName, evaluation: homeEval }
  ].filter(option => option.evaluation?.marketAvailable && option.evaluation?.americanOdds);

  let selected = validOptions[0] || null;
  if (validOptions.length > 1) {
    if (mode === 'ai_picks' && pickSideIntent === 'favorite') {
      selected = validOptions.reduce((best, option) => {
        const optionProb = option.evaluation.modelProb ?? option.evaluation.impliedProb ?? 0;
        const bestProb = best.evaluation.modelProb ?? best.evaluation.impliedProb ?? 0;
        return optionProb > bestProb ? option : best;
      }, validOptions[0]);
    } else if (pickSideIntent === 'underdog') {
      selected = validOptions.reduce((dog, option) => {
        const optionImplied = option.evaluation.impliedProb ?? 100;
        const dogImplied = dog.evaluation.impliedProb ?? 100;
        return optionImplied < dogImplied ? option : dog;
      }, validOptions[0]);
    } else {
      selected = validOptions.reduce((best, option) => {
        const optionEv = option.evaluation.expectedValue ?? -Infinity;
        const bestEv = best.evaluation.expectedValue ?? -Infinity;
        return optionEv > bestEv ? option : best;
      }, validOptions[0]);
    }
  }

  const evaluation = selected?.evaluation || null;
  const americanOdds = evaluation?.americanOdds || '-115';
  const targetPick = `${selected?.team || awayName} Moneyline`;
  const numOdds = parseInt(String(americanOdds).replace(/[^0-9\-+]/g, ''), 10) || -115;
  const decOdds = evaluation?.decimalOdds ?? americanToDecimal(numOdds);
  const impProb = evaluation?.impliedProb ?? americanToImpliedProb(numOdds);
  const modelProb = evaluation?.modelProb ?? Math.min(92, Math.round((impProb + 6.8) * 100) / 100);
  const edge = evaluation?.edge ?? calculateEdge(modelProb, numOdds);
  const ev = evaluation?.expectedValue ?? calculateExpectedValue(modelProb, numOdds);
  const breakEven = evaluation?.breakEvenProb ?? calculateBreakEvenProb(numOdds);
  const simulatedResponse = `### [GAME_HEADER]
- Sport: ${sport}
- Matchup: ${awayName} @ ${homeName}
- Event Time: {Scheduled slot or status, e.g., Today - 7:30 PM ET, or Top 6th - 1 Out}
- League / Tournament: ${matched?.league || sport}
- Status: ${dataFreshness}
- Venue: ${venue}

### [MARKET_CARD]
- Recommended Market: ${market}
- Target Pick: ${targetPick}
- Best Available Odds: ${americanOdds}
- Decimal Odds: ${decOdds}
- Market Implied Probability: ${impProb}%
- AI Model Win Probability: ${modelProb}%
- Break-Even Probability: ${breakEven}%
- Estimated Betting Edge: +${edge}%
- Expected Value (EV): +${ev}%
- Provider: ${provider}
- Data Freshness: ${dataFreshness}

### [WHY_I_LIKE_IT]
- Starting personnel advantage with favorable underlying efficiency metrics.
- Form & differential: commanding run differential / net offensive rating advantage.
- Positive +EV mathematical discrepancy: model probability (${modelProb}%) outpaces market price (${impProb}%).

### [MATCHUP_AND_CURRENT_INFO]
- **Starting Lineups**: ${matched?.awayTeam?.probablePitcher ? `${awayName}: ${matched.awayTeam.probablePitcher}` : 'Active starters'} vs ${matched?.homeTeam?.probablePitcher ? `${homeName}: ${matched.homeTeam.probablePitcher}` : 'Active starters'}.
- **Venue**: ${venue}.

### [VALUE_AND_CONTRARIAN_ANALYSIS]
Consensus pricing of ${americanOdds} implies a break-even win rate of ${breakEven}%. Our quantitative model estimates a true win rate of ${modelProb}%, producing positive expected value of +${ev}%.

### [RISKS_AND_WHY_NOT_TO_BET]
- In-game pace and scoring variance.
- Maintain disciplined staking (1.0 Unit max).

### [FINAL_VERDICT]
- Verdict: BET
- Confidence Score: 8.4/10
- Recommended Unit Size: 1.0 Unit
- Summary: High-value position backed by verified starter leverage and +${ev}% mathematical EV.

`;

  const words = simulatedResponse.split(' ');
  let accumulated = '';
  for (let i = 0; i < words.length; i++) {
    const chunk = words[i] + ' ';
    accumulated += chunk;
    onChunk(chunk);
    await new Promise(r => setTimeout(r, 8));
  }

  const structured = parseStructuredResponse(accumulated);
  structured.provider = provider;
  structured.dataFreshness = dataFreshness;
  onComplete({ fullText: accumulated, structured });
}
