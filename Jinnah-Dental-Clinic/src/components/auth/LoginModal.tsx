'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { UserRole } from '@/types';
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
import { Loader2, Lock, User, Stethoscope } from 'lucide-react';
import { toast } from 'sonner';

// Firebase
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

// IndexedDB Utilities
import { saveToLocal, getFromLocal } from '@/services/indexedDbUtils';

export function LoginModal({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Default users setup (admin123, operator123)
  useEffect(() => {
    async function setupDefaultUsers() {
      try {
        // Check & create default admin
        let admin = await getFromLocal('users', 'admin');
        if (!admin || !admin.id) {
          admin = { ...admin, id: 'admin', role: 'admin', password: 'admin123', name: 'Admin User' };
          await saveToLocal('users', admin);
          // Optional: Firebase sync
          setDoc(doc(db, 'users', 'admin'), admin).catch(console.error);
        }

        // Check & create default operator
        let operator = await getFromLocal('users', 'operator');
        if (!operator || !operator.id) {
          operator = { ...operator, id: 'operator', role: 'operator', password: 'operator123', name: 'Operator User' };
          await saveToLocal('users', operator);
          // Optional: Firebase sync
          setDoc(doc(db, 'users', 'operator'), operator).catch(console.error);
        }

        // console.log('Default users ready');
      } catch (err) {
        console.error('Setup default users failed:', err);
      }
    }

    setupDefaultUsers();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/10" />

      <div className="relative z-10 w-full max-w-md animate-slide-in">
        <div className="bg-card border border-border rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
              <Stethoscope className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">DentalFlow</h1>
            <p className="text-muted-foreground mt-1">Dental Clinic Management System</p>
          </div>

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
              className="w-full h-11 font-medium"
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

        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          © 2026 Saynz. All rights reserved.
        </p>
      </div>
    </div>
  );
}