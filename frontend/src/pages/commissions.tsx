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
  CheckCircle,
  Clock,
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
  id: string;
  period_start: string;
  period_end: string;
  quota_amount: number;
  actual_amount: number;
  attainment_pct: number;
  commission_rate: number;
  commission_earned: number;
  base_commission: number;
  status: string;
  calculated_at: string;
  approved_at?: string;
  user: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  target: {
    commission_payment_schedule: string;
  };
  commission_details: Array<{
    id: string;
    commission_amount: number;
    deal: {
      id: string;
      deal_name: string;
      account_name: string;
      amount: number;
      close_date: string;
    };
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
  const isManager = user?.role === 'manager';

  // Fetch commissions data with manager filtering support
  const { data: commissionsResponse, isLoading, error } = useQuery({
    queryKey: ['commissions', user?.id, managerView, selectedMemberId],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('include_historical', 'true');
      
      if (isManager && managerView) {
        params.append('view', managerView);
        if (managerView === 'member' && selectedMemberId) {
          params.append('user_id', selectedMemberId);
        }
      }
      
      console.log('🔍 Fetching commissions with params:', params.toString());
      const response = await api.get(`/commissions?${params}`);
      console.log('🔍 Commissions response:', response.data);
      return response.data;
    },
    enabled: !!user,
    staleTime: 0 // Always refetch when query key changes
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

  // Auto-calculate commissions for team members when viewing team data
  const calculateTeamCommissionsMutation = useMutation({
    mutationFn: async (teamMemberIds: string[]) => {
      const results = [];
      for (const memberId of teamMemberIds) {
        try {
          // Use direct API call since commissionsApi.calculateCommissions doesn't support user_id
          const result = await api.post('/commissions/calculate', {
            user_id: memberId,
            period_start: currentPeriod.start,
            period_end: currentPeriod.end
          });
          results.push({ success: true, memberId, result: result.data });
        } catch (error) {
          console.log(`⚠️ Failed to calculate commission for team member ${memberId}:`, error);
          results.push({ success: false, memberId, error });
        }
      }
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
    },
    throwOnError: false
  });

  const commissions = Array.isArray(commissionsResponse) 
    ? commissionsResponse 
    : commissionsResponse?.commissions || [];
  const paymentScheduleFromAPI = commissionsResponse?.payment_schedule;
  const missingPeriods = commissionsResponse?.missing_periods || [];
  const teamSummary: TeamSummary[] = commissionsResponse?.team_summary || [];
  const viewContext = commissionsResponse?.view_context;
  const teamMembers: TeamMember[] = teamMembersResponse?.team_members || [];

  // Auto-trigger team commission calculations when viewing team/all and no commissions exist
  useEffect(() => {
    console.log('🔍 Team calculation check:', {
      isManager,
      managerView,
      teamMembersLength: teamMembers.length,
      commissionsLength: commissions.length,
      isPending: calculateTeamCommissionsMutation.isPending
    });
    
    if (isManager && (managerView === 'team' || managerView === 'all') && 
        teamMembers.length > 0 && commissions.length === 0 && 
        !calculateTeamCommissionsMutation.isPending) {
      
      console.log('🎯 Auto-calculating team commission data for team members:', teamMembers.map(m => m.email));
      const teamMemberIds = teamMembers.map(member => member.id);
      calculateTeamCommissionsMutation.mutate(teamMemberIds);
    }
  }, [isManager, managerView, teamMembers, commissions, calculateTeamCommissionsMutation.isPending]);

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

  // Auto-calculate commission for current period on page load
  const calculateCurrentPeriodMutation = useMutation({
    mutationFn: async (period: { start: string; end: string }) => {
      return await commissionsApi.calculateCommissions({
        period_start: period.start,
        period_end: period.end
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
    },
    onError: (error: any) => {
      // Handle the specific case where no target is found
      if (error?.response?.status === 400 && 
          error?.response?.data?.error === 'No active target found for this period') {
        console.log('📅 No active target found for current period - user needs to set up targets');
      } else {
        console.error('Commission calculation error:', error?.message || error);
      }
    },
    // CRITICAL: Prevent React Query from throwing this error to error boundaries
    throwOnError: false
  });

  // Auto-trigger calculation on page load for personal and individual member views
  useEffect(() => {
    const shouldAutoCalculate = user && !calculateCurrentPeriodMutation.isPending && 
      ((!isManager) || (isManager && managerView === 'personal'));
    
    if (shouldAutoCalculate && !calculateCurrentPeriodMutation.isSuccess) {
      console.log('🎯 Auto-calculating current period commission on page load');
      calculateCurrentPeriodMutation.mutate({
        start: currentPeriod.start,
        end: currentPeriod.end
      });
    }
  }, [user, isManager, managerView]); // Depend on managerView for managers

  // Auto-trigger calculation for specific team member when viewing member view
  useEffect(() => {
    if (isManager && managerView === 'member' && selectedMemberId && 
        commissions.length === 0 && !calculateCurrentPeriodMutation.isPending) {
      
      console.log('🎯 Auto-calculating commission for selected team member:', selectedMemberId);
      // Use direct API call for specific team member
      api.post('/commissions/calculate', {
        user_id: selectedMemberId,
        period_start: currentPeriod.start,
        period_end: currentPeriod.end
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ['commissions'] });
      }).catch(error => {
        console.log(`⚠️ Failed to calculate commission for member ${selectedMemberId}:`, error);
      });
    }
  }, [isManager, managerView, selectedMemberId, commissions.length]);

  // Mutation for calculating historical commissions
  const calculateHistoricalCommissionsMutation = useMutation({
    mutationFn: async (periods: Array<{ period_start: string; period_end: string }>) => {
      const results = [];
      for (const period of periods) {
        try {
          // For individual member view, calculate for that specific member
          const requestData = {
            period_start: period.period_start,
            period_end: period.period_end,
            ...(managerView === 'member' && selectedMemberId && { user_id: selectedMemberId })
          };
          
          console.log('🔄 Calculating historical commission with data:', requestData);
          const result = await api.post('/commissions/calculate', requestData);
          results.push({ success: true, period, result: result.data });
        } catch (error) {
          console.log('⚠️ Historical commission calculation failed:', error);
          results.push({ success: false, period, error });
        }
      }
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
    },
    throwOnError: false
  });

  // Get current payment schedule (prefer API response, fallback to targets)
  const paymentSchedule = paymentScheduleFromAPI || 
    targets?.find((t: any) => t.is_active)?.commission_payment_schedule || 
    'monthly';

  // Auto-calculate historical commissions when missing periods are available
  const [hasAutoCalculated, setHasAutoCalculated] = useState(false);
  
  // Reset auto-calculation flag when view or selected member changes
  useEffect(() => {
    setHasAutoCalculated(false);
  }, [managerView, selectedMemberId]);
  
  useEffect(() => {
    if (
      missingPeriods && 
      missingPeriods.length > 0 && 
      !hasAutoCalculated &&
      !calculateHistoricalCommissionsMutation.isPending
    ) {
      // Filter periods that can be calculated (have targets)
      const calculablePeriods = missingPeriods.filter((period: any) => 
        period.can_calculate && !period.missing_target
      );
      
      if (calculablePeriods.length > 0) {
        console.log(`🔄 Auto-calculating ${calculablePeriods.length} historical commission periods for view: ${managerView}${selectedMemberId ? ` (member: ${selectedMemberId})` : ''}`);
        console.log('🔄 Calculable periods:', calculablePeriods);
        setHasAutoCalculated(true);
        calculateHistoricalCommissionsMutation.mutate(
          calculablePeriods.map((p: any) => ({
            period_start: p.period_start,
            period_end: p.period_end
          }))
        );
      }
    }
  }, [missingPeriods, hasAutoCalculated, calculateHistoricalCommissionsMutation.isPending, managerView, selectedMemberId]);
  
  // Calculate current period based on payment schedule
  const getCurrentPeriod = () => {
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth(); // 0-based
    
    if (paymentSchedule === 'quarterly') {
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
    
    if (paymentSchedule === 'quarterly') {
      // Last 4 quarters
      for (let i = 0; i < 4; i++) {
        const currentYear = now.getUTCFullYear();
        const currentMonth = now.getUTCMonth();
        
        let targetYear = currentYear;
        let targetMonth = currentMonth - (i * 3);
        
        while (targetMonth < 0) {
          targetMonth += 12;
          targetYear -= 1;
        }
        
        const quarter = Math.floor(targetMonth / 3);
        const quarterStartMonth = quarter * 3;
        
        periods.push({
          start: new Date(Date.UTC(targetYear, quarterStartMonth, 1)).toISOString().split('T')[0],
          end: new Date(Date.UTC(targetYear, quarterStartMonth + 3, 0, 23, 59, 59, 999)).toISOString().split('T')[0],
          label: `Q${quarter + 1} ${targetYear}`,
          period: `${targetYear}-Q${quarter + 1}`
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
  
  // Calculate current period commission based on view
  const getCurrentPeriodCommission = () => {
    const currentPeriodCommissions = commissions?.filter(c => {
      const commissionStart = new Date(c.period_start).toISOString().split('T')[0];
      return commissionStart === currentPeriod.start;
    }) || [];

    if (currentPeriodCommissions.length === 0) return null;

    // For team view, aggregate all team members' commissions
    if (isManager && (managerView === 'team' || managerView === 'all')) {
      // Aggregate commission details from all team members
      const allCommissionDetails = currentPeriodCommissions.reduce((details, c) => {
        if (c.commission_details && Array.isArray(c.commission_details)) {
          return [...details, ...c.commission_details];
        }
        return details;
      }, [] as any[]);

      return {
        id: 'team-aggregated', // Synthetic ID for team view
        commission_earned: currentPeriodCommissions.reduce((sum, c) => sum + Number(c.commission_earned), 0),
        quota_amount: currentPeriodCommissions.reduce((sum, c) => sum + Number(c.quota_amount), 0),
        actual_amount: currentPeriodCommissions.reduce((sum, c) => sum + Number(c.actual_amount), 0),
        attainment_pct: currentPeriodCommissions.length > 0 ? 
          currentPeriodCommissions.reduce((sum, c) => sum + Number(c.attainment_pct), 0) / currentPeriodCommissions.length : 0,
        period_start: currentPeriodCommissions[0].period_start,
        period_end: currentPeriodCommissions[0].period_end,
        status: 'calculated', // Default status for aggregated data
        calculated_at: new Date().toISOString(),
        commission_details: allCommissionDetails
      };
    }

    // For individual view, return single commission
    return currentPeriodCommissions[0];
  };

  const currentCommission = getCurrentPeriodCommission();

  // Filter historical commissions
  const historicalCommissions = commissions?.filter(c => {
    const commissionStart = new Date(c.period_start).toISOString().split('T')[0];
    return commissionStart !== currentPeriod.start;
  }) || [];

  // Calculate totals
  const totalEarned = commissions?.reduce((sum, c) => sum + Number(c.commission_earned), 0) || 0;
  const averageAttainment = commissions?.length ? 
    commissions.reduce((sum, c) => sum + Number(c.attainment_pct), 0) / commissions.length : 0;

  // handleCalculateCurrentPeriod removed - now auto-calculated on page load

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
        {/* Breadcrumb Navigation */}
        {isManager && (
          <nav className="flex items-center space-x-2 text-sm text-gray-600 mb-4">
            <span>Performance</span>
            <span className="text-gray-400">→</span>
            <span className="font-medium text-gray-900">
              {managerView === 'personal' && 'Personal View'}
              {managerView === 'team' && 'Team View'}
              {managerView === 'all' && 'All Team Members'}
              {managerView === 'member' && selectedMemberId && 
                `${teamMembers.find(m => m.id === selectedMemberId)?.first_name} ${teamMembers.find(m => m.id === selectedMemberId)?.last_name}`
              }
            </span>
            {managerView !== 'personal' && (
              <>
                <span className="text-gray-400">→</span>
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-medium">
                  {managerView === 'team' && `${commissions?.length || 0} Active Team Members`}
                  {managerView === 'all' && `All Team Data`}
                  {managerView === 'member' && 'Individual Member'}
                </span>
              </>
            )}
          </nav>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Performance</h1>
            <p className="text-gray-600 mt-1">
              {isManager ? `Track team performance, quota attainment, and commission earnings` : `Monitor your quota performance and commission earnings across ${paymentSchedule} payment periods`}
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
              {(!isManager || (isManager && (managerView === 'personal' || managerView === 'member'))) && calculateCurrentPeriodMutation.isPending && (
                <div className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-700 rounded-lg">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                  Calculating commission...
                </div>
              )}
              {isManager && (managerView === 'team' || managerView === 'all') && calculateTeamCommissionsMutation.isPending && (
                <div className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-700 rounded-lg">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                  Calculating team commissions...
                </div>
              )}
              {(!isManager || (isManager && (managerView === 'personal' || managerView === 'member'))) && (calculateCurrentPeriodMutation.isSuccess || calculateCurrentPeriodMutation.isError) && (
                <div className="inline-flex items-center px-4 py-2 bg-green-100 text-green-700 rounded-lg">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Auto-calculated
                </div>
              )}
              {isManager && (managerView === 'team' || managerView === 'all') && calculateTeamCommissionsMutation.isSuccess && (
                <div className="inline-flex items-center px-4 py-2 bg-green-100 text-green-700 rounded-lg">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Team commissions calculated
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Manager Filter Controls */}
        {isManager && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center justify-between">
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
              <div className="flex items-center space-x-3">
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
            </div>
            
            {/* View Context Display */}
            <div className="mt-3 text-sm text-gray-600">
              {managerView === 'personal' && 'Showing your personal commission calculations'}
              {managerView === 'team' && `Showing commission calculations for all ${teamMembers.length} direct reports`}
              {managerView === 'member' && selectedMemberId && `Showing commission calculations for ${teamMembers.find(m => m.id === selectedMemberId)?.first_name} ${teamMembers.find(m => m.id === selectedMemberId)?.last_name}`}
              {managerView === 'all' && `Showing combined commission calculations (you + ${teamMembers.length} team members)`}
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <PoundSterling className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Earned</p>
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
                <p className="text-sm font-medium text-gray-600">Avg. Attainment</p>
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
                <Award className="w-6 h-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Periods Tracked</p>
                <p className="text-2xl font-bold text-gray-900">
                  {commissions?.length || 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Current Period */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              {isManager && managerView !== 'personal' ? 'Team Current Period' : 'Current Period'} - {currentPeriod.label}
            </h3>
          </div>
          <div className="p-6">
            {currentCommission ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-600">Status</p>
                    <div className="flex items-center justify-center mt-2">
                      {currentCommission.status === 'approved' ? (
                        <div className="flex items-center text-green-600">
                          <CheckCircle className="w-5 h-5 mr-1" />
                          Approved
                        </div>
                      ) : (
                        <div className="flex items-center text-orange-600">
                          <Clock className="w-5 h-5 mr-1" />
                          Calculated
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Deal Breakdown */}
                <div className="mt-6">
                  <button
                    onClick={() => setExpandedCommission(
                      expandedCommission === currentCommission.id ? null : currentCommission.id
                    )}
                    className="flex items-center text-blue-600 hover:text-blue-700 font-medium"
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    View Deal Breakdown ({currentCommission.commission_details?.length || 0} deals)
                  </button>
                  
                  {expandedCommission === currentCommission.id && (
                    <div className="mt-4 bg-gray-50 rounded-lg p-4">
                      <div className="space-y-3">
                        {(currentCommission.commission_details || []).map((detail) => {
                          // Calculate sales cycle length - handle both close_date and closed_date
                          const createdDate = new Date(detail.deal.created_date);
                          const actualCloseDate = detail.deal.closed_date || detail.deal.close_date;
                          const closeDate = new Date(actualCloseDate);
                          
                          // Only calculate if both dates are valid
                          const salesCycleDays = (createdDate && actualCloseDate && !isNaN(createdDate.getTime()) && !isNaN(closeDate.getTime())) 
                            ? Math.ceil((closeDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24))
                            : null;

                          return (
                            <div key={detail.id} className="py-3 border-b border-gray-200 last:border-b-0">
                              {/* Deal Header */}
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <p className="font-medium text-gray-900">{detail.deal.account_name}</p>
                                  <p className="text-sm text-gray-600">{detail.deal.deal_name}</p>
                                </div>
                                <div className="text-right ml-4">
                                  <p className="font-medium text-gray-900">
                                    £{Number(detail.commission_amount).toLocaleString()}
                                  </p>
                                  <p className="text-xs text-gray-500">Commission</p>
                                </div>
                              </div>

                              {/* Deal Details Grid */}
                              <div className="grid grid-cols-3 gap-4 text-sm">
                                {/* Deal Value */}
                                <div>
                                  <span className="text-gray-500">Deal Value:</span>
                                  <div className="font-medium text-green-600">
                                    £{Number(detail.deal.amount).toLocaleString()}
                                  </div>
                                </div>

                                {/* Sales Cycle */}
                                <div>
                                  <span className="text-gray-500">Sales Cycle:</span>
                                  <div className="font-medium text-blue-600">
                                    {salesCycleDays !== null ? `${salesCycleDays} days` : 'Unknown'}
                                  </div>
                                </div>

                                {/* Deal Owner */}
                                <div>
                                  <span className="text-gray-500">Owner:</span>
                                  <div className="font-medium text-gray-700">
                                    {detail.deal.user ? 
                                      `${detail.deal.user.first_name} ${detail.deal.user.last_name}` : 
                                      'Unknown'
                                    }
                                  </div>
                                </div>
                              </div>

                              {/* Close Date */}
                              <div className="mt-2 text-xs text-gray-500">
                                Closed: {actualCloseDate ? new Date(actualCloseDate).toLocaleDateString('en-GB', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric'
                                }) : 'Unknown'}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                
                {calculateCurrentPeriodMutation.isError && 
                 (calculateCurrentPeriodMutation.error as any)?.response?.status === 400 && 
                 (calculateCurrentPeriodMutation.error as any)?.response?.data?.error === 'No active target found for this period' ? (
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
                
                {calculateCurrentPeriodMutation.isPending && (
                  <div className="mt-4 inline-flex items-center px-4 py-2 bg-blue-100 text-blue-700 rounded-lg">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                    Calculating commission...
                  </div>
                )}
                {!calculateCurrentPeriodMutation.isPending && (
                  <div className="mt-4 inline-flex items-center px-4 py-2 bg-gray-100 text-gray-600 rounded-lg">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Auto-calculation complete
                  </div>
                )}
                
                {calculateCurrentPeriodMutation.isError && !(
                  (calculateCurrentPeriodMutation.error as any)?.response?.status === 400 && 
                  (calculateCurrentPeriodMutation.error as any)?.response?.data?.error === 'No active target found for this period'
                ) && (
                  <p className="mt-3 text-sm text-red-600">
                    Error: {calculateCurrentPeriodMutation.error?.message || 'Failed to calculate commission'}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

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
              Quota Performance & Earnings
              <span className="text-sm font-normal text-gray-600 ml-2">
                (Calendar Year)
              </span>
            </h3>
          </div>
          <div className="p-6">
            <CommissionChart 
              commissions={historicalCommissions}
              isManager={isManager}
              managerView={managerView}
              isCalculating={calculateHistoricalCommissionsMutation.isPending}
              teamMembers={teamMembers}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default CommissionsPage;