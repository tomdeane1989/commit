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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Create axios instance with default config
const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

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
};

// Dashboard API
export const dashboardApi = {
  getDashboardData: async (userId?: string): Promise<DashboardData> => {
    const endpoint = userId ? `/dashboard/sales-rep/${userId}` : '/dashboard/sales-rep';
    const response = await api.get(endpoint);
    return response.data;
  },

  updateDealCategory: async (dealId: string, category: string): Promise<Deal> => {
    const response = await api.patch(`/dashboard/deals/${dealId}/category`, { category });
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
  getTargets: async (): Promise<ApiResponse<Target[]>> => {
    const response = await api.get('/targets');
    return response.data;
  },

  createTarget: async (targetData: Partial<Target>): Promise<Target> => {
    const response = await api.post('/targets', targetData);
    return response.data;
  },

  updateTarget: async (targetId: string, targetData: Partial<Target>): Promise<Target> => {
    const response = await api.put(`/targets/${targetId}`, targetData);
    return response.data;
  },

  deactivateTarget: async (targetId: string): Promise<Target> => {
    const response = await api.patch(`/targets/${targetId}/deactivate`);
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

export default api;