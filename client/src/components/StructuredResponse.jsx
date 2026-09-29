import React, { useState } from 'react';
import {
  TrendingUp,
  CheckCircle2,
  Info,
  Bookmark,
  BookmarkCheck,
  Calculator,
  Copy,
  Check,
  ShieldAlert,
  Flame,
  BarChart2,
  Calendar,
  Radio
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useTheme } from '../context/ThemeContext';
import { formatOddsDisplay } from '../utils/oddsClient';
import './StructuredResponse.css';

function hasDisplayValue(value) {
  if (value === null || value === undefined) return false;
  const text = String(value).trim();
  return text.length > 0 && !/^n\/?a$/i.test(text) && !/unavailable/i.test(text);
}

function hasUsableMarket(marketCard) {
  if (!marketCard) return false;
  if (marketCard.marketAvailable === false && !hasDisplayValue(marketCard.americanOdds)) return false;
  return hasDisplayValue(marketCard.market) && hasDisplayValue(marketCard.pick) && hasDisplayValue(marketCard.americanOdds);
}

function renderInline(text) {
  if (!text) return '';
  return cleanAnalysisText(text).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}


function cleanAnalysisText(value) {
  if (!value) return '';
  return String(value)
    .replace(/\\\[/g, '')
    .replace(/\\\]/g, '')
    .replace(/\\\(/g, '')
    .replace(/\\\)/g, '')
    .replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/gi, '$1')
    .replace(/\(https?:\/\/[^)\s]+\)/gi, '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/^\s*(?:sources?|citations?)\s*:.*$/gim, '')
    .replace(/^\s*let me know if.*$/gim, '')
    .replace(/^\s*would you like.*$/gim, '')
    .replace(/\\times/g, ' x ')
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/P_\{model\}/g, 'model probability')
    .replace(/P_model/g, 'model probability')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1 / $2)')
    .replace(/\{([^{}]+)\}/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
function isMarkdownTableLine(line) {
  const trimmed = String(line || '').trim();
  return trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.split('|').length >= 4;
}

function isMarkdownTableSeparator(line) {
  return /^\|\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$/.test(String(line || '').trim());
}

function parseMarkdownTable(lines, startIndex) {
  const rows = [];
  let idx = startIndex;
  while (idx < lines.length && isMarkdownTableLine(lines[idx])) {
    if (!isMarkdownTableSeparator(lines[idx])) {
      rows.push(String(lines[idx]).trim().slice(1, -1).split('|').map(cell => cleanAnalysisText(cell.trim())));
    }
    idx += 1;
  }
  if (rows.length < 2) return null;
  const headers = rows[0];
  const dataRows = rows.slice(1).filter(row => {
    const statCells = row.slice(1).map(cell => String(cell || '').trim());
    return statCells.some(cell => cell && !/^[-��]+$/.test(cell) && !/^n\/?a$/i.test(cell) && !/unavailable/i.test(cell));
  });
  if (dataRows.length === 0) return null;
  let previousGroup = '';
  dataRows.forEach((row) => {
    if (String(row[0] || '').trim()) previousGroup = row[0];
    else if (previousGroup) row[0] = previousGroup;
  });
  const isMissing = (cell) => {
    const value = String(cell || '').trim();
    return !value || /^[-\u2013\u2014]+$/.test(value) || /^n\/?a$/i.test(value) || /unavailable|not confirmed|tbd/i.test(value);
  };
  const completeColumnIndexes = headers
    .map((_, columnIndex) => columnIndex)
    .filter(columnIndex => columnIndex === 0 || dataRows.every(row => !isMissing(row[columnIndex])));
  const completeHeaders = completeColumnIndexes.map(columnIndex => headers[columnIndex]);
  const completeRows = dataRows
    .filter(row => !isMissing(row[0]))
    .map(row => completeColumnIndexes.map(columnIndex => row[columnIndex]));
  if (completeRows.length === 0 || completeHeaders.length < 2) return null;
  return { headers: completeHeaders, rows: completeRows, nextIndex: idx };
}

function renderSectionBody(lines) {
  const nodes = [];
  for (let idx = 0; idx < lines.length; idx += 1) {
    const table = parseMarkdownTable(lines, idx);
    if (table) {
      nodes.push(
        <div className="analysis-table-wrap" key={`table-${idx}`}>
          <table className="analysis-table">
            <thead><tr>{table.headers.map((header, hIdx) => <th key={hIdx} dangerouslySetInnerHTML={{ __html: renderInline(header) }} />)}</tr></thead>
            <tbody>{table.rows.map((row, rIdx) => <tr key={rIdx}>{table.headers.map((_, cIdx) => <td key={cIdx} dangerouslySetInnerHTML={{ __html: renderInline(row[cIdx] || '') }} />)}</tr>)}</tbody>
          </table>
        </div>
      );
      idx = table.nextIndex - 1;
      continue;
    }
    const trimmed = String(lines[idx] || '').trim();
    if (!trimmed || trimmed === '--' || /^[-*]?\s*(?:sources?|citations?)\s*:?/i.test(trimmed) || isMarkdownTableSeparator(trimmed)) continue;
    const subheadMatch = trimmed.match(/^(?:#{2,4}\s+|\*\*)([A-Za-z0-9\s&/().'-]+)(?:\*\*|:)?$/);
    if (subheadMatch && !trimmed.startsWith('*') && !trimmed.startsWith('-')) {
      const nextTable = parseMarkdownTable(lines, idx + 1);
      const rawTitle = cleanAnalysisText(subheadMatch[1].trim());
      const title = /\bvs$/i.test(rawTitle) && nextTable?.headers?.length >= 3
        ? nextTable.headers[1] + ' vs ' + nextTable.headers[2]
        : rawTitle;
      nodes.push(
        <div key={idx} className="matchup-subhead">
          <strong>{title}</strong>
        </div>
      );
      continue;
    }
    const isBullet = trimmed.startsWith('-') || trimmed.startsWith('*');
    const content = isBullet ? trimmed.replace(/^[-*]\s*/, '') : trimmed;
    nodes.push(isBullet
      ? <div key={idx} className="bullet-item"><span className="bullet-dot" /><span dangerouslySetInnerHTML={{ __html: renderInline(cleanAnalysisText(content)) }} /></div>
      : <div key={idx} className="analysis-paragraph" dangerouslySetInnerHTML={{ __html: renderInline(cleanAnalysisText(content)) }} />
    );
  }
  return nodes;
}

function renderMarkdownBlock(value) {
  return renderSectionBody(String(value || '').split('\n'));
}

function parseRawSections(raw) {
  if (!raw) return [];
  const sections = [];
  let current = { title: '', body: [] };
  String(raw).split('\n').forEach((line) => {
    const headerMatch = line.match(/^#{1,4}\s*\[?([A-Za-z0-9_ ]+)\]?/);
    if (headerMatch) {
      if (current.title || current.body.length) sections.push(current);
      current = { title: headerMatch[1].replace(/_/g, ' ').trim(), body: [] };
    } else if (line.trim().length) {
      current.body.push(line);
    }
  });
  if (current.title || current.body.length) sections.push(current);
  return sections.filter(section => !/^sources?|citations?$/i.test(section.title.trim()));
}

function MarketMetrics({ marketCard, isMarketAvailable }) {
  return (
    <div className="odds-metric-grid">
      <div className="metric-tile"><span className="metric-label">American</span><span className="metric-val cyan">{isMarketAvailable ? marketCard.americanOdds : 'N/A'}</span></div>
      <div className="metric-tile"><span className="metric-label">Decimal</span><span className="metric-val">{isMarketAvailable && marketCard.decimalOdds ? marketCard.decimalOdds : 'N/A'}</span></div>
      <div className="metric-tile"><span className="metric-label">Implied Win</span><span className="metric-val">{isMarketAvailable && marketCard.impliedProb ? `${marketCard.impliedProb}%` : 'N/A'}</span></div>
      <div className="metric-tile"><span className="metric-label">CovrIQ Model</span><span className="metric-val positive">{isMarketAvailable && marketCard.aiEstimatedProb ? `${marketCard.aiEstimatedProb}%` : 'N/A'}</span></div>
      <div className="metric-tile"><span className="metric-label">Break-Even</span><span className="metric-val">{isMarketAvailable ? (marketCard.breakEvenProb || `${marketCard.impliedProb}%`) : 'N/A'}</span></div>
      <div className="metric-tile highlight-edge"><span className="metric-label">Betting Edge</span><span className="metric-val positive">{isMarketAvailable && marketCard.edge ? marketCard.edge : 'N/A'}</span></div>
      <div className="metric-tile highlight-ev"><span className="metric-label">Expected Value</span><span className="metric-val positive">{isMarketAvailable && marketCard.expectedValue ? marketCard.expectedValue : 'N/A'}</span></div>
    </div>
  );
}

function MarketCard({ marketCard, oddsFormat }) {
  const isMarketAvailable = hasUsableMarket(marketCard);
  return (
    <div className="market-card animate-fade-in">
      <div className="market-card-top">
        <div>
          <div className="market-type-badge">{marketCard.market}</div>
          <div className="pick-title">
            <TrendingUp size={22} style={{ color: 'var(--accent-cyan)' }} />
            <span>{marketCard.pick}</span>
          </div>
        </div>
        <div className="formatted-odds-block">
          <div className="formatted-odds-label">Formatted Odds</div>
          <div className="formatted-odds-value">{isMarketAvailable ? formatOddsDisplay(marketCard.americanOdds, oddsFormat) : 'Market data unavailable'}</div>
        </div>
      </div>
      <MarketMetrics marketCard={marketCard} isMarketAvailable={isMarketAvailable} />
      {isMarketAvailable && marketCard.impliedProb && marketCard.aiEstimatedProb && (
        <div className="probability-comparison-bar">
          <div className="prob-labels">
            <span style={{ color: 'var(--text-secondary)' }}>Market Implied: <strong>{marketCard.impliedProb}%</strong></span>
            <span style={{ color: 'var(--accent-emerald)' }}>CovrIQ Model: <strong>{marketCard.aiEstimatedProb}% ({marketCard.edge} Edge)</strong></span>
          </div>
          <div className="prob-track">
            <div className="prob-fill-market" style={{ width: `${Math.min(100, Number(marketCard.impliedProb) || 0)}%` }} />
            <div className="prob-fill-ai" style={{ width: `${Math.min(100, Number(marketCard.aiEstimatedProb) || 0)}%` }} />
          </div>
        </div>
      )}
      {!isMarketAvailable && (
        <div className="unverified-data-banner">
          <ShieldAlert size={14} style={{ color: 'var(--accent-amber)' }} />
          <span>Current market data is unavailable. Edge and EV are paused until a verified price is received.</span>
        </div>
      )}
    </div>
  );
}

function GameHeader({ gameHeader }) {
  const statusText = gameHeader?.status || 'UPCOMING';
  const isLive = /live|in progress|half|1st|2nd|3rd|4th|qtr|top|bot|inning|period/i.test(statusText);
  const isFinal = /final|ft|ended/i.test(statusText);
  return (
    <div className="game-header-card animate-fade-in">
      <div className="game-meta">
        <span className="sport-badge">{gameHeader.sport || 'SPORTS'}</span>
        <div>
          <div className="game-matchup-title">{gameHeader.matchup}</div>
          <div className="game-time-league">
            <Calendar size={13} />
            <span>{gameHeader.time}</span>
            {gameHeader.league && <span>- {gameHeader.league}</span>}
            <span className={`status-pill ${isLive ? 'live' : isFinal ? 'final' : 'upcoming'}`}>
              {isLive && <Radio size={10} className="animate-pulse" />}
              {statusText}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SlateGameCard({ pick, oddsFormat }) {
  const gameHeader = pick.gameHeader;
  const marketCard = pick.marketCard;
  const whyILikeIt = pick.whyILikeIt || [];
  if (!gameHeader && !marketCard) return null;
  return (
    <div className="slate-game-card animate-fade-in" style={{ marginBottom: '16px' }}>
      {gameHeader && <GameHeader gameHeader={gameHeader} />}
      {marketCard && <MarketCard marketCard={marketCard} oddsFormat={oddsFormat} />}
      {whyILikeIt.length > 0 && (
        <div className="analysis-section" style={{ marginTop: '8px' }}>
          <div className="section-heading"><CheckCircle2 size={16} style={{ color: 'var(--accent-emerald)' }} /><span>Key Factors & Rationale</span></div>
          <div className="bullet-list">{whyILikeIt.map((point, idx) => <div key={idx} className="bullet-item"><span className="bullet-dot" /><span dangerouslySetInnerHTML={{ __html: renderInline(point) }} /></div>)}</div>
        </div>
      )}
    </div>
  );
}

export default function StructuredResponse({ structuredData, rawContent, onOpenOddsCalc, onSavePick, isSaved = false }) {
  const { oddsFormat, chatFont } = useTheme();
  const [copied, setCopied] = useState(false);
  const [savedLocally, setSavedLocally] = useState(isSaved);

  const data = structuredData || {};
  const gameHeader = data.gameHeader;
  const marketCard = data.marketCard;
  const whyILikeIt = data.whyILikeIt || [];
  const matchupInfo = data.matchupInfo || {};
  const valueAnalysis = data.valueAnalysis;
  const risks = data.risks || [];
  const verdict = data.verdict;
  const picks = data.picks;
  const isMarketAvailable = hasUsableMarket(marketCard);
  const proseClass = chatFont === 'serif' ? 'ai-prose-serif' : 'ai-prose-sans';

  const handleCopy = () => {
    navigator.clipboard.writeText(rawContent || JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    setSavedLocally(true);
    onSavePick?.({ title: marketCard?.pick || gameHeader?.matchup || 'Sports Bet Pick', content: data });
    try { confetti({ particleCount: 30, spread: 60, origin: { y: 0.8 }, colors: ['#38bdf8', '#10b981', '#fbbf24'] }); } catch (e) { }
  };

  if (picks && picks.length > 0) {
    return (
      <div className={`analysis-card-container ${proseClass}`}>
        <div className="slate-summary-header">
          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{picks.length} Matchups Analyzed</div>
        </div>
        {picks.map((pick, idx) => <SlateGameCard key={idx} pick={pick} oddsFormat={oddsFormat} />)}
        <div className="analysis-action-bar"><button className="action-btn" onClick={handleCopy} title="Copy Full Slate Analysis">{copied ? <Check size={14} style={{ color: 'var(--accent-emerald)' }} /> : <Copy size={14} />}<span>{copied ? 'Copied!' : 'Copy All'}</span></button></div>
      </div>
    );
  }

  if (!gameHeader && !marketCard && whyILikeIt.length === 0) {
    const sections = parseRawSections(rawContent);
    if (sections.length === 0) return <div className={`analysis-card-container ${proseClass}`}><div className="analysis-section" style={{ whiteSpace: 'pre-wrap' }}>{cleanAnalysisText(rawContent)}</div></div>;
    return (
      <div className={`analysis-card-container ${proseClass}`}>
        {sections.map((section, sIdx) => (
          <div key={sIdx} className="analysis-section animate-fade-in">
            {section.title && <div className="section-heading"><span>{section.title}</span></div>}
            <div className="bullet-list">{renderSectionBody(section.body)}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`analysis-card-container ${proseClass}`}>
      {gameHeader && <GameHeader gameHeader={gameHeader} />}
      {marketCard && <MarketCard marketCard={marketCard} oddsFormat={oddsFormat} />}
      {whyILikeIt.length > 0 && <div className="analysis-section animate-fade-in"><div className="section-heading"><CheckCircle2 size={17} style={{ color: 'var(--accent-emerald)' }} /><span>Why It Matters & Key Factors</span></div><div className="bullet-list">{whyILikeIt.map((point, idx) => <div key={idx} className="bullet-item"><span className="bullet-dot" /><span dangerouslySetInnerHTML={{ __html: renderInline(point) }} /></div>)}</div></div>}
      {matchupInfo?.raw && <div className="analysis-section animate-fade-in"><div className="section-heading"><Info size={17} style={{ color: 'var(--accent-cyan)' }} /><span>Matchup & Current Info</span></div><div className="matchup-text-block">{renderMarkdownBlock(matchupInfo.raw)}</div></div>}
      {valueAnalysis && <div className="analysis-section animate-fade-in"><div className="section-heading"><BarChart2 size={17} style={{ color: 'var(--accent-amber)' }} /><span>Market Context & Value Analysis</span></div><div className="bullet-list">{renderMarkdownBlock(valueAnalysis)}</div></div>}
      {risks.length > 0 && <div className="analysis-section animate-fade-in" style={{ borderColor: 'rgba(244, 63, 94, 0.2)' }}><div className="section-heading" style={{ color: 'var(--accent-rose)' }}><ShieldAlert size={17} /><span>Risks & Why NOT to Bet</span></div><div className="bullet-list">{risks.map((risk, idx) => <div key={idx} className="bullet-item"><span className="bullet-dot danger" /><span dangerouslySetInnerHTML={{ __html: renderInline(risk) }} /></div>)}</div></div>}
      {verdict && <div className="verdict-card animate-fade-in"><div className="verdict-header"><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><div className={`verdict-badge ${verdict.type}`}><Flame size={18} /><span>{verdict.type}</span></div><div><div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>Confidence Rating</div><div style={{ fontSize: '16px', fontWeight: '800', fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}>{verdict.confidence}/10 - <span style={{ color: 'var(--accent-cyan)' }}>{verdict.unitSize || '1.0 Unit'}</span></div></div></div></div>{verdict.summary && <div className="verdict-summary" dangerouslySetInnerHTML={{ __html: renderInline(verdict.summary.replace(/^["']+|["']+$/g, '')) }} />}</div>}
      <div className="analysis-action-bar">
        <button className={`action-btn ${savedLocally ? 'saved' : ''}`} onClick={handleSave} title="Save this pick to your Bet Journal">{savedLocally ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}<span>{savedLocally ? 'Saved to Journal' : 'Save to Journal'}</span></button>
        {isMarketAvailable && marketCard && <button className="action-btn" onClick={() => onOpenOddsCalc?.({ american: marketCard.americanOdds, pick: marketCard.pick, prob: marketCard.aiEstimatedProb })} title="Open in Odds Calculator"><Calculator size={14} /><span>Calculate Payout & EV</span></button>}
        <button className="action-btn" onClick={handleCopy} title="Copy Analysis">{copied ? <Check size={14} style={{ color: 'var(--accent-emerald)' }} /> : <Copy size={14} />}<span>{copied ? 'Copied!' : 'Copy'}</span></button>
      </div>
    </div>
  );
}










