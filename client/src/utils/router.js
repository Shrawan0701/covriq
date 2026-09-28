import { useState, useEffect, useCallback } from 'react';

/**
 * Minimal, dependency-free client-side router built on the History API.
 *
 * The rest of the app previously used only component state (`currentView` /
 * `activeMode`) to switch screens, so there was no router at all. Rather than
 * pull in react-router-dom (which isn't a dependency today and would require
 * a network install), this tiny hook gives us real URLs (`/ai-picks`,
 * `/value-finder`, ...) with browser back/forward support by listening for
 * the `popstate` event. It's perfectly sufficient for a two-level app (a
 * Discover Mode route + `/saved`) and keeps the client dependency-free.
 */

export function currentPath() {
  return window.location.pathname.replace(/\/+$/, '') || '/';
}

export function useHistoryPath() {
  const [path, setPath] = useState(currentPath);

  useEffect(() => {
    const onPopState = () => setPath(currentPath());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const push = useCallback((to) => {
    const target = (to || '/').startsWith('/') ? (to || '/') : `/${to}`;
    if (currentPath() === target) {
      // Same route - just keep our state in sync without a history entry.
      setPath(target);
      return;
    }
    window.history.pushState({}, '', target);
    setPath(target);
  }, []);

  const replace = useCallback((to) => {
    const target = (to || '/').startsWith('/') ? (to || '/') : `/${to}`;
    window.history.replaceState({}, '', target);
    setPath(target);
  }, []);

  return { path, push, replace };
}