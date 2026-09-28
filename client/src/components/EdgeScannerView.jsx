import React, { useState, useEffect, useCallback } from 'react';
import {
  Radar,
  TrendingUp,
  RefreshCw,
  Filter,
  Bookmark,
  BookmarkCheck,
  Calculator,
  MessageSquare,
  ArrowUpRight,
  ShieldAlert,
  Flame,
  CheckCircle2,
  Calendar,
  Layers,
  ChevronRight,
  Sparkles,
  Radio,
  Clock,
  CheckCircle
} from 'lucide-react';
import { useSport } from '../context/SportContext';
import { useTheme } from '../context/ThemeContext';
import { formatOddsDisplay } from '../utils/oddsClient';
import './EdgeScannerView.css';

function hasMarketValue(value) {
  if (value === null || value === undefined) return false;
  const text = String(value).trim();
  return text.length > 0 && !/^n\/?a$/i.test(text) && !/unavailable/i.test(text);
}

function hasUsableOpportunityMarket(op) {
  if (!op) return false;
  if (op.marketAvailable === false && !hasMarketValue(op.americanOdds)) return false;
  return hasMarketValue(op.market) && hasMarketValue(op.selection) && hasMarketValue(op.americanOdds);
}
const API_BASE = '/api';

export default function EdgeScannerView({
  onDeepDive,
  onOpenOddsCalc,
  onSavePick,
  savedItems = []
}) {
  const { sportId, leagueId, selectedSport, selectedLeague, displayLabel } = useSport();
  const { oddsFormat } = useTheme();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [filterState, setFilterState] = useState('all'); // 'all' | 'upcoming' | 'live' | 'completed'
  const [filterMarket, setFilterMarket] = useState('all'); // 'all' | 'moneyline' | 'totals' | 'high_edge' | 'high_ev'
  const [sortBy, setSortBy] = useState('edge'); // 'edge' | 'ev' | 'confidence' | 'odds'
  const [lastScanned, setLastScanned] = useState(null);

  const fetchScan = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        sport: sportId || 'mlb',
        sortBy
      });
      if (leagueId) params.set('league', leagueId);

      const res = await fetch(`${API_BASE}/edge-scanner?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setLastScanned(new Date());
      }
    } catch (err) {
      console.error('Failed to scan board:', err);
    } finally {
      setLoading(false);
    }
  }, [sportId, leagueId, sortBy]);

  useEffect(() => {
    fetchScan();
  }, [fetchScan]);

  const rawOpportunities = data?.opportunities || [];

  // Filter opportunities by State (Upcoming, Live, Completed) and Market
  const opportunities = rawOpportunities.filter(op => {
    // State filtering
    if (filterState === 'upcoming' && op.state !== 'pre') return false;
    if (filterState === 'live' && op.state !== 'in') return false;
    if (filterState === 'completed' && op.state !== 'post') return false;

    // Market filtering
    if (filterMarket === 'moneyline') return op.market?.toLowerCase().includes('moneyline');
    if (filterMarket === 'totals') return op.market?.toLowerCase().includes('total');
    if (filterMarket === 'high_edge') return (op.edge || 0) >= 5.0;
    if (filterMarket === 'high_ev') return (op.expectedValue || 0) >= 10.0;
    return true;
  });

  const isItemSaved = (pickTitle) => {
    return savedItems.some(s => s.title?.toLowerCase() === pickTitle?.toLowerCase());
  };

  const liveCount = rawOpportunities.filter(o => o.state === 'in').length;
  const upcomingCount = rawOpportunities.filter(o => o.state === 'pre').length;
  const completedCount = rawOpportunities.filter(o => o.state === 'post').length;

  return (
    <div className="edge-scanner-container">
      {/* Top Header Bar */}
      <div className="scanner-header">
        <div className="scanner-title-group">
          <div className="scanner-badge-icon">
            <Radar size={22} className={loading ? 'animate-spin-slow' : ''} />
          </div>
          <div>
            <div className="scanner-title">
              Edge Scanner <span className="sport-tag">{displayLabel || 'Sports'}</span>
            </div>
            <div className="scanner-subtitle">
              Live quantitative board scan - Discrepancies, True Win % & +EV Expectancy
            </div>
          </div>
        </div>

        <div className="scanner-controls">
          <button
            className="refresh-scan-btn"
            onClick={fetchScan}
            disabled={loading}
            title="Re-scan current board"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>{loading ? 'Scanning...' : 'Refresh Board'}</span>
          </button>
        </div>
      </div>

      {/* State Tabs: All / Upcoming / Live / Completed */}
      <div className="scanner-state-tabs">
        <button
          className={`state-tab ${filterState === 'all' ? 'active' : ''}`}
          onClick={() => setFilterState('all')}
        >
          All Games ({rawOpportunities.length})
        </button>
        <button
          className={`state-tab ${filterState === 'upcoming' ? 'active' : ''}`}
          onClick={() => setFilterState('upcoming')}
        >
          <Clock size={13} />
          Upcoming Pre-Match ({upcomingCount})
        </button>
        <button
          className={`state-tab ${filterState === 'live' ? 'active' : ''}`}
          onClick={() => setFilterState('live')}
        >
          <Radio size={13} className={liveCount > 0 ? 'animate-pulse' : ''} style={{ color: 'var(--accent-rose)' }} />
          Live In-Game ({liveCount})
        </button>
        <button
          className={`state-tab ${filterState === 'completed' ? 'active' : ''}`}
          onClick={() => setFilterState('completed')}
        >
          <CheckCircle size={13} />
          Completed ({completedCount})
        </button>
      </div>

      {/* Filter and Sort Toolbar */}
      <div className="scanner-toolbar">
        <div className="filter-chips-group">
          <span className="toolbar-label">
            <Filter size={13} />
            Market:
          </span>
          <button
            className={`filter-chip ${filterMarket === 'all' ? 'active' : ''}`}
            onClick={() => setFilterMarket('all')}
          >
            All Markets
          </button>
          <button
            className={`filter-chip ${filterMarket === 'high_edge' ? 'active' : ''}`}
            onClick={() => setFilterMarket('high_edge')}
          >
            <Sparkles size={13} style={{ color: 'var(--accent-cyan)' }} />
            High Edge (&gt;5%)
          </button>
          <button
            className={`filter-chip ${filterMarket === 'high_ev' ? 'active' : ''}`}
            onClick={() => setFilterMarket('high_ev')}
          >
            <TrendingUp size={13} style={{ color: 'var(--accent-emerald)' }} />
            High EV (&gt;10%)
          </button>
          <button
            className={`filter-chip ${filterMarket === 'moneyline' ? 'active' : ''}`}
            onClick={() => setFilterMarket('moneyline')}
          >
            Moneyline
          </button>
          <button
            className={`filter-chip ${filterMarket === 'totals' ? 'active' : ''}`}
            onClick={() => setFilterMarket('totals')}
          >
            Totals (O/U)
          </button>
        </div>

        <div className="sort-group">
          <span className="toolbar-label">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="scanner-select"
          >
            <option value="edge">Highest Probability Edge</option>
            <option value="ev">Highest Expected Value (EV%)</option>
            <option value="confidence">Confidence Score</option>
            <option value="odds">Longest Odds</option>
          </select>
        </div>
      </div>

      {/* Content Area */}
      <div className="scanner-content-scroll">
        {loading && !data ? (
          <div className="scanner-loading-state">
            <div className="radar-ping-animation">
              <Radar size={48} />
            </div>
            <div className="loading-text">Scanning {displayLabel || 'Sports'} Market Odds & Starters...</div>
            <div className="loading-sub">Connecting via Live Sports Data feeds</div>
          </div>
        ) : opportunities.length === 0 ? (
          <div className="scanner-empty-state">
            <Radar size={42} style={{ opacity: 0.3, marginBottom: '12px' }} />
            <h3>No Discrepancies Matching Filter</h3>
            <p>Try switching filter tabs or check back closer to game time when market lines open.</p>
            <button className="reset-filter-btn" onClick={() => { setFilterState('all'); setFilterMarket('all'); }}>
              Show All Games
            </button>
          </div>
        ) : (
          <div className="scanner-grid">
            {opportunities.map((op) => {
              const saved = isItemSaved(op.selection);
              const isLive = op.state === 'in';
              const isFinal = op.state === 'post';
              const marketAvail = hasUsableOpportunityMarket(op);

              return (
                <div key={op.id} className={`opportunity-card animate-fade-in ${!marketAvail ? 'market-unavailable' : ''}`}>
                  {/* Card Header */}
                  <div className="opp-header">
                    <div className="opp-meta">
                      <span className={`state-badge ${op.state}`}>
                        {isLive && <Radio size={10} className="animate-pulse" style={{ marginRight: '4px' }} />}
                        {isLive ? 'LIVE' : isFinal ? 'FINAL' : 'UPCOMING'}
                      </span>
                      <span className="opp-matchup">{op.matchup}</span>
                    </div>
                    <span className="opp-time">{op.liveStateDetail || op.status}</span>
                  </div>

                  {/* Pick & Odds Banner */}
                  <div className="opp-pick-row">
                    <div>
                      <div className="opp-market-type">{op.market}</div>
                      <div className="opp-selection-title">
                        <TrendingUp size={18} style={{ color: 'var(--accent-cyan)' }} />
                        <span>{op.selection}</span>
                      </div>
                    </div>
                    <div className="opp-odds-display">
                      <span className="odds-label">Consensus Odds</span>
                      <span className="odds-val">
                        {marketAvail ? formatOddsDisplay(op.americanOdds, oddsFormat) : 'Market data unavailable'}
                      </span>
                    </div>
                  </div>

                  {/* Metrics Row */}
                  <div className="opp-metrics-grid">
                    <div className="opp-metric-cell">
                      <span className="label">Implied Win</span>
                      <span className="val">{marketAvail && op.impliedProb !== null ? `${op.impliedProb}%` : 'N/A'}</span>
                    </div>
                    <div className="opp-metric-cell">
                      <span className="label">CovrIQ Model</span>
                      <span className="val cyan">{marketAvail && op.modelProb !== null ? `${op.modelProb}%` : 'N/A'}</span>
                    </div>
                    <div className="opp-metric-cell">
                      <span className="label">Break-Even</span>
                      <span className="val">{marketAvail && op.breakEvenProb !== null ? `${op.breakEvenProb}%` : 'N/A'}</span>
                    </div>
                    <div className="opp-metric-cell highlight-edge">
                      <span className="label">Edge</span>
                      <span className="val">{marketAvail && op.edge !== null ? `+${op.edge}%` : 'N/A'}</span>
                    </div>
                    <div className="opp-metric-cell highlight-ev">
                      <span className="label">EV%</span>
                      <span className="val">{marketAvail && op.expectedValue !== null ? `+${op.expectedValue}%` : 'N/A'}</span>
                    </div>
                    <div className="opp-metric-cell">
                      <span className="label">Confidence</span>
                      <span className="val">{marketAvail && op.confidence !== null ? `${op.confidence}/10` : 'N/A'}</span>
                    </div>
                  </div>

                  {/* Unavailable warning banner if live market is locked */}
                  {!marketAvail && (
                    <div className="market-unavailable-banner">
                      <ShieldAlert size={14} style={{ color: 'var(--accent-amber)' }} />
                      <span>Current market data is unavailable. Edge and EV are paused until a verified price is received.</span>
                    </div>
                  )}

                  {/* Key Factors */}
                  {op.keyFactors && op.keyFactors.length > 0 && (
                    <div className="opp-key-factors">
                      {op.keyFactors.map((factor, fIdx) => (
                        <div key={fIdx} className="factor-item">
                          <CheckCircle2 size={13} style={{ color: 'var(--accent-emerald)', flexShrink: 0 }} />
                          <span>{factor}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Footer & Actions */}
                  <div className="opp-footer">
                    <div className="provider-tag">
                      <span>Source: {op.provider || 'Live Sports Data'}</span>
                      {op.dataFreshness && <span className="freshness-badge">{op.dataFreshness}</span>}
                    </div>

                    <div className="opp-actions">
                      <button
                        className={`opp-action-btn ${saved ? 'saved' : ''}`}
                        onClick={() => onSavePick && onSavePick({
                          title: op.selection,
                          content: {
                            state: op.state,
                            stateAtBet: op.state,
                            oddsAtBet: op.americanOdds,
                            gameHeader: { sport: op.sport, matchup: op.matchup, time: op.status, league: op.league, venue: op.venue },
                            marketCard: {
                              pick: op.selection,
                              market: op.market,
                              americanOdds: op.americanOdds,
                              decimalOdds: op.decimalOdds,
                              impliedProb: op.impliedProb,
                              aiEstimatedProb: op.modelProb,
                              edge: op.edge !== null ? `+${op.edge}%` : 'N/A',
                              expectedValue: op.expectedValue !== null ? `+${op.expectedValue}%` : 'N/A',
                              breakEvenProb: op.breakEvenProb !== null ? `${op.breakEvenProb}%` : 'N/A',
                              provider: op.provider,
                              dataFreshness: op.dataFreshness
                            },
                            whyILikeIt: op.keyFactors,
                            verdict: { type: 'BET', confidence: op.confidence || 8.0, unitSize: '1.0 Unit' },
                            provider: op.provider
                          }
                        })}
                        title="Save to Bet Journal"
                      >
                        {saved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                        <span>{saved ? 'Saved' : 'Save'}</span>
                      </button>

                      {marketAvail && (
                        <button
                          className="opp-action-btn"
                          onClick={() => onOpenOddsCalc && onOpenOddsCalc({
                            american: op.americanOdds,
                            pick: op.selection,
                            prob: op.modelProb
                          })}
                          title="Calculate Payout & EV"
                        >
                          <Calculator size={14} />
                        </button>
                      )}

                      <button
                        className="opp-action-btn primary"
                        onClick={() => onDeepDive && onDeepDive(`Deep dive analysis on ${op.selection} in ${op.matchup} ${op.americanOdds ? `with odds ${op.americanOdds}` : ''}. Evaluate true mathematical edge and key matchup factors.`)}
                        title="Deep Dive with AI"
                      >
                        <span>Deep Dive</span>
                        <ArrowUpRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


