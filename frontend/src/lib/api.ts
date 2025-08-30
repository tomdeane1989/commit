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

// Token refresh function
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response interceptor to handle auth errors and token refresh
const addResponseInterceptor = (axiosInstance: any) => {
  axiosInstance.interceptors.response.use(
    (response: any) => response,
    async (error: any) => {
      const originalRequest = error.config;

      // Check if error is token expired
      if (error.response?.status === 401 && error.response?.data?.code === 'TOKEN_EXPIRED' && !originalRequest._retry) {
        if (isRefreshing) {
          // If already refreshing, queue this request
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          }).then(token => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return axiosInstance(originalRequest);
          }).catch(err => {
            return Promise.reject(err);
          });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        const refreshToken = localStorage.getItem('refreshToken');
        
        if (!refreshToken) {
          // No refresh token, redirect to login
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
          return Promise.reject(error);
        }

        try {
          // Call refresh endpoint
          const response = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {
            refreshToken
          });

          const { accessToken, refreshToken: newRefreshToken } = response.data;
          
          // Store new tokens
          localStorage.setItem('token', accessToken);
          if (newRefreshToken) {
            localStorage.setItem('refreshToken', newRefreshToken);
          }

          // Process queued requests
          processQueue(null, accessToken);
          
          // Retry original request
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return axiosInstance(originalRequest);
          
        } catch (refreshError) {
          // Refresh failed, clear tokens and redirect to login
          processQueue(refreshError, null);
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }

      // Handle other 401 errors (invalid token, user inactive, etc.)
      if (error.response?.status === 401 && error.response?.data?.code !== 'TOKEN_EXPIRED') {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
      }

      // Handle rate limiting
      if (error.response?.status === 429) {
        const retryAfter = error.response?.data?.retryAfter || error.response?.headers?.['retry-after'] || 60;
        const message = error.response?.data?.error || 'Too many requests. Please slow down.';
        
        // Show user-friendly rate limit message
        if (typeof window !== 'undefined') {
          // Create or update rate limit notification
          const existingNotification = document.getElementById('rate-limit-notification');
          if (existingNotification) {
            existingNotification.remove();
          }
          
          const notification = document.createElement('div');
          notification.id = 'rate-limit-notification';
          notification.className = 'fixed top-4 right-4 z-50 max-w-md';
          notification.innerHTML = `
            <div class="bg-red-50 border border-red-200 rounded-lg p-4 shadow-lg">
              <div class="flex">
                <div class="flex-shrink-0">
                  <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                  </svg>
                </div>
                <div class="ml-3">
                  <h3 class="text-sm font-medium text-red-800">Rate Limit Exceeded</h3>
                  <div class="mt-1 text-sm text-red-700">
                    <p>${message}</p>
                    <p class="mt-1">Please wait ${retryAfter} seconds before trying again.</p>
                  </div>
                </div>
                <button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-red-400 hover:text-red-600">
                  <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          `;
          document.body.appendChild(notification);
          
          // Auto-remove after retry period
          setTimeout(() => {
            notification.remove();
          }, retryAfter * 1000);
        }
      }

      // Handle validation errors
      if (error.response?.status === 400 && error.response?.data?.code === 'VALIDATION_ERROR') {
        const errors = error.response.data.errors;
        if (errors && Array.isArray(errors)) {
          const errorMessage = errors.map((e: any) => `${e.field}: ${e.message}`).join('\n');
          console.error('Validation errors:', errorMessage);
        }
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
    // Store both tokens
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
    }
    if (response.data.refreshToken) {
      localStorage.setItem('refreshToken', response.data.refreshToken);
    }
    return response.data;
  },

  register: async (data: RegisterData): Promise<AuthResponse> => {
    const response = await api.post('/auth/register', data);
    // Store both tokens
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
    }
    if (response.data.refreshToken) {
      localStorage.setItem('refreshToken', response.data.refreshToken);
    }
    return response.data;
  },

  me: async (): Promise<ApiResponse<any>> => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  logout: async (): Promise<void> => {
    try {
      const response = await api.post('/auth/logout');
      return response.data;
    } finally {
      // Always clear tokens on logout
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
    }
  },

  refresh: async (refreshToken: string): Promise<any> => {
    const response = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {
      refreshToken
    });
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
  getCommissions: async (filters?: { 
    period_start?: string; 
    period_end?: string;
    user_id?: string;
    period_view?: 'monthly' | 'quarterly' | 'yearly';
    commission_type?: string;
  }): Promise<ApiResponse<Commission[]>> => {
    const params = new URLSearchParams();
    if (filters?.period_start) params.append('start_date', filters.period_start);
    if (filters?.period_end) params.append('end_date', filters.period_end);
    if (filters?.user_id) params.append('user_id', filters.user_id);
    if (filters?.period_view) params.append('period_view', filters.period_view);
    if (filters?.commission_type) params.append('commission_type', filters.commission_type);
    
    const response = await api.get(`/commissions?${params.toString()}`);
    return response.data;
  },

  exportCommissions: async (filters?: { start_date?: string; end_date?: string; status?: string }) => {
    const params = new URLSearchParams();
    if (filters?.start_date) params.append('start_date', filters.start_date);
    if (filters?.end_date) params.append('end_date', filters.end_date);
    if (filters?.status) params.append('status', filters.status);
    
    const response = await api.get(`/commissions?${params.toString()}&is_export=true`, {
      responseType: 'blob'
    });
    
    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `commissions_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
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
    console.log('🔍 TeamAPI - Raw axios response:', response);
    console.log('🔍 TeamAPI - Response.data:', response.data);
    console.log('🔍 TeamAPI - Team members in response:', response.data.team_members);
    console.log('🔍 TeamAPI - First member details:', response.data.team_members?.[0]);
    return response.data;
  },

  inviteTeamMember: async (memberData: {
    email: string;
    first_name: string;
    last_name: string;
    employee_id?: string;
    is_admin?: boolean;
    is_manager?: boolean;
    territory?: string;
    manager_id?: string;
    team_ids?: string[];
  }): Promise<any> => {
    console.log('🔍 TeamAPI - Sending invite data:', memberData);
    try {
      const response = await api.post('/team/invite', memberData);
      return response.data;
    } catch (error: any) {
      console.error('🔍 TeamAPI - Invite error:', error.response?.data);
      throw error;
    }
  },

  updateTeamMember: async (userId: string, memberData: {
    first_name?: string;
    last_name?: string;
    employee_id?: string | null;
    role?: string;
    territory?: string;
    manager_id?: string;
    is_active?: boolean;
    is_admin?: boolean;
    is_manager?: boolean;
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
    try {
      const response = await api.get('/integrations');
      return response?.data || { success: false, integrations: [] };
    } catch (error) {
      console.error('Error fetching integrations:', error);
      // Return empty integrations list on error
      return { success: false, integrations: [], error: 'Failed to fetch integrations' };
    }
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

// GDPR API for data privacy
export const gdprApi = {
  exportData: async (options: {
    format?: 'json' | 'csv' | 'excel';
    include_deals?: boolean;
    include_commissions?: boolean;
    include_targets?: boolean;
    include_team?: boolean;
    date_from?: string;
    date_to?: string;
  } = {}): Promise<void> => {
    const response = await api.post('/gdpr/export', {
      format: options.format || 'json',
      include_deals: options.include_deals !== false,
      include_commissions: options.include_commissions !== false,
      include_targets: options.include_targets !== false,
      include_team: options.include_team || false,
      date_from: options.date_from,
      date_to: options.date_to
    }, {
      responseType: 'blob'
    });
    
    // Determine file extension based on format
    const format = options.format || 'json';
    const extensions: Record<string, string> = {
      json: 'json',
      csv: 'csv',
      excel: 'xlsx'
    };
    
    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `my-data-export-${new Date().toISOString().split('T')[0]}.${extensions[format]}`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  deleteAccount: async (password: string, confirmation: string): Promise<any> => {
    const response = await api.delete('/gdpr/delete-account', {
      data: {
        password,
        confirmation
      }
    });
    return response.data;
  },

  getPortableData: async (): Promise<any> => {
    const response = await api.get('/gdpr/portability');
    return response.data;
  },

  updatePrivacySettings: async (settings: {
    allow_performance_tracking?: boolean;
    allow_ai_analysis?: boolean;
    allow_benchmarking?: boolean;
    data_retention_days?: number;
  }): Promise<any> => {
    const response = await api.put('/gdpr/privacy-settings', settings);
    return response.data;
  }
};

export default api;