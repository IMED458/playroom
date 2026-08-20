import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, RoleName, AttendanceRecord } from '../types';
import { apiRequest, setToken, removeToken, getToken } from '../lib/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  activeShift: AttendanceRecord | null;
  login: (username: string, password?: string) => Promise<void>;
  quickLogin: (role: RoleName) => Promise<void>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
  refreshUser: () => Promise<void>;
  refreshShift: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeShift, setActiveShift] = useState<AttendanceRecord | null>(null);

  const refreshShift = async () => {
    try {
      const res = await apiRequest<{ attendance: AttendanceRecord[] }>('/employees/attendance');
      const ongoing = res.attendance.find(a => !a.endTime);
      setActiveShift(ongoing || null);
    } catch {
      setActiveShift(null);
    }
  };

  const refreshUser = async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const data = await apiRequest<{ user: User }>('/auth/me');
      setUser(data.user);
      await refreshShift();
    } catch {
      removeToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();

    const handleUnauthorized = () => {
      setUser(null);
      setActiveShift(null);
      setLoading(false);
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const login = async (username: string, password = 'password123') => {
    const data = await apiRequest<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    setToken(data.token);
    setUser(data.user);
    await refreshShift();
  };

  const quickLogin = async (role: RoleName) => {
    const data = await apiRequest<{ token: string; user: User }>('/auth/quick-login', {
      method: 'POST',
      body: JSON.stringify({ role })
    });
    setToken(data.token);
    setUser(data.user);
    await refreshShift();
  };

  const logout = () => {
    removeToken();
    setUser(null);
    setActiveShift(null);
  };

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    if (user.role === RoleName.SUPER_ADMIN) return true;
    return user.permissions.includes(permission);
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      activeShift,
      login,
      quickLogin,
      logout,
      hasPermission,
      refreshUser,
      refreshShift
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
