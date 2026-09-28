import test from 'node:test';
import assert from 'node:assert/strict';
import {
  americanToDecimal,
  americanToImpliedProb,
  decimalToImpliedProb,
  decimalToAmerican,
  calculateExpectedValue,
  calculateEdge,
  formatOdds,
  calculateParlay
} from '../src/utils/odds.js';

test('Odds Conversion: Positive American to Decimal (+125 -> 2.25)', () => {
  const decimal = americanToDecimal(125);
  assert.equal(decimal, 2.25, 'Decimal odds for +125 must be 2.25');
});

test('Odds Conversion: Negative American to Decimal (-135 -> 1.74)', () => {
  const decimal = americanToDecimal(-135);
  assert.equal(decimal, 1.74, 'Decimal odds for -135 must be 1.74 (1 + 100/135)');
});

test('Odds Conversion: Even Money (+100 and -100 -> 2.0)', () => {
  assert.equal(americanToDecimal(100), 2.0);
  assert.equal(americanToDecimal(-100), 2.0);
});

test('Implied Probability: Positive American (+125 -> 44.44%)', () => {
  const prob = americanToImpliedProb(125);
  // 100 / (125 + 100) = 44.444...% -> 44.44%
  assert.equal(prob, 44.44, 'Implied prob for +125 must be 44.44%');
});

test('Implied Probability: Negative American (-135 -> 57.45%)', () => {
  const prob = americanToImpliedProb(-135);
  // 135 / (135 + 100) = 135 / 235 = 57.4468% -> 57.45%
  assert.equal(prob, 57.45, 'Implied prob for -135 must be 57.45%');
});

test('Implied Probability from Decimal (1.74 -> 57.47%, 2.25 -> 44.44%)', () => {
  assert.equal(decimalToImpliedProb(2.25), 44.44);
  assert.equal(decimalToImpliedProb(1.74), 57.47);
});

test('Decimal to American Conversion (2.25 -> +125, 1.74 -> -135)', () => {
  assert.equal(decimalToAmerican(2.25), '+125');
  assert.equal(decimalToAmerican(1.74074), '-135');
});

test('Expected Value (EV) Calculation', () => {
  // If AI estimates 50% win probability on +125 underdog:
  // EV = (0.50 * 2.25 - 1) * 100 = (1.125 - 1) * 100 = +12.5%
  const ev = calculateExpectedValue(50, 125, true);
  assert.equal(ev, 12.5, 'EV for 50% on +125 should be +12.5%');

  // If AI estimates 50% win probability on -135 favorite:
  // EV = (0.50 * 1.74074 - 1) * 100 = -12.96%
  const evFav = calculateExpectedValue(50, -135, true);
  assert.ok(evFav < 0, 'Negative EV when win prob is below implied prob');
});

test('Edge Calculation', () => {
  // AI estimates 50% on +125 (implied is 44.44%) -> Edge is 50 - 44.44 = +5.56%
  const edge = calculateEdge(50, 125);
  assert.equal(edge, 5.56);
});

test('Format Odds Utility', () => {
  const both = formatOdds(125, 'both');
  assert.equal(both.american, '+125');
  assert.equal(both.decimal, 2.25);
  assert.equal(both.impliedProb, 44.44);
  assert.equal(both.displayString, '+125 / 2.25 (44.44%)');

  const fav = formatOdds(-135, 'both');
  assert.equal(fav.american, '-135');
  assert.equal(fav.decimal, 1.74);
  assert.equal(fav.impliedProb, 57.45);
});

test('Parlay Calculation (2-leg: -110 and +150)', () => {
  // -110 is ~1.909, +150 is 2.50. Product is ~4.77.
  const parlay = calculateParlay([-110, 150]);
  assert.ok(parlay.combinedDecimal > 4.7 && parlay.combinedDecimal < 4.8);
  assert.ok(parlay.combinedAmerican.startsWith('+'));
  assert.ok(parlay.payoutOn100 > 470);
});
