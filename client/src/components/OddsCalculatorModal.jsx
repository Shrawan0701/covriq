import React, { useState, useEffect } from 'react';
import {
  X,
  Calculator,
  Layers,
  Plus,
  Trash2,
  TrendingUp,
  Percent,
  DollarSign,
  Activity
} from 'lucide-react';
import {
  americanToDecimal,
  americanToImpliedProb,
  decimalToAmerican,
  decimalToImpliedProb,
  calculateExpectedValue,
  calculateEdge,
  calculatePayout,
  calculateParlay
} from '../utils/oddsClient';
import './OddsCalculatorModal.css';

export default function OddsCalculatorModal({ isOpen, onClose, initialData = null }) {
  const [activeTab, setActiveTab] = useState('single'); // 'single' | 'parlay'

  // Single Bet State
  const [americanOdds, setAmericanOdds] = useState('+125');
  const [stake, setStake] = useState(100);
  const [modelWinProb, setModelWinProb] = useState(52);

  // Parlay State
  const [parlayLegs, setParlayLegs] = useState([
    { id: 1, name: 'Leg 1: NY Yankees ML', odds: '-110' },
    { id: 2, name: 'Leg 2: Celtics -4.5 Spread', odds: '-110' },
    { id: 3, name: 'Leg 3: Arsenal BTTS', odds: '+120' }
  ]);
  const [parlayStake, setParlayStake] = useState(50);

  // Prepopulate if opened with specific bet pick
  useEffect(() => {
    if (initialData) {
      if (initialData.american) setAmericanOdds(String(initialData.american));
      if (initialData.prob) setModelWinProb(Number(initialData.prob));
    }
  }, [initialData]);

  if (!isOpen) return null;

  // Single Calculations
  const numericAm = parseInt(americanOdds, 10) || 100;
  const decimal = americanToDecimal(numericAm);
  const impliedProb = americanToImpliedProb(numericAm);
  const payout = calculatePayout(stake, numericAm, true);
  const ev = calculateExpectedValue(modelWinProb, numericAm, true);
  const edge = calculateEdge(modelWinProb, numericAm);

  // Parlay Calculations
  const parlayOddsList = parlayLegs.map(l => parseInt(l.odds, 10) || 100);
  const parlayResult = calculateParlay(parlayLegs);
  const parlayPayout = calculatePayout(parlayStake, parlayResult.combinedDecimal, false);

  const addParlayLeg = () => {
    setParlayLegs(prev => [
      ...prev,
      { id: Date.now(), name: `Leg ${prev.length + 1}`, odds: '-110' }
    ]);
  };

  const removeParlayLeg = (id) => {
    if (parlayLegs.length <= 1) return;
    setParlayLegs(prev => prev.filter(l => l.id !== id));
  };

  const updateParlayLeg = (id, field, value) => {
    setParlayLegs(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title">
            <Calculator size={20} style={{ color: 'var(--accent-cyan)' }} />
            <span>CovrIQ Odds & Mathematical EV Calculator</span>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)', padding: '4px' }}>
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {/* Tabs */}
          <div className="calc-tabs">
            <button
              className={`calc-tab-btn ${activeTab === 'single' ? 'active' : ''}`}
              onClick={() => setActiveTab('single')}
            >
              Single Bet & Edge / EV
            </button>
            <button
              className={`calc-tab-btn ${activeTab === 'parlay' ? 'active' : ''}`}
              onClick={() => setActiveTab('parlay')}
            >
              Multi-Leg Parlay Compounding
            </button>
          </div>

          {activeTab === 'single' ? (
            <>
              {/* Single Bet Inputs */}
              <div className="calc-input-grid">
                <div className="calc-form-group">
                  <label className="calc-label">American Odds</label>
                  <input
                    type="text"
                    className="calc-input"
                    value={americanOdds}
                    onChange={(e) => setAmericanOdds(e.target.value)}
                    placeholder="+125 or -135"
                  />
                </div>

                <div className="calc-form-group">
                  <label className="calc-label">Wager Stake ($)</label>
                  <input
                    type="number"
                    className="calc-input"
                    value={stake}
                    onChange={(e) => setStake(Number(e.target.value) || 0)}
                    min="1"
                  />
                </div>

                <div className="calc-form-group">
                  <label className="calc-label">Your Win Prob (%)</label>
                  <input
                    type="number"
                    className="calc-input"
                    value={modelWinProb}
                    onChange={(e) => setModelWinProb(Number(e.target.value) || 0)}
                    min="1"
                    max="99"
                  />
                </div>
              </div>

              {/* Exact Formula Mathematical Results Grid */}
              <div className="calc-results-grid">
                <div className="calc-res-item">
                  <span className="calc-res-label">Decimal Odds</span>
                  <span className="calc-res-val cyan">{decimal}</span>
                </div>
                <div className="calc-res-item">
                  <span className="calc-res-label">Market Implied Prob</span>
                  <span className="calc-res-val">{impliedProb}%</span>
                </div>
                <div className="calc-res-item">
                  <span className="calc-res-label">Total Payout Return</span>
                  <span className="calc-res-val">${payout.totalReturn.toFixed(2)}</span>
                </div>
                <div className="calc-res-item">
                  <span className="calc-res-label">Net Profit</span>
                  <span className="calc-res-val highlight">+${payout.netProfit.toFixed(2)}</span>
                </div>
                <div className="calc-res-item">
                  <span className="calc-res-label">Betting Edge</span>
                  <span className={`calc-res-val ${edge >= 0 ? 'highlight' : ''}`}>
                    {edge >= 0 ? `+${edge}%` : `${edge}%`}
                  </span>
                </div>
                <div className="calc-res-item">
                  <span className="calc-res-label">Expected Value (EV)</span>
                  <span className={`calc-res-val ${ev >= 0 ? 'highlight' : ''}`}>
                    {ev >= 0 ? `+${ev}%` : `${ev}%`}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Parlay Calculator */}
              <div className="parlay-header">
                <span className="calc-label">Parlay Legs</span>
                <button
                  onClick={addParlayLeg}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--accent-cyan)', fontWeight: '600' }}
                >
                  <Plus size={14} />
                  <span>Add Leg</span>
                </button>
              </div>

              <div className="parlay-legs-list">
                {parlayLegs.map((leg) => (
                  <div key={leg.id} className="parlay-leg-row">
                    <input
                      type="text"
                      className="calc-input"
                      style={{ flex: 2 }}
                      value={leg.name}
                      onChange={(e) => updateParlayLeg(leg.id, 'name', e.target.value)}
                      placeholder="Matchup / Pick Name"
                    />
                    <input
                      type="text"
                      className="calc-input"
                      style={{ width: '100px', textAlign: 'center' }}
                      value={leg.odds}
                      onChange={(e) => updateParlayLeg(leg.id, 'odds', e.target.value)}
                      placeholder="-110"
                    />
                    <button
                      onClick={() => removeParlayLeg(leg.id)}
                      style={{ color: 'var(--text-muted)', padding: '6px' }}
                      title="Remove Leg"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="calc-form-group" style={{ maxWidth: '200px' }}>
                <label className="calc-label">Parlay Stake ($)</label>
                <input
                  type="number"
                  className="calc-input"
                  value={parlayStake}
                  onChange={(e) => setParlayStake(Number(e.target.value) || 0)}
                  min="1"
                />
              </div>

              {/* Parlay Results */}
              <div className="calc-results-grid">
                <div className="calc-res-item">
                  <span className="calc-res-label">Combined American</span>
                  <span className="calc-res-val cyan">{parlayResult.combinedAmerican}</span>
                </div>
                <div className="calc-res-item">
                  <span className="calc-res-label">Combined Decimal</span>
                  <span className="calc-res-val">{parlayResult.combinedDecimal}</span>
                </div>
                <div className="calc-res-item">
                  <span className="calc-res-label">Combined Implied %</span>
                  <span className="calc-res-val">{parlayResult.impliedProb}%</span>
                </div>
                <div className="calc-res-item">
                  <span className="calc-res-label">Total Payout Return</span>
                  <span className="calc-res-val highlight">${parlayPayout.totalReturn.toFixed(2)}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
