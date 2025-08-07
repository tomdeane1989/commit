import { useState, useEffect } from 'react';
import Layout from '../components/layout';
import CommissionChart from '../components/CommissionChart';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import api, { commissionsApi } from '../lib/api';
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
  User,
  Users,
  ChevronDown
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
  
  // Manager view state
  const [managerView, setManagerView] = useState<'personal' | 'team' | 'member' | 'all'>('personal');
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const isManager = user?.is_manager === true || user?.is_admin === true;
  
  // Period view state - default to quarterly
  const [periodView, setPeriodView] = useState<'monthly' | 'quarterly' | 'yearly'>('quarterly');

  // Fetch commissions data with manager filtering support
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


  if (isLoading) {
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
                onClick={() => commissionsApi.exportCommissions()}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
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
    </Layout>
  );
};

export default CommissionsPage;