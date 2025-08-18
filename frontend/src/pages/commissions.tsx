import { useState, useEffect } from 'react';
import Layout from '../components/layout';
import CommissionChart from '../components/CommissionChart';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import api, { commissionsApi } from '../lib/api';
import { commissionApprovalsApi, commissionRulesApi } from '../lib/commissionApprovals';
import type { CommissionRecord, CommissionFilters } from '../lib/commissionApprovals';
import { 
  PoundSterling, 
  TrendingUp, 
  Calendar,
  Eye,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Target,
  Award,
  AlertCircle,
  AlertTriangle,
  User,
  Users,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  FileText,
  RefreshCw,
  Check,
  X,
  Info,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  Search,
  ArrowUpDown
} from 'lucide-react';

interface Commission {
  period_key: string;
  period_start: string;
  period_end: string;
  user_id: string;
  user: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  quota_amount: number;
  actual_amount: number;
  commission_earned: number;
  commission_rate: number;
  attainment_pct: number;
  commission_type: string;
  status: string;
  target_id?: string;
  deals_count: number;
  deals_with_commission: number;
  deals_without_commission: number;
  warning?: string;
  deals?: Array<{
    id: string;
    deal_name: string;
    account_name: string;
    amount: string | number;
    close_date: string;
    commission_amount?: string | number;
    commission_rate?: string | number;
  }>;
}

interface TeamMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
}

interface TeamSummary {
  user_id: string;
  name: string;
  email: string;
  commission_count: number;
  total_commission_earned: number;
  total_quota: number;
  total_actual: number;
  avg_attainment: number;
}

const CommissionsPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedPeriod, setSelectedPeriod] = useState('current');
  const [expandedCommission, setExpandedCommission] = useState<string | null>(null);
  const [selectedCommission, setSelectedCommission] = useState<CommissionRecord | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject' | 'pay' | null>(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [showApprovedSection, setShowApprovedSection] = useState(true); // Always fetch approved data
  const [approvedPeriodFilter, setApprovedPeriodFilter] = useState<'current' | 'custom'>('current');
  const [approvedStartDate, setApprovedStartDate] = useState('');
  const [approvedEndDate, setApprovedEndDate] = useState('');
  const [commissionTab, setCommissionTab] = useState<'pending' | 'approved' | 'paid' | 'all'>('pending');
  const [selectedCommissionIds, setSelectedCommissionIds] = useState<string[]>([]);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<'xero_bills' | 'xero_payroll' | 'detailed_csv' | 'simple_csv'>('xero_bills');
  const [exportOptions, setExportOptions] = useState({
    pay_period_end: new Date().toISOString().split('T')[0],
    earnings_type: 'Commission',
    account_code: '6000',
    tax_rate: 0,
    includeApproved: true,
    includePending: false,
    includePaid: false,
    includeRejected: false
  });
  
  // Pagination states for each tab
  const [pendingPage, setPendingPage] = useState(1);
  const [approvedPage, setApprovedPage] = useState(1);
  const [paidPage, setPaidPage] = useState(1);
  
  // Manager view state
  const [managerView, setManagerView] = useState<'personal' | 'team' | 'member' | 'all'>('personal');
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const isManager = user?.is_manager === true || user?.is_admin === true;
  
  // Commission approval period filter
  const [approvalPeriodFilter, setApprovalPeriodFilter] = useState<'current_month' | 'current_quarter' | 'overdue' | 'all'>('current_month');
  
  // Period view state - default to quarterly
  const [periodView, setPeriodView] = useState<'monthly' | 'quarterly' | 'yearly'>('quarterly');
  
  // Sorting and filtering state
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [showFilterDropdown, setShowFilterDropdown] = useState<string | null>(null);
  
  // Missing commissions modal
  const [showMissingModal, setShowMissingModal] = useState(false);
  const [missingCommissionsData, setMissingCommissionsData] = useState<any>(null);
  const [loadingMissingData, setLoadingMissingData] = useState(false);
  
  // Adjustment modal
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [adjustmentAmount, setAdjustmentAmount] = useState<string>('');
  const [adjustmentReason, setAdjustmentReason] = useState<string>('');
  
  // Close filter dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.filter-dropdown')) {
        setShowFilterDropdown(null);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Fetch commission approvals from new system (pending/review)
  const { data: approvalsResponse, isLoading: isLoadingApprovals, refetch: refetchApprovals } = useQuery({
    queryKey: ['commission-approvals', user?.id, statusFilter, managerView, selectedMemberId, pendingPage, approvalPeriodFilter],
    queryFn: async () => {
      const filters: CommissionFilters = {
        page: pendingPage,
        limit: 20
      };
      
      if (statusFilter === 'pending') {
        // Show calculated and pending_review by default
        filters.status = undefined; // API defaults to these statuses
      } else if (statusFilter !== 'all') {
        filters.status = statusFilter;
      }
      
      // Apply period filter for commission approvals
      const now = new Date();
      const currentYear = now.getUTCFullYear();
      const currentMonth = now.getUTCMonth();
      
      if (approvalPeriodFilter === 'current_month') {
        filters.period_start = new Date(Date.UTC(currentYear, currentMonth, 1)).toISOString().split('T')[0];
        filters.period_end = new Date(Date.UTC(currentYear, currentMonth + 1, 0, 23, 59, 59, 999)).toISOString().split('T')[0];
      } else if (approvalPeriodFilter === 'current_quarter') {
        const currentQuarter = Math.floor(currentMonth / 3);
        const quarterStartMonth = currentQuarter * 3;
        filters.period_start = new Date(Date.UTC(currentYear, quarterStartMonth, 1)).toISOString().split('T')[0];
        filters.period_end = new Date(Date.UTC(currentYear, quarterStartMonth + 3, 0, 23, 59, 59, 999)).toISOString().split('T')[0];
      } else if (approvalPeriodFilter === 'overdue') {
        // Overdue: deals closed before current month
        filters.period_end = new Date(Date.UTC(currentYear, currentMonth, 0, 23, 59, 59, 999)).toISOString().split('T')[0];
      }
      // 'all' - no date filter
      
      if (isManager && managerView === 'member' && selectedMemberId) {
        filters.user_id = selectedMemberId;
      } else if (isManager && managerView === 'team') {
        // Don't set user_id filter - get all team commissions
      } else if (!isManager || managerView === 'personal') {
        filters.user_id = user?.id;
      }
      
      return await commissionApprovalsApi.getApprovals(filters);
    },
    enabled: !!user,
    refetchOnWindowFocus: true,
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Fetch approved commissions separately
  const { data: approvedResponse, isLoading: isLoadingApproved, refetch: refetchApproved } = useQuery({
    queryKey: ['approved-commissions', user?.id, managerView, selectedMemberId, approvedPeriodFilter, approvedStartDate, approvedEndDate, approvedPage],
    queryFn: async () => {
      const filters: CommissionFilters = {
        status: 'approved',
        page: approvedPage,
        limit: 20
      };
      
      // Add date filtering based on period selection
      if (approvedPeriodFilter === 'current') {
        const currentPeriod = getCurrentPeriod();
        filters.period_start = currentPeriod.start;
        filters.period_end = currentPeriod.end;
      } else if (approvedPeriodFilter === 'custom' && approvedStartDate && approvedEndDate) {
        filters.period_start = approvedStartDate;
        filters.period_end = approvedEndDate;
      }
      
      if (isManager && managerView === 'member' && selectedMemberId) {
        filters.user_id = selectedMemberId;
      } else if (isManager && managerView === 'team') {
        // Don't set user_id filter - get all team commissions
      } else if (!isManager || managerView === 'personal') {
        filters.user_id = user?.id;
      }
      
      return await commissionApprovalsApi.getApprovals(filters);
    },
    enabled: !!user, // Always fetch when user is available
    refetchOnWindowFocus: true,
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Fetch paid commissions
  const { data: paidResponse, isLoading: isLoadingPaid } = useQuery({
    queryKey: ['paid-commissions', user?.id, managerView, selectedMemberId, approvedPeriodFilter, approvedStartDate, approvedEndDate, paidPage],
    queryFn: async () => {
      const filters: CommissionFilters = {
        status: 'paid',
        page: paidPage,
        limit: 20
      };
      
      // Add date filtering based on period selection
      if (approvedPeriodFilter === 'current') {
        const currentPeriod = getCurrentPeriod();
        filters.period_start = currentPeriod.start;
        filters.period_end = currentPeriod.end;
      } else if (approvedPeriodFilter === 'custom' && approvedStartDate && approvedEndDate) {
        filters.period_start = approvedStartDate;
        filters.period_end = approvedEndDate;
      }
      
      if (isManager && managerView === 'member' && selectedMemberId) {
        filters.user_id = selectedMemberId;
      } else if (isManager && managerView === 'team') {
        // Don't set user_id filter - get all team commissions
      } else if (!isManager || managerView === 'personal') {
        filters.user_id = user?.id;
      }
      
      return await commissionApprovalsApi.getApprovals(filters);
    },
    enabled: !!user, // Always fetch when user is available
    refetchOnWindowFocus: true,
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Fetch legacy commissions data for historical view
  const { data: commissionsResponse, isLoading, error } = useQuery({
    queryKey: ['commissions', user?.id, managerView, selectedMemberId, periodView],
    queryFn: async () => {
      // For team or all views, we need to get data for all team members
      if (isManager && (managerView === 'team' || managerView === 'all')) {
        // First get team members
        const teamResponse = await api.get('/commissions/team-members');
        const teamMemberIds = teamResponse.data.team_members.map((m: any) => m.id);
        
        // Add manager's ID for 'all' view
        if (managerView === 'all') {
          teamMemberIds.push(user?.id);
        }
        
        // Get commissions for all team members
        const allCommissions = [];
        for (const memberId of teamMemberIds) {
          const memberCommissions = await commissionsApi.getCommissions({
            period_view: periodView,
            user_id: memberId
          });
          if (memberCommissions.commissions) {
            allCommissions.push(...memberCommissions.commissions);
          }
        }
        
        return {
          commissions: allCommissions,
          summary: {
            total_periods: allCommissions.length,
            total_commission: allCommissions.reduce((sum, c) => sum + c.commission_earned, 0),
            overall_attainment: allCommissions.length > 0 
              ? allCommissions.reduce((sum, c) => sum + c.attainment_pct, 0) / allCommissions.length
              : 0
          }
        };
      } else {
        // Personal or specific member view
        const filters: any = {
          period_view: periodView
        };
        
        if (isManager && managerView === 'member' && selectedMemberId) {
          filters.user_id = selectedMemberId;
        }
        
        return await commissionsApi.getCommissions(filters);
      }
    },
    enabled: !!user
  });

  // Fetch team members for manager dropdown
  const { data: teamMembersResponse } = useQuery({
    queryKey: ['commission-team-members', user?.id],
    queryFn: async () => {
      const response = await api.get('/commissions/team-members');
      return response.data;
    },
    enabled: isManager
  });

  const commissions = commissionsResponse?.commissions || [];
  const paymentScheduleFromAPI = commissionsResponse?.payment_schedule;
  const missingPeriods = commissionsResponse?.missing_periods || [];
  const teamSummary: TeamSummary[] = commissionsResponse?.team_summary || [];
  const viewContext = commissionsResponse?.view_context;
  const teamMembers: TeamMember[] = teamMembersResponse?.team_members || [];
  const summary = commissionsResponse?.summary || {};
  
  // New commission approval system data
  const approvalCommissions = approvalsResponse?.commissions || [];
  const approvalSummary = approvalsResponse?.summary || {};
  const approvalPagination = approvalsResponse?.pagination || {};
  
  // Approved commissions data
  const approvedCommissions = approvedResponse?.commissions || [];
  const approvedSummary = approvedResponse?.summary || {};
  const approvedPagination = approvedResponse?.pagination || {};
  
  // Paid commissions data
  const paidCommissions = paidResponse?.commissions || [];
  
  // Sorting function
  const sortData = (data: any[]) => {
    if (!sortField) return data;
    
    return [...data].sort((a, b) => {
      let aValue, bValue;
      
      switch (sortField) {
        case 'deal':
          aValue = a.deal?.account_name || '';
          bValue = b.deal?.account_name || '';
          break;
        case 'salesRep':
          aValue = `${a.user?.first_name} ${a.user?.last_name}`;
          bValue = `${b.user?.first_name} ${b.user?.last_name}`;
          break;
        case 'closeDate':
          aValue = a.deal?.close_date || '';
          bValue = b.deal?.close_date || '';
          break;
        case 'amount':
          aValue = Number(a.deal_amount);
          bValue = Number(b.deal_amount);
          break;
        case 'commission':
          aValue = Number(a.commission_amount);
          bValue = Number(b.commission_amount);
          break;
        default:
          return 0;
      }
      
      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  };
  
  // Filtering function
  const filterData = (data: any[]) => {
    if (Object.keys(columnFilters).length === 0) return data;
    
    return data.filter(item => {
      for (const [field, selectedValues] of Object.entries(columnFilters)) {
        if (selectedValues.length === 0) continue;
        
        let itemValue;
        switch (field) {
          case 'salesRep':
            itemValue = `${item.user?.first_name} ${item.user?.last_name}`;
            break;
          case 'status':
            itemValue = item.status;
            break;
          default:
            continue;
        }
        
        if (!selectedValues.includes(itemValue)) {
          return false;
        }
      }
      return true;
    });
  };
  
  // Apply sorting and filtering
  const processedApprovalCommissions = sortData(filterData(approvalCommissions));
  const processedApprovedCommissions = sortData(filterData(approvedCommissions));
  const processedPaidCommissions = sortData(filterData(paidCommissions));
  
  // Get unique values for filter dropdowns
  const getUniqueValues = (data: any[], field: string) => {
    const values = new Set<string>();
    data.forEach(item => {
      let value;
      switch (field) {
        case 'salesRep':
          value = `${item.user?.first_name} ${item.user?.last_name}`;
          break;
        case 'status':
          value = item.status;
          break;
        default:
          return;
      }
      if (value) values.add(value);
    });
    return Array.from(values).sort();
  };
  
  // Handle column header click for sorting
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  // Handle filter toggle
  const toggleFilter = (field: string, value: string) => {
    setColumnFilters(prev => {
      const current = prev[field] || [];
      const updated = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      
      if (updated.length === 0) {
        const { [field]: _, ...rest } = prev;
        return rest;
      }
      
      return { ...prev, [field]: updated };
    });
  };
  const paidSummary = paidResponse?.summary || {};
  const paidPagination = paidResponse?.pagination || {};
  
  // Debug log to check what we're getting
  console.log('Commission data:', {
    view: managerView,
    commissionsCount: commissions.length,
    missingPeriodsCount: missingPeriods.length,
    missingPeriods: missingPeriods,
    actualPeriods: commissions.map(c => ({
      start: c.period_start,
      end: c.period_end,
      user: c.user?.first_name
    }))
  });

  // Fetch user's target to determine payment schedule
  const { data: targetsResponse } = useQuery({
    queryKey: ['user-targets', user?.id], // User-specific cache key to prevent cross-user data leakage
    queryFn: async () => {
      const response = await api.get('/targets');
      return response.data;
    },
    enabled: !!user
  });

  // Fetch missing commissions count for current period
  const { data: missingCommissionsCount } = useQuery({
    queryKey: ['missing-commissions-count', user?.id, periodView],
    queryFn: async () => {
      const currentPeriod = getCurrentPeriod();
      const response = await api.get('/deals/missing-commissions', {
        params: {
          period_start: currentPeriod.start,
          period_end: currentPeriod.end
        }
      });
      return response.data;
    },
    enabled: !!user && isManager,
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  const targets = targetsResponse?.targets || [];


  // Get current payment schedule (prefer API response, fallback to targets)
  const paymentSchedule = paymentScheduleFromAPI || 
    targets?.find((t: any) => t.is_active)?.commission_payment_schedule || 
    'monthly';

  
  // Calculate current period based on period view
  const getCurrentPeriod = () => {
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth(); // 0-based
    
    if (periodView === 'yearly') {
      return {
        start: new Date(Date.UTC(currentYear, 0, 1)).toISOString().split('T')[0],
        end: new Date(Date.UTC(currentYear, 11, 31, 23, 59, 59, 999)).toISOString().split('T')[0],
        label: currentYear.toString()
      };
    } else if (periodView === 'quarterly') {
      // Determine current quarter
      const currentQuarter = Math.floor(currentMonth / 3);
      const quarterStartMonth = currentQuarter * 3;
      
      return {
        start: new Date(Date.UTC(currentYear, quarterStartMonth, 1)).toISOString().split('T')[0],
        end: new Date(Date.UTC(currentYear, quarterStartMonth + 3, 0, 23, 59, 59, 999)).toISOString().split('T')[0],
        label: `Q${currentQuarter + 1} ${currentYear}`
      };
    } else {
      // Monthly
      return {
        start: new Date(Date.UTC(currentYear, currentMonth, 1)).toISOString().split('T')[0],
        end: new Date(Date.UTC(currentYear, currentMonth + 1, 0, 23, 59, 59, 999)).toISOString().split('T')[0],
        label: new Date(Date.UTC(currentYear, currentMonth, 1)).toLocaleDateString('en-GB', { 
          month: 'long', 
          year: 'numeric',
          timeZone: 'UTC'
        })
      };
    }
  };

  // Get historical periods
  const getHistoricalPeriods = () => {
    const now = new Date();
    const periods = [];
    
    if (periodView === 'yearly') {
      // Last 3 years
      for (let i = 0; i < 3; i++) {
        const targetYear = now.getUTCFullYear() - i;
        periods.push({
          start: new Date(Date.UTC(targetYear, 0, 1)).toISOString().split('T')[0],
          end: new Date(Date.UTC(targetYear, 11, 31, 23, 59, 59, 999)).toISOString().split('T')[0],
          label: targetYear.toString(),
          period: targetYear.toString()
        });
      }
    } else if (periodView === 'quarterly') {
      // Last 3 quarters plus current (total 4 quarters)
      const currentYear = now.getUTCFullYear();
      const currentMonth = now.getUTCMonth();
      
      // Calculate current quarter
      const currentQuarter = Math.floor(currentMonth / 3);
      
      // Start from 3 quarters ago (i=3) to current quarter (i=0)
      for (let i = 3; i >= 0; i--) {
        // Calculate the target quarter (going backwards from current quarter)
        let targetYear = currentYear;
        let targetQuarter = currentQuarter - i;
        
        // Handle year boundary
        while (targetQuarter < 0) {
          targetQuarter += 4;
          targetYear -= 1;
        }
        
        const quarterStartMonth = targetQuarter * 3;
        
        periods.push({
          start: new Date(Date.UTC(targetYear, quarterStartMonth, 1)).toISOString().split('T')[0],
          end: new Date(Date.UTC(targetYear, quarterStartMonth + 3, 0, 23, 59, 59, 999)).toISOString().split('T')[0],
          label: `Q${targetQuarter + 1} ${targetYear}`,
          period: `${targetYear}-Q${targetQuarter + 1}`
        });
      }
    } else {
      // Last 12 months
      for (let i = 0; i < 12; i++) {
        const currentYear = now.getUTCFullYear();
        const currentMonth = now.getUTCMonth();
        
        let targetYear = currentYear;
        let targetMonth = currentMonth - i;
        
        while (targetMonth < 0) {
          targetMonth += 12;
          targetYear -= 1;
        }
        
        const periodStart = new Date(Date.UTC(targetYear, targetMonth, 1));
        
        periods.push({
          start: periodStart.toISOString().split('T')[0],
          end: new Date(Date.UTC(targetYear, targetMonth + 1, 0, 23, 59, 59, 999)).toISOString().split('T')[0],
          label: periodStart.toLocaleDateString('en-GB', { 
            month: 'long', 
            year: 'numeric',
            timeZone: 'UTC'
          }),
          period: `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`
        });
      }
    }
    
    return periods;
  };

  const currentPeriod = getCurrentPeriod();
  const historicalPeriods = getHistoricalPeriods();
  
  // Check if user has an active target covering the current period
  const hasActiveTargetForCurrentPeriod = targets?.some((target: any) => {
    if (!target.is_active) return false;
    const targetStart = new Date(target.period_start);
    const targetEnd = new Date(target.period_end);
    const currentStart = new Date(currentPeriod.start);
    const currentEnd = new Date(currentPeriod.end);
    
    // Check if target period overlaps with current period
    return targetStart <= currentEnd && targetEnd >= currentStart;
  }) || false;
  
  // Find current period commission (only for personal view)
  const currentCommission = !isManager || managerView === 'personal' ? 
    commissions?.find(c => {
      // Use date range comparison instead of exact match to handle timezone differences
      const commissionStart = new Date(c.period_start);
      const commissionEnd = new Date(c.period_end);
      const currentStart = new Date(currentPeriod.start);
      const currentEnd = new Date(currentPeriod.end);
      
      // Check if commission period overlaps with current period
      const periodsMatch = commissionStart <= currentEnd && commissionEnd >= currentStart;
      return periodsMatch && c.user_id === user?.id;
    }) : null;

  // For historical chart, show all commissions including current period
  // The chart component handles ordering (newest to oldest)
  const historicalCommissions = commissions || [];

  // Calculate rolling 12-month totals
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  
  const rolling12MonthCommissions = commissions?.filter(c => 
    new Date(c.period_start) >= twelveMonthsAgo
  ) || [];
  
  const totalEarned = rolling12MonthCommissions.reduce((sum, c) => sum + Number(c.commission_earned), 0);
  const averageAttainment = rolling12MonthCommissions.length ? 
    rolling12MonthCommissions.reduce((sum, c) => sum + Number(c.attainment_pct), 0) / rolling12MonthCommissions.length : 0;
  
  // Get most recent quarter data
  const mostRecentQuarter = commissions?.find(c => {
    const periodStart = new Date(c.period_start);
    const periodEnd = new Date(c.period_end);
    const periodLengthDays = (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24);
    // Check if it's a quarterly period (60-120 days)
    return periodLengthDays > 60 && periodLengthDays < 120;
  });
  
  const recentQuarterLabel = mostRecentQuarter ? (() => {
    const periodStart = new Date(mostRecentQuarter.period_start);
    const quarter = Math.floor(periodStart.getMonth() / 3) + 1;
    return `Q${quarter} ${periodStart.getFullYear()}`;
  })() : 'No Data';

  // Commission approval mutations
  const processApprovalMutation = useMutation({
    mutationFn: async ({ id, action, data }: { id: string; action: string; data: any }) => {
      return await commissionApprovalsApi.processAction(id, action, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commission-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['approved-commissions'] });
      setShowApprovalModal(false);
      setApprovalAction(null);
      setApprovalNotes('');
      setPaymentReference('');
      // Show approved section if we just approved something
      if (approvalAction === 'approve') {
        setShowApprovedSection(true);
      }
    }
  });

  const recalculateMutation = useMutation({
    mutationFn: async (id: string) => {
      return await commissionApprovalsApi.recalculate(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commission-approvals'] });
    }
  });

  const bulkApprovalMutation = useMutation({
    mutationFn: async ({ action, notes }: { action: 'approve' | 'reject'; notes?: string }) => {
      return await commissionApprovalsApi.bulkAction(selectedCommissionIds, action, notes);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commission-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['approved-commissions'] });
      setSelectedCommissionIds([]);
      if (approvalAction === 'approve') {
        setShowApprovedSection(true);
      }
    }
  });

  // Get status badge styling
  const getStatusBadge = (status: string) => {
    const styles = {
      calculated: 'bg-yellow-100 text-yellow-800',
      pending_review: 'bg-orange-100 text-orange-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      paid: 'bg-blue-100 text-blue-800',
      voided: 'bg-gray-100 text-gray-800'
    };
    const icons = {
      calculated: <Clock className="w-3 h-3" />,
      pending_review: <Eye className="w-3 h-3" />,
      approved: <CheckCircle className="w-3 h-3" />,
      rejected: <XCircle className="w-3 h-3" />,
      paid: <DollarSign className="w-3 h-3" />,
      voided: <X className="w-3 h-3" />
    };
    
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800'}`}>
        {icons[status as keyof typeof icons]}
        {status.replace('_', ' ').charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
      </span>
    );
  };

  // Handle approval actions
  const handleApprovalAction = async () => {
    if (!selectedCommission || !approvalAction) return;
    
    const data: any = { notes: approvalNotes };
    if (approvalAction === 'pay') {
      data.payment_reference = paymentReference;
    }
    
    await processApprovalMutation.mutateAsync({
      id: selectedCommission.id,
      action: approvalAction,
      data
    });
  };


  if (isLoading && isLoadingApprovals) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-500"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Performance Overview</h1>
            <p className="text-gray-600 mt-1">
              {isManager ? `Manage team commission calculations and performance` : `Track your earnings and performance across ${paymentSchedule} payment periods`}
            </p>
          </div>
          <div className="flex flex-col items-end space-y-2">
            {!isManager && !hasActiveTargetForCurrentPeriod && (
              <div className="flex items-center text-sm text-amber-600 bg-amber-50 px-3 py-1 rounded-md">
                <AlertCircle className="w-4 h-4 mr-1" />
                No target set for {currentPeriod.label}
              </div>
            )}
            <div className="flex space-x-3">
              <button
                onClick={() => refetchApprovals()}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </button>
              <button
                onClick={() => setShowExportModal(true)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Export
              </button>
            </div>
          </div>
        </div>

        {/* Combined Filter Controls */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Left side - Manager filters (if manager) */}
            {isManager && (
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button 
                    onClick={() => { setManagerView('personal'); setSelectedMemberId(''); }}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      managerView === 'personal' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <User className="w-4 h-4 inline mr-2" />
                    Personal
                  </button>
                  <button 
                    onClick={() => { setManagerView('team'); setSelectedMemberId(''); }}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      managerView === 'team' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Users className="w-4 h-4 inline mr-2" />
                    Team
                  </button>
                  <button 
                    onClick={() => setManagerView('all')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      managerView === 'all' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Users className="w-4 h-4 inline mr-2" />
                    All
                  </button>
                </div>
                
                {/* Individual Member Selector */}
                <select
                  value={selectedMemberId}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSelectedMemberId(value);
                    if (value) {
                      setManagerView('member');
                    }
                  }}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select team member...</option>
                  {teamMembers.map(member => (
                    <option key={member.id} value={member.id}>
                      {member.first_name} {member.last_name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            {/* Right side - Period selector */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Period:</label>
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button 
                  onClick={() => setPeriodView('monthly')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    periodView === 'monthly' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Monthly
                </button>
                <button 
                  onClick={() => setPeriodView('quarterly')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    periodView === 'quarterly' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Quarterly
                </button>
                <button 
                  onClick={() => setPeriodView('yearly')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    periodView === 'yearly' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Yearly
                </button>
              </div>
            </div>
          </div>
          
          {/* View Context Display - only show for managers */}
          {isManager && (
            <div className="mt-3 text-sm text-gray-600">
              {managerView === 'personal' && 'Showing your personal commission calculations'}
              {managerView === 'team' && `Showing commission calculations for all ${teamMembers.length} direct reports`}
              {managerView === 'member' && selectedMemberId && `Showing commission calculations for ${teamMembers.find(m => m.id === selectedMemberId)?.first_name} ${teamMembers.find(m => m.id === selectedMemberId)?.last_name}`}
              {managerView === 'all' && `Showing combined commission calculations (you + ${teamMembers.length} team members)`}
            </div>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <PoundSterling className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Earned (12M)</p>
                <p className="text-2xl font-bold text-gray-900">
                  £{totalEarned.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Target className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg. Attainment (12M)</p>
                <p className="text-2xl font-bold text-gray-900">
                  {averageAttainment.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Calendar className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Payment Schedule</p>
                <p className="text-2xl font-bold text-gray-900 capitalize">
                  {paymentSchedule}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Recent Quarter</p>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {mostRecentQuarter ? `${mostRecentQuarter.attainment_pct.toFixed(0)}%` : '-'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {recentQuarterLabel}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Current Period - Only show for personal view */}
        {(!isManager || managerView === 'personal') && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Current Period - {currentPeriod.label}
              </h3>
            </div>
          <div className="p-6">
            {currentCommission ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-600">Commission Earned</p>
                    <p className="text-3xl font-bold text-green-600">
                      £{Number(currentCommission.commission_earned).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-600">Quota Attainment</p>
                    <p className="text-3xl font-bold text-blue-600">
                      {Number(currentCommission.attainment_pct).toFixed(1)}%
                    </p>
                  </div>
                </div>

                {/* Deal Breakdown */}
                {currentCommission.deals && currentCommission.deals.length > 0 && (
                  <div className="mt-6">
                    <button
                      onClick={() => setExpandedCommission(
                        expandedCommission === currentCommission.period_key ? null : currentCommission.period_key
                      )}
                      className="flex items-center text-blue-600 hover:text-blue-700 font-medium"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View Deal Breakdown ({currentCommission.deals.length} deals)
                    </button>
                    
                    {expandedCommission === currentCommission.period_key && (
                      <div className="mt-4 bg-gray-50 rounded-lg p-4">
                        <div className="space-y-3">
                          {currentCommission.deals.map((deal) => (
                            <div key={deal.id} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-b-0">
                              <div>
                                <p className="font-medium text-gray-900">{deal.account_name}</p>
                                <p className="text-sm text-gray-600">{deal.deal_name}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-medium text-gray-900">
                                  £{Number(deal.commission_amount || 0).toLocaleString()}
                                </p>
                                <p className="text-sm text-gray-600">
                                  {new Date(deal.close_date).toLocaleDateString('en-GB')}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                
                {!hasActiveTargetForCurrentPeriod ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-6 text-left max-w-md mx-auto">
                    <div className="flex items-start">
                      <Target className="w-5 h-5 text-amber-600 mt-0.5 mr-3 flex-shrink-0" />
                      <div>
                        <h4 className="text-sm font-semibold text-amber-800 mb-2">
                          No Active Target Found
                        </h4>
                        <p className="text-sm text-amber-700 mb-3">
                          You need to set up a quota target that covers <strong>{currentPeriod.label}</strong> before calculating commissions.
                        </p>
                        <div className="space-y-2 text-sm text-amber-700">
                          <p className="font-medium">To fix this:</p>
                          <ol className="list-decimal list-inside space-y-1 ml-2">
                            <li>Go to <strong>Settings → Targets</strong></li>
                            <li>Create a new target for {currentPeriod.label}</li>
                            <li>Set your quota and commission rate</li>
                            <li>Return here to calculate commissions</li>
                          </ol>
                        </div>
                        <button
                          onClick={() => window.location.href = '/settings'}
                          className="mt-4 inline-flex items-center text-sm font-medium text-amber-800 hover:text-amber-900"
                        >
                          Go to Settings →
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-600">No commission calculated for current period</p>
                )}
              </div>
            )}
          </div>
        </div>
        )}

        {/* Team Summary for Manager Views */}
        {isManager && (managerView === 'team' || managerView === 'all') && teamSummary && teamSummary.length > 0 && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Team Performance Summary</h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {teamSummary.map((member) => (
                  <div key={member.user_id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-medium text-gray-900">{member.name}</h4>
                        <p className="text-sm text-gray-600">{member.email}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-green-600">
                          £{member.total_commission_earned.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500">Total earned</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-gray-600">Periods</p>
                        <p className="font-medium">{member.commission_count}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Attainment</p>
                        <p className="font-medium">{member.avg_attainment.toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Total Sales</p>
                        <p className="font-medium">£{member.total_actual.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Commission Management System with Tabs */}
        {isManager && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Commission Management
                </h3>
                <div className="flex items-center gap-4">
                  {/* Summary Stats */}
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-600">
                      Pending: <span className="font-medium text-orange-600">{approvalSummary.status_breakdown?.find(s => s.status === 'calculated')?.count || 0}</span>
                    </span>
                    <span className="text-gray-600">
                      Approved: <span className="font-medium text-green-600">{approvedSummary.total_count || 0}</span>
                    </span>
                    <span className="text-gray-600">
                      Paid: <span className="font-medium text-blue-600">{paidSummary.total_count || 0}</span>
                    </span>
                    <button
                      onClick={async () => {
                        setLoadingMissingData(true);
                        try {
                          const currentPeriod = getCurrentPeriod();
                          const response = await api.get('/deals/missing-commissions', {
                            params: {
                              period_start: currentPeriod.start,
                              period_end: currentPeriod.end
                            }
                          });
                          setMissingCommissionsData(response.data);
                          setShowMissingModal(true);
                        } catch (error) {
                          console.error('Failed to fetch missing commissions:', error);
                        } finally {
                          setLoadingMissingData(false);
                        }
                      }}
                      className="flex items-center gap-1 text-amber-600 hover:text-amber-700 transition-colors"
                      title="Deals without commissions"
                      disabled={loadingMissingData}
                    >
                      <AlertTriangle className="w-4 h-4" />
                      <span className="font-medium">
                        {loadingMissingData ? '...' : (missingCommissionsCount?.total || 0)}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Period Filter Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">Show commissions for:</span>
                  <div className="flex bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => {
                        setApprovalPeriodFilter('current_month');
                        setPendingPage(1);
                      }}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        approvalPeriodFilter === 'current_month' 
                          ? 'bg-white text-blue-600 shadow-sm' 
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5 inline mr-1.5" />
                      Current Month
                    </button>
                    <button
                      onClick={() => {
                        setApprovalPeriodFilter('current_quarter');
                        setPendingPage(1);
                      }}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        approvalPeriodFilter === 'current_quarter' 
                          ? 'bg-white text-blue-600 shadow-sm' 
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <BarChart3 className="w-3.5 h-3.5 inline mr-1.5" />
                      Current Quarter
                    </button>
                    <button
                      onClick={() => {
                        setApprovalPeriodFilter('overdue');
                        setPendingPage(1);
                      }}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        approvalPeriodFilter === 'overdue' 
                          ? 'bg-white text-red-600 shadow-sm' 
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <AlertCircle className="w-3.5 h-3.5 inline mr-1.5" />
                      Overdue
                    </button>
                    <button
                      onClick={() => {
                        setApprovalPeriodFilter('all');
                        setPendingPage(1);
                      }}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        approvalPeriodFilter === 'all' 
                          ? 'bg-white text-gray-700 shadow-sm' 
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      All Periods
                    </button>
                  </div>
                </div>
                
                {/* Period indicator */}
                <div className="text-sm text-gray-500">
                  {approvalPeriodFilter === 'current_month' && (
                    <span>
                      {new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                    </span>
                  )}
                  {approvalPeriodFilter === 'current_quarter' && (
                    <span>
                      Q{Math.floor(new Date().getUTCMonth() / 3) + 1} {new Date().getUTCFullYear()}
                    </span>
                  )}
                  {approvalPeriodFilter === 'overdue' && (
                    <span className="text-red-600">
                      Deals closed before {new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                    </span>
                  )}
                </div>
              </div>
              
              {/* Active Filters Bar */}
              {Object.keys(columnFilters).length > 0 && (
                <div className="mt-4 flex items-center gap-2 p-2 bg-blue-50 rounded-lg">
                  <span className="text-sm text-gray-600">Active filters:</span>
                  {Object.entries(columnFilters).map(([field, values]) => (
                    <div key={field} className="flex items-center gap-1">
                      {values.map(value => (
                        <span key={value} className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded-md text-xs text-gray-700 border border-gray-200">
                          {value}
                          <button
                            onClick={() => toggleFilter(field, value)}
                            className="hover:text-red-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ))}
                  <button
                    onClick={() => setColumnFilters({})}
                    className="ml-auto text-sm text-blue-600 hover:text-blue-700"
                  >
                    Clear all filters
                  </button>
                </div>
              )}
              
              {/* Tabs */}
              <div className="flex gap-4 mt-4">
                <button
                  onClick={() => {
                    setCommissionTab('pending');
                    setPendingPage(1);
                    setSelectedCommissionIds([]);
                  }}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    commissionTab === 'pending' 
                      ? 'bg-orange-100 text-orange-700' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Pending Approval
                  {approvalSummary.total_count > 0 && (
                    <span className="ml-2 px-2 py-1 bg-orange-500 text-white text-xs rounded-full">
                      {approvalSummary.total_count}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => { 
                    setCommissionTab('approved'); 
                    setShowApprovedSection(true);
                    setApprovedPage(1);
                    setSelectedCommissionIds([]);
                  }}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    commissionTab === 'approved' 
                      ? 'bg-green-100 text-green-700' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Approved
                  {approvedSummary.total_count > 0 && (
                    <span className="ml-2 px-2 py-1 bg-green-600 text-white text-xs rounded-full">
                      {approvedSummary.total_count}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => {
                    setCommissionTab('paid');
                    setPaidPage(1);
                    setSelectedCommissionIds([]);
                  }}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    commissionTab === 'paid' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Paid
                  {paidSummary.total_count > 0 && (
                    <span className="ml-2 px-2 py-1 bg-blue-600 text-white text-xs rounded-full">
                      {paidSummary.total_count}
                    </span>
                  )}
                </button>
              </div>
            </div>
            {/* Tab Content */}
            <div className="overflow-x-auto">
              {/* Bulk Actions Bar for Pending Tab */}
              {commissionTab === 'pending' && selectedCommissionIds.length > 0 && (
                <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex items-center justify-between">
                  <span className="text-sm text-gray-700">
                    {selectedCommissionIds.length} commission{selectedCommissionIds.length !== 1 ? 's' : ''} selected
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => bulkApprovalMutation.mutate({ action: 'approve' })}
                      disabled={bulkApprovalMutation.isPending}
                      className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50"
                    >
                      Approve All
                    </button>
                    <button
                      onClick={() => setSelectedCommissionIds([])}
                      className="px-3 py-1 border border-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-50"
                    >
                      Clear Selection
                    </button>
                  </div>
                </div>
              )}
              
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {commissionTab === 'pending' && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <input
                          type="checkbox"
                          checked={selectedCommissionIds.length === processedApprovalCommissions.length && processedApprovalCommissions.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCommissionIds(processedApprovalCommissions.map(c => c.id));
                            } else {
                              setSelectedCommissionIds([]);
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                      </th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('deal')}
                        className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                      >
                        Deal
                        <ArrowUpDown className="w-3 h-3" />
                        {sortField === 'deal' && (
                          sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                        )}
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSort('salesRep')}
                          className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                        >
                          Sales Rep
                          <ArrowUpDown className="w-3 h-3" />
                          {sortField === 'salesRep' && (
                            sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                          )}
                        </button>
                        <div className="relative filter-dropdown">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowFilterDropdown(showFilterDropdown === 'salesRep' ? null : 'salesRep');
                            }}
                            className={`p-1 rounded transition-colors ${
                              columnFilters.salesRep?.length > 0 
                                ? 'bg-blue-100 text-blue-600 hover:bg-blue-200' 
                                : 'hover:bg-gray-200'
                            }`}
                          >
                            <Filter className="w-3 h-3" />
                          </button>
                          {showFilterDropdown === 'salesRep' && (
                            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-50 min-w-[200px]">
                              <div className="max-h-48 overflow-y-auto">
                                {getUniqueValues(
                                  commissionTab === 'pending' ? approvalCommissions : 
                                  commissionTab === 'approved' ? approvedCommissions : 
                                  paidCommissions, 
                                  'salesRep'
                                ).map(value => (
                                  <label key={value} className="flex items-center gap-2 py-1 px-2 hover:bg-gray-50 rounded cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={columnFilters.salesRep?.includes(value) || false}
                                      onChange={() => toggleFilter('salesRep', value)}
                                      className="rounded border-gray-300"
                                    />
                                    <span className="text-sm">{value}</span>
                                  </label>
                                ))}
                              </div>
                              <div className="border-t mt-2 pt-2 flex justify-end gap-2">
                                <button
                                  onClick={() => {
                                    setColumnFilters(prev => {
                                      const { salesRep, ...rest } = prev;
                                      return rest;
                                    });
                                  }}
                                  className="text-xs text-gray-600 hover:text-gray-900"
                                >
                                  Clear
                                </button>
                                <button
                                  onClick={() => setShowFilterDropdown(null)}
                                  className="text-xs text-blue-600 hover:text-blue-700"
                                >
                                  Done
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('closeDate')}
                        className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                      >
                        Close Date
                        <ArrowUpDown className="w-3 h-3" />
                        {sortField === 'closeDate' && (
                          sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                        )}
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('amount')}
                        className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                      >
                        {commissionTab === 'paid' ? 'Deal Amount' : 'Amount'}
                        <ArrowUpDown className="w-3 h-3" />
                        {sortField === 'amount' && (
                          sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                        )}
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('commission')}
                        className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                      >
                        Commission
                        <ArrowUpDown className="w-3 h-3" />
                        {sortField === 'commission' && (
                          sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                        )}
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {commissionTab === 'paid' ? 'Payment Info' : commissionTab === 'approved' ? 'Approved Date' : 'Status'}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(commissionTab === 'pending' ? processedApprovalCommissions : 
                    commissionTab === 'approved' ? processedApprovedCommissions : 
                    processedPaidCommissions).map((commission: CommissionRecord) => (
                    <tr key={commission.id} className="hover:bg-gray-50">
                      {commissionTab === 'pending' && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedCommissionIds.includes(commission.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCommissionIds([...selectedCommissionIds, commission.id]);
                              } else {
                                setSelectedCommissionIds(selectedCommissionIds.filter(id => id !== commission.id));
                              }
                            }}
                            className="rounded border-gray-300"
                          />
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {commission.deal?.account_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {commission.deal?.deal_name}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {commission.user?.first_name} {commission.user?.last_name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {commission.user?.email}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {commission.deal?.close_date ? new Date(commission.deal.close_date).toLocaleDateString('en-GB') : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        £{Number(commission.deal_amount).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          £{Number(commission.commission_amount).toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          {(Number(commission.commission_rate) * 100).toFixed(2)}%
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {commissionTab === 'paid' ? (
                          <div>
                            <div className="text-sm text-gray-900">{commission.payment_reference}</div>
                            <div className="text-xs text-gray-500">
                              {commission.paid_at ? new Date(commission.paid_at).toLocaleDateString('en-GB') : '-'}
                            </div>
                          </div>
                        ) : commissionTab === 'approved' ? (
                          <div className="text-sm text-gray-500">
                            {commission.approved_at ? new Date(commission.approved_at).toLocaleDateString('en-GB') : '-'}
                          </div>
                        ) : (
                          getStatusBadge(commission.status)
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          {commissionTab === 'pending' && commission.status === 'calculated' && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedCommission(commission);
                                  setAdjustmentAmount(String(commission.commission_amount));
                                  setAdjustmentReason('');
                                  setShowAdjustmentModal(true);
                                }}
                                className="text-blue-600 hover:text-blue-900"
                                title="Edit & Approve"
                              >
                                <FileText className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedCommission(commission);
                                  setApprovalAction('approve');
                                  setShowApprovalModal(true);
                                }}
                                className="text-green-600 hover:text-green-900"
                                title="Approve"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedCommission(commission);
                                  setApprovalAction('reject');
                                  setShowApprovalModal(true);
                                }}
                                className="text-red-600 hover:text-red-900"
                                title="Reject"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {commissionTab === 'approved' && (
                            <button
                              onClick={() => {
                                setSelectedCommission(commission);
                                setApprovalAction('pay');
                                setShowApprovalModal(true);
                              }}
                              className="text-blue-600 hover:text-blue-900"
                              title="Mark as Paid"
                            >
                              <DollarSign className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setSelectedCommission(commission);
                              setShowAuditModal(true);
                            }}
                            className="text-gray-600 hover:text-gray-900"
                            title="View Details"
                          >
                            <Info className="w-4 h-4" />
                          </button>
                          {commissionTab !== 'paid' && (
                            <button
                              onClick={() => recalculateMutation.mutate(commission.id)}
                              disabled={recalculateMutation.isPending}
                              className="text-gray-600 hover:text-gray-900"
                              title="Recalculate"
                            >
                              <RefreshCw className={`w-4 h-4 ${recalculateMutation.isPending ? 'animate-spin' : ''}`} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(commissionTab === 'pending' ? processedApprovalCommissions : 
                commissionTab === 'approved' ? processedApprovedCommissions : 
                processedPaidCommissions).length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  {commissionTab === 'pending' && 'No commissions pending approval'}
                  {commissionTab === 'approved' && 'No approved commissions awaiting payment'}
                  {commissionTab === 'paid' && 'No paid commissions for the selected period'}
                </div>
              )}
            </div>
            {approvalPagination.pages > 1 && (
              <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing page {approvalPagination.page} of {approvalPagination.pages}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setPendingPage(prev => Math.max(1, prev - 1));
                      setSelectedCommissionIds([]);
                    }}
                    disabled={approvalPagination.page === 1}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 hover:bg-gray-50 disabled:hover:bg-white"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => {
                      setPendingPage(prev => Math.min(approvalPagination.pages, prev + 1));
                      setSelectedCommissionIds([]);
                    }}
                    disabled={approvalPagination.page === approvalPagination.pages}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 hover:bg-gray-50 disabled:hover:bg-white"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}


        {/* Historical Commissions */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              {isManager && managerView === 'team' ? 'Team Commission Data' : 
               isManager && managerView === 'all' ? 'All Commission Data' :
               isManager && managerView === 'member' ? 'Member Commission History' : 
               'Commission History'}
              <span className="text-sm font-normal text-gray-600 ml-2">
                {isManager && managerView !== 'personal' ? 
                  `(${commissions?.length || 0} total records)` :
                  periodView === 'yearly' ? '(Including current year)' :
                  periodView === 'quarterly' ? '(Including current quarter)' :
                  '(Including current month)'
                }
              </span>
            </h3>
          </div>
          <div className="p-6">
            <CommissionChart 
              commissions={historicalCommissions}
              isManager={isManager}
              managerView={managerView}
              isCalculating={false}
              teamMemberCount={teamMembers.length > 0 ? teamMembers.length : undefined}
              teamMembers={isManager && (managerView === 'team' || managerView === 'all') ? teamMembers : undefined}
              periodView={periodView}
            />
          </div>
        </div>

      </div>

      {/* Adjustment Modal */}
      {showAdjustmentModal && selectedCommission && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">
              Adjust & Approve Commission
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Deal</p>
                <p className="font-medium">{selectedCommission.deal?.account_name} - {selectedCommission.deal?.deal_name}</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-600">Original Commission Amount</p>
                <p className="font-medium text-gray-500 line-through">£{Number(selectedCommission.commission_amount).toLocaleString()}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Adjusted Commission Amount *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-500">£</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={adjustmentAmount}
                    onChange={(e) => setAdjustmentAmount(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                {adjustmentAmount && (
                  <p className="text-sm text-gray-500 mt-1">
                    Difference: £{(Number(adjustmentAmount) - Number(selectedCommission.commission_amount)).toLocaleString()}
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for Adjustment *
                </label>
                <textarea
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="e.g., Split payment - only 50% received, Special promotion applied, etc."
                  required
                  minLength={10}
                  maxLength={500}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {adjustmentReason.length}/500 characters (min 10)
                </p>
              </div>
              
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-start">
                  <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 mr-2" />
                  <div className="text-sm text-amber-800">
                    <p className="font-medium mb-1">Important:</p>
                    <p>Clicking "Save & Approve" will:</p>
                    <ul className="list-disc list-inside mt-1">
                      <li>Update the commission amount to £{adjustmentAmount || '0'}</li>
                      <li>Automatically approve the adjusted commission</li>
                      <li>Create an audit trail of this adjustment</li>
                    </ul>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowAdjustmentModal(false);
                    setAdjustmentAmount('');
                    setAdjustmentReason('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!adjustmentAmount || !adjustmentReason || adjustmentReason.length < 10) {
                      alert('Please enter an adjusted amount and a reason (min 10 characters)');
                      return;
                    }
                    
                    await processApprovalMutation.mutateAsync({
                      id: selectedCommission.id,
                      action: 'adjust_and_approve',
                      data: {
                        adjustment_amount: parseFloat(adjustmentAmount),
                        adjustment_reason: adjustmentReason
                      }
                    });
                    
                    setShowAdjustmentModal(false);
                    setAdjustmentAmount('');
                    setAdjustmentReason('');
                  }}
                  disabled={
                    processApprovalMutation.isPending ||
                    !adjustmentAmount ||
                    !adjustmentReason ||
                    adjustmentReason.length < 10
                  }
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md disabled:opacity-50"
                >
                  {processApprovalMutation.isPending ? 'Processing...' : 'Save & Approve'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approval Modal */}
      {showApprovalModal && selectedCommission && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">
              {approvalAction === 'approve' && 'Approve Commission'}
              {approvalAction === 'reject' && 'Reject Commission'}
              {approvalAction === 'pay' && 'Mark as Paid'}
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Deal</p>
                <p className="font-medium">{selectedCommission.deal?.account_name} - {selectedCommission.deal?.deal_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Commission Amount</p>
                <p className="font-medium">£{Number(selectedCommission.commission_amount).toLocaleString()}</p>
              </div>
              {approvalAction === 'pay' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Reference *
                  </label>
                  <input
                    type="text"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="e.g. BACS-2024-001"
                    required
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes {approvalAction === 'reject' && '*'}
                </label>
                <textarea
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows={3}
                  placeholder={approvalAction === 'reject' ? 'Reason for rejection (required)' : 'Optional notes'}
                  required={approvalAction === 'reject'}
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowApprovalModal(false);
                    setApprovalAction(null);
                    setApprovalNotes('');
                    setPaymentReference('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApprovalAction}
                  disabled={
                    processApprovalMutation.isPending ||
                    (approvalAction === 'reject' && !approvalNotes) ||
                    (approvalAction === 'pay' && !paymentReference)
                  }
                  className={`px-4 py-2 rounded-md text-white ${
                    approvalAction === 'approve' ? 'bg-green-600 hover:bg-green-700' :
                    approvalAction === 'reject' ? 'bg-red-600 hover:bg-red-700' :
                    'bg-blue-600 hover:bg-blue-700'
                  } disabled:opacity-50`}
                >
                  {processApprovalMutation.isPending ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Audit Trail Modal */}
      {showAuditModal && selectedCommission && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Commission Details & Audit Trail</h3>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Deal</p>
                  <p className="font-medium">{selectedCommission.deal?.account_name}</p>
                  <p className="text-sm">{selectedCommission.deal?.deal_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Sales Rep</p>
                  <p className="font-medium">{selectedCommission.user?.first_name} {selectedCommission.user?.last_name}</p>
                  <p className="text-sm">{selectedCommission.user?.email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Deal Amount</p>
                  <p className="font-medium">£{Number(selectedCommission.deal_amount).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Commission</p>
                  <p className="font-medium">£{Number(selectedCommission.commission_amount).toLocaleString()}</p>
                  <p className="text-sm">{(Number(selectedCommission.commission_rate) * 100).toFixed(2)}% rate</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Deal Close Date</p>
                  <p className="font-medium">
                    {selectedCommission.deal?.close_date 
                      ? new Date(selectedCommission.deal.close_date).toLocaleDateString('en-GB')
                      : 'Not specified'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Commission Period</p>
                  <p className="font-medium">
                    {new Date(selectedCommission.period_start).toLocaleDateString('en-GB')} - 
                    {new Date(selectedCommission.period_end).toLocaleDateString('en-GB')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <div className="mt-1">{getStatusBadge(selectedCommission.status)}</div>
                </div>
                {selectedCommission.target_name && (
                  <div>
                    <p className="text-sm text-gray-600">Target</p>
                    <p className="font-medium">{selectedCommission.target_name}</p>
                  </div>
                )}
              </div>

              {selectedCommission.approvals && selectedCommission.approvals.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Audit Trail</h4>
                  <div className="space-y-2">
                    {selectedCommission.approvals.map((approval, index) => (
                      <div key={approval.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-md">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                            {index + 1}
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{approval.action}</span>
                            <span className="text-sm text-gray-500">
                              by {approval.performed_by_user?.first_name} {approval.performed_by_user?.last_name}
                            </span>
                          </div>
                          <div className="text-sm text-gray-600">
                            {new Date(approval.performed_at).toLocaleString('en-GB')}
                          </div>
                          {approval.notes && (
                            <div className="mt-1 text-sm text-gray-700">{approval.notes}</div>
                          )}
                          <div className="mt-1 text-xs text-gray-500">
                            {approval.previous_status} → {approval.new_status}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  setShowAuditModal(false);
                  setSelectedCommission(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Missing Commissions Modal */}
      {showMissingModal && missingCommissionsData && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Deals Without Commissions
                  </h3>
                  <p className="text-sm text-gray-600">
                    {missingCommissionsData.total} deals found for {getCurrentPeriod().label}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowMissingModal(false)}
                className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {missingCommissionsData.breakdown && missingCommissionsData.breakdown.length > 0 ? (
              <div className="space-y-4">
                {missingCommissionsData.breakdown.map((userGroup: any) => (
                  <div key={userGroup.user.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-medium text-gray-900">
                          {userGroup.user.first_name} {userGroup.user.last_name}
                        </h4>
                        <p className="text-sm text-gray-500">{userGroup.user.email}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-gray-900">
                          {userGroup.count} {userGroup.count === 1 ? 'deal' : 'deals'}
                        </p>
                        <p className="text-sm text-gray-500">
                          Total: £{userGroup.total_amount.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    
                    <div className={`px-3 py-2 rounded-lg mb-3 ${
                      userGroup.has_target ? 'bg-yellow-50 border border-yellow-200' : 'bg-red-50 border border-red-200'
                    }`}>
                      <p className={`text-sm font-medium ${
                        userGroup.has_target ? 'text-yellow-800' : 'text-red-800'
                      }`}>
                        {userGroup.has_target ? (
                          <>
                            <Clock className="w-4 h-4 inline mr-1" />
                            Commission calculation pending
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-4 h-4 inline mr-1" />
                            No target set for this period - commission cannot be calculated
                          </>
                        )}
                      </p>
                    </div>
                    
                    {/* Show first 3 deals */}
                    <div className="space-y-2">
                      {userGroup.deals.slice(0, 3).map((deal: any) => (
                        <div key={deal.id} className="flex items-center justify-between py-1 text-sm">
                          <div>
                            <span className="text-gray-900">{deal.account_name}</span>
                            <span className="text-gray-500 ml-2">- {deal.deal_name}</span>
                          </div>
                          <div className="text-gray-600">
                            £{Number(deal.amount).toLocaleString()}
                            <span className="text-gray-400 ml-2">
                              {new Date(deal.close_date).toLocaleDateString('en-GB')}
                            </span>
                          </div>
                        </div>
                      ))}
                      {userGroup.deals.length > 3 && (
                        <p className="text-sm text-gray-500 italic">
                          +{userGroup.deals.length - 3} more deals
                        </p>
                      )}
                    </div>
                    
                    {!userGroup.has_target && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <button
                          onClick={() => {
                            setShowMissingModal(false);
                            window.location.href = '/settings';
                          }}
                          className="text-sm font-medium text-blue-600 hover:text-blue-700">
                          Go to Settings to set target →
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="text-gray-600">
                  All closed deals have commissions calculated for this period!
                </p>
              </div>
            )}
            
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
              {missingCommissionsData.total > 0 && (
                <button
                  onClick={async () => {
                    try {
                      // Trigger recalculation for all deals
                      await api.post('/commissions/recalculate-all');
                      queryClient.invalidateQueries({ queryKey: ['commission-approvals'] });
                      setShowMissingModal(false);
                    } catch (error) {
                      console.error('Failed to recalculate:', error);
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                  <RefreshCw className="w-4 h-4 inline mr-2" />
                  Recalculate All
                </button>
              )}
              <button
                onClick={() => setShowMissingModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Export Commissions</h3>
            
            <div className="space-y-4">
              {/* Format Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Export Format</label>
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="xero_bills">Xero Bills (Accounts Payable)</option>
                  <option value="xero_payroll">Xero Payroll (UK)</option>
                  <option value="detailed_csv">Detailed Report CSV</option>
                  <option value="simple_csv">Simple CSV</option>
                </select>
              </div>

              {/* Format-specific options */}
              {exportFormat === 'xero_bills' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Account Code</label>
                    <input
                      type="text"
                      value={exportOptions.account_code}
                      onChange={(e) => setExportOptions({...exportOptions, account_code: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="6000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">VAT Rate</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={exportOptions.tax_rate}
                      onChange={(e) => setExportOptions({...exportOptions, tax_rate: parseFloat(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="0"
                    />
                    <p className="text-xs text-gray-500 mt-1">Usually 0 for employee commissions</p>
                  </div>
                </>
              )}

              {exportFormat === 'xero_payroll' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pay Period End Date</label>
                    <input
                      type="date"
                      value={exportOptions.pay_period_end}
                      onChange={(e) => setExportOptions({...exportOptions, pay_period_end: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Earnings Type</label>
                    <input
                      type="text"
                      value={exportOptions.earnings_type}
                      onChange={(e) => setExportOptions({...exportOptions, earnings_type: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="Commission"
                    />
                  </div>
                </>
              )}

              {/* Status Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Include Commissions By Status</label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={exportOptions.includeApproved}
                      onChange={(e) => setExportOptions({...exportOptions, includeApproved: e.target.checked})}
                      className="mr-2 rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    <span className="text-sm">Approved (Ready for payment)</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={exportOptions.includePending}
                      onChange={(e) => setExportOptions({...exportOptions, includePending: e.target.checked})}
                      className="mr-2 rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    <span className="text-sm">Pending Review</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={exportOptions.includePaid}
                      onChange={(e) => setExportOptions({...exportOptions, includePaid: e.target.checked})}
                      className="mr-2 rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    <span className="text-sm">Already Paid</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    // Check if at least one status is selected
                    if (!exportOptions.includeApproved && !exportOptions.includePending && !exportOptions.includePaid) {
                      alert('Please select at least one commission status to export');
                      return;
                    }
                    
                    // Fetch all team commissions based on selected statuses
                    const statusesToInclude = [];
                    if (exportOptions.includeApproved) statusesToInclude.push('approved');
                    if (exportOptions.includePending) statusesToInclude.push('calculated', 'pending_review');
                    if (exportOptions.includePaid) statusesToInclude.push('paid');
                    
                    console.log('Fetching commissions with statuses:', statusesToInclude);
                    
                    // Fetch team commissions from the API with status filter
                    const queryParams = new URLSearchParams();
                    if (exportOptions.includeApproved) queryParams.append('status', 'approved');
                    
                    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/api/commission-approvals?${queryParams}`, {
                      method: 'GET',
                      headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                      }
                    });
                    
                    if (!response.ok) throw new Error('Failed to fetch commissions');
                    
                    const data = await response.json();
                    let allCommissions = data.commissions || [];
                    
                    // If we need to fetch other statuses, do additional requests
                    if (exportOptions.includePending) {
                      const pendingResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/api/commission-approvals?status=pending`, {
                        method: 'GET',
                        headers: {
                          'Authorization': `Bearer ${localStorage.getItem('token')}`
                        }
                      });
                      if (pendingResponse.ok) {
                        const pendingData = await pendingResponse.json();
                        allCommissions = [...allCommissions, ...(pendingData.commissions || [])];
                      }
                    }
                    
                    if (exportOptions.includePaid) {
                      const paidResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/api/commission-approvals?status=paid`, {
                        method: 'GET',
                        headers: {
                          'Authorization': `Bearer ${localStorage.getItem('token')}`
                        }
                      });
                      if (paidResponse.ok) {
                        const paidData = await paidResponse.json();
                        allCommissions = [...allCommissions, ...(paidData.commissions || [])];
                      }
                    }
                    
                    const idsToExport = allCommissions.map((c: any) => c.id);
                    
                    console.log(`Found ${idsToExport.length} commissions to export:`, idsToExport);
                    
                    if (idsToExport.length === 0) {
                      alert('No commissions found matching the selected criteria');
                      return;
                    }

                    // Make export request
                    const exportResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/api/commissions/export`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                      },
                      body: JSON.stringify({
                        commission_ids: idsToExport,
                        format: exportFormat,
                        options: exportOptions
                      })
                    });

                    if (!exportResponse.ok) {
                      const errorData = await exportResponse.json();
                      throw new Error(errorData.error || 'Export failed');
                    }

                    // Download the file
                    const blob = await exportResponse.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${exportFormat}-${new Date().toISOString().split('T')[0]}.csv`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);

                    setShowExportModal(false);
                    setSelectedCommissionIds([]);
                  } catch (error) {
                    console.error('Export error:', error);
                    alert(`Failed to export commissions: ${error instanceof Error ? error.message : 'Unknown error'}`);
                  }
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                <FileSpreadsheet className="w-4 h-4 inline mr-2" />
                Export
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default CommissionsPage;