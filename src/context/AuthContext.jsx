import { useState, useEffect } from 'react';
import api from '../api/axios';
import { AuthContext } from './contexts';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const stored = localStorage.getItem('user');
      const token = localStorage.getItem('token');
      if (stored && token) {
        await Promise.resolve(); // yield to microtask queue
        setUser(JSON.parse(stored));
      }
      setLoading(false);
    })();
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { token, user } = res.data;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    // Let the sidebar's upload-notification alert fire fresh on this login,
    // even if it already fired earlier in the same browser tab/session.
    sessionStorage.removeItem('uploadNotifAlerted');
    setUser(user);
    return user;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

