import { createContext, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '../lib/api';
import { useRouter } from 'next/router';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User | null) => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    const initializeAuth = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setUser(null);
          setLoading(false);
          return;
        }

        console.log('Auth: Checking authentication with localStorage token');
        const response = await authApi.me();
        console.log('Auth: me() response:', response);
        
        // Handle new response format
        if (response.success && response.user) {
          setUser(response.user);
        } else {
          // Handle legacy format
          setUser(response.data || response);
        }
      } catch (error) {
        console.error('Auth: Authentication check failed:', error);
        localStorage.removeItem('token');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, [mounted]);

  const login = async (email: string, password: string) => {
    try {
      const response = await authApi.login({ email, password });
      
      // Store token in localStorage
      if (response.success && response.token && response.user) {
        // CRITICAL SECURITY FIX: Clear all cached data to prevent cross-user data leakage
        console.log('🔄 Login: Clearing all React Query cache to prevent cross-user data leakage');
        queryClient.clear();
        
        // Clear any persisted login errors on successful login
        localStorage.removeItem('loginError');
        
        localStorage.setItem('token', response.token);
        setUser(response.user);
        router.push('/commissions');
      } else {
        throw new Error('Login failed - invalid response format');
      }
    } catch (error: any) {
      
      // Provide user-friendly error messages
      let errorMsg = 'Login failed. Please try again.';
      
      if (error.response?.status === 401) {
        errorMsg = 'Invalid email or password. Please check your credentials and try again.';
      } else if (error.response?.status === 429) {
        errorMsg = 'Too many login attempts. Please wait a moment before trying again.';
      } else if (error.response?.status >= 500) {
        errorMsg = 'Server error. Please try again in a moment.';
      } else if (error.code === 'NETWORK_ERROR' || !error.response) {
        errorMsg = 'Network error. Please check your internet connection and try again.';
      } else if (error.response?.data?.error) {
        // Use backend error if it's user-friendly
        const backendError = error.response.data.error;
        if (backendError.includes('Invalid credentials') || backendError.includes('invalid')) {
          errorMsg = 'Invalid email or password. Please check your credentials and try again.';
        } else if (backendError.includes('account') && backendError.includes('locked')) {
          errorMsg = 'Account temporarily locked. Please contact support if this persists.';
        } else {
          errorMsg = backendError;
        }
      }
      
      console.error('Login error:', errorMsg);
      throw new Error(errorMsg);
    }
  };

  const logout = async () => {
    try {
      // CRITICAL SECURITY FIX: Clear all cached data to prevent cross-user data leakage
      console.log('🔄 Logout: Clearing all React Query cache to prevent cross-user data leakage');
      queryClient.clear();
      
      // Clear token from localStorage
      localStorage.removeItem('token');
      setUser(null);
      if (router.pathname !== '/login') {
        router.push('/login');
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Prevent hydration mismatches by not rendering until mounted
  if (!mounted) {
    return (
      <AuthContext.Provider value={{ user: null, login, logout, setUser, loading: true }}>
        {children}
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, setUser, loading }}>
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