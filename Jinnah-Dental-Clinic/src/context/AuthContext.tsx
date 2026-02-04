'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { User, UserRole, AuthState } from '@/types';

// IndexedDB Utilities
import { saveToLocal, getFromLocal } from '@/services/indexedDbUtils';
import { toast } from 'sonner';

interface AuthContextType extends AuthState {
  login: (loginId: string, password: string) => Promise<{ success: boolean; role?: UserRole }>;
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

  const login = useCallback(async (loginId: string, password: string): Promise<{ success: boolean; role?: UserRole }> => {
    try {
      console.log("Searching for user ID:", loginId);

      // Fetch all users to search by ID (since keyPath is role)
      const usersRaw = await getFromLocal('users');
      const users = (Array.isArray(usersRaw) ? usersRaw : []) as User[];

      const foundUser = users.find(u => u.id === loginId && u.password === password);

      if (foundUser && (foundUser.role === 'admin' || foundUser.role === 'operator')) {
        console.log('Login successful for:', foundUser.name);

        // Login success - Create user object matching your User type
        const newAuthState: AuthState = {
          isAuthenticated: true,
          user: {
            id: foundUser.id,
            role: foundUser.role as UserRole,
            name: foundUser.name,
            email: foundUser.email || '',
            createdAt: foundUser.createdAt || new Date().toISOString(),
            lastUpdated: foundUser.lastUpdated
          },
        };

        setAuthState(newAuthState);

        // Backup to localStorage as requested
        localStorage.setItem('currentUser', JSON.stringify(foundUser));

        toast.success(`Welcome ${foundUser.name}!`);
        return { success: true, role: foundUser.role as UserRole };
      } else {
        console.warn(`User found not found or password mismatch for ID: ${loginId}`);
        toast.error('Invalid credentials');
        return { success: false };
      }
    } catch (err) {
      console.error('Login error:', err);
      toast.error('Login failed. Please try again.');
      return { success: false };
    }
  }, []);

  const logout = useCallback(() => {
    console.log('Logging out');
    setAuthState({
      isAuthenticated: false,
      user: null,
    });
    sessionStorage.removeItem('clinic_auth_state');
    localStorage.removeItem('currentUser'); // Optional cleanup
    toast.success('Logged out successfully');
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