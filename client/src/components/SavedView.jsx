import React, { useState } from 'react';
import {
  Bookmark,
  ArrowLeft,
  Trash2,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Clock,
  Edit3,
  Scale,
  Award,
  DollarSign,
  Percent,
  BarChart2,
  ShieldAlert,
  Calendar,
  X,
  Check,
  ChevronDown,
  Radio,
  Sparkles,
  Ban
} from 'lucide-react';
import StructuredResponse from './StructuredResponse';
import { calculateCLV, calculatePayout } from '../utils/oddsClient';
import './SavedView.css';

export default function SavedView({
  savedItems = [],
  onBackToChat,
  onDeleteSaved,
  onOpenOddsCalc,
  onUpdateBet
}) {
  const [filterResult, setFilterResult] = useState('all'); // 'all' | 'pending' | 'won' | 'lost' | 'push' | 'void'
  const [selectedBetForGrading, setSelectedBetForGrading] = useState(null);

  // Grade Modal State
  const [gradingResult, setGradingResult] = useState('won');
  const [gradingStake, setGradingStake] = useState('');
  const [gradingClosingOdds, setGradingClosingOdds] = useState('');
  const [gradingNotes, setGradingNotes] = useState('');

  // Performance calculations from real stored bets
  let totalBets = 0;
  let won = 0;
  let lost = 0;
  let push = 0;
  let voidCount = 0;
  let pending = 0;
  let totalStaked = 0;
  let totalProfit = 0;
  let totalEdge = 0;
  let edgeCount = 0;
  let totalCLV = 0;
  let clvCount = 0;

  // Breakdown by Prematch vs Live
  const stateStats = {
    prematch: { total: 0, won: 0, lost: 0, push: 0, staked: 0, profit: 0 },
    live: { total: 0, won: 0, lost: 0, push: 0, staked: 0, profit: 0 }
  };

  savedItems.forEach(item => {
    totalBets++;
    const content = item.content || {};
    const res = (item.result || content.result || 'pending').toLowerCase();
    const stake = Number(item.stake || content.stake) || 0;
    const profit = Number(item.profit ?? content.profit ?? 0);
    const isLive = (content.stateAtBet || content.state || (content.gameHeader?.status?.includes('LIVE') ? 'in' : 'pre')).toLowerCase() === 'in';
    const stateKey = isLive ? 'live' : 'prematch';

    if (res === 'won') won++;
    else if (res === 'lost') lost++;
    else if (res === 'push') push++;
    else if (res === 'void') voidCount++;
    else pending++;

    if (stake > 0) {
      totalStaked += stake;
      totalProfit += profit;
    }

    const rawEdge = parseFloat(String(content.marketCard?.edge || item.edge || '').replace(/[^0-9.\-]/g, ''));
    if (!isNaN(rawEdge)) {
      totalEdge += rawEdge;
      edgeCount++;
    }

    const rawCLV = Number(item.clv_percent ?? content.clv_percent);
    if (!isNaN(rawCLV) && rawCLV !== null) {
      totalCLV += rawCLV;
      clvCount++;
    }

    // Accumulate state stats
    stateStats[stateKey].total++;
    if (res === 'won') stateStats[stateKey].won++;
    if (res === 'lost') stateStats[stateKey].lost++;
    if (res === 'push') stateStats[stateKey].push++;
    if (stake > 0) {
      stateStats[stateKey].staked += stake;
      stateStats[stateKey].profit += profit;
    }
  });

  const gradedTotal = won + lost;
  const winRate = gradedTotal > 0 ? ((won / gradedTotal) * 100).toFixed(1) : null;
  const roi = totalStaked > 0 ? ((totalProfit / totalStaked) * 100).toFixed(1) : null;
  const avgEdge = edgeCount > 0 ? (totalEdge / edgeCount).toFixed(2) : null;
  const avgCLV = clvCount > 0 ? (totalCLV / clvCount).toFixed(2) : null;

  const prematchGraded = stateStats.prematch.won + stateStats.prematch.lost;
  const prematchWinRate = prematchGraded > 0 ? ((stateStats.prematch.won / prematchGraded) * 100).toFixed(1) : null;
  const prematchROI = stateStats.prematch.staked > 0 ? ((stateStats.prematch.profit / stateStats.prematch.staked) * 100).toFixed(1) : null;

  const liveGraded = stateStats.live.won + stateStats.live.lost;
  const liveWinRate = liveGraded > 0 ? ((stateStats.live.won / liveGraded) * 100).toFixed(1) : null;
  const liveROI = stateStats.live.staked > 0 ? ((stateStats.live.profit / stateStats.live.staked) * 100).toFixed(1) : null;

  // Filter items
  const filteredItems = savedItems.filter(item => {
    const res = (item.result || item.content?.result || 'pending').toLowerCase();
    if (filterResult === 'all') return true;
    return res === filterResult;
  });

  const handleOpenGrading = (item) => {
    const content = item.content || {};
    setSelectedBetForGrading(item);
    setGradingResult(item.result || content.result || 'won');
    setGradingStake(item.stake || content.stake || '');
    setGradingClosingOdds(item.closing_odds || content.closing_odds || '');
    setGradingNotes(item.notes || content.notes || '');
  };

  const handleSaveGrading = async () => {
    if (!selectedBetForGrading) return;
    const entryOdds = selectedBetForGrading.content?.oddsAtBet || selectedBetForGrading.content?.marketCard?.americanOdds || '+100';

    let clvPercent = null;
    let beatClosing = null;
    if (gradingClosingOdds) {
      const clv = calculateCLV(entryOdds, gradingClosingOdds, true);
      clvPercent = clv.clvPercent;
      beatClosing = clv.beatClosingLine;
    }

    const stakeNum = parseFloat(gradingStake) || null;
    let profit = 0;
    if (stakeNum && stakeNum > 0) {
      const payout = calculatePayout(stakeNum, entryOdds, true);
      if (gradingResult === 'won') profit = payout.netProfit;
      else if (gradingResult === 'lost') profit = -stakeNum;
      else if (gradingResult === 'push' || gradingResult === 'void') profit = 0;
    }

    if (onUpdateBet) {
      await onUpdateBet(selectedBetForGrading.id, {
        result: gradingResult,
        stake: stakeNum,
        closing_odds: gradingClosingOdds || null,
        clv_percent: clvPercent,
        profit,
        notes: gradingNotes
      });
    }

    setSelectedBetForGrading(null);
  };

  return (
    <div className="saved-view-container">
      {/* Top Header */}
      <div className="saved-view-header">
        <div className="saved-view-title">
          <button onClick={onBackToChat} className="back-btn">
            <ArrowLeft size={16} />
            <span>Back to Workspace</span>
          </button>
          <span className="divider">|</span>
          <div className="title-text">
            <Bookmark size={18} style={{ color: 'var(--accent-cyan)' }} />
            <span>Prediction Journal & Tracked Performance ({savedItems.length})</span>
          </div>
        </div>
      </div>

      {/* Performance Summary Banner */}
      <div className="journal-kpi-bar">
        <div className="kpi-card">
          <span className="kpi-label">Overall Win Rate</span>
          <span className="kpi-value cyan">{winRate !== null ? `${winRate}%` : 'N/A'}</span>
          <span className="kpi-sub">{won}W - {lost}L ({push}P {voidCount > 0 ? `• ${voidCount}V` : ''})</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Total ROI / Profit</span>
          <span className={`kpi-value ${totalProfit >= 0 ? 'emerald' : 'rose'}`}>
            {totalStaked > 0 ? `${totalProfit >= 0 ? '+' : ''}$${totalProfit.toFixed(2)} (${roi}%)` : 'N/A'}
          </span>
          <span className="kpi-sub">Staked: ${totalStaked.toFixed(2)}</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Avg Betting Edge</span>
          <span className="kpi-value emerald">{avgEdge !== null ? `+${avgEdge}%` : 'N/A'}</span>
          <span className="kpi-sub">Across {edgeCount} bets</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Closing Line Value (CLV)</span>
          <span className={`kpi-value ${avgCLV !== null && avgCLV >= 0 ? 'cyan' : 'muted'}`}>
            {avgCLV !== null ? `${avgCLV >= 0 ? '+' : ''}${avgCLV}%` : 'N/A'}
          </span>
          <span className="kpi-sub">{clvCount > 0 ? `${clvCount} graded with closing line` : 'Add closing odds'}</span>
        </div>
      </div>

      {/* Prematch vs Live Breakdown Bar */}
      <div className="state-breakdown-bar">
        <div className="breakdown-pill">
          <Clock size={13} style={{ color: 'var(--accent-cyan)' }} />
          <span>Prematch Predictions:</span>
          <strong>{prematchWinRate !== null ? `${prematchWinRate}% Win Rate` : 'No graded bets'}</strong>
          {prematchROI !== null && <span className="roi-badge">({prematchROI >= 0 ? '+' : ''}{prematchROI}% ROI)</span>}
        </div>
        <div className="breakdown-pill">
          <Radio size={13} style={{ color: 'var(--accent-rose)' }} />
          <span>Live In-Play Bets:</span>
          <strong>{liveWinRate !== null ? `${liveWinRate}% Win Rate` : 'No graded bets'}</strong>
          {liveROI !== null && <span className="roi-badge">({liveROI >= 0 ? '+' : ''}{liveROI}% ROI)</span>}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="journal-filter-bar">
        <button
          className={`filter-tab ${filterResult === 'all' ? 'active' : ''}`}
          onClick={() => setFilterResult('all')}
        >
          All Bets ({savedItems.length})
        </button>
        <button
          className={`filter-tab ${filterResult === 'pending' ? 'active' : ''}`}
          onClick={() => setFilterResult('pending')}
        >
          <Clock size={13} />
          Pending ({pending})
        </button>
        <button
          className={`filter-tab ${filterResult === 'won' ? 'active' : ''}`}
          onClick={() => setFilterResult('won')}
        >
          <CheckCircle2 size={13} style={{ color: 'var(--accent-emerald)' }} />
          Won ({won})
        </button>
        <button
          className={`filter-tab ${filterResult === 'lost' ? 'active' : ''}`}
          onClick={() => setFilterResult('lost')}
        >
          <XCircle size={13} style={{ color: 'var(--accent-rose)' }} />
          Lost ({lost})
        </button>
        <button
          className={`filter-tab ${filterResult === 'push' ? 'active' : ''}`}
          onClick={() => setFilterResult('push')}
        >
          Push ({push})
        </button>
        {voidCount > 0 && (
          <button
            className={`filter-tab ${filterResult === 'void' ? 'active' : ''}`}
            onClick={() => setFilterResult('void')}
          >
            <Ban size={13} />
            Void ({voidCount})
          </button>
        )}
      </div>

      {/* Content List */}
      <div className="saved-content-scroll">
        {filteredItems.length === 0 ? (
          <div className="journal-empty-state">
            <Bookmark size={42} style={{ opacity: 0.3, marginBottom: '12px' }} />
            <h3>No Bets in This View</h3>
            <p>Save research or AI picks directly from any chat or Edge Scanner to track performance and CLV over time.</p>
            <button className="explore-btn" onClick={onBackToChat}>
              Explore AI Picks
            </button>
          </div>
        ) : (
          filteredItems.map((item) => {
            const content = item.content || {};
            const result = (item.result || content.result || 'pending').toLowerCase();
            const stake = item.stake || content.stake;
            const closingOdds = item.closing_odds || content.closing_odds;
            const clvPercent = item.clv_percent ?? content.clv_percent;
            const notes = item.notes || content.notes;
            const isLiveBet = (content.stateAtBet || content.state || (content.gameHeader?.status?.includes('LIVE') ? 'in' : 'pre')).toLowerCase() === 'in';

            return (
              <div key={item.id} className="journal-bet-card animate-fade-in">
                {/* Header Row */}
                <div className="bet-card-header">
                  <div className="bet-header-left">
                    <span className={`result-badge ${result}`}>
                      {result === 'won' && <CheckCircle2 size={13} />}
                      {result === 'lost' && <XCircle size={13} />}
                      {result === 'pending' && <Clock size={13} />}
                      {result === 'void' && <Ban size={13} />}
                      {result.toUpperCase()}
                    </span>

                    <span className={`bet-type-badge ${isLiveBet ? 'live' : 'prematch'}`}>
                      {isLiveBet ? <Radio size={10} style={{ marginRight: '3px' }} /> : <Clock size={10} style={{ marginRight: '3px' }} />}
                      {isLiveBet ? 'LIVE IN-PLAY' : 'PRE-MATCH'}
                    </span>

                    <span className="bet-title">{item.title}</span>
                  </div>

                  <div className="bet-header-actions">
                    <button
                      className="grade-bet-btn"
                      onClick={() => handleOpenGrading(item)}
                      title="Grade Result & CLV"
                    >
                      <Edit3 size={13} />
                      <span>{result === 'pending' ? 'Grade Bet' : 'Edit Outcome'}</span>
                    </button>

                    <button
                      className="delete-saved-btn"
                      onClick={() => onDeleteSaved(item.id)}
                      title="Delete from journal"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Journal Status Row */}
                <div className="bet-journal-meta-row">
                  {content.oddsAtBet && (
                    <div className="meta-chip">
                      <span className="label">Entry Odds:</span>
                      <span className="val cyan">{content.oddsAtBet}</span>
                    </div>
                  )}

                  {stake && (
                    <div className="meta-chip">
                      <span className="label">Stake:</span>
                      <span className="val">${Number(stake).toFixed(2)}</span>
                    </div>
                  )}

                  {closingOdds && (
                    <div className="meta-chip">
                      <span className="label">Closing Odds:</span>
                      <span className="val">{closingOdds}</span>
                    </div>
                  )}

                  {clvPercent !== null && clvPercent !== undefined && (
                    <div className={`meta-chip clv ${clvPercent >= 0 ? 'positive' : 'negative'}`}>
                      <span className="label">CLV:</span>
                      <span className="val">{clvPercent >= 0 ? `+${clvPercent}%` : `${clvPercent}%`}</span>
                      {clvPercent >= 0 && <span className="clv-beat">Beat Closing Line</span>}
                    </div>
                  )}

                  <div className="meta-chip date">
                    <span>Saved {new Date(item.created_at || Date.now()).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Optional Notes */}
                {notes && (
                  <div className="bet-notes-callout">
                    <span className="notes-label">Decision Notes:</span>
                    <span>{notes}</span>
                  </div>
                )}

                {/* Render Structured Content */}
                <StructuredResponse
                  structuredData={content}
                  rawContent={content.rawContent}
                  onOpenOddsCalc={onOpenOddsCalc}
                  isSaved={true}
                />
              </div>
            );
          })
        )}
      </div>

      {/* Grading & CLV Modal */}
      {selectedBetForGrading && (
        <div className="modal-overlay" onClick={() => setSelectedBetForGrading(null)}>
          <div className="grading-modal animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Grade Bet & Track CLV</div>
              <button className="modal-close-btn" onClick={() => setSelectedBetForGrading(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="modal-pick-info">
                <strong>{selectedBetForGrading.title}</strong>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Entry Odds: {selectedBetForGrading.content?.oddsAtBet || selectedBetForGrading.content?.marketCard?.americanOdds || '+100'}
                </span>
              </div>

              {/* Result Picker */}
              <div className="input-group">
                <label>Outcome</label>
                <div className="result-select-grid">
                  <button
                    className={`res-btn won ${gradingResult === 'won' ? 'active' : ''}`}
                    onClick={() => setGradingResult('won')}
                  >
                    <CheckCircle2 size={16} />
                    Won
                  </button>
                  <button
                    className={`res-btn lost ${gradingResult === 'lost' ? 'active' : ''}`}
                    onClick={() => setGradingResult('lost')}
                  >
                    <XCircle size={16} />
                    Lost
                  </button>
                  <button
                    className={`res-btn push ${gradingResult === 'push' ? 'active' : ''}`}
                    onClick={() => setGradingResult('push')}
                  >
                    Push
                  </button>
                  <button
                    className={`res-btn void ${gradingResult === 'void' ? 'active' : ''}`}
                    onClick={() => setGradingResult('void')}
                  >
                    Void
                  </button>
                  <button
                    className={`res-btn pending ${gradingResult === 'pending' ? 'active' : ''}`}
                    onClick={() => setGradingResult('pending')}
                  >
                    Pending
                  </button>
                </div>
              </div>

              {/* Stake input */}
              <div className="input-group">
                <label>Stake Amount ($) <span className="optional">(Optional)</span></label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 50.00"
                  value={gradingStake}
                  onChange={(e) => setGradingStake(e.target.value)}
                  className="modal-input"
                />
              </div>

              {/* Closing Odds for CLV */}
              <div className="input-group">
                <label>Closing Line / Odds <span className="optional">(Calculates Closing Line Value)</span></label>
                <input
                  type="text"
                  placeholder="e.g. -135 or +110"
                  value={gradingClosingOdds}
                  onChange={(e) => setGradingClosingOdds(e.target.value)}
                  className="modal-input"
                />
              </div>

              {/* Notes */}
              <div className="input-group">
                <label>Notes & Strategy Takeaways</label>
                <textarea
                  rows="2"
                  placeholder="Why did you take this bet? Any late line shifts?"
                  value={gradingNotes}
                  onChange={(e) => setGradingNotes(e.target.value)}
                  className="modal-textarea"
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="cancel-btn" onClick={() => setSelectedBetForGrading(null)}>
                Cancel
              </button>
              <button className="save-grade-btn" onClick={handleSaveGrading}>
                Save to Journal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
