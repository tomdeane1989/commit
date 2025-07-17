export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'rep' | 'manager' | 'admin';
  company_id: string;
  territory?: string;
  manager_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  name: string;
  domain?: string;
  subscription: 'trial' | 'basic' | 'premium';
  default_commission_rate: number;
  created_at: string;
  updated_at: string;
}

export interface Deal {
  id: string;
  deal_name: string;
  account_name: string;
  amount: number;
  probability: number;
  status: 'open' | 'closed_won' | 'closed_lost';
  stage?: string;
  close_date: string;
  closed_date?: string;
  created_date: string;
  crm_id?: string;
  crm_type: 'salesforce' | 'hubspot' | 'pipedrive' | 'sheets' | 'manual';
  crm_url?: string;
  user_id: string;
  company_id: string;
  ai_probability?: number;
  ai_close_date?: string;
  created_at: string;
  updated_at: string;
  
  // Current categorization
  current_category?: 'pipeline' | 'commit' | 'best_case' | 'closed';
}

export interface DealCategorization {
  id: string;
  deal_id: string;
  category: 'commit' | 'best_case' | 'pipeline';
  confidence_note?: string;
  user_id: string;
  created_at: string;
  actual_outcome?: 'closed_won' | 'closed_lost' | 'moved_to_next_period';
  outcome_date?: string;
}

export interface Target {
  id: string;
  period_type: 'monthly' | 'quarterly' | 'annual';
  period_start: string;
  period_end: string;
  quota_amount: number;
  commission_rate: number;
  is_active: boolean;
  user_id: string;
  company_id: string;
  ai_forecast_amount?: number;
  ai_confidence?: number;
  created_at: string;
  updated_at: string;
}

export interface Commission {
  id: string;
  period_start: string;
  period_end: string;
  quota_amount: number;
  actual_amount: number;
  attainment_pct: number;
  commission_rate: number;
  commission_earned: number;
  base_commission: number;
  bonus_commission: number;
  status: 'calculated' | 'approved' | 'paid';
  calculated_at: string;
  approved_at?: string;
  approved_by?: string;
  paid_at?: string;
  user_id: string;
  target_id: string;
  created_at: string;
  updated_at: string;
}

export interface Forecast {
  id: string;
  forecast_date: string;
  forecast_type: 'weekly' | 'monthly' | 'quarterly';
  pipeline_amount: number;
  commit_amount: number;
  best_case_amount: number;
  closed_amount: number;
  ai_predicted_close: number;
  ai_confidence: number;
  actual_closed?: number;
  forecast_accuracy?: number;
  user_id: string;
  target_id: string;
  created_at: string;
}

export interface DashboardData {
  user: User;
  current_target: Target;
  metrics: {
    quota_attainment: number;
    closed_amount: number;
    commission_earned: number;
    projected_commission: number;
    trend: 'up' | 'down' | 'stable';
  };
  quota_progress: {
    closed_amount: number;
    commit_amount: number;
    best_case_amount: number;
    total_quota: number;
    commission_rate: number;
  };
  deals: {
    closed: Deal[];
    commit: Deal[];
    best_case: Deal[];
    pipeline: Deal[];
  };
  latest_forecast?: Forecast;
}

export interface DealsFilter {
  status?: 'open' | 'closed_won' | 'closed_lost';
  category?: 'pipeline' | 'commit' | 'best_case' | 'closed';
  start_date?: string;
  end_date?: string;
  user_id?: string;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  expires_in: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  company_name: string;
}