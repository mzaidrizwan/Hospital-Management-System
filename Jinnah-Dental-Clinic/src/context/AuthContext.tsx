'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { User, UserRole, AuthState } from '@/types';

// IndexedDB Utilities
import { saveToLocal, getFromLocal } from '@/services/indexedDbUtils';

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

  // New: Change password function (used from settings)
  // Update the changePassword function in AuthContext.tsx
  const changePassword = async (role: string, currentPassword: string, newPassword: string): Promise<boolean> => {
    try {
      console.log('Changing password for role:', role);
      console.log('Current password entered:', currentPassword);

      // 1. First check localStorage for current user
      const currentUserStr = localStorage.getItem('currentUser');
      if (!currentUserStr) {
        console.error('No current user found in localStorage');
        return false;
      }

      const currentUser = JSON.parse(currentUserStr);
      console.log('Stored user data:', currentUser);

      // Check if the current password matches
      if (currentUser.password !== currentPassword) {
        console.error('Password mismatch:', {
          entered: currentPassword,
          stored: currentUser.password
        });
        return false;
      }

      // 2. Update localStorage
      const updatedUser = {
        ...currentUser,
        password: newPassword
      };
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      console.log('LocalStorage updated');

      // 3. Update IndexedDB
      const user = await getFromLocal('users', role);
      if (user) {
        user.password = newPassword;
        await saveToLocal('users', user);
        console.log('IndexedDB updated');
      } else {
        console.warn('User not found in IndexedDB, adding new user');
        await saveToLocal('users', updatedUser);
      }

      // 4. Update in clinicUsers array (if it exists)
      const clinicUsersStr = localStorage.getItem('clinicUsers');
      if (clinicUsersStr) {
        try {
          const clinicUsers = JSON.parse(clinicUsersStr);
          const userIndex = clinicUsers.findIndex((u: any) => u.role === role);
          if (userIndex !== -1) {
            clinicUsers[userIndex].password = newPassword;
            localStorage.setItem('clinicUsers', JSON.stringify(clinicUsers));
            console.log('clinicUsers array updated');
          }
        } catch (e) {
          console.warn('Could not update clinicUsers array:', e);
        }
      }

      // 5. Update Firebase if online
      if (typeof window !== 'undefined' && navigator.onLine) {
        try {
          // Import db dynamically to avoid SSR issues
          const { db } = await import('@/lib/firebase');
          const { doc, setDoc } = await import('firebase/firestore');

          if (db) {
            await setDoc(doc(db, 'users', role), {
              ...updatedUser,
              lastUpdated: new Date().toISOString()
            });
            console.log('Firebase password updated');
          }
        } catch (firebaseError) {
          console.error('Firebase update failed:', firebaseError);
          // Continue even if Firebase fails
        }
      }

      console.log('Password changed successfully');
      return true;

    } catch (error) {
      console.error('Change password error:', error);
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