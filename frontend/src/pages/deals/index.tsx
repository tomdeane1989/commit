import { useState, useEffect, useRef } from 'react';
import Layout from '../../components/layout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import api from '../../lib/api';
import { Deal } from '../../types';
import { 
  Star, 
  Zap, 
  CheckCircle, 
  Search,
  TrendingUp,
  Calendar,
  PoundSterling,
  BarChart3,
  RefreshCw,
  Target,
  Clock,
  Package,
  Timer,
  Award,
  ArrowRight,
  Trophy,
  Percent,
  Users,
  User,
  ChevronDown,
  Info
} from 'lucide-react';

const DealsPage = () => {
  const { user } = useAuth();
  const [filters, setFilters] = useState({
    status: '',
    search: '',
    from_date: '',
    to_date: ''
  });
  const [draggedDeal, setDraggedDeal] = useState<Deal | null>(null);
  const [showAddDeal, setShowAddDeal] = useState(false);
  const [expandedDeals, setExpandedDeals] = useState<Set<string>>(new Set());
  const [quotaPeriod, setQuotaPeriod] = useState<'weekly' | 'monthly' | 'quarterly' | 'annual'>('quarterly');
  
  // Manager view filtering state
  const [managerView, setManagerView] = useState<'personal' | 'team' | 'member' | 'all'>('team');
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Manager deal categorization confirmation state
  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false);
  const [pendingCategorization, setPendingCategorization] = useState<{
    deal: Deal;
    category: string;
    previousCategory: string;
  } | null>(null);
  
  // Tooltip state for bucket information
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  
  const queryClient = useQueryClient();
  const isManager = user?.is_manager === true || user?.is_admin === true;

  // Toggle expanded state for a deal
  const toggleDealExpansion = (dealId: string) => {
    setExpandedDeals(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dealId)) {
        newSet.delete(dealId);
      } else {
        newSet.add(dealId);
      }
      return newSet;
    });
  };

  // Helper function to calculate days remaining in quarter (hardcoded Sept 30 for now)
  const getDaysRemainingInQuarter = () => {
    const now = new Date();
    const quarterEnd = new Date(now.getFullYear(), 8, 30); // September 30
    const diffTime = quarterEnd.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  // Helper function to get confidence rating for each category
  const getConfidenceRating = (category: string) => {
    switch (category) {
      case 'pipeline': return 50;
      case 'best_case': return 75;
      case 'commit': return 95;
      case 'closed_won': return 100;
      default: return 50;
    }
  };

  // Helper function to get commission value from deal
  const getDealCommission = (deal: Deal, commissionRate?: number) => {
    // Use actual_commission for closed deals
    if (deal.status === 'closed_won' && deal.actual_commission !== undefined) {
      return Number(deal.actual_commission);
    }
    // For open deals, calculate based on provided commission rate
    if (commissionRate !== undefined) {
      return Number(deal.amount) * commissionRate;
    }
    // No fallback - return 0 if no commission rate provided
    return 0;
  };

  // Calculate quota amount based on selected period
  const calculateQuotaForPeriod = (annualQuota: number, period: string) => {
    switch (period) {
      case 'weekly':
        return annualQuota / 52; // 52 weeks per year
      case 'monthly':
        return annualQuota / 12; // 12 months per year
      case 'quarterly':
        return annualQuota / 4; // 4 quarters per year
      case 'annual':
        return annualQuota;
      default:
        return annualQuota / 4; // Default to quarterly
    }
  };

  // Get current period date range based on selected quota period
  const getCurrentPeriodRange = (period: string) => {
    const now = new Date();
    let startDate, endDate;

    switch (period) {
      case 'weekly':
        // Current week (Monday to Sunday)
        const dayOfWeek = now.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        startDate = new Date(now);
        startDate.setDate(now.getDate() + mondayOffset);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        break;

      case 'monthly':
        // Current month
        startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
        break;

      case 'quarterly':
        // Current quarter (Q1: Jan-Mar, Q2: Apr-Jun, Q3: Jul-Sep, Q4: Oct-Dec)
        const quarter = Math.floor(now.getUTCMonth() / 3);
        startDate = new Date(Date.UTC(now.getUTCFullYear(), quarter * 3, 1));
        endDate = new Date(Date.UTC(now.getUTCFullYear(), quarter * 3 + 3, 0, 23, 59, 59, 999));
        break;

      case 'annual':
        // Current year
        startDate = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
        endDate = new Date(Date.UTC(now.getUTCFullYear(), 11, 31, 23, 59, 59, 999));
        break;

      default:
        // Default to quarterly
        const defaultQuarter = Math.floor(now.getUTCMonth() / 3);
        startDate = new Date(Date.UTC(now.getUTCFullYear(), defaultQuarter * 3, 1));
        endDate = new Date(Date.UTC(now.getUTCFullYear(), defaultQuarter * 3 + 3, 0, 23, 59, 59, 999));
    }

    return { startDate, endDate };
  };

  // Check if a deal is overdue (close date has passed)
  const isDealOverdue = (deal: Deal): boolean => {
    if (deal.status !== 'open' || !deal.close_date) return false;
    const closeDate = new Date(deal.close_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of today
    return closeDate < today;
  };

  // Filter deals by current period, including overdue deals
  const filterDealsByPeriod = (deals: Deal[], period: string) => {
    const { startDate, endDate } = getCurrentPeriodRange(period);
    
    return deals.filter((deal: Deal) => {
      if (deal.status === 'closed_won' && deal.closed_date) {
        const closedDate = new Date(deal.closed_date);
        return closedDate >= startDate && closedDate <= endDate;
      } else if (deal.status === 'open' && deal.close_date) {
        const expectedCloseDate = new Date(deal.close_date);
        // Include deals that are in the current period OR overdue
        return (expectedCloseDate >= startDate && expectedCloseDate <= endDate) || isDealOverdue(deal);
      }
      return false;
    });
  };

  // Initialize session tracking for ML data
  useEffect(() => {
    if (!sessionStorage.getItem('session_id')) {
      sessionStorage.setItem('session_id', `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showMemberDropdown && dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        console.log('🔍 Clicking outside dropdown - closing');
        setShowMemberDropdown(false);
      } else if (showMemberDropdown) {
        console.log('🔍 Clicking inside dropdown - keeping open');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMemberDropdown]);

  // Fetch team members for managers
  const { data: teamMembersData } = useQuery({
    queryKey: ['deals-team-members', user?.id],
    queryFn: async () => {
      const response = await api.get('/deals/team-members');
      return response.data;
    },
    enabled: isManager
  });

  const { data: dealsData, isLoading, refetch } = useQuery({
    queryKey: ['deals', user?.id, filters, managerView, selectedMemberId, quotaPeriod], // Include quotaPeriod in cache key
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      
      // Add manager view parameters
      if (isManager && managerView) {
        console.log('🔍 API Call - Adding view parameter:', managerView);
        params.append('view', managerView);
        if (managerView === 'member' && selectedMemberId) {
          console.log('🔍 API Call - Adding user_id parameter:', selectedMemberId);
          params.append('user_id', selectedMemberId);
        }
      }
      
      // Add period filtering - server-side instead of client-side
      params.append('period', quotaPeriod);
      
      // Set intelligent limit based on view context
      // Team view needs higher limit to capture all categorized deals
      const limit = managerView === 'team' ? 500 : 100;
      params.append('limit', limit.toString());
      
      const url = `/deals?${params}`;
      console.log('🔍 API Call - Full URL:', url);
      const response = await api.get(url);
      console.log('🔍 API Response received:', response.data);
      return response.data;
    }
  });

  // Get quota targets based on manager view
  const { data: targetsData } = useQuery({
    queryKey: ['targets', user?.id, managerView, selectedMemberId],
    queryFn: async () => {
      let endpoint = `/targets`;
      const params = new URLSearchParams();
      
      if (isManager && managerView) {
        if (managerView === 'personal') {
          // Personal view: only manager's own targets
          params.append('user_id', user?.id || ''); 
        } else if (managerView === 'member' && selectedMemberId) {
          // Individual member view: only selected member's targets
          params.append('user_id', selectedMemberId);
        } else if (managerView === 'team') {
          // Team view: all team member targets (excluding manager)
          // Don't specify user_id, backend will return all targets for manager role
          // We'll filter out manager's targets on frontend
        } else if (managerView === 'all') {
          // All view: manager + team targets combined
          // Don't specify user_id, backend will return all targets for manager role
        }
      } else {
        // Non-manager: only their own targets
        params.append('user_id', user?.id || '');
      }
      
      // Add view parameter to get current period targets for forecasting
      params.append('view', 'current_period');
      
      const queryString = params.toString();
      const url = queryString ? `${endpoint}?${queryString}` : endpoint;
      
      const response = await api.get(url);
      return response.data;
    },
    enabled: !!user?.id
  });

  const updateDealCategoryMutation = useMutation({
    mutationFn: async ({ dealId, category, previousCategory }: { dealId: string, category: string, previousCategory: string }) => {
      console.log('🔍 Frontend - Making PATCH request to:', `/deals/${dealId}/categorize`);
      console.log('🔍 Frontend - Full API base URL:', api.defaults.baseURL);
      console.log('🔍 Frontend - Request payload:', { 
        deal_type: category,
        previous_category: previousCategory 
      });
      
      try {
        const response = await api.patch(`/deals/${dealId}/categorize`, { 
          deal_type: category,
          previous_category: previousCategory,
          categorization_timestamp: new Date().toISOString(),
          user_context: {
            confidence_level: 'high',
            categorization_method: 'drag_drop',
            session_id: sessionStorage.getItem('session_id') || 'unknown'
          }
        });
        console.log('🔍 Frontend - Response received:', response.data);
        return response.data;
      } catch (error: any) {
        console.error('🔍 Frontend - API Error:', error.response?.status, error.response?.data, error.message);
        throw error;
      }
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deals', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', user?.id] });
      // Invalidate team queries to update quota progress on team page
      queryClient.invalidateQueries({ queryKey: ['team'] }); // Invalidate all team queries regardless of filters
      queryClient.invalidateQueries({ queryKey: ['targets'] }); // Invalidate all targets queries
      logCategorizationChange(variables.dealId, variables.previousCategory, variables.category);
      
      // Show feedback for manager actions
      if (data.manager_action && data.deal_owner) {
        console.log(`✅ Manager Action: Deal categorized for ${data.deal_owner.first_name} ${data.deal_owner.last_name} - ${data.message}`);
        // TODO: In future, trigger notification to deal owner here
      }
    }
  });

  const deals = dealsData?.deals || [];
  const targets = targetsData?.targets || [];
  
  // Debug logging
  console.log('🎯 Deals Page Debug:', {
    managerView,
    selectedMemberId,
    targetsCount: targets.length,
    userIdFromAuth: user?.id,
    targets: targets.map((t: any) => ({
      user_id: t.user_id,
      user_email: t.user?.email,
      quota_amount: t.quota_amount,
      is_active: t.is_active,
      period_type: t.period_type,
      matches_filter: managerView === 'team' ? t.user_id !== user?.id : true
    }))
  });
  
  // Calculate quota target based on manager view
  let quotaAmount = 0;
  if (isManager && managerView) {
    if (managerView === 'personal') {
      // Personal view: only manager's quota
      const managerTarget = targets.find((t: any) => t.is_active && t.user_id === user?.id);
      quotaAmount = Number(managerTarget?.quota_amount) || 0;
    } else if (managerView === 'member' && selectedMemberId) {
      // Individual member view: selected member's quota  
      const memberTarget = targets.find((t: any) => t.is_active && t.user_id === selectedMemberId);
      quotaAmount = Number(memberTarget?.quota_amount) || 0;
    } else if (managerView === 'team') {
      // Team view: sum of all team members' quotas (excluding manager)
      const teamTargets = targets.filter((t: any) => t.is_active && t.user_id !== user?.id);
      console.log('📊 Team View Calculation:', {
        allTargets: targets.length,
        filteredTeamTargets: teamTargets.length,
        teamTargets: teamTargets.map((t: any) => ({
          user_id: t.user_id,
          email: t.user?.email,
          quota: t.quota_amount,
          quota_type: typeof t.quota_amount,
          is_active: t.is_active,
          is_active_type: typeof t.is_active
        }))
      });
      const amounts = teamTargets.map((t: any) => Number(t.quota_amount));
      console.log('💵 Amount conversions:', amounts, 'Has NaN:', amounts.some(isNaN));
      quotaAmount = amounts.reduce((sum: number, amount: number) => sum + amount, 0);
    } else if (managerView === 'all') {
      // All view: manager + team quotas combined
      const allActiveTargets = targets.filter((t: any) => t.is_active);
      quotaAmount = allActiveTargets.reduce((sum: number, target: any) => sum + Number(target.quota_amount), 0);
    }
  } else {
    // Non-manager: their own quota
    const currentTarget = targets.find((t: any) => t.is_active && t.user_id === user?.id);
    quotaAmount = Number(currentTarget?.quota_amount) || 0;
  }
  
  // Fallback to default if no quota found  
  // Note: quotaAmount now comes from current period targets (quarterly), not annual
  const currentPeriodQuotaTarget = quotaAmount || 0; // No fallback - show 0 if no quota set
  
  console.log('💰 Quota Calculation Result:', {
    isManager,
    managerView,
    selectedMemberId,
    quotaAmount,
    currentPeriodQuotaTarget
  });
  
  // Get commission rate based on current view
  let commissionRate = 0;
  if (isManager && managerView) {
    if (managerView === 'personal') {
      const managerTarget = targets.find((t: any) => t.is_active && t.user_id === user?.id);
      commissionRate = Number(managerTarget?.commission_rate) || 0;
    } else if (managerView === 'member' && selectedMemberId) {
      const memberTarget = targets.find((t: any) => t.is_active && t.user_id === selectedMemberId);
      commissionRate = Number(memberTarget?.commission_rate) || 0;
    } else if (managerView === 'team' || managerView === 'all') {
      // For team/all views, use average commission rate
      const relevantTargets = managerView === 'team' 
        ? targets.filter((t: any) => t.is_active && t.user_id !== user?.id)
        : targets.filter((t: any) => t.is_active);
      
      if (relevantTargets.length > 0) {
        const totalRate = relevantTargets.reduce((sum: number, target: any) => sum + Number(target.commission_rate), 0);
        commissionRate = totalRate / relevantTargets.length;
      }
    }
  } else {
    // Non-manager: their own commission rate
    const currentTarget = targets.find((t: any) => t.is_active && t.user_id === user?.id);
    commissionRate = Number(currentTarget?.commission_rate) || 0;
  }

  // ML Training Data Logging
  const logCategorizationChange = async (dealId: string, fromCategory: string, toCategory: string) => {
    try {
      await api.post('/analytics/categorization-log', {
        deal_id: dealId,
        from_category: fromCategory,
        to_category: toCategory,
        timestamp: new Date().toISOString(),
        user_id: user?.id || null,
        session_metadata: {
          user_agent: navigator.userAgent,
          screen_resolution: `${window.screen.width}x${window.screen.height}`,
          viewport_size: `${window.innerWidth}x${window.innerHeight}`
        }
      });
    } catch (error) {
      console.warn('Failed to log categorization change for ML training:', error);
    }
  };

  // Deals are now filtered server-side by period, so use them directly
  // Group deals by category (deals are already filtered by current period from server)
  const dealsByCategory = {
    pipeline: deals.filter((deal: Deal) => 
      deal.deal_type === 'pipeline' && deal.status === 'open'
    ),
    commit: deals.filter((deal: Deal) => 
      deal.deal_type === 'commit' && deal.status === 'open'
    ),
    best_case: deals.filter((deal: Deal) => 
      deal.deal_type === 'best_case' && deal.status === 'open'
    ),
    closed: deals.filter((deal: Deal) => 
      deal.status === 'closed_won' && (deal.deal_type === 'closed_won' || !deal.deal_type)
    )
  };

  // Also keep all deals (unfiltered) for display purposes in the columns
  const allDealsByCategory = {
    pipeline: deals.filter((deal: Deal) => 
      deal.deal_type === 'pipeline' && deal.status === 'open'
    ),
    commit: deals.filter((deal: Deal) => 
      deal.deal_type === 'commit' && deal.status === 'open'
    ),
    best_case: deals.filter((deal: Deal) => 
      deal.deal_type === 'best_case' && deal.status === 'open'
    ),
    closed: deals.filter((deal: Deal) => 
      deal.status === 'closed_won' && (deal.deal_type === 'closed_won' || !deal.deal_type)
    )
  };

  // Calculate progress values using API summary data or fallback to calculated values
  const summaryData = dealsData?.summary;
  const closedAmount = summaryData ? 
    deals.filter((d: Deal) => d.status === 'closed_won').reduce((sum: number, deal: Deal) => sum + Number(deal.amount), 0) :
    dealsByCategory.closed.reduce((sum: number, deal: Deal) => sum + Number(deal.amount), 0);
  const commitAmount = summaryData ? 
    deals.filter((d: Deal) => d.deal_type === 'commit').reduce((sum: number, deal: Deal) => sum + Number(deal.amount), 0) :
    dealsByCategory.commit.reduce((sum: number, deal: Deal) => sum + Number(deal.amount), 0);
  const bestCaseAmount = summaryData ? 
    deals.filter((d: Deal) => d.deal_type === 'best_case').reduce((sum: number, deal: Deal) => sum + Number(deal.amount), 0) :
    dealsByCategory.best_case.reduce((sum: number, deal: Deal) => sum + Number(deal.amount), 0);
    
  // Since the backend now returns current period targets, use them directly for quarterly view
  // Only use calculation for other periods (weekly, monthly, annual)
  const quotaTarget = quotaPeriod === 'quarterly' 
    ? currentPeriodQuotaTarget 
    : calculateQuotaForPeriod(currentPeriodQuotaTarget * 4, quotaPeriod); // Multiply by 4 to get estimated annual for other periods
  
  const totalCategorized = closedAmount + commitAmount + bestCaseAmount;
  const closedProgress = (closedAmount / quotaTarget) * 100;
  const commitProgress = (commitAmount / quotaTarget) * 100;
  const bestCaseProgress = (bestCaseAmount / quotaTarget) * 100;
  const totalProgress = (totalCategorized / quotaTarget) * 100;

  const handleDragStart = (e: React.DragEvent, deal: Deal) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', deal.id);
    // Small delay to ensure state is set before render
    requestAnimationFrame(() => {
      setDraggedDeal(deal);
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, category: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (draggedDeal && draggedDeal.deal_type !== category) {
      const previousCategory = draggedDeal.deal_type;
      
      // Check if this is a manager categorizing someone else's deal
      const isDealOwner = draggedDeal.user_id === user?.id;
      const isManagerAction = isManager && !isDealOwner;
      
      if (isManagerAction) {
        // Show confirmation dialog for manager actions
        setPendingCategorization({
          deal: draggedDeal,
          category,
          previousCategory
        });
        setShowConfirmationDialog(true);
      } else {
        // Direct categorization for own deals
        updateDealCategoryMutation.mutate({ 
          dealId: draggedDeal.id, 
          category,
          previousCategory 
        });
      }
    }
    setDraggedDeal(null);
  };

  const handleDragEnd = () => {
    setDraggedDeal(null);
  };

  // Handle confirmation dialog actions
  const handleConfirmCategorization = () => {
    if (pendingCategorization) {
      updateDealCategoryMutation.mutate({ 
        dealId: pendingCategorization.deal.id, 
        category: pendingCategorization.category,
        previousCategory: pendingCategorization.previousCategory 
      });
    }
    setShowConfirmationDialog(false);
    setPendingCategorization(null);
  };

  const handleCancelCategorization = () => {
    setShowConfirmationDialog(false);
    setPendingCategorization(null);
  };

  const DealCard = ({ deal }: { deal: Deal }) => {
    const commission = getDealCommission(deal, commissionRate);
    const daysToCloseRaw = deal.close_date ? 
      Math.ceil((new Date(deal.close_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 
      null;
    const daysToClose = daysToCloseRaw ? Math.max(0, daysToCloseRaw) : null;
    const isExpanded = expandedDeals.has(deal.id);
    const isOverdue = isDealOverdue(deal);
    const daysOverdue = isOverdue && daysToCloseRaw ? Math.abs(daysToCloseRaw) : 0;

    const handleCardClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      toggleDealExpansion(deal.id);
    };

    return (
      <div
        draggable
        onDragStart={(e) => handleDragStart(e, deal)}
        onDragEnd={handleDragEnd}
        onClick={handleCardClick}
        className={`bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer select-none relative group ${
          draggedDeal?.id === deal.id 
            ? 'opacity-60 scale-95 shadow-xl' 
            : 'hover:scale-[1.01] hover:-translate-y-0.5'
        } ${isExpanded ? 'ring-2 ring-blue-200 border-blue-300' : ''}`}
      >
        {/* Compact View */}
        <div className="p-3">
          {/* Company Name */}
          <div className="text-sm font-semibold text-gray-900 mb-2 truncate">
            {deal.account_name}
          </div>
          
          {/* Owner Info (for team views) */}
          {isManager && (managerView === 'team' || managerView === 'all') && (deal as any).user && (
            <div className="flex items-center mb-2 px-2 py-1 bg-blue-50 border border-blue-200 rounded text-xs">
              <User className="w-3 h-3 text-blue-600 mr-1" />
              <span className="text-blue-700 font-medium">
                {(deal as any).user.first_name} {(deal as any).user.last_name}
              </span>
            </div>
          )}
          
          {/* Overdue Warning */}
          {isOverdue && (
            <div className="flex items-center space-x-1 mb-2 px-2 py-1 bg-red-50 border border-red-200 rounded text-xs">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span className="text-red-700 font-medium">CRM Close Date Passed</span>
            </div>
          )}
          
          {/* Deal Amount */}
          <div className="flex items-center space-x-1">
            <PoundSterling className="w-3 h-3 text-green-600" />
            <span className="font-bold text-green-700">
              £{Number(deal.amount).toLocaleString()}
            </span>
          </div>

          {/* Expand indicator */}
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div className={`w-4 h-4 rounded-full bg-gray-100 flex items-center justify-center transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
              <div className="w-2 h-2 border-b border-r border-gray-400 transform rotate-45 -translate-y-0.5"></div>
            </div>
          </div>

          {/* Drag indicator */}
          <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div className="grid grid-cols-2 gap-0.5">
              <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
              <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
              <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
              <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
            </div>
          </div>
        </div>

        {/* Expanded View */}
        {isExpanded && (
          <div className="border-t border-gray-100 p-3 bg-gray-50">
            {/* Deal Name */}
            {deal.deal_name && deal.deal_name !== deal.account_name && (
              <div className="mb-3">
                <span className="text-xs font-medium text-gray-600">Deal:</span>
                <div className="text-sm font-medium text-gray-900 mt-1">
                  {deal.deal_name}
                </div>
              </div>
            )}

            {/* Time Remaining */}
            {daysToClose !== null && (
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-gray-600">
                  {isOverdue ? 'Days overdue' : 'Time to close'}
                </span>
                <div className="flex items-center space-x-1">
                  <Clock className={`w-3 h-3 ${isOverdue ? 'text-red-500' : 'text-orange-500'}`} />
                  <span className={`text-sm font-medium ${isOverdue ? 'text-red-600' : 'text-orange-600'}`}>
                    {isOverdue 
                      ? `${daysOverdue} days ago` 
                      : daysToClose === 0 ? 'Today' : daysToClose === 1 ? '1 day' : `${daysToClose} days`
                    }
                  </span>
                </div>
              </div>
            )}

            {/* Close Date */}
            {deal.close_date && (
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-gray-600">Close date</span>
                <span className="text-sm text-gray-700">
                  {new Date(deal.close_date).toLocaleDateString('en-GB')}
                </span>
              </div>
            )}

            {/* Estimated Commission */}
            <div className="pt-2 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-600">Est. Commission</span>
                <div className="flex items-center space-x-1">
                  <Award className="w-3 h-3 text-purple-500" />
                  <span className="text-sm font-semibold text-purple-600">
                    £{commission.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const DealsSection = ({ title, icon: Icon, deals, bgColor, borderColor, iconColor, textColor, category, badge, description, tooltipContent }: any) => {
    const totalValue = deals.reduce((sum: number, deal: Deal) => sum + Number(deal.amount), 0);
    const totalCommission = deals.reduce((sum: number, deal: Deal) => sum + getDealCommission(deal, commissionRate), 0);
    
    return (
      <div className={`bg-white rounded-xl border-2 shadow-lg overflow-hidden transition-all duration-300 ${
        draggedDeal && category && draggedDeal.deal_type !== category 
          ? 'border-blue-400 bg-blue-50 shadow-xl transform scale-105' 
          : borderColor
      }`}>
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-3">
              <div className={`p-2 ${bgColor} rounded-xl`}>
                <Icon className={`w-5 h-5 ${iconColor}`} />
              </div>
              <div>
                <div className="flex items-center space-x-2 mb-1">
                  <h3 className={`text-lg font-bold ${textColor}`}>
                    {title}
                  </h3>
                  {tooltipContent && (
                    <div className="relative group">
                      <Info 
                        className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help transition-colors"
                        onMouseEnter={() => setActiveTooltip(category)}
                        onMouseLeave={() => setActiveTooltip(null)}
                      />
                      {activeTooltip === category && (
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg whitespace-nowrap z-[9999]">
                          <div className="space-y-1">
                            {tooltipContent.map((line: string, index: number) => (
                              <div key={index}>{line}</div>
                            ))}
                          </div>
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
                        </div>
                      )}
                    </div>
                  )}
                  {badge && (
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${badge.class}`}>
                      {badge.text}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600">{description}</p>
              </div>
            </div>
          </div>

          {/* Summary Metrics */}
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className={`text-xl font-bold ${textColor}`}>
                £{totalValue.toLocaleString()}
              </div>
              <div className="text-xs text-gray-600">Total Value</div>
            </div>
            <div>
              <div className={`text-xl font-bold ${textColor}`}>
                {deals.length}
              </div>
              <div className="text-xs text-gray-600">Deals</div>
            </div>
          </div>
        </div>
        
        <div 
          className={`p-4 transition-all duration-300 min-h-[250px] ${
            draggedDeal && category && draggedDeal.deal_type !== category 
              ? 'bg-gradient-to-b from-blue-50 to-blue-100' 
              : 'bg-gray-50'
          }`}
          onDragOver={category ? handleDragOver : undefined}
          onDragEnter={category ? handleDragEnter : undefined}
          onDragLeave={category ? handleDragLeave : undefined}
          onDrop={category ? (e) => handleDrop(e, category) : undefined}
        >
          {deals.length === 0 ? (
            <div className="text-center py-12">
              <Icon className={`w-12 h-12 ${iconColor} mx-auto mb-4 opacity-40`} />
              <p className="text-sm text-gray-500 mb-2">
                {category ? 'Drop deals here' : 'No deals available'}
              </p>
              {category && (
                <p className="text-xs text-gray-400">
                  Drag from Pipeline to categorize
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {deals.map((deal: Deal) => (
                <DealCard key={deal.id} deal={deal} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const QuotaProgress = () => {
    // Calculate actual vs total projected progress correctly
    const actualAttainment = (closedAmount / quotaTarget) * 100;
    const projectedAmount = commitAmount + bestCaseAmount; // Only projected pipeline
    const totalProjected = closedAmount + projectedAmount; // Actual + Projected
    const totalProjectedAttainment = (totalProjected / quotaTarget) * 100;

    
    // Dynamic scale: if projected exceeds quota, scale the ring to show the full projected amount
    const ringScale = Math.max(100, totalProjectedAttainment); // Scale to at least 100%, but more if projected exceeds quota
    
    // Progress percentages for rings (scaled appropriately)
    const actualProgress = (actualAttainment / ringScale) * 100; // Inner ring: actual scaled to ring
    const projectedProgress = (totalProjectedAttainment / ringScale) * 100; // Outer ring: total projected scaled to ring
    
    // Commission calculations - sum actual commissions from deals
    const actualCommission = dealsByCategory.closed.reduce((sum: number, deal: Deal) => sum + getDealCommission(deal, commissionRate), 0);
    const projectedCommission = [...dealsByCategory.commit, ...dealsByCategory.best_case].reduce((sum: number, deal: Deal) => sum + getDealCommission(deal, commissionRate), 0);
    const totalCommission = actualCommission + projectedCommission;

    const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);

    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-6 group hover:shadow-xl transition-all duration-300">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-bold text-gray-900">Quota Attainment</h2>
          <div className="text-right">
            <div className="text-3xl font-bold text-gray-900 group-hover:text-green-600 transition-colors duration-300">
              {actualAttainment.toFixed(0)}%
            </div>
            <div className="text-sm text-gray-500">actual closed</div>
          </div>
        </div>

        {/* Enhanced Circular Progress Ring */}
        <div className="relative flex items-center justify-center mb-8 py-8">
          <div className="w-64 h-64 transition-transform duration-500">
            <svg className="w-full h-full -rotate-90 drop-shadow-lg" viewBox="0 0 180 180" style={{ overflow: 'visible' }}>
              {/* Outer quota ring background */}
              <circle
                cx="90"
                cy="90"
                r="80"
                stroke="#f1f5f9"
                strokeWidth="10"
                fill="none"
                className="opacity-60"
              />
              
              {/* Outer quota ring segments - Actual (Green) */}
              <circle
                cx="90"
                cy="90"
                r="80"
                stroke="url(#greenGradientOuter)"
                strokeWidth="10"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${Math.min(actualProgress * 5.03, 503)} 503`}
                className="transition-all duration-300 cursor-pointer hover:stroke-width-[12]"
                style={{ pointerEvents: actualProgress > 0 ? 'stroke' : 'none' }}
                onMouseEnter={(e) => {
                  e.stopPropagation();
                  setHoveredSegment('actual-outer');
                }}
                onMouseLeave={(e) => {
                  e.stopPropagation();
                  setHoveredSegment(null);
                }}
              />
              
              {/* Outer quota ring segments - Commit (Amber) */}
              {commitAmount > 0 && (
                <circle
                  cx="90"
                  cy="90"
                  r="80"
                  stroke="url(#amberGradientOuter)"
                  strokeWidth="10"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${(((commitAmount / quotaTarget) * 100) / ringScale) * 100 * 5.03} 503`}
                  strokeDashoffset={-actualProgress * 5.03}
                  className="transition-all duration-300 cursor-pointer hover:stroke-width-[12]"
                  style={{ pointerEvents: 'stroke' }}
                  onMouseEnter={(e) => {
                    e.stopPropagation();
                    setHoveredSegment('commit-outer');
                  }}
                  onMouseLeave={(e) => {
                    e.stopPropagation();
                    setHoveredSegment(null);
                  }}
                />
              )}
              
              {/* Outer quota ring segments - Best Case (Purple) */}
              {bestCaseAmount > 0 && (
                <circle
                  cx="90"
                  cy="90"
                  r="80"
                  stroke="url(#purpleGradientOuter)"
                  strokeWidth="10"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${(((bestCaseAmount / quotaTarget) * 100) / ringScale) * 100 * 5.03} 503`}
                  strokeDashoffset={-(actualProgress + (((commitAmount / quotaTarget) * 100) / ringScale) * 100) * 5.03}
                  className="transition-all duration-300 cursor-pointer hover:stroke-width-[12]"
                  style={{ pointerEvents: 'stroke' }}
                  onMouseEnter={(e) => {
                    e.stopPropagation();
                    setHoveredSegment('bestcase-outer');
                  }}
                  onMouseLeave={(e) => {
                    e.stopPropagation();
                    setHoveredSegment(null);
                  }}
                />
              )}
              
              {/* Inner quota ring background */}
              <circle
                cx="90"
                cy="90"
                r="64"
                stroke="#f1f5f9"
                strokeWidth="16"
                fill="none"
                className="transition-colors duration-300"
              />
              
              {/* Inner quota ring - Actual Progress Only (Green for actual attainment) */}
              <circle
                cx="90"
                cy="90"
                r="64"
                stroke="url(#greenGradient)"
                strokeWidth="16"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${Math.min(actualProgress * 4.02, 402)} 402`}
                className="transition-all duration-300 cursor-pointer hover:stroke-width-[18]"
                style={{
                  filter: 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.3))',
                  pointerEvents: actualProgress > 0 ? 'stroke' : 'none'
                }}
                onMouseEnter={(e) => {
                  e.stopPropagation();
                  setHoveredSegment('actual');
                }}
                onMouseLeave={(e) => {
                  e.stopPropagation();
                  setHoveredSegment(null);
                }}
              />

              {/* Quota Achievement Markers - show where 100% quota falls when exceeded */}
              {actualAttainment > 100 && (
                <>
                  {/* Inner ring quota marker */}
                  <circle
                    cx="90"
                    cy="90"
                    r="64"
                    stroke="#FFD700"
                    strokeWidth="3"
                    fill="none"
                    strokeDasharray="6 6"
                    strokeDashoffset={-(100 / ringScale) * 100 * 4.02}
                    className="opacity-90"
                    style={{ 
                      strokeLinecap: 'round',
                      filter: 'drop-shadow(0 0 4px rgba(255, 215, 0, 0.6))'
                    }}
                  />
                  {/* Inner ring quota indicator dot */}
                  <circle
                    cx={90 + 64 * Math.cos(((100 / ringScale) * 100 * 2 * Math.PI / 100) - Math.PI / 2)}
                    cy={90 + 64 * Math.sin(((100 / ringScale) * 100 * 2 * Math.PI / 100) - Math.PI / 2)}
                    r="4"
                    fill="#FFD700"
                    stroke="#FFF"
                    strokeWidth="2"
                    className="drop-shadow-md"
                  />
                </>
              )}
              
              {totalProjectedAttainment > 100 && (
                <>
                  {/* Outer ring quota marker */}
                  <circle
                    cx="90"
                    cy="90"
                    r="80"
                    stroke="#FFD700"
                    strokeWidth="3"
                    fill="none"
                    strokeDasharray="8 8"
                    strokeDashoffset={-(100 / ringScale) * 100 * 5.03}
                    className="opacity-90"
                    style={{ 
                      strokeLinecap: 'round',
                      filter: 'drop-shadow(0 0 4px rgba(255, 215, 0, 0.6))'
                    }}
                  />
                  {/* Outer ring quota indicator dot */}
                  <circle
                    cx={90 + 80 * Math.cos(((100 / ringScale) * 100 * 2 * Math.PI / 100) - Math.PI / 2)}
                    cy={90 + 80 * Math.sin(((100 / ringScale) * 100 * 2 * Math.PI / 100) - Math.PI / 2)}
                    r="5"
                    fill="#FFD700"
                    stroke="#FFF"
                    strokeWidth="2"
                    className="drop-shadow-md"
                  />
                </>
              )}

              {/* Gradient definitions */}
              <defs>
                <linearGradient id="greenGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10B981" />
                  <stop offset="100%" stopColor="#059669" />
                </linearGradient>
                <linearGradient id="greenGradientOuter" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10B981" />
                  <stop offset="100%" stopColor="#059669" />
                </linearGradient>
                <linearGradient id="amberGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#F59E0B" />
                  <stop offset="100%" stopColor="#D97706" />
                </linearGradient>
                <linearGradient id="amberGradientOuter" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#F59E0B" />
                  <stop offset="100%" stopColor="#D97706" />
                </linearGradient>
                <linearGradient id="purpleGradientOuter" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#9333EA" />
                  <stop offset="100%" stopColor="#7C3AED" />
                </linearGradient>
              </defs>
            </svg>
            
            {/* Center content with hover details */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              {hoveredSegment === 'actual' || hoveredSegment === 'actual-outer' ? (
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {actualAttainment.toFixed(0)}%
                  </div>
                  <div className="text-sm text-green-700 font-medium">
                    Actual Closed
                  </div>
                  <div className="text-lg font-bold text-green-800">
                    £{closedAmount.toLocaleString()}
                  </div>
                  <div className="text-xs text-green-600 font-semibold">
                    Commission: £{actualCommission.toLocaleString()}
                  </div>
                </div>
              ) : hoveredSegment === 'commit-outer' ? (
                <div className="text-center">
                  <div className="text-3xl font-bold text-amber-600">
                    {(((commitAmount / quotaTarget) * 100) / ringScale * 100).toFixed(0)}%
                  </div>
                  <div className="text-sm text-amber-700 font-medium">
                    Commit Pipeline
                  </div>
                  <div className="text-lg font-bold text-amber-800">
                    £{commitAmount.toLocaleString()}
                  </div>
                  <div className="text-xs text-amber-600 font-semibold">
                    Potential: £{dealsByCategory.commit.reduce((sum: number, deal: Deal) => sum + getDealCommission(deal, commissionRate), 0).toLocaleString()}
                  </div>
                </div>
              ) : hoveredSegment === 'bestcase-outer' ? (
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600">
                    {(((bestCaseAmount / quotaTarget) * 100) / ringScale * 100).toFixed(0)}%
                  </div>
                  <div className="text-sm text-purple-700 font-medium">
                    Best Case Pipeline
                  </div>
                  <div className="text-lg font-bold text-purple-800">
                    £{bestCaseAmount.toLocaleString()}
                  </div>
                  <div className="text-xs text-purple-600 font-semibold">
                    Potential: £{dealsByCategory.best_case.reduce((sum: number, deal: Deal) => sum + getDealCommission(deal, commissionRate), 0).toLocaleString()}
                  </div>
                </div>
              ) : hoveredSegment === 'projected' ? (
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    {totalProjectedAttainment.toFixed(0)}%
                  </div>
                  <div className="text-sm text-blue-700 font-medium">
                    £{totalProjected.toLocaleString()} total
                  </div>
                  <div className="text-xs text-blue-600 font-semibold">
                    Commission: £{totalCommission.toLocaleString()}
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-4xl font-bold text-gray-900 transition-all duration-300">
                    {actualAttainment.toFixed(0)}%
                  </div>
                  <div className="text-sm text-gray-500">Actual Attainment</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {totalProjectedAttainment.toFixed(0)}% projected total
                  </div>
                </div>
              )}
            </div>

            {/* Progress labels around the rings */}
            <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
              <div className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full shadow-sm border border-blue-200">
                Projected: {totalProjectedAttainment.toFixed(0)}%
              </div>
            </div>
            <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2">
              <div className="text-xs font-semibold text-green-600 bg-green-50 px-3 py-1 rounded-full shadow-sm border border-green-200">
                Actual: {actualAttainment.toFixed(0)}%
              </div>
            </div>
          </div>
        </div>

        {/* Progress Summary */}
        <div className="space-y-4 mb-6">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Actual Closed</span>
              <span className="text-lg font-bold text-gray-900">
                £{closedAmount.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Projected Total</span>
              <span className="text-lg font-bold text-gray-900">
                £{totalProjected.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Quota Target</span>
              <span className="text-lg font-bold text-gray-900">
                £{quotaTarget.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Actual Attainment</span>
              <span className={`text-lg font-bold ${actualAttainment >= 100 ? 'text-green-600' : 'text-orange-600'}`}>
                {actualAttainment.toFixed(0)}%
              </span>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 bg-green-500 rounded-full"></div>
              <span className="text-sm font-medium text-green-800">Actual Quota Gap</span>
            </div>
            <div className="text-right">
              {quotaTarget - closedAmount <= 0 ? (
                <div className="text-sm font-bold text-green-800">
                  Quota Exceeded! 🎉
                </div>
              ) : (
                <>
                  <div className="text-sm font-bold text-green-800">
                    £{(quotaTarget - closedAmount).toLocaleString()} needed
                  </div>
                  <div className="text-xs text-green-600">
                    to reach quota
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 bg-blue-500 rounded-full opacity-80"></div>
              <span className="text-sm font-medium text-blue-800">Projected Quota Gap</span>
            </div>
            <div className="text-right">
              {quotaTarget - totalProjected <= 0 ? (
                <div className="text-sm font-bold text-blue-800">
                  {totalProjected > quotaTarget ? `£${(totalProjected - quotaTarget).toLocaleString()} over` : 'On target! 🎯'}
                </div>
              ) : (
                <>
                  <div className="text-sm font-bold text-blue-800">
                    £{(quotaTarget - totalProjected).toLocaleString()} at risk
                  </div>
                  <div className="text-xs text-blue-600">
                    additional pipe needed to meet quota
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Achievement Badge */}
        {actualAttainment >= 100 && (
          <div className="mt-4 p-3 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg text-center">
            <div className="flex items-center justify-center space-x-2 text-white">
              <Trophy className="w-5 h-5" />
              <span className="font-bold">Quota Achieved!</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
              Forecasting
            </h1>
            <p className="mt-2 text-lg text-gray-600">
              Drag deals into confidence buckets to see your projected earnings and track quota attainment
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => refetch()}
              disabled={isLoading}
              className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Sync CRM
            </button>
          </div>
        </div>

        {/* Filtering Controls */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Period Selector (for all users) */}
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">Period:</label>
                <select
                  value={quotaPeriod}
                  onChange={(e) => setQuotaPeriod(e.target.value as 'weekly' | 'monthly' | 'quarterly' | 'annual')}
                  className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annual">Annual</option>
                </select>
              </div>

              {/* Team View Selector (managers only) */}
              {isManager && (
                <>
                  <div className="h-6 w-px bg-gray-300"></div>
                  <span className="text-sm font-medium text-gray-700">Team View:</span>
                
                {/* View Toggle Buttons */}
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => {
                      setManagerView('personal');
                      setSelectedMemberId(''); // Clear selected member when switching views
                    }}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      managerView === 'personal'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <User className="w-4 h-4 inline mr-2" />
                    Personal
                  </button>
                  <button
                    onClick={() => {
                      setManagerView('team');
                      setSelectedMemberId(''); // Clear selected member when switching views
                    }}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      managerView === 'team'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Users className="w-4 h-4 inline mr-2" />
                    Team
                  </button>
                  <button
                    onClick={() => setManagerView('member')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      managerView === 'member'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <User className="w-4 h-4 inline mr-2" />
                    Individual
                  </button>
                  <button
                    onClick={() => {
                      setManagerView('all');
                      setSelectedMemberId(''); // Clear selected member when switching views
                    }}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      managerView === 'all'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Target className="w-4 h-4 inline mr-2" />
                    All
                  </button>
                </div>

                {/* Team Member Dropdown (shown when Individual is selected) */}
                {console.log('🔍 Dropdown render check - managerView:', managerView, 'should show dropdown:', managerView === 'member')}
                {managerView === 'member' && (
                  <div className="relative" ref={dropdownRef}>
                    <button
                      onClick={() => setShowMemberDropdown(!showMemberDropdown)}
                      className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm min-w-48"
                    >
                      {selectedMemberId && teamMembersData?.team_members ? (
                        teamMembersData.team_members.find((m: any) => m.id === selectedMemberId)?.first_name + ' ' + 
                        teamMembersData.team_members.find((m: any) => m.id === selectedMemberId)?.last_name
                      ) : (
                        'Select Team Member'
                      )}
                      <ChevronDown className="w-4 h-4 ml-2" />
                    </button>
                    
                    {console.log('🔍 Dropdown items render check - showMemberDropdown:', showMemberDropdown, 'has team members:', !!teamMembersData?.team_members)}
                    {showMemberDropdown && teamMembersData?.team_members && (
                      <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-[9999]">
                        {teamMembersData.team_members.map((member: any) => (
                          <button
                            key={member.id}
                            onClick={() => {
                              console.log('🔍 Team member selected:', member.first_name, member.last_name, 'ID:', member.id);
                              setSelectedMemberId(member.id);
                              setManagerView('member'); // Automatically set view to member when selecting a team member
                              setShowMemberDropdown(false);
                              console.log('🔍 States updated - selectedMemberId:', member.id, 'managerView: member');
                            }}
                            className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-red-100 border-b border-gray-100 last:border-b-0 flex items-center cursor-pointer"
                            onMouseEnter={() => console.log('🔍 Mouse entered:', member.first_name)}
                            onMouseLeave={() => console.log('🔍 Mouse left:', member.first_name)}
                          >
                            <User className="w-4 h-4 mr-3 text-gray-400" />
                            <div>
                              <div className="font-medium">{member.first_name} {member.last_name}</div>
                              <div className="text-xs text-gray-500">{member.email}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                </>
              )}
            </div>

            {/* View Context Indicator */}
            <div className="flex items-center space-x-2">
              {isManager && dealsData?.view_context && (
                <span className="text-sm text-gray-500">
                  {dealsData.view_context.current_view === 'team' && 'Showing team deals'}
                  {dealsData.view_context.current_view === 'personal' && 'Showing your deals'}
                  {dealsData.view_context.current_view === 'member' && selectedMemberId && 
                    `Showing ${teamMembersData?.team_members?.find((m: any) => m.id === selectedMemberId)?.first_name}'s deals`
                  }
                  {dealsData.view_context.current_view === 'all' && 'Showing all deals (you + team)'}
                </span>
              )}
              {!isManager && (
                <span className="text-sm text-gray-500">
                  Showing {quotaPeriod} view
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Summary Bar */}
        <div className="bg-gradient-to-r from-green-700 to-green-600 rounded-2xl p-4 md:p-6 text-white shadow-xl" style={{ background: 'linear-gradient(to right, #82a365, #6b8950)' }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {/* Actual (Closed Won) */}
            <div className="text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start mb-2">
                <CheckCircle className="w-5 h-5 mr-2 text-green-200" />
                <span className="text-sm font-medium text-green-100">Actual Closed</span>
              </div>
              <div className="text-3xl font-bold text-white">
                £{closedAmount.toLocaleString()}
              </div>
              <div className="text-sm text-green-100">
                Commission: £{dealsByCategory.closed.reduce((sum: number, deal: Deal) => sum + getDealCommission(deal, commissionRate), 0).toLocaleString()}
              </div>
            </div>

            {/* Projected (Commit + Best Case) */}
            <div className="text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start mb-2">
                <TrendingUp className="w-5 h-5 mr-2 text-yellow-200" />
                <span className="text-sm font-medium text-green-100">Projected</span>
              </div>
              <div className="text-3xl font-bold text-white">
                £{(commitAmount + bestCaseAmount).toLocaleString()}
              </div>
              <div className="text-sm text-green-100">
                Commission: £{[...dealsByCategory.commit, ...dealsByCategory.best_case].reduce((sum: number, deal: Deal) => sum + getDealCommission(deal, commissionRate), 0).toLocaleString()}
              </div>
            </div>

            {/* Quota Target */}
            <div className="text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start mb-2">
                <Target className="w-5 h-5 mr-2 text-blue-200" />
                <span className="text-sm font-medium text-green-100">
                  {quotaPeriod.charAt(0).toUpperCase() + quotaPeriod.slice(1)} Quota
                </span>
              </div>
              <div className="text-3xl font-bold text-white">
                £{quotaTarget.toLocaleString()}
              </div>
              <div className="text-sm text-green-100">
                Attainment: {((closedAmount / quotaTarget) * 100).toFixed(0)}%
              </div>
            </div>

            {/* Days Remaining */}
            <div className="text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start mb-2">
                <Timer className="w-5 h-5 mr-2 text-orange-200" />
                <span className="text-sm font-medium text-green-100">Days Remaining</span>
              </div>
              <div className="text-3xl font-bold text-white">
                {getDaysRemainingInQuarter()}
              </div>
              <div className="text-sm text-green-100">days in quarter</div>
            </div>
          </div>
        </div>


        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search deals..."
                value={filters.search}
                onChange={(e) => setFilters({...filters, search: e.target.value})}
                className="pl-10 pr-4 py-2 w-full bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent\n                style={{ '--tw-ring-color': '#82a365' } as React.CSSProperties}"
              />
            </div>
            
            <select
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
              className="py-2 px-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent\n                style={{ '--tw-ring-color': '#82a365' } as React.CSSProperties}"
            >
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="closed_won">Closed Won</option>
              <option value="closed_lost">Closed Lost</option>
            </select>
            
            <input
              type="date"
              value={filters.from_date}
              onChange={(e) => setFilters({...filters, from_date: e.target.value})}
              className="py-2 px-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent\n                style={{ '--tw-ring-color': '#82a365' } as React.CSSProperties}"
            />
            
            <input
              type="date"
              value={filters.to_date}
              onChange={(e) => setFilters({...filters, to_date: e.target.value})}
              className="py-2 px-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent\n                style={{ '--tw-ring-color': '#82a365' } as React.CSSProperties}"
            />
          </div>
        </div>

        {/* Main Content */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-transparent mx-auto" style={{ borderColor: '#82a365' }}></div>
              <p className="mt-4 text-gray-600">Loading deals...</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            {/* Pipeline Deals */}
            <div className="lg:col-span-1">
              <DealsSection
                title="Pipeline"
                icon={Package}
                deals={allDealsByCategory.pipeline}
                bgColor="bg-gray-100"
                borderColor="border-gray-300"
                iconColor="text-gray-500"
                textColor="text-gray-700"
                category="pipeline"
                description="CRM synced opportunities"
                tooltipContent={[
                  "CRM-synced opportunities",
                  "Starting point for all deals"
                ]}
              />
            </div>

            {/* Commit Bucket */}
            <div className="lg:col-span-1">
              <DealsSection
                title="Commit"
                icon={Star}
                deals={allDealsByCategory.commit}
                bgColor="bg-amber-100"
                borderColor="border-amber-300"
                iconColor="text-amber-600"
                textColor="text-amber-800"
                category="commit"
                description="High confidence deals"
                tooltipContent={[
                  "High confidence deals",
                  "Drag likely closes here"
                ]}
              />
            </div>

            {/* Best Case Bucket */}
            <div className="lg:col-span-1">
              <DealsSection
                title="Best Case"
                icon={TrendingUp}
                deals={allDealsByCategory.best_case}
                bgColor="bg-purple-100"
                borderColor="border-purple-300"
                iconColor="text-purple-600"
                textColor="text-purple-800"
                category="best_case"
                description="Potential upside opportunities"
                tooltipContent={[
                  "Potential upside opportunities",
                  "Optimistic forecast scenarios"
                ]}
              />
            </div>

            {/* Quota Progress */}
            <div className="md:col-span-2 lg:col-span-1">
              <QuotaProgress />
            </div>
          </div>
        )}

        {/* Team Performance Breakdown (for team/all views) */}
        {isManager && dealsData?.team_summary && (managerView === 'team' || managerView === 'all') && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Users className="w-5 h-5 mr-2 text-blue-600" />
                Team Performance Breakdown
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Individual performance of team members in current view
              </p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {dealsData.team_summary.map((memberStats: any) => (
                  <div key={memberStats.user_id} className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                    <div className="flex items-center mb-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="ml-3">
                        <div className="font-medium text-gray-900">{memberStats.name}</div>
                        <div className="text-xs text-gray-500">{memberStats.email}</div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Total Deals:</span>
                        <span className="font-medium">{memberStats.deal_count}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Total Value:</span>
                        <span className="font-medium text-green-600">£{memberStats.total_amount.toLocaleString()}</span>
                      </div>
                      
                      {/* Category breakdown */}
                      <div className="mt-3 pt-2 border-t border-gray-200">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Commit:</span>
                            <span className="text-blue-600 font-medium">{memberStats.categories.commit}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Best Case:</span>
                            <span className="text-orange-600 font-medium">{memberStats.categories.best_case}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Closed:</span>
                            <span className="text-green-600 font-medium">{memberStats.categories.closed_won}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Pipeline:</span>
                            <span className="text-gray-600 font-medium">{memberStats.categories.uncategorized}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}


      </div>

      {/* Manager Deal Categorization Confirmation Dialog */}
      {showConfirmationDialog && pendingCategorization && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                Categorize Team Member's Deal
              </h3>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-700 mb-3">
                You're about to categorize a deal that belongs to{' '}
                <span className="font-semibold text-blue-600">
                  {pendingCategorization.deal.user?.first_name} {pendingCategorization.deal.user?.last_name}
                </span>
              </p>
              
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h4 className="font-medium text-gray-900 mb-2">Deal Details:</h4>
                <p className="text-sm text-gray-700">
                  <strong>{pendingCategorization.deal.deal_name}</strong> - {pendingCategorization.deal.account_name}
                </p>
                <p className="text-sm text-gray-600">
                  £{Number(pendingCategorization.deal.amount).toLocaleString()}
                </p>
              </div>
              
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Action:</strong> Moving from{' '}
                  <span className="capitalize font-medium">
                    {pendingCategorization.previousCategory.replace('_', ' ')}
                  </span>{' '}
                  to{' '}
                  <span className="capitalize font-medium">
                    {pendingCategorization.category.replace('_', ' ')}
                  </span>
                </p>
              </div>
              
              <p className="text-sm text-gray-600 mt-3">
                This action will be logged for future notification features.
              </p>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={handleCancelCategorization}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmCategorization}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                disabled={updateDealCategoryMutation.isPending}
              >
                {updateDealCategoryMutation.isPending ? 'Updating...' : 'Confirm & Categorize'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default DealsPage;