import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const { token, user } = useAuth();
  const [theme, setTheme] = useState(() => localStorage.getItem('covriq_theme') || 'dark');
  const [oddsFormat, setOddsFormat] = useState(() => localStorage.getItem('covriq_odds_format') || 'both');
  const [chatFont, setChatFont] = useState(() => localStorage.getItem('covriq_chat_font') || 'serif');

  // Apply theme to DOM
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('covriq_theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('covriq_odds_format', oddsFormat);
  }, [oddsFormat]);

  useEffect(() => {
    localStorage.setItem('covriq_chat_font', chatFont);
  }, [chatFont]);

  // Sync preferences from user if available
  useEffect(() => {
    if (user?.preference) {
      if (user.preference.theme) setTheme(user.preference.theme);
      if (user.preference.odds_format) setOddsFormat(user.preference.odds_format);
      if (user.preference.chat_font) setChatFont(user.preference.chat_font);
    }
  }, [user]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const updatePreferences = async (newPrefs) => {
    if (newPrefs.theme) setTheme(newPrefs.theme);
    if (newPrefs.oddsFormat) setOddsFormat(newPrefs.oddsFormat);
    if (newPrefs.chatFont) setChatFont(newPrefs.chatFont);

    // Save to server if logged in
    if (token) {
      try {
        await fetch('/api/settings', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            theme: newPrefs.theme || theme,
            odds_format: newPrefs.oddsFormat || oddsFormat,
            chat_font: newPrefs.chatFont || chatFont
          })
        });
      } catch (err) {
        console.error('Failed to sync settings with server:', err);
      }
    }
  };

  return (
    <ThemeContext.Provider value={{
      theme,
      setTheme,
      toggleTheme,
      oddsFormat,
      setOddsFormat,
      chatFont,
      setChatFont,
      updatePreferences
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
