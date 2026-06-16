import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, setToken, getToken } from '../api.js';
import { reauthSocket } from '../socket.js';

/**
 * AuthContext — optional Google account layer.
 *
 * On mount it reads /api/config to learn whether accounts are enabled (and the
 * Google client id), then restores any existing session via /api/me. Exposes
 * `login(credential)` (called with a Google ID token) and `logout()`. When the
 * session changes it re-handshakes the socket so the server links gameplay to
 * the signed-in user.
 *
 * Everything degrades gracefully: if the server has no Google/DB configured,
 * `accountsEnabled` is false and the UI simply hides the login affordances.
 */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [googleClientId, setGoogleClientId] = useState(null);
  const [accountsEnabled, setAccountsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = await api.config();
        if (cancelled) return;
        setGoogleClientId(cfg.googleClientId);
        setAccountsEnabled(cfg.accountsEnabled);
        // Restore an existing session if we have a token.
        if (cfg.accountsEnabled && getToken()) {
          try {
            const { user: u } = await api.me();
            if (!cancelled) setUser(u);
          } catch {
            setToken(null); // stale/expired token
          }
        }
      } catch {
        // Server unreachable or no /api/config — treat as accounts disabled.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (credential) => {
    const { token, user: u } = await api.googleLogin(credential);
    setToken(token);
    reauthSocket(); // re-handshake so the socket is now authenticated
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    reauthSocket();
    setUser(null);
  }, []);

  const value = { user, setUser, googleClientId, accountsEnabled, loading, login, logout };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
