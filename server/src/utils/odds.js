/**
 * CovrIQ Quantitative Odds & Sports Math Engine
 * Precise, deterministic sports betting math:
 * American, Decimal, Implied Probability, Break-Even Probability,
 * Probability Edge, Expected Value (EV), Payout, Parlays, and Closing Line Value (CLV).
 */

/**
 * Converts American odds to Decimal odds (rounded to 2 decimal places).
 * Positive: Decimal = 1 + (American / 100)
 * Negative: Decimal = 1 + (100 / abs(American))
 * @param {number|string} american 
 * @returns {number}
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

/**
 * High-precision Decimal odds from American odds (unrounded float).
 * @param {number|string} american 
 * @returns {number}
 */
export function americanToDecimalPrecise(american) {
  const am = Number(american);
  if (isNaN(am) || am === 0) return 1.0;
  if (am > 0) {
    return 1 + (am / 100);
  } else {
    return 1 + (100 / Math.abs(am));
  }
}

/**
 * Converts Decimal odds to American odds string (e.g. "+125" or "-135").
 * @param {number|string} decimal 
 * @returns {string}
 */
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

/**
 * Calculates Implied Probability (%) from American odds.
 * Positive American: 100 / (American + 100) * 100
 * Negative American: abs(American) / (abs(American) + 100) * 100
 * @param {number|string} american 
 * @returns {number} (e.g. 52.38)
 */
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

/**
 * Calculates Implied Probability (%) from Decimal odds.
 * Implied % = (1 / Decimal) * 100
 * @param {number|string} decimal 
 * @returns {number}
 */
export function decimalToImpliedProb(decimal) {
  const dec = Number(decimal);
  if (isNaN(dec) || dec <= 1.0) return 0;
  const prob = (1 / dec) * 100;
  return Math.round(prob * 100) / 100;
}

/**
 * Calculates Break-Even Win Probability (%).
 * Break-Even % is the win percentage required for a wager at these odds to have zero expected profit.
 * Break-Even % = (1 / DecimalOdds) * 100
 * @param {number|string} odds - American or Decimal
 * @param {boolean} isAmerican 
 * @returns {number}
 */
export function calculateBreakEvenProb(odds, isAmerican = true) {
  const dec = isAmerican ? americanToDecimalPrecise(odds) : Number(odds);
  if (isNaN(dec) || dec <= 1.0) return 50.0;
  return Math.round((1 / dec) * 10000) / 100;
}

/**
 * Calculates Probability Edge (percentage point difference between Model Prob and Implied Prob).
 * Edge = ModelProb% - ImpliedProb%
 * @param {number} modelProb - Win probability in % (e.g. 58.5)
 * @param {number|string} odds - American odds (e.g. -110) or Decimal odds
 * @param {boolean} isAmerican 
 * @returns {number} Edge in percentage points (e.g. +6.12)
 */
export function calculateEdge(modelProb, odds, isAmerican = true) {
  const implied = isAmerican ? americanToImpliedProb(odds) : decimalToImpliedProb(odds);
  const edge = Number(modelProb) - implied;
  return Math.round(edge * 100) / 100;
}

/**
 * Calculates Expected Value (EV%) percentage.
 * EV% = ((ModelProbability% / 100) * DecimalOdds - 1) * 100
 * @param {number} modelProb - Estimated win probability in % (e.g. 55.0)
 * @param {number|string} odds - American (e.g. -110) or Decimal (e.g. 1.91)
 * @param {boolean} isAmerican 
 * @returns {number} Expected Value % (e.g. +5.05)
 */
export function calculateExpectedValue(modelProb, odds, isAmerican = true) {
  const prob = Number(modelProb) / 100;
  if (isNaN(prob) || prob <= 0 || prob > 1) return 0;

  const dec = isAmerican ? americanToDecimalPrecise(odds) : Number(odds);
  if (isNaN(dec) || dec <= 1) return 0;

  const ev = (prob * dec - 1) * 100;
  return Math.round(ev * 100) / 100;
}

/**
 * Calculates deterministic payout and profit on a given stake.
 * @param {number} stake - Amount wagered in currency units (e.g. 100)
 * @param {number|string} odds - American or Decimal odds
 * @param {boolean} isAmerican 
 * @returns {object} { stake, decimalOdds, totalPayout, profit, roi }
 */
export function calculatePayout(stake, odds, isAmerican = true) {
  const s = Math.max(0, Number(stake) || 0);
  const dec = isAmerican ? americanToDecimalPrecise(odds) : Math.max(1, Number(odds) || 1);
  const totalPayout = Math.round(s * dec * 100) / 100;
  const profit = Math.round((totalPayout - s) * 100) / 100;
  const roi = s > 0 ? Math.round((profit / s) * 10000) / 100 : 0;

  return {
    stake: s,
    decimalOdds: Math.round(dec * 100) / 100,
    totalPayout,
    profit,
    roi
  };
}

/**
 * Calculates Closing Line Value (CLV).
 * Compares entry odds (price when bet was placed) against closing odds (game start price).
 * CLV % = ((DecimalEntry / DecimalClosing) - 1) * 100
 * Positive CLV means the user got a better price than the market closed at (beating the closing line).
 * @param {number|string} entryOdds - American or Decimal
 * @param {number|string} closingOdds - American or Decimal
 * @param {boolean} isAmerican 
 * @returns {object} { entryDecimal, closingDecimal, clvPercent, probDiff, beatClosingLine }
 */
export function calculateCLV(entryOdds, closingOdds, isAmerican = true) {
  if (!entryOdds || !closingOdds) {
    return {
      entryDecimal: null,
      closingDecimal: null,
      clvPercent: null,
      probDiff: null,
      beatClosingLine: null
    };
  }

  const decEntry = isAmerican ? americanToDecimalPrecise(entryOdds) : Number(entryOdds);
  const decClosing = isAmerican ? americanToDecimalPrecise(closingOdds) : Number(closingOdds);

  if (isNaN(decEntry) || isNaN(decClosing) || decEntry <= 1 || decClosing <= 1) {
    return {
      entryDecimal: null,
      closingDecimal: null,
      clvPercent: null,
      probDiff: null,
      beatClosingLine: null
    };
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

/**
 * Formats Odds for standard display based on user preference.
 * @param {number|string} american 
 * @param {'american'|'decimal'|'both'} format 
 * @returns {object} { american, decimal, impliedProb, displayString }
 */
export function formatOdds(american, format = 'both') {
  const amNum = Number(american);
  const formattedAmerican = amNum > 0 ? `+${amNum}` : `${amNum}`;
  const dec = americanToDecimal(amNum);
  const implied = americanToImpliedProb(amNum);

  let displayString = '';
  switch (format) {
    case 'american':
      displayString = `${formattedAmerican} (${implied}%)`;
      break;
    case 'decimal':
      displayString = `${dec.toFixed(2)} (${implied}%)`;
      break;
    case 'both':
    default:
      displayString = `${formattedAmerican} / ${dec.toFixed(2)} (${implied}%)`;
      break;
  }

  return {
    american: formattedAmerican,
    decimal: dec,
    impliedProb: implied,
    displayString
  };
}

/**
 * Calculates multi-leg Parlay Math with leg-by-leg diagnostics.
 * @param {Array<{ odds: number|string, modelProb?: number, label?: string } | number | string>} legs 
 * @returns {object} { combinedDecimal, combinedAmerican, combinedImpliedProb, combinedModelProb, parlayEdge, parlayEV, payoutOn100, legs, weakestLeg }
 */
export function calculateParlay(legs) {
  if (!Array.isArray(legs) || legs.length === 0) {
    return {
      combinedDecimal: 1.0,
      combinedAmerican: "+100",
      combinedImpliedProb: 100,
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

  const combinedDecimalPrecise = processedLegs.reduce((acc, curr) => acc * curr.decimalPrecise, 1);
  const combinedDecimal = Math.round(combinedDecimalPrecise * 100) / 100;
  const combinedAmerican = decimalToAmerican(combinedDecimalPrecise);
  const combinedImpliedProb = Math.round((1 / combinedDecimalPrecise) * 10000) / 100;

  // If model probabilities exist for all legs, compute combined win probability
  const allHaveModelProb = processedLegs.every(l => l.modelProb !== null && l.modelProb > 0);
  let combinedModelProb = null;
  let parlayEdge = null;
  let parlayEV = null;

  if (allHaveModelProb) {
    const combinedProbFraction = processedLegs.reduce((acc, curr) => acc * (curr.modelProb / 100), 1);
    combinedModelProb = Math.round(combinedProbFraction * 10000) / 100;
    parlayEdge = Math.round((combinedModelProb - combinedImpliedProb) * 100) / 100;
    parlayEV = Math.round(((combinedProbFraction * combinedDecimalPrecise) - 1) * 10000) / 100;
  }

  // Find weakest leg (lowest model win prob, or lowest edge, or highest implied risk)
  let weakestLeg = null;
  if (processedLegs.length > 0) {
    weakestLeg = processedLegs.reduce((worst, curr) => {
      const currScore = curr.edge !== null ? curr.edge : -curr.impliedProb;
      const worstScore = worst.edge !== null ? worst.edge : -worst.impliedProb;
      return currScore < worstScore ? curr : worst;
    }, processedLegs[0]);
  }

  const payoutOn100 = Math.round(100 * combinedDecimalPrecise * 100) / 100;

  return {
    combinedDecimal,
    combinedAmerican,
    combinedImpliedProb,
    combinedModelProb,
    parlayEdge,
    parlayEV,
    payoutOn100,
    legs: processedLegs,
    weakestLeg
  };
}
