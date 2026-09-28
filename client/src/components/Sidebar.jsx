import React, { useState } from 'react';
import {
  Scale,
  MessageSquare,
  MessagesSquare,
  Bookmark,
  Settings,
  Mail,
  Coffee,
  Plus,
  Trash2,
  User,
  LogOut,
  Sun,
  Moon,
  X,
  ChevronDown
} from 'lucide-react';
import { DISCOVER_MODES } from '../config/discoverModes';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import SportSelector from './SportSelector';
import './Sidebar.css';

export default function Sidebar({
  isOpen,
  onClose,
  activeMode,
  isCommunityActive = false,
  onSelectMode,
  currentConversationId,
  onSelectConversation,
  onNewChat,
  onOpenCommunity,
  onOpenSaved,
  onOpenSettings,
  onOpenContact,
  onOpenAuthModal,
  onOpenOddsCalc,
  conversations = [],
  onDeleteConversation
}) {
  const { user, isAuthenticated, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // State to track how many chats to display (default: 5)
  const [visibleCount, setVisibleCount] = useState(5);

  // The six Discover Modes are now defined centrally (config/discoverModes.js)
  // so the sidebar, chat workspace, routing, and quick prompts all share one
  // source of truth for routes, labels, icons, colors, and per-mode prompts.
  const discoverModes = DISCOVER_MODES;

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + 5);
  };

  // Slice conversations array based on current limit
  const displayedConversations = conversations.slice(0, visibleCount);

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      {/* Brand Header */}
      <div className="sidebar-header">
        <a href="/" className="brand-logo" onClick={(e) => { e.preventDefault(); onNewChat(); }}>
          <div className="brand-icon">
            <img src="/covriq.png" alt="CovrIQ" className="brand-logo-img" />
          </div>
          <div>
            Covr<span style={{ color: 'var(--accent-cyan)' }}>IQ</span>
          </div>
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            style={{ padding: '6px', borderRadius: '6px', color: 'var(--text-secondary)' }}
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          <button
            className="mobile-close-btn"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* New Analysis Action Button */}
      <button className="new-chat-btn" onClick={onNewChat} id="new-analysis-btn">
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={16} style={{ color: 'var(--accent-cyan)' }} />
          New Analysis
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', border: '1px solid var(--border-medium)', padding: '1px 5px', borderRadius: '4px' }}>
          /
        </span>
      </button>

      {/* Scrollable Nav Sections */}
      <div className="sidebar-scrollable">
        {/* GLOBAL SPORT SELECTOR (above Discover Modes) */}
        <div className="sidebar-sport-selector">
          <div className="nav-section-title">Sport</div>
          <SportSelector />
        </div>

        {/* DISCOVER MODES */}
        <div>
          <div className="nav-section-title">Discover Modes</div>
          <div className="nav-list">
            {discoverModes.map((mode) => {
              const Icon = mode.icon;
              const isActive = activeMode === mode.id;
              return (
                <button
                  key={mode.id}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => onSelectMode(mode)}
                  title={mode.desc}
                  id={`mode-${mode.id}`}
                >
                  <span className="nav-item-icon">
                    <Icon size={16} />
                  </span>
                  <span style={{ flex: 1 }}>{mode.label}</span>
                  {mode.badge && (
                    <span className="brand-badge" style={{ fontSize: '9px' }}>
                      {mode.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* COMMUNITY */}
        <div>
          <div className="nav-section-title">Community</div>
          <div className="nav-list">
            <button className={`nav-item ${isCommunityActive ? 'active' : ''}`} onClick={onOpenCommunity} id="nav-community-btn">
              <span className="nav-item-icon">
                <MessagesSquare size={16} />
              </span>
              <span style={{ flex: 1 }}>Community</span>
              <span className="brand-badge" style={{ fontSize: '9px' }}>NEW</span>
            </button>
          </div>
        </div>

        {/* YOUR STUFF */}
        <div>
          <div className="nav-section-title">Your Stuff</div>
          <div className="nav-list">
            <button className="nav-item" onClick={onOpenSaved} id="nav-saved-btn">
              <span className="nav-item-icon">
                <Bookmark size={16} />
              </span>
              <span style={{ flex: 1 }}>Saved Picks</span>
            </button>
            <button className="nav-item" onClick={onOpenOddsCalc} id="nav-odds-calc-btn">
              <span className="nav-item-icon">
                <Scale size={16} />
              </span>
              <span style={{ flex: 1 }}>Odds Calculator</span>
            </button>
            <button className="nav-item" onClick={onOpenSettings} id="nav-settings-btn">
              <span className="nav-item-icon">
                <Settings size={16} />
              </span>
              <span style={{ flex: 1 }}>Settings</span>
            </button>
            <button className="nav-item" onClick={onOpenContact} id="nav-contact-btn">
              <span className="nav-item-icon">
                <Mail size={16} />
              </span>
              <span style={{ flex: 1 }}>Contact Us</span>
            </button>
          </div>
        </div>

        {/* RECENT CHATS (MY CHATS) */}
        <div>
          <div className="nav-section-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>My Chats</span>
            <span style={{ fontSize: '10px' }}>{conversations.length}</span>
          </div>
          <div className="nav-list">
            {conversations.length === 0 ? (
              <div style={{ padding: '8px 10px', fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No past chats yet. Start asking AI!
              </div>
            ) : (
              <>
                {displayedConversations.map((conv) => {
                  const isSelected = currentConversationId === conv.id;
                  return (
                    <div
                      key={conv.id}
                      className={`chat-history-item ${isSelected ? 'active' : ''}`}
                      onClick={() => onSelectConversation(conv.id)}
                    >
                      <MessageSquare size={14} style={{ marginRight: '8px', flexShrink: 0, opacity: 0.7 }} />
                      <span className="chat-title-text" title={conv.title}>
                        {conv.title}
                      </span>
                      <button
                        className="delete-chat-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteConversation(conv.id);
                        }}
                        title="Delete chat"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}

                {/* LOAD MORE BUTTON */}
                {conversations.length > visibleCount && (
                  <button className="load-more-chats-btn" onClick={handleLoadMore}>
                    <ChevronDown size={14} />
                    <span>Load More ({conversations.length - visibleCount})</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Sidebar Footer */}
      <div className="sidebar-footer">


        {isAuthenticated ? (
          <div className="user-profile-bar">
            <div className="user-info-area">
              <div className="user-avatar">
                {user?.name ? user.name.charAt(0).toUpperCase() : <User size={14} />}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div className="user-email-text">{user?.name || user?.email}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Pro Member</div>
              </div>
            </div>
            <button
              onClick={logout}
              title="Sign Out"
              style={{ color: 'var(--text-muted)', padding: '6px' }}
            >
              <LogOut size={15} />
            </button>
          </div>
        ) : (
          <button
            className="auth-trigger-btn"
            onClick={() => onOpenAuthModal('login')}
            id="sidebar-signin-btn"
          >
            <User size={15} />
            <span>Sign In to Save History</span>
          </button>
        )}
      </div>
    </aside>
  );
}





