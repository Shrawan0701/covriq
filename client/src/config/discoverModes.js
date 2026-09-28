import {
  Sparkles,
  TrendingUp,
  Flame,
  Scale,
  Layers,
  Microscope,
  Radar
} from 'lucide-react';

/**
 * Central definition of the Discover Modes + Edge Scanner.
 */
export const DISCOVER_MODES = [
  {
    id: 'ai_picks',
    route: '/ai-picks',
    label: 'AI Picks',
    icon: Sparkles,
    color: 'var(--accent-cyan)',
    badge: 'EV+',
    desc: 'High-confidence mathematical edges'
  },
  {
    id: 'edge_scanner',
    route: '/edge-scanner',
    label: 'Edge Scanner',
    icon: Radar,
    color: '#38bdf8',
    badge: 'Live',
    desc: 'Scan live board for +EV discrepancies'
  },
  {
    id: 'value_finder',
    route: '/value-finder',
    label: 'Value Finder',
    icon: TrendingUp,
    color: 'var(--accent-emerald)',
    badge: 'Sharp',
    desc: 'Mispriced market discrepancies'
  },
  {
    id: 'upset_finder',
    route: '/upset-finder',
    label: 'Upset Finder',
    icon: Flame,
    color: 'var(--accent-amber)',
    badge: 'Dogs',
    desc: 'High-value live underdogs'
  },
  {
    id: 'compare_bets',
    route: '/compare-bets',
    label: 'Compare Bets',
    icon: Scale,
    color: 'var(--accent-violet)',
    badge: 'H2H',
    desc: 'Head-to-head line comparison'
  },
  {
    id: 'parlay_lab',
    route: '/parlay-lab',
    label: 'Parlay Lab',
    icon: Layers,
    color: 'var(--accent-cyan)',
    badge: 'Multi',
    desc: 'Multi-leg parlay builder'
  },
  {
    id: 'deep_analysis',
    route: '/deep-analysis',
    label: 'Deep Analysis',
    icon: Microscope,
    color: 'var(--accent-emerald)',
    badge: 'Pro',
    desc: 'In-depth regression & injury modeling'
  }
];

/** Route path (with trailing slash normalized) -> mode config, or null. */
export function modeByPath(path) {
  const seg = normalizePathSegment(path);
  if (!seg) return null;
  return DISCOVER_MODES.find(m => m.route === `/${seg}`) || null;
}

/** mode id -> mode config, or null. */
export function getModeById(id) {
  return DISCOVER_MODES.find(m => m.id === id) || null;
}

export const DEFAULT_MODE = DISCOVER_MODES[0];

/** Lower-cases & takes the first path segment without surrounding slashes. */
export function normalizePathSegment(path) {
  const clean = (path || '/').replace(/\/+$/, '') || '/';
  const seg = clean.split('/').filter(Boolean);
  return seg[0] ? seg[0].toLowerCase() : null;
}