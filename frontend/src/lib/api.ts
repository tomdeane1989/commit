import axios from 'axios';
import type { 
  ApiResponse, 
  AuthResponse, 
  LoginCredentials, 
  RegisterData, 
  DashboardData, 
  Deal, 
  DealsFilter,
  Target,
  Commission 
} from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3002';

// Create axios instance with default config
const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Create a separate axios instance for long-running operations like sync
const longRunningApi = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 60000, // 60 seconds for sync operations
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add JWT token from localStorage
const addAuthInterceptor = (axiosInstance: any) => {
  axiosInstance.interceptors.request.use(
    (config: any) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error: any) => Promise.reject(error)
  );
};

// Response interceptor to handle auth errors
const addResponseInterceptor = (axiosInstance: any) => {
  axiosInstance.interceptors.response.use(
    (response: any) => response,
    (error: any) => {
      if (error.response?.status === 401) {
        // Clear token and redirect to login
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }
  );
};

// Apply interceptors to both instances
addAuthInterceptor(api);
addResponseInterceptor(api);
addAuthInterceptor(longRunningApi);
addResponseInterceptor(longRunningApi);

// Auth API
export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },

  register: async (data: RegisterData): Promise<AuthResponse> => {
    const response = await api.post('/auth/register', data);
    return response.data;
  },

  me: async (): Promise<ApiResponse<any>> => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  logout: async (): Promise<void> => {
    const response = await api.post('/auth/logout');
    return response.data;
  },
};

// Dashboard API
export const dashboardApi = {
  getDashboardData: async (userId?: string): Promise<DashboardData> => {
    const endpoint = userId ? `/dashboard/sales-rep/${userId}` : '/dashboard/sales-rep';
    const response = await api.get(endpoint);
    return response.data;
  },

  updateDealCategory: async (dealId: string, category: string): Promise<Deal> => {
    const response = await api.patch(`/deals/${dealId}/categorize`, { 
      deal_type: category,
      // TODO: Add these fields when implementing full ML tracking
      // previous_category: previousCategory,
      // categorization_timestamp: new Date().toISOString(),
      // user_context: { categorization_method: 'manual' }
    });
    return response.data;
  },
};

// Deals API
export const dealsApi = {
  getDeals: async (filters?: DealsFilter): Promise<ApiResponse<Deal[]>> => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.category) params.append('category', filters.category);
    if (filters?.start_date) params.append('start_date', filters.start_date);
    if (filters?.end_date) params.append('end_date', filters.end_date);
    if (filters?.user_id) params.append('user_id', filters.user_id);
    
    const response = await api.get(`/deals?${params.toString()}`);
    return response.data;
  },

  createDeal: async (dealData: Partial<Deal>): Promise<Deal> => {
    const response = await api.post('/deals', dealData);
    return response.data;
  },

  updateDeal: async (dealId: string, dealData: Partial<Deal>): Promise<Deal> => {
    const response = await api.put(`/deals/${dealId}`, dealData);
    return response.data;
  },

  deleteDeal: async (dealId: string): Promise<void> => {
    await api.delete(`/deals/${dealId}`);
  },
};

// Targets API
export const targetsApi = {
  getTargets: async (filters?: { active_only?: boolean; user_id?: string }): Promise<ApiResponse<Target[]>> => {
    const params = new URLSearchParams();
    if (filters?.active_only !== undefined) params.append('active_only', filters.active_only.toString());
    if (filters?.user_id) params.append('user_id', filters.user_id);
    
    const response = await api.get(`/targets${params.toString() ? `?${params.toString()}` : ''}`);
    return response.data;
  },

  createTarget: async (targetData: Partial<Target>): Promise<Target> => {
    try {
      const response = await api.post('/targets', targetData);
      return response.data;
    } catch (error: any) {
      // Check if this is a conflict error that should be handled specially
      if (error.response?.status === 400 && error.response?.data?.skipped_users) {
        console.log('Conflict detected in API call, returning conflict response');
        // Return a special response that indicates conflicts
        return {
          ...error.response.data,
          isConflict: true,
        } as any;
      }
      // Re-throw other errors
      throw error;
    }
  },

  updateTarget: async (targetId: string, targetData: Partial<Target>): Promise<Target> => {
    const response = await api.put(`/targets/${targetId}`, targetData);
    return response.data;
  },

  deactivateTarget: async (targetId: string): Promise<Target> => {
    const response = await api.patch(`/targets/${targetId}/deactivate`);
    return response.data;
  },

  resolveConflicts: async (data: { conflicts: any[], wizard_data: any }): Promise<any> => {
    const response = await api.post('/targets/resolve-conflicts', data);
    return response.data;
  },

  getChildTargets: async (parentId: string): Promise<any> => {
    const response = await api.get(`/targets/${parentId}/children`);
    return response.data;
  },
};

// Commissions API
export const commissionsApi = {
  getCommissions: async (filters?: { period_start?: string; period_end?: string }): Promise<ApiResponse<Commission[]>> => {
    const params = new URLSearchParams();
    if (filters?.period_start) params.append('period_start', filters.period_start);
    if (filters?.period_end) params.append('period_end', filters.period_end);
    
    const response = await api.get(`/commissions?${params.toString()}`);
    return response.data;
  },

  calculateCommissions: async (data: { period_start: string; period_end: string }): Promise<Commission> => {
    console.log('🚀 Making API call to:', `${API_BASE_URL}/api/commissions/calculate`);
    console.log('🚀 Request data:', data);
    const response = await api.post('/commissions/calculate', data);
    return response.data;
  },

  approveCommission: async (commissionId: string): Promise<Commission> => {
    const response = await api.patch(`/commissions/${commissionId}/approve`);
    return response.data;
  },
};

// CRM API
export const crmApi = {
  getIntegrations: async (): Promise<ApiResponse<any[]>> => {
    const response = await api.get('/crm/integrations');
    return response.data;
  },

  createIntegration: async (integrationData: any): Promise<any> => {
    const response = await api.post('/crm/integrations', integrationData);
    return response.data;
  },

  syncDeals: async (integrationId: string): Promise<any> => {
    const response = await api.post(`/crm/sync/${integrationId}`);
    return response.data;
  },
};

// Team API
export const teamApi = {
  getTeam: async (params?: { 
    period?: 'monthly' | 'quarterly' | 'yearly';
    show_inactive?: string;
  }): Promise<ApiResponse<any[]>> => {
    console.log('🔍 TeamAPI - Making request to /team with params:', params);
    console.log('🔍 TeamAPI - Full URL will be:', `${API_BASE_URL}/api/team`);
    console.log('🔍 TeamAPI - Auth token being used (full):', localStorage.getItem('token'));
    const response = await api.get('/team', { params });
    console.log('🔍 TeamAPI - Response received:', response.data);
    return response.data;
  },

  inviteTeamMember: async (memberData: {
    email: string;
    first_name: string;
    last_name: string;
    role: string;
    territory?: string;
    manager_id?: string;
  }): Promise<any> => {
    const response = await api.post('/team/invite', memberData);
    return response.data;
  },

  updateTeamMember: async (userId: string, memberData: {
    first_name?: string;
    last_name?: string;
    role?: string;
    territory?: string;
    manager_id?: string;
    is_active?: boolean;
  }): Promise<any> => {
    const response = await api.patch(`/team/${userId}`, memberData);
    return response.data;
  },

  deactivateTeamMember: async (userId: string): Promise<any> => {
    const response = await api.delete(`/team/${userId}`);
    return response.data;
  },
};

// Integrations API - separate from CRM API for clarity
export const integrationsApi = {
  getIntegrations: async (): Promise<ApiResponse<any[]>> => {
    const response = await api.get('/integrations');
    return response.data;
  },

  testConnection: async (data: { crm_type: string; spreadsheet_url: string }): Promise<any> => {
    const response = await api.post('/integrations/test-connection', data);
    return response.data;
  },

  previewData: async (data: { crm_type: string; spreadsheet_url: string; sheet_name: string }): Promise<any> => {
    const response = await api.post('/integrations/preview-data', data);
    return response.data;
  },

  createIntegration: async (integrationData: any): Promise<any> => {
    const response = await api.post('/integrations', integrationData);
    return response.data;
  },

  syncIntegration: async (integrationId: string): Promise<any> => {
    // Use longRunningApi for sync operations that can take 30+ seconds
    const response = await longRunningApi.post(`/integrations/${integrationId}/sync`);
    return response.data;
  },

  deleteIntegration: async (integrationId: string): Promise<any> => {
    const response = await api.delete(`/integrations/${integrationId}`);
    return response.data;
  },
};

export default api;