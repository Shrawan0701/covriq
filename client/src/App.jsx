import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useHistoryPath } from './utils/router';
import { modeByPath, getModeById, DEFAULT_MODE } from './config/discoverModes';
import Sidebar from './components/Sidebar';
import ChatWorkspace from './components/ChatWorkspace';
import SavedView from './components/SavedView';
import EdgeScannerView from './components/EdgeScannerView';
import CommunityView from './components/CommunityView';
import OddsCalculatorModal from './components/OddsCalculatorModal';
import AuthModal from './components/AuthModal';
import SettingsModal from './components/SettingsModal';
import ContactModal from './components/ContactModal';
import { useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';
import { useSport } from './context/SportContext';
import { parseStructuredResponse } from './utils/oddsClient';
import { Menu, X } from 'lucide-react';

const API_BASE = '/api';

export default function App() {
  const { user, token, isAuthenticated } = useAuth();
  const { oddsFormat } = useTheme();
  const { sportId, leagueId, setSport } = useSport();

  // Router (History API) -> every Discover Mode is its own URL route.
  const { path, push } = useHistoryPath();
  const isSavedRoute = path === '/saved';
  const isEdgeScannerRoute = path === '/edge-scanner';
  const isCommunityRoute = path === '/community';
  const currentMode = modeByPath(path) || DEFAULT_MODE;
  const activeMode = currentMode.id;


  // Mobile & Sidebar Drawer State
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768);

  // Conversations & Active Chat State
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const skipNextWorkspaceResetRef = useRef(false);

  // Streaming State
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingStatus, setStreamingStatus] = useState(null);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingStructured, setStreamingStructured] = useState(null);

  // Saved Items State
  const [savedItems, setSavedItems] = useState([]);

  // Modals State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authInitialView, setAuthInitialView] = useState('login');
  const [isOddsCalcOpen, setIsOddsCalcOpen] = useState(false);
  const [oddsCalcInitialData, setOddsCalcInitialData] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);

  // Auto-collapse on mobile viewports
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const closeSidebarOnMobile = () => {
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  // Load conversations for the ACTIVE mode (per-mode history scoping) AND the
  // current sport/league context ("My Chats" filtering). The backend matches
  // against each conversation's stored sport/league - never the title.
  const fetchConversations = useCallback(async () => {
    if (!token) {
      setConversations([]);
      return;
    }
    try {
      const params = new URLSearchParams({ mode: activeMode });
      if (sportId) params.set('sport', sportId);
      params.set('league', leagueId || '');
      const res = await fetch(`${API_BASE}/conversations?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  }, [token, activeMode, sportId, leagueId]);

  // Load Saved Items
  const fetchSavedItems = async () => {
    if (!token) {
      const local = localStorage.getItem('covriq_guest_saved');
      if (local) setSavedItems(JSON.parse(local));
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/saved`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSavedItems(data.items || []);
      }
    } catch (err) {
      console.error('Failed to load saved items:', err);
    }
  };

  // Load the active mode's conversations whenever the mode or auth changes.
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Reset the in-progress thread whenever the active mode, auth, or the global
  // sport context changes so one sport/mode's messages never leak into another
  // view. This keeps the workspace consistent with the sport-filtered "My Chats".
  useEffect(() => {
    if (skipNextWorkspaceResetRef.current) {
      skipNextWorkspaceResetRef.current = false;
      return;
    }
    setCurrentConversationId(null);
    setActiveConversation(null);
    setMessages([]);
    setIsStreaming(false);
    setStreamingStatus(null);
    setStreamingContent('');
    setStreamingStructured(null);
  }, [activeMode, token, sportId, leagueId]);

  // Load saved items when authenticated or on mount
  useEffect(() => {
    fetchSavedItems();
  }, [token]);

  // Load selected conversation
  const handleSelectConversation = async (id) => {
    closeSidebarOnMobile();
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${API_BASE}/conversations/${id}`, { headers });
      if (res.ok) {
        const data = await res.json();
        const conversation = data.conversation;
        const targetMode = getModeById(conversation.mode) || DEFAULT_MODE;

        skipNextWorkspaceResetRef.current = true;
        if (conversation.sport && (conversation.sport !== sportId || (conversation.league || null) !== (leagueId || null))) {
          setSport(conversation.sport, conversation.league || null);
        }
        if (path !== targetMode.route) {
          push(targetMode.route);
        }

        setActiveConversation(conversation);
        setCurrentConversationId(id);
        setMessages(conversation.messages || []);
        setStreamingContent('');
        setStreamingStatus(null);
        setStreamingStructured(null);
      }
    } catch (err) {
      console.error('Failed to load conversation:', err);
    }
  };

  // Start a fresh analysis (scoped to the active mode)
  const handleNewChat = () => {
    closeSidebarOnMobile();
    setCurrentConversationId(null);
    setActiveConversation(null);
    setMessages([]);
    setStreamingContent('');
    setStreamingStatus(null);
    setStreamingStructured(null);
    // If we're on the saved screen, jump back into the active mode's chat.
    if (isSavedRoute) push(currentMode.route);
  };

  // Delete Conversation
  const handleDeleteConversation = async (id) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/conversations/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setConversations(prev => prev.filter(c => c.id !== id));
        if (currentConversationId === id) {
          handleNewChat();
        }
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  // Save Pick Handler
  const handleSavePick = async ({ title, content }) => {
    if (token) {
      try {
        const res = await fetch(`${API_BASE}/saved`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            type: 'bet_pick',
            title,
            content
          })
        });
        if (res.ok) {
          const data = await res.json();
          setSavedItems(prev => [data.item, ...prev]);
        }
      } catch (err) {
        console.error('Save pick error:', err);
      }
    } else {
      const guestItem = {
        id: 'guest_' + Date.now(),
        title,
        content,
        created_at: new Date().toISOString()
      };
      const updated = [guestItem, ...savedItems];
      setSavedItems(updated);
      localStorage.setItem('covriq_guest_saved', JSON.stringify(updated));
    }
  };

  // Delete Saved Item
  const handleDeleteSaved = async (id) => {
    if (token) {
      try {
        const res = await fetch(`${API_BASE}/saved/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          setSavedItems(prev => prev.filter(s => s.id !== id));
        }
      } catch (err) {
        console.error('Delete saved error:', err);
      }
    } else {
      const updated = savedItems.filter(s => s.id !== id);
      setSavedItems(updated);
      localStorage.setItem('covriq_guest_saved', JSON.stringify(updated));
    }
  };

  // Update Bet (Grading & CLV) Handler
  const handleUpdateBet = async (id, updates) => {
    if (token) {
      try {
        const res = await fetch(`${API_BASE}/saved/${id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(updates)
        });
        if (res.ok) {
          const data = await res.json();
          setSavedItems(prev => prev.map(item => item.id === id ? data.item : item));
        }
      } catch (err) {
        console.error('Update bet error:', err);
      }
    } else {
      const updated = savedItems.map(item => {
        if (item.id === id) {
          return {
            ...item,
            result: updates.result,
            stake: updates.stake,
            closing_odds: updates.closing_odds,
            clv_percent: updates.clv_percent,
            profit: updates.profit,
            notes: updates.notes,
            content: {
              ...item.content,
              ...updates
            }
          };
        }
        return item;
      });
      setSavedItems(updated);
      localStorage.setItem('covriq_guest_saved', JSON.stringify(updated));
    }
  };

  // Send Message & Stream SSE
  const handleSendMessage = async (text, images = []) => {

    const imageList = Array.isArray(images) ? images.filter(Boolean) : (images ? [images] : []);
    const primaryImage = imageList[0] || null;
    if ((!text && imageList.length === 0) || isStreaming) return;
    closeSidebarOnMobile();

    const userMsg = {
      role: 'user',
      content: text,
      metadata: imageList.length > 0 ? { image: primaryImage, images: imageList } : null,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMsg]);
    setIsStreaming(true);
    setStreamingStatus(imageList.length > 0 ? 'Analyzing screenshots with AI Vision...' : 'Connecting to CovrIQ sports engine...');
    setStreamingContent('');
    setStreamingStructured(null);

    try {
      const headers = { 'Content-Type': 'application/json' };
            if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          conversationId: currentConversationId,
          message: text,
          image: primaryImage || undefined,
          images: imageList.length > 0 ? imageList : undefined,
          mode: activeMode,
          oddsFormat,
          sport: sportId,
          league: leagueId || null
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let accumulatedText = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop();

        for (const block of lines) {
          const eventLine = block.match(/event:\s*([^\n]+)/);
          const dataLine = block.match(/data:\s*([^\n]+)/);

          if (!eventLine || !dataLine) continue;

          const event = eventLine[1].trim();
          let data;
          try {
            data = JSON.parse(dataLine[1].trim());
          } catch (e) {
            continue;
          }

          if (event === 'init') {
            setCurrentConversationId(data.conversationId);
            setActiveConversation({ id: data.conversationId, title: data.title });
          } else if (event === 'status') {
            setStreamingStatus(data.text);
          } else if (event === 'chunk') {
            setStreamingStatus(null);
            accumulatedText += data.chunk;
            setStreamingContent(accumulatedText);
          } else if (event === 'done') {
            const assistantMsg = {
              id: data.messageId,
              role: 'assistant',
              content: accumulatedText,
              metadata: data.structured,
              created_at: new Date().toISOString()
            };
            setMessages(prev => [...prev, assistantMsg]);
            setIsStreaming(false);
            setStreamingStatus(null);
            setStreamingContent('');
            setStreamingStructured(null);
            fetchConversations();
            return;
          } else if (event === 'error') {
            throw new Error(data.message || 'Streaming failed');
          }
        }
      }

      setIsStreaming(false);
      setStreamingStatus(null);
    } catch (err) {
      console.error('Chat error:', err);
      setIsStreaming(false);
      setStreamingStatus(null);
      const errMsg = {
        role: 'assistant',
        content: `Unable to complete live research: ${err.message}. Please check your connection or try again.`,
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, errMsg]);
    }
  };

  const openOddsCalculator = (initialData = null) => {
    closeSidebarOnMobile();
    setOddsCalcInitialData(initialData);
    setIsOddsCalcOpen(true);
  };

  const openAuth = (view = 'login') => {
    closeSidebarOnMobile();
    setAuthInitialView(view);
    setIsAuthModalOpen(true);
  };

  return (
    <div className="app-container">
      {/* Mobile Top Navigation Header */}
      <div className="mobile-header">
        <button
          className="mobile-toggle-btn"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          aria-label="Toggle Menu"
        >
          <Menu size={22} />
        </button>
        <span className="mobile-brand-title">
          Covr<span style={{ color: 'var(--accent-cyan)' }}>IQ</span>
        </span>
      </div>

      {/* Backdrop for Mobile Drawer */}
      {isSidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Primary Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        activeMode={activeMode}
        isCommunityActive={isCommunityRoute}
        onSelectMode={(mode) => {
          push(mode.route);
          closeSidebarOnMobile();
        }}
        currentConversationId={currentConversationId}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        onOpenCommunity={() => {
          push('/community');
          closeSidebarOnMobile();
        }}
        onOpenSaved={() => {
          push('/saved');
          closeSidebarOnMobile();
        }}
        onOpenSettings={() => {
          setIsSettingsOpen(true);
          closeSidebarOnMobile();
        }}
        onOpenContact={() => {
          setIsContactOpen(true);
          closeSidebarOnMobile();
        }}
        onOpenAuthModal={openAuth}
        onOpenOddsCalc={() => openOddsCalculator()}
        conversations={conversations}
        onDeleteConversation={handleDeleteConversation}
      />

      {/* Main Content Area */}
      <main className="main-content">
        {isSavedRoute ? (
          <SavedView
            savedItems={savedItems}
            onBackToChat={() => push(currentMode.route)}
            onDeleteSaved={handleDeleteSaved}
            onOpenOddsCalc={openOddsCalculator}
            onUpdateBet={handleUpdateBet}
          />
        ) : isCommunityRoute ? (
          <CommunityView onOpenAuth={openAuth} />
        ) : isEdgeScannerRoute ? (
          <EdgeScannerView
            onDeepDive={(prompt) => {
              push('/deep-analysis');
              setTimeout(() => {
                handleSendMessage(prompt);
              }, 50);
            }}
            onOpenOddsCalc={openOddsCalculator}
            onSavePick={handleSavePick}
            savedItems={savedItems}
          />
        ) : (
          <ChatWorkspace
            activeMode={activeMode}
        isCommunityActive={isCommunityRoute}
            conversation={activeConversation}
            messages={messages}
            isStreaming={isStreaming}
            streamingStatus={streamingStatus}
            streamingContent={streamingContent}
            streamingStructured={streamingStructured}
            onSendMessage={handleSendMessage}
            onOpenOddsCalc={openOddsCalculator}
            onSavePick={handleSavePick}
            savedItems={savedItems}
          />
        )}
      </main>


      {/* Modals */}
      <OddsCalculatorModal
        isOpen={isOddsCalcOpen}
        onClose={() => setIsOddsCalcOpen(false)}
        initialData={oddsCalcInitialData}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialView={authInitialView}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <ContactModal
        isOpen={isContactOpen}
        onClose={() => setIsContactOpen(false)}
      />
    </div>
  );
}




