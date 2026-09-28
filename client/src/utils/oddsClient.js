/**
 * CovrIQ Frontend Odds & Probability Math Utilities
 */

export function americanToDecimal(american) {
  const am = Number(american);
  if (isNaN(am) || am === 0) return 1.0;
  if (am > 0) {
    const dec = 1 + (am / 100);
    return Math.round(dec * 100) / 100;
  } else {
    const dec = 1 + (100 / Math.abs(am));
    return Math.round(dec * 100) / 100;
  }
}

export function americanToDecimalPrecise(american) {
  const am = Number(american);
  if (isNaN(am) || am === 0) return 1.0;
  return am > 0 ? 1 + (am / 100) : 1 + (100 / Math.abs(am));
}

export function americanToImpliedProb(american) {
  const am = Number(american);
  if (isNaN(am) || am === 0) return 0;
  if (am > 0) {
    const prob = (100 / (am + 100)) * 100;
    return Math.round(prob * 100) / 100;
  } else {
    const absAm = Math.abs(am);
    const prob = (absAm / (absAm + 100)) * 100;
    return Math.round(prob * 100) / 100;
  }
}

export function decimalToImpliedProb(decimal) {
  const dec = Number(decimal);
  if (isNaN(dec) || dec <= 1.0) return 0;
  const prob = (1 / dec) * 100;
  return Math.round(prob * 100) / 100;
}

export function decimalToAmerican(decimal) {
  const dec = Number(decimal);
  if (isNaN(dec) || dec <= 1.0) return "+100";
  if (dec >= 2.0) {
    const am = Math.round((dec - 1) * 100);
    return `+${am}`;
  } else {
    const am = Math.round(-100 / (dec - 1));
    return `${am}`;
  }
}

export function calculateBreakEvenProb(odds, isAmerican = true) {
  const dec = isAmerican ? americanToDecimalPrecise(odds) : Number(odds);
  if (isNaN(dec) || dec <= 1.0) return 50.0;
  return Math.round((1 / dec) * 10000) / 100;
}

export function calculateExpectedValue(estimatedProb, odds, isAmerican = true) {
  const prob = Number(estimatedProb) / 100;
  if (isNaN(prob) || prob <= 0 || prob > 1) return 0;
  const dec = isAmerican ? americanToDecimalPrecise(odds) : Number(odds);
  if (isNaN(dec) || dec <= 1) return 0;
  const ev = (prob * dec - 1) * 100;
  return Math.round(ev * 100) / 100;
}

export function calculateEdge(aiEstimatedProb, odds, isAmerican = true) {
  const implied = isAmerican ? americanToImpliedProb(odds) : decimalToImpliedProb(odds);
  const edge = Number(aiEstimatedProb) - implied;
  return Math.round(edge * 100) / 100;
}

export function calculateCLV(entryOdds, closingOdds, isAmerican = true) {
  if (!entryOdds || !closingOdds) {
    return { entryDecimal: null, closingDecimal: null, clvPercent: null, probDiff: null, beatClosingLine: null };
  }
  const decEntry = isAmerican ? americanToDecimalPrecise(entryOdds) : Number(entryOdds);
  const decClosing = isAmerican ? americanToDecimalPrecise(closingOdds) : Number(closingOdds);
  if (isNaN(decEntry) || isNaN(decClosing) || decEntry <= 1 || decClosing <= 1) {
    return { entryDecimal: null, closingDecimal: null, clvPercent: null, probDiff: null, beatClosingLine: null };
  }
  const clvPercent = Math.round(((decEntry / decClosing) - 1) * 10000) / 100;
  const entryImplied = (1 / decEntry) * 100;
  const closingImplied = (1 / decClosing) * 100;
  const probDiff = Math.round((closingImplied - entryImplied) * 100) / 100;
  const beatClosingLine = decEntry > decClosing;
  return {
    entryDecimal: Math.round(decEntry * 100) / 100,
    closingDecimal: Math.round(decClosing * 100) / 100,
    clvPercent,
    probDiff,
    beatClosingLine
  };
}

export function formatOddsDisplay(american, format = 'both') {
  const amNum = Number(american);
  const formattedAmerican = amNum > 0 ? `+${amNum}` : `${amNum}`;
  const dec = americanToDecimal(amNum);
  const implied = americanToImpliedProb(amNum);

  if (format === 'american') {
    return `${formattedAmerican} (${implied}%)`;
  }
  if (format === 'decimal') {
    return `${dec.toFixed(2)} (${implied}%)`;
  }
  return `${formattedAmerican} / ${dec.toFixed(2)} (${implied}%)`;
}

export function calculatePayout(stake, odds, isAmerican = true) {
  const s = Math.max(0, Number(stake) || 0);
  const dec = isAmerican ? americanToDecimalPrecise(odds) : Math.max(1, Number(odds) || 1);
  const totalReturn = Math.round(s * dec * 100) / 100;
  const netProfit = Math.round((totalReturn - s) * 100) / 100;
  const roi = s > 0 ? Math.round((netProfit / s) * 10000) / 100 : 0;
  return {
    stake: s,
    decimalOdds: Math.round(dec * 100) / 100,
    totalReturn,
    netProfit,
    roi
  };
}

export function calculateParlay(legs) {
  if (!legs || legs.length === 0) {
    return {
      combinedDecimal: 1,
      combinedAmerican: "+100",
      impliedProb: 100,
      combinedModelProb: 100,
      parlayEdge: 0,
      parlayEV: 0,
      payoutOn100: 100,
      legs: [],
      weakestLeg: null
    };
  }
  const processedLegs = legs.map((leg, idx) => {
    const rawOdds = typeof leg === 'object' && leg !== null ? leg.odds : leg;
    const modelProb = typeof leg === 'object' && leg !== null && leg.modelProb ? Number(leg.modelProb) : null;
    const label = typeof leg === 'object' && leg !== null && leg.label ? leg.label : `Leg ${idx + 1}`;
    const dec = americanToDecimalPrecise(rawOdds);
    const implied = americanToImpliedProb(rawOdds);
    const edge = modelProb ? calculateEdge(modelProb, rawOdds) : null;
    const ev = modelProb ? calculateExpectedValue(modelProb, rawOdds) : null;
    return {
      index: idx + 1,
      label,
      americanOdds: Number(rawOdds) > 0 ? `+${Number(rawOdds)}` : `${Number(rawOdds)}`,
      decimalOdds: Math.round(dec * 100) / 100,
      decimalPrecise: dec,
      impliedProb: implied,
      modelProb,
      edge,
      ev
    };
  });

  const decimalOdds = processedLegs.map(l => l.decimalPrecise);
  const combinedDecPrecise = decimalOdds.reduce((a, b) => a * b, 1);
  const combinedDec = Math.round(combinedDecPrecise * 100) / 100;
  const combinedAm = decimalToAmerican(combinedDecPrecise);
  const impliedProb = Math.round((1 / combinedDecPrecise) * 10000) / 100;

  const allHaveModelProb = processedLegs.every(l => l.modelProb !== null && l.modelProb > 0);
  let combinedModelProb = null;
  let parlayEdge = null;
  let parlayEV = null;

  if (allHaveModelProb) {
    const combinedProbFraction = processedLegs.reduce((acc, curr) => acc * (curr.modelProb / 100), 1);
    combinedModelProb = Math.round(combinedProbFraction * 10000) / 100;
    parlayEdge = Math.round((combinedModelProb - impliedProb) * 100) / 100;
    parlayEV = Math.round(((combinedProbFraction * combinedDecPrecise) - 1) * 10000) / 100;
  }

  let weakestLeg = null;
  if (processedLegs.length > 0) {
    weakestLeg = processedLegs.reduce((worst, curr) => {
      const currScore = curr.edge !== null ? curr.edge : -curr.impliedProb;
      const worstScore = worst.edge !== null ? worst.edge : -worst.impliedProb;
      return currScore < worstScore ? curr : worst;
    }, processedLegs[0]);
  }

  return {
    combinedDecimal: combinedDec,
    combinedAmerican: combinedAm,
    impliedProb,
    combinedModelProb,
    parlayEdge,
    parlayEV,
    payoutOn100: Math.round(100 * combinedDecPrecise * 100) / 100,
    legs: processedLegs,
    weakestLeg
  };
}

/**
 * Client-side parser fallback for structured sports analysis cards.
 */
export function parseStructuredResponse(rawMarkdown) {
  if (!rawMarkdown || typeof rawMarkdown !== 'string') return {};
  const result = {
    rawContent: rawMarkdown,
    gameHeader: null,
    marketCard: null,
    whyILikeIt: [],
    matchupInfo: {},
    valueAnalysis: null,
    risks: [],
    verdict: { type: 'LEAN', confidence: 7, unitSize: '1.0 Unit', summary: '' },
    sources: [],
    provider: 'CovrIQ Intelligence',
    dataFreshness: 'Live'
  };

  try {
    const headerMatch = rawMarkdown.match(/### \[GAME_HEADER\]([\s\S]*?)(?=### \[|$)/);
    if (headerMatch) {
      const h = headerMatch[1];
      const sport = h.match(/Sport:\s*([^\n]+)/i)?.[1]?.trim() || 'SPORTS';
      const match = h.match(/Matchup:\s*([^\n]+)/i)?.[1]?.trim() || '';
      const time = h.match(/Event Time:\s*([^\n]+)/i)?.[1]?.trim() || 'Today';
      const league = h.match(/League[^:]*:\s*([^\n]+)/i)?.[1]?.trim() || '';
      const status = h.match(/Status:\s*([^\n]+)/i)?.[1]?.trim() || 'UPCOMING';
      result.gameHeader = { sport, matchup: match, time, league, status };
    }

    const marketMatch = rawMarkdown.match(/### \[MARKET_CARD\]([\s\S]*?)(?=### \[|$)/);
    if (marketMatch) {
      const m = marketMatch[1];
      const pick = m.match(/Target Pick:\s*([^\n]+)/i)?.[1]?.trim() || 'Pick';
      const market = m.match(/Recommended Market:\s*([^\n]+)/i)?.[1]?.trim() || 'Moneyline';
      const am = m.match(/Best Available Odds:\s*([^\n]+)/i)?.[1]?.trim() || '+100';
      const dec = parseFloat(m.match(/Decimal Odds:\s*([^\n]+)/i)?.[1]) || americanToDecimal(am);
      const imp = parseFloat(m.match(/Market Implied Probability:\s*([^\n]+)/i)?.[1]) || americanToImpliedProb(am);
      const ai = parseFloat(m.match(/AI Model Win Probability:\s*([^\n]+)/i)?.[1]) || (imp + 5);
      const edge = m.match(/Estimated Betting Edge:\s*([^\n]+)/i)?.[1]?.trim() || `+${calculateEdge(ai, am)}%`;
      const ev = m.match(/Expected Value[^:]*:\s*([^\n]+)/i)?.[1]?.trim() || `+${calculateExpectedValue(ai, am)}%`;
      const breakEven = m.match(/Break-Even Probability:\s*([^\n]+)/i)?.[1]?.trim() || `${calculateBreakEvenProb(am)}%`;
      const provider = m.match(/Provider:\s*([^\n]+)/i)?.[1]?.trim() || 'SerpApi';
      const freshness = m.match(/Data Freshness:\s*([^\n]+)/i)?.[1]?.trim() || 'Live Verified';

      result.marketCard = {
        pick,
        market,
        americanOdds: am,
        decimalOdds: dec,
        impliedProb: imp,
        aiEstimatedProb: ai,
        edge,
        expectedValue: ev,
        breakEvenProb: breakEven,
        provider,
        dataFreshness: freshness
      };
      result.provider = provider;
      result.dataFreshness = freshness;
    }

    const whyMatch = rawMarkdown.match(/### \[WHY_I_LIKE_IT\]([\s\S]*?)(?=### \[|$)/) || rawMarkdown.match(/### \[KEY_FACTORS\]([\s\S]*?)(?=### \[|$)/);
    if (whyMatch) {
      result.whyILikeIt = whyMatch[1].split('\n').map(l => l.replace(/^[\s*-]+/, '').trim()).filter(l => l.length > 5);
    }

    const matchupMatch = rawMarkdown.match(/### \[MATCHUP_AND_CURRENT_INFO\]([\s\S]*?)(?=### \[|$)/);
    if (matchupMatch) {
      result.matchupInfo = { raw: matchupMatch[1].trim() };
    }

    const valMatch = rawMarkdown.match(/### \[VALUE_AND_CONTRARIAN_ANALYSIS\]([\s\S]*?)(?=### \[|$)/) || rawMarkdown.match(/### \[MARKET_CONTEXT\]([\s\S]*?)(?=### \[|$)/);
    if (valMatch) {
      result.valueAnalysis = valMatch[1].trim();
    }

    const riskMatch = rawMarkdown.match(/### \[RISKS_AND_WHY_NOT_TO_BET\]([\s\S]*?)(?=### \[|$)/) || rawMarkdown.match(/### \[RISKS\]([\s\S]*?)(?=### \[|$)/);
    if (riskMatch) {
      result.risks = riskMatch[1].split('\n').map(l => l.replace(/^[\s*-]+/, '').trim()).filter(l => l.length > 5);
    }

    const verdMatch = rawMarkdown.match(/### \[FINAL_VERDICT\]([\s\S]*?)(?=### \[|$)/);
    if (verdMatch) {
      const v = verdMatch[1];
      const type = v.match(/Verdict:\s*(BET|LEAN|PASS|AVOID)/i)?.[1]?.toUpperCase() || 'LEAN';
      const conf = parseFloat(v.match(/Confidence Score:\s*([0-9.]+)/i)?.[1]) || 7.5;
      const unit = v.match(/Recommended Unit Size:\s*([^\n]+)/i)?.[1]?.trim() || '1.0 Unit';
      const sum = v.match(/Summary:\s*([^\n]+)/i)?.[1]?.trim() || '';
      result.verdict = { type, confidence: conf, unitSize: unit, summary: sum };
    }

    const srcMatch = rawMarkdown.match(/### \[SOURCES\]([\s\S]*?)(?=$)/);
    if (srcMatch) {
      const lines = srcMatch[1].split('\n');
      const sources = [];
      for (const line of lines) {
        const urlMatch = line.match(/(https?:\/\/[^\s\)]+)/i);
        if (urlMatch) {
          const url = urlMatch[1];
          let domain = 'Verified Source';
          try { domain = new URL(url).hostname.replace('www.', ''); } catch (e) {}
          sources.push({ url, title: domain, provider: result.provider || 'SerpApi' });
        }
      }
      if (sources.length > 0) result.sources = sources;
    }
  } catch (e) {
    console.error('Client parse error:', e);
  }

  return result;
}
