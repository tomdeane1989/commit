// Commission Approvals API Client
import api from './api';

export interface CommissionRecord {
  id: string;
  deal_id: string;
  user_id: string;
  company_id: string;
  deal_amount: string;
  commission_rate: string;
  commission_amount: string;
  target_id?: string;
  target_name?: string;
  period_start: string;
  period_end: string;
  status: 'calculated' | 'pending_review' | 'approved' | 'rejected' | 'paid' | 'voided';
  calculated_at: string;
  calculated_by?: string;
  reviewed_at?: string;
  reviewed_by?: string;
  approved_at?: string;
  approved_by?: string;
  paid_at?: string;
  payment_reference?: string;
  notes?: string;
  rejection_reason?: string;
  adjustment_amount?: string;
  adjustment_reason?: string;
  created_at: string;
  updated_at: string;
  deal: {
    id: string;
    deal_name: string;
    account_name: string;
    amount: string;
    close_date: string;
  };
  user: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  target?: {
    id: string;
    period_type: string;
    quota_amount: string;
  };
  approvals?: CommissionApproval[];
}

export interface CommissionApproval {
  id: string;
  commission_id: string;
  action: string;
  performed_by: string;
  performed_at: string;
  notes?: string;
  previous_status: string;
  new_status: string;
  metadata?: any;
  performed_by_user: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
}

export interface CommissionSummary {
  total_count: number;
  total_amount: number;
  status_breakdown: Array<{
    status: string;
    count: number;
    amount: number;
  }>;
}

export interface CommissionFilters {
  status?: string;
  user_id?: string;
  period_start?: string;
  period_end?: string;
  min_amount?: number;
  max_amount?: number;
  page?: number;
  limit?: number;
}

export interface CommissionRule {
  id: string;
  company_id: string;
  name: string;
  description?: string;
  rule_type: 'base_rate' | 'tiered' | 'bonus' | 'accelerator' | 'product_rate';
  priority: number;
  config: any;
  conditions?: any;
  calculation_type: string;
  calculation_config: any;
  effective_from: string;
  effective_to?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  tiers?: Array<{
    id: string;
    tier_number: number;
    threshold_min: string;
    threshold_max?: string;
    rate: string;
    type: string;
  }>;
}

class CommissionApprovalsAPI {
  // Get commission approvals with filtering
  async getApprovals(filters: CommissionFilters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });
    
    const response = await api.get(`/commission-approvals?${params.toString()}`);
    return response.data;
  }

  // Get single commission with details
  async getCommissionDetails(id: string) {
    const response = await api.get(`/commission-approvals/${id}`);
    return response.data;
  }

  // Process approval action
  async processAction(id: string, action: string, data: {
    notes?: string;
    payment_reference?: string;
    adjustment_amount?: number;
    adjustment_reason?: string;
  } = {}) {
    const response = await api.post(`/commission-approvals/${id}/action`, {
      action,
      ...data
    });
    return response.data;
  }

  // Bulk approve/reject
  async bulkAction(commission_ids: string[], action: 'approve' | 'reject', notes?: string) {
    const response = await api.post('/commission-approvals/bulk-action', {
      commission_ids,
      action,
      notes
    });
    return response.data;
  }

  // Get pending count
  async getPendingCount() {
    const response = await api.get('/commission-approvals/pending-count');
    return response.data;
  }

  // Recalculate commission
  async recalculate(id: string) {
    const response = await api.post(`/commission-approvals/recalculate/${id}`);
    return response.data;
  }

  // Migrate historical data
  async migrate(batch_size: number = 100) {
    const response = await api.post('/commission-approvals/migrate', { batch_size });
    return response.data;
  }

  // Get audit trail
  async getAuditTrail(filters: {
    commission_id?: string;
    user_id?: string;
    deal_id?: string;
    action?: string;
    start_date?: string;
    end_date?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });
    
    const response = await api.get(`/commission-reports/audit-trail?${params.toString()}`);
    return response.data;
  }

  // Get commission summary report
  async getSummaryReport(params: {
    period?: 'monthly' | 'quarterly' | 'yearly';
    year?: number;
    quarter?: number;
    month?: number;
    user_id?: string;
    team_view?: boolean;
  } = {}) {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });
    
    const response = await api.get(`/commission-reports/summary?${queryParams.toString()}`);
    return response.data;
  }

  // Get payment ready commissions
  async getPaymentReady(payment_period_start?: string, payment_period_end?: string) {
    const params = new URLSearchParams();
    if (payment_period_start) params.append('payment_period_start', payment_period_start);
    if (payment_period_end) params.append('payment_period_end', payment_period_end);
    
    const response = await api.get(`/commission-reports/payment-ready?${params.toString()}`);
    return response.data;
  }

  // Mark commissions as paid
  async markAsPaid(commission_ids: string[], payment_reference: string, payment_date?: string) {
    const response = await api.post('/commission-reports/mark-paid', {
      commission_ids,
      payment_reference,
      payment_date
    });
    return response.data;
  }

  // Export commissions
  async exportCommissions(params: {
    format?: 'csv';
    start_date?: string;
    end_date?: string;
    status?: string;
    user_id?: string;
  } = {}) {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });
    
    const response = await api.get(`/commission-reports/export?${queryParams.toString()}`, {
      responseType: 'blob'
    });
    return response.data;
  }
}

// Commission Rules API
class CommissionRulesAPI {
  // Get all rules
  async getRules(filters: {
    rule_type?: string;
    is_active?: boolean;
    include_expired?: boolean;
  } = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });
    
    const response = await api.get(`/commission-rules?${params.toString()}`);
    return response.data;
  }

  // Get single rule
  async getRule(id: string) {
    const response = await api.get(`/commission-rules/${id}`);
    return response.data;
  }

  // Create rule
  async createRule(rule: Partial<CommissionRule>) {
    const response = await api.post('/commission-rules', rule);
    return response.data;
  }

  // Update rule
  async updateRule(id: string, updates: Partial<CommissionRule>) {
    const response = await api.put(`/commission-rules/${id}`, updates);
    return response.data;
  }

  // Delete rule
  async deleteRule(id: string, hard_delete: boolean = false) {
    const response = await api.delete(`/commission-rules/${id}?hard_delete=${hard_delete}`);
    return response.data;
  }

  // Test rules
  async testRules(deal: any, rule_ids?: string[]) {
    const response = await api.post('/commission-rules/test', {
      deal,
      rule_ids
    });
    return response.data;
  }

  // Get rule templates
  async getTemplates() {
    const response = await api.get('/commission-rules/templates');
    return response.data;
  }

  // Create rules from template
  async createFromTemplate(template_type: string) {
    const response = await api.post('/commission-rules/bulk-create', {
      template_type
    });
    return response.data;
  }
}

export const commissionApprovalsApi = new CommissionApprovalsAPI();
export const commissionRulesApi = new CommissionRulesAPI();