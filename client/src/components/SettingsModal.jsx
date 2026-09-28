import React from 'react';
import { X, Settings, Moon, Sun, DollarSign, Type, ShieldCheck, Database } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import './SettingsModal.css';

export default function SettingsModal({ isOpen, onClose }) {
  const { theme, oddsFormat, chatFont, updatePreferences } = useTheme();
  const { user, isAuthenticated } = useAuth();

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="settings-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title">
            <Settings size={20} style={{ color: 'var(--accent-cyan)' }} />
            <span>CovrIQ Application Preferences</span>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)', padding: '4px' }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="settings-section-list">
          {/* 1. Theme Selection */}
          <div className="settings-group">
            <span className="settings-group-title">Theme Aesthetic</span>
            <div className="settings-options-row">
              <button
                className={`settings-option-btn ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => updatePreferences({ theme: 'dark' })}
              >
                <Moon size={18} />
                <span>Deep Charcoal</span>
              </button>

              <button
                className={`settings-option-btn ${theme === 'light' ? 'active' : ''}`}
                onClick={() => updatePreferences({ theme: 'light' })}
              >
                <Sun size={18} />
                <span>Crisp Light</span>
              </button>
            </div>
          </div>

          {/* 2. Odds Display Format */}
          <div className="settings-group">
            <span className="settings-group-title">Odds Display Format</span>
            <div className="settings-options-row">
              <button
                className={`settings-option-btn ${oddsFormat === 'both' ? 'active' : ''}`}
                onClick={() => updatePreferences({ oddsFormat: 'both' })}
              >
                <DollarSign size={18} />
                <span>Both + Implied %</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>+125 / 2.25 (44.4%)</span>
              </button>

              <button
                className={`settings-option-btn ${oddsFormat === 'american' ? 'active' : ''}`}
                onClick={() => updatePreferences({ oddsFormat: 'american' })}
              >
                <DollarSign size={18} />
                <span>American</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>+125 (44.4%)</span>
              </button>

              <button
                className={`settings-option-btn ${oddsFormat === 'decimal' ? 'active' : ''}`}
                onClick={() => updatePreferences({ oddsFormat: 'decimal' })}
              >
                <DollarSign size={18} />
                <span>Decimal</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>2.25 (44.4%)</span>
              </button>
            </div>
          </div>

          {/* 3. AI Typography */}
          <div className="settings-group">
            <span className="settings-group-title">AI Response Typography</span>
            <div className="settings-options-row">
              <button
                className={`settings-option-btn ${chatFont === 'serif' ? 'active' : ''}`}
                onClick={() => updatePreferences({ chatFont: 'serif' })}
              >
                <Type size={18} />
                <span>Claude Serif</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Newsreader / Serif</span>
              </button>

              <button
                className={`settings-option-btn ${chatFont === 'sans' ? 'active' : ''}`}
                onClick={() => updatePreferences({ chatFont: 'sans' })}
              >
                <Type size={18} />
                <span>Modern Sans</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Inter / Clean UI</span>
              </button>
            </div>
          </div>

          {/* 4. Engine Status */}

        </div>
      </div>
    </div>
  );
}
