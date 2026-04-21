'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Lock, User, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

// Firebase
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

// IndexedDB Utilities
import { dbManager } from '@/lib/indexedDB';

// ============================================
// LOGO PATH FIX - Add these helpers
// ============================================
const isElectron = () => {
  return !!(typeof window !== 'undefined' && 
    window.process && 
    window.process.type === 'renderer');
};

const getLogoPath = () => {
  if (isElectron()) {
    // Electron production mein - logo from build folder
    return './logo.png';
  }
  // Web development mein
  return '/logo.png';
};

export function LoginModal({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(true);

  // Default users setup
  useEffect(() => {
    async function setupDefaultUsers() {
      try {
        // Check local first
        let admin = await dbManager.getFromLocal('users', 'admin');
        let operator = await dbManager.getFromLocal('users', 'operator');

        // If not local, check cloud before creating defaults
        if (!admin || !operator) {
          const { getDoc, doc } = await import('firebase/firestore');
          
          if (!admin) {
            const adminDoc = await getDoc(doc(db, 'users', 'admin'));
            if (adminDoc.exists()) {
              admin = { id: 'admin', ...adminDoc.data() };
              await dbManager.putItem('users', admin);
            } else {
              admin = { id: 'admin', role: 'admin', password: 'admin123', name: 'Admin User' };
              await dbManager.putItem('users', admin);
              setDoc(doc(db, 'users', 'admin'), admin).catch(console.error);
            }
          }

          if (!operator) {
            const operatorDoc = await getDoc(doc(db, 'users', 'operator'));
            if (operatorDoc.exists()) {
              operator = { id: 'operator', ...operatorDoc.data() };
              await dbManager.putItem('users', operator);
            } else {
              operator = { id: 'operator', role: 'operator', password: 'operator123', name: 'Operator User' };
              await dbManager.putItem('users', operator);
              setDoc(doc(db, 'users', 'operator'), operator).catch(console.error);
            }
          }
        }

        setTimeout(() => {
          setShowLoginForm(true);
        }, 1500);
      } catch (err) {
        console.error('Setup default users failed:', err);
        setTimeout(() => {
          setShowLoginForm(true);
        }, 1500);
      }
    }

    setupDefaultUsers();
    
    // Test logo loading
    const logoPath = getLogoPath();
    // console.log('Logo path:', logoPath);
    // console.log('Is Electron:', isElectron());
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await login(userId, password);
      if (result.success) {
        if (onOpenChange) onOpenChange(false);
        if (result.role === 'admin') {
          navigate('/admin/dashboard');
        } else {
          navigate('/operator/dashboard');
        }
      } else {
        setError('Login failed. Please check your ID and password.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/10" />

      <div className="relative z-10 w-full max-w-md animate-slide-in">
        <div className="bg-white/90 backdrop-blur-sm border border-border rounded-2xl shadow-2xl p-8">
          
          {/* Logo and Welcome Section */}
          <div className={`text-center transition-all duration-700 ${showLoginForm ? 'mb-6' : 'mb-0 py-8'}`}>
            
            {/* Company Logo Image */}
            <div className="flex justify-center mb-4">
              <div className="relative group">
                <img 
                  src={getLogoPath()}
                  alt="Company Logo"
                  className="w-28 h-28 md:w-32 md:h-32 lg:w-36 lg:h-36 mx-auto object-contain transition-transform hover:scale-105 duration-300"
                  onError={(e) => {
                    console.error('Logo failed to load from path:', getLogoPath());
                    setLogoLoaded(false);
                    // Fallback - show clinic name
                    e.currentTarget.style.display = 'none';
                  }}
                  onLoad={() => {
                    console.log('Logo loaded successfully');
                    setLogoLoaded(true);
                  }}
                />
                {!logoLoaded && (
                  <div className="w-28 h-28 md:w-32 md:h-32 mx-auto bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl flex items-center justify-center">
                    <span className="text-white text-2xl font-bold">JD</span>
                  </div>
                )}
              </div>
            </div>

            {/* Welcome Message */}
            <div className="space-y-2">
              <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-700 to-blue-500 bg-clip-text text-transparent">
                Welcome to Jinnah Dental
              </h1>
              <p className="text-muted-foreground text-sm md:text-base">
                Your Complete Clinic Management Solution
              </p>
            </div>

            {/* Powered By Text */}
            <div className="mt-4 flex items-center justify-center gap-2">
              <Sparkles className="w-3 h-3 text-blue-500" />
              <p className="text-xs text-muted-foreground">
                Powered by <span className="font-semibold text-blue-600">Saynz Technologies</span>
              </p>
              <Sparkles className="w-3 h-3 text-blue-500" />
            </div>
          </div>

          {/* Login Form */}
          <div className={`transition-all duration-700 transform ${
            showLoginForm 
              ? 'opacity-100 translate-y-0' 
              : 'opacity-0 translate-y-4 pointer-events-none'
          }`}>
            
            {showLoginForm && (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="userId" className="text-sm font-medium">
                    User ID
                  </Label>
                  <Select value={userId} onValueChange={setUserId}>
                    <SelectTrigger className="w-full h-11">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <SelectValue placeholder="Select user" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="operator">
                        <div className="flex items-center gap-2">
                          <span>Operator</span>
                          <span className="text-xs text-muted-foreground">(Front Desk)</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="admin">
                        <div className="flex items-center gap-2">
                          <span>Admin</span>
                          <span className="text-xs text-muted-foreground">(Full Access)</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 h-11"
                      required
                    />
                  </div>
                </div>

                {error && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm animate-fade-in">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-11 font-medium bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all"
                  disabled={isLoading || !password}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </form>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          © 2026 Saynz Technologies. All rights reserved.
        </p>
      </div>
    </div>
  );
}