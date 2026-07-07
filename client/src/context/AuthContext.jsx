import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getToken, setToken } from '../lib/api.js';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!getToken()) { setLoading(false); return; }
    try {
      const { user } = await api.get('/auth/me');
      setUser(user);
    } catch {
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const login = async (email, password) => {
    const { token, user } = await api.post('/auth/login', { email, password });
    setToken(token);
    setUser(user);
    return user;
  };

  const guestLogin = async () => {
    const guestUser = {
      id: 'guest',
      email: 'guest@skyroot.com',
      account_type: 'guest',
      isGuest: true,
      permissions: {},
    };
    setToken('guest-token');
    setUser(guestUser);
    return guestUser;
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    setToken(null);
    setUser(null);
  };

  // Admins implicitly hold every permission.
  const isAdmin = user?.account_type === 'admin';
  const can = (perm) => isAdmin || !!user?.permissions?.[perm];
  const isType = (...t) => t.includes(user?.account_type);

  return (
    <AuthCtx.Provider value={{ user, loading, login, logout, guestLogin, can, isAdmin, isType, accountType: user?.account_type, reload: load }}>
      {children}
    </AuthCtx.Provider>
  );
}
