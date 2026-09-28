import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import {
  SPORTS,
  SOCCER_LEAGUES,
  DEFAULT_SPORT,
  DEFAULT_SOCCER_LEAGUE,
  getSportById,
  getSoccerLeagueById
} from '../config/sports';

const SportContext = createContext();

const API_BASE = '/api';

const LOCAL_SPORT_KEY = 'covriq_selected_sport';
const LOCAL_LEAGUE_KEY = 'covriq_selected_league';

/**
 * Centralized GLOBAL SPORT CONTEXT.
 *
 * Holds the sport/league the user is CURRENTLY researching. This drives:
 *   - new conversation creation (sport is FIXED on the conversation at creation)
 *   - the "My Chats" filter (conversations are matched by stored sport/league)
 *   - the SPORT/LEAGUE research context sent to the backend chat/AI pipeline
 *
 * NOTE: Changing this global sport NEVER mutates existing conversations - it only
 * affects which sport new chats are created under, the research context, and
 * which chats are listed in the sidebar.
 */
export function SportProvider({ children }) {
  const { token } = useAuth();

  const [sportId, setSportId] = useState(() => {
    const stored = localStorage.getItem(LOCAL_SPORT_KEY);
    return getSportById(stored) ? stored : DEFAULT_SPORT;
  });
  const [leagueId, setLeagueId] = useState(() => {
    const stored = localStorage.getItem(LOCAL_LEAGUE_KEY);
    return sportLeagueStoreValid(DEFAULT_SOCCER_LEAGUE, stored) ? stored : null;
  });
  const [isHydrated, setIsHydrated] = useState(false);

  // Helper: a league id is only valid when the sport is soccer.
  function sportLeagueStoreValid(sportIdVal, storedLeague) {
    if (sportIdVal !== 'soccer') return false;
    return storedLeague && getSoccerLeagueById(storedLeague) ? true : false;
  }

  // When the sport is not soccer, a lingering league id (from a previous soccer
  // selection) must not be carried over. Keep state + localStorage in sync.
  useEffect(() => {
    const normalizedLeague = sportId === 'soccer' ? leagueId : null;
    if (normalizedLeague !== leagueId) setLeagueId(normalizedLeague);
  }, [sportId, leagueId]);

  // Load the persisted preference for the authenticated user once available.
  useEffect(() => {
    let cancelled = false;

    async function hydrateFromServer() {
      if (!token) {
        setIsHydrated(true);
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/settings`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const { preferences } = await res.json();
          if (cancelled) return;
          const serverSport = getSportById(preferences.selected_sport)
            ? preferences.selected_sport
            : DEFAULT_SPORT;
          const serverLeague = serverSport === 'soccer' && getSoccerLeagueById(preferences.selected_league)
            ? preferences.selected_league
            : null;
          setSportId(serverSport);
          setLeagueId(serverLeague);
          localStorage.setItem(LOCAL_SPORT_KEY, serverSport);
          if (serverLeague) localStorage.setItem(LOCAL_LEAGUE_KEY, serverLeague);
          else localStorage.removeItem(LOCAL_LEAGUE_KEY);
        }
      } catch (err) {
        console.error('Failed to load sport preference:', err);
      } finally {
        if (!cancelled) setIsHydrated(true);
      }
    }

    hydrateFromServer();
    return () => { cancelled = true; };
  }, [token]);

  // Persist the user's global sport selection immediately (UI + server).
  const setSport = useCallback((newSportId, newLeagueId = null) => {
    const targetSport = getSportById(newSportId) ? newSportId : DEFAULT_SPORT;
    const targetLeague =
      targetSport === 'soccer' && getSoccerLeagueById(newLeagueId)
        ? newLeagueId
        : (targetSport === 'soccer' ? DEFAULT_SOCCER_LEAGUE : null);

    setSportId(targetSport);
    setLeagueId(targetLeague);
    localStorage.setItem(LOCAL_SPORT_KEY, targetSport);
    if (targetLeague) localStorage.setItem(LOCAL_LEAGUE_KEY, targetLeague);
    else localStorage.removeItem(LOCAL_LEAGUE_KEY);

    if (token) {
      fetch(`${API_BASE}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          selected_sport: targetSport,
          selected_league: targetLeague
        })
      }).catch((err) => console.error('Failed to persist sport preference:', err));
    }
  }, [token]);

  const selectedSport = getSportById(sportId) || getSportById(DEFAULT_SPORT);
  const selectedLeague = selectedSport?.id === 'soccer' ? getSoccerLeagueById(leagueId) : null;
  const displayLabel = selectedSport
    ? (selectedLeague ? selectedLeague.label : selectedSport.label)
    : 'MLB';

  return (
    <SportContext.Provider
      value={{
        sportId: selectedSport.id,
        leagueId: selectedLeague ? selectedLeague.id : null,
        selectedSport,
        selectedLeague,
        displayLabel,
        setSport,
        isHydrated,
        sportsList: SPORTS,
        soccerLeagues: SOCCER_LEAGUES
      }}
    >
      {children}
    </SportContext.Provider>
  );
}

export function useSport() {
  return useContext(SportContext);
}