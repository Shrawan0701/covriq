import React, { useState, useRef, useEffect } from 'react';
import { useSport } from '../context/SportContext';
import './SportSelector.css';

export default function SportSelector() {
  const { sportId, leagueId, selectedSport, selectedLeague, sportsList, soccerLeagues, setSport } = useSport();
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState('sports'); // 'sports' or 'leagues'
  const buttonRef = useRef(null);
  const popoverRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    function onOutsideClick(e) {
      if (
        isOpen &&
        buttonRef.current &&
        popoverRef.current &&
        !buttonRef.current.contains(e.target) &&
        !popoverRef.current.contains(e.target)
      ) {
        setIsOpen(false);
        setView('sports');
      }
    }
    document.addEventListener('mousedown', onOutsideClick);
    return () => document.removeEventListener('mousedown', onOutsideClick);
  }, [isOpen]);

  const handleSportClick = (sport) => {
    if (sport.id === 'soccer') {
      setView('leagues');
    } else {
      setSport(sport.id, null);
      setIsOpen(false);
    }
  };

  const handleLeagueClick = (selectedLeagueId) => {
    setSport('soccer', selectedLeagueId);
    setIsOpen(false);
    setView('sports');
  };

  const currentSport = selectedSport || sportsList[0];
  const currentLabel = selectedLeague
    ? `${currentSport.emoji} ${selectedLeague.label}`
    : `${currentSport.emoji} ${currentSport.label}`;

  return (
    <div className="sport-selector">
      <button
        ref={buttonRef}
        type="button"
        className="sport-selector-btn"
        onClick={() => {
          setIsOpen((prev) => !prev);
          if (sportId === 'soccer') setView('leagues');
        }}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <span className="sport-selector-label">{currentLabel}</span>
        <span className="sport-selector-chevron">▼</span>
      </button>

      {isOpen && (
        <div className="sport-selector-popover" ref={popoverRef} role="menu">
          {view === 'sports' ? (
            <div className="sport-menu-list">
              {sportsList.map((sport) => {
                const isActive = sportId === sport.id;
                return (
                  <button
                    key={sport.id}
                    type="button"
                    className={`sport-option ${isActive ? 'active' : ''}`}
                    onClick={() => handleSportClick(sport)}
                  >
                    <span className="sport-option-emoji">{sport.emoji}</span>
                    <span className="sport-option-label">{sport.label}</span>
                    {sport.id === 'soccer' ? (
                      <span className="sport-option-arrow">›</span>
                    ) : (
                      isActive && <span className="sport-option-dot" />
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="sport-menu-list">
              <button
                type="button"
                className="sport-option-back"
                onClick={() => setView('sports')}
              >
                ← Other Sports
              </button>
              <div className="sport-menu-divider" />
              {soccerLeagues.map((league) => {
                const isActive = leagueId === league.id;
                return (
                  <button
                    key={league.id}
                    type="button"
                    className={`league-option ${isActive ? 'active' : ''}`}
                    onClick={() => handleLeagueClick(league.id)}
                  >
                    <span className="league-option-label">{league.label}</span>
                    {isActive && <span className="league-option-dot" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}