'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { User, UserRole, AuthState } from '@/types';

// IndexedDB Utilities
import { saveToLocal, getFromLocal } from '@/services/indexedDbUtils';
import { toast } from 'sonner';

interface AuthContextType extends AuthState {
  login: (role: UserRole, password: string) => Promise<boolean>;
  logout: () => void;
  changePassword: (role: string, currentPassword: string, newPassword: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
  });

  // Load from sessionStorage on mount
  useEffect(() => {
    const saved = sessionStorage.getItem('clinic_auth_state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setAuthState(parsed);
      } catch (err) {
        console.error('Invalid saved auth:', err);
        sessionStorage.removeItem('clinic_auth_state');
      }
    }
  }, []);

  // Save to sessionStorage on change
  useEffect(() => {
    if (authState.isAuthenticated) {
      sessionStorage.setItem('clinic_auth_state', JSON.stringify(authState));
    } else {
      sessionStorage.removeItem('clinic_auth_state');
    }
  }, [authState]);

  const login = useCallback(async (role: UserRole, password: string): Promise<boolean> => {
    try {
      // Fetch latest user from IndexedDB
      const storedUser = await getFromLocal('users', role);

      if (!storedUser) {
        console.warn(`No user found for role: ${role}`);
        return false;
      }

      if (storedUser.password !== password) {
        console.log('Password mismatch:', { entered: password, stored: storedUser.password });
        return false;
      }

      // Also save to localStorage for backward compatibility
      localStorage.setItem('currentUser', JSON.stringify({
        role: storedUser.role,
        name: storedUser.name,
        password: storedUser.password
      }));

      // Login success
      const newAuthState: AuthState = {
        isAuthenticated: true,
        user: {
          id: storedUser.id || `${role}-001`,
          role: storedUser.role,
          name: storedUser.name || `${role.charAt(0).toUpperCase() + role.slice(1)} User`,
        },
      };

      setAuthState(newAuthState);
      return true;
    } catch (err) {
      console.error('Login error:', err);
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    setAuthState({
      isAuthenticated: false,
      user: null,
    });
    sessionStorage.removeItem('clinic_auth_state');
    localStorage.removeItem('currentUser'); // Optional cleanup
  }, []);

  // Refactored changePassword to use authService
  const changePassword = async (role: string, currentPassword: string, newPassword: string): Promise<boolean> => {
    try {
      const { updateUserPassword } = await import('@/services/authService');
      const success = await updateUserPassword(role, currentPassword, newPassword);

      if (success) {
        // Update local auth state if the change was for the logged-in user
        if (authState.user && authState.user.role === role) {
          // Note: we don't store password in authState.user for security
          // But we might want to refresh the session metadata if needed
          console.log('Current user password updated in background');
        }
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('Change password error:', error);
      toast.error(error.message || 'Failed to change password');
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{ ...authState, login, logout, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}