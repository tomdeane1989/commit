import { useState, useEffect } from 'react';
import Layout from '../components/layout';
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
  AlertCircle
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

const CommissionsPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedPeriod, setSelectedPeriod] = useState('current');
  const [expandedCommission, setExpandedCommission] = useState<string | null>(null);

  // Fetch commissions data with historical analysis
  const { data: commissionsResponse, isLoading, error } = useQuery({
    queryKey: ['commissions', user?.id], // User-specific cache key to prevent cross-user data leakage
    queryFn: async () => {
      const response = await api.get('/commissions?include_historical=true');
      return response.data;
    },
    enabled: !!user
  });

  const commissions = Array.isArray(commissionsResponse) 
    ? commissionsResponse 
    : commissionsResponse?.commissions || [];
  const paymentScheduleFromAPI = commissionsResponse?.payment_schedule;
  const missingPeriods = commissionsResponse?.missing_periods || [];

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

  // Calculate commission for current period
  const calculateCurrentPeriodMutation = useMutation({
    mutationFn: async (period: { start: string; end: string }) => {
      return await commissionsApi.calculateCommissions({
        period_start: period.start,
        period_end: period.end
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commissions', user?.id] });
    }
  });

  // Get current payment schedule (prefer API response, fallback to targets)
  const paymentSchedule = paymentScheduleFromAPI || 
    targets?.find((t: any) => t.is_active)?.commission_payment_schedule || 
    'monthly';
  
  // Calculate current period based on payment schedule
  const getCurrentPeriod = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-based
    
    if (paymentSchedule === 'quarterly') {
      // Determine current quarter
      const currentQuarter = Math.floor(currentMonth / 3);
      const quarterStartMonth = currentQuarter * 3;
      
      return {
        start: new Date(currentYear, quarterStartMonth, 1).toISOString().split('T')[0],
        end: new Date(currentYear, quarterStartMonth + 3, 0).toISOString().split('T')[0],
        label: `Q${currentQuarter + 1} ${currentYear}`
      };
    } else {
      // Monthly
      return {
        start: new Date(currentYear, currentMonth, 1).toISOString().split('T')[0],
        end: new Date(currentYear, currentMonth + 1, 0).toISOString().split('T')[0],
        label: new Date(currentYear, currentMonth, 1).toLocaleDateString('en-GB', { 
          month: 'long', 
          year: 'numeric' 
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
        const quarterDate = new Date(now.getFullYear(), now.getMonth() - (i * 3), 1);
        const year = quarterDate.getFullYear();
        const quarter = Math.floor(quarterDate.getMonth() / 3);
        const quarterStartMonth = quarter * 3;
        
        periods.push({
          start: new Date(year, quarterStartMonth, 1).toISOString().split('T')[0],
          end: new Date(year, quarterStartMonth + 3, 0).toISOString().split('T')[0],
          label: `Q${quarter + 1} ${year}`,
          period: `${year}-Q${quarter + 1}`
        });
      }
    } else {
      // Last 12 months
      for (let i = 0; i < 12; i++) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = monthDate.getFullYear();
        const month = monthDate.getMonth();
        
        periods.push({
          start: new Date(year, month, 1).toISOString().split('T')[0],
          end: new Date(year, month + 1, 0).toISOString().split('T')[0],
          label: monthDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
          period: `${year}-${String(month + 1).padStart(2, '0')}`
        });
      }
    }
    
    return periods;
  };

  const currentPeriod = getCurrentPeriod();
  const historicalPeriods = getHistoricalPeriods();
  
  // Find current period commission
  const currentCommission = commissions?.find(c => {
    const commissionStart = new Date(c.period_start).toISOString().split('T')[0];
    return commissionStart === currentPeriod.start;
  });

  // Filter historical commissions
  const historicalCommissions = commissions?.filter(c => {
    const commissionStart = new Date(c.period_start).toISOString().split('T')[0];
    return commissionStart !== currentPeriod.start;
  }) || [];

  // Calculate totals
  const totalEarned = commissions?.reduce((sum, c) => sum + Number(c.commission_earned), 0) || 0;
  const averageAttainment = commissions?.length ? 
    commissions.reduce((sum, c) => sum + Number(c.attainment_pct), 0) / commissions.length : 0;

  const handleCalculateCurrentPeriod = () => {
    calculateCurrentPeriodMutation.mutate({
      start: currentPeriod.start,
      end: currentPeriod.end
    });
  };

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
            <h1 className="text-3xl font-bold text-gray-900">Commission Overview</h1>
            <p className="text-gray-600 mt-1">
              Track your earnings and performance across {paymentSchedule} payment periods
            </p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={handleCalculateCurrentPeriod}
              disabled={calculateCurrentPeriodMutation.isPending}
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              {calculateCurrentPeriodMutation.isPending ? 'Calculating...' : 'Calculate Current Period'}
            </button>
          </div>
        </div>

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
              Current Period - {currentPeriod.label}
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
                    View Deal Breakdown ({currentCommission.commission_details.length} deals)
                  </button>
                  
                  {expandedCommission === currentCommission.id && (
                    <div className="mt-4 bg-gray-50 rounded-lg p-4">
                      <div className="space-y-3">
                        {currentCommission.commission_details.map((detail) => (
                          <div key={detail.id} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-b-0">
                            <div>
                              <p className="font-medium text-gray-900">{detail.deal.account_name}</p>
                              <p className="text-sm text-gray-600">{detail.deal.deal_name}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium text-gray-900">
                                £{Number(detail.commission_amount).toLocaleString()}
                              </p>
                              <p className="text-sm text-gray-600">
                                {new Date(detail.deal.close_date).toLocaleDateString('en-GB')}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No commission calculated for current period</p>
                <button
                  onClick={handleCalculateCurrentPeriod}
                  disabled={calculateCurrentPeriodMutation.isPending}
                  className="mt-4 inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Calculate Now
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Historical Commissions */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Historical Commissions
              <span className="text-sm font-normal text-gray-600 ml-2">
                (Last {paymentSchedule === 'quarterly' ? '4 quarters' : '12 months'})
              </span>
            </h3>
          </div>
          <div className="p-6">
            {historicalCommissions.length > 0 ? (
              <div className="space-y-4">
                {historicalCommissions.map((commission) => {
                  const periodLabel = new Date(commission.period_start).toLocaleDateString('en-GB', {
                    month: 'long',
                    year: 'numeric'
                  });
                  
                  return (
                    <div key={commission.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900">{periodLabel}</h4>
                          <p className="text-sm text-gray-600">
                            £{Number(commission.actual_amount).toLocaleString()} of £{Number(commission.quota_amount).toLocaleString()} quota
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-green-600">
                            £{Number(commission.commission_earned).toLocaleString()}
                          </p>
                          <p className="text-sm text-gray-600">
                            {Number(commission.attainment_pct).toFixed(1)}% attainment
                          </p>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => setExpandedCommission(
                          expandedCommission === commission.id ? null : commission.id
                        )}
                        className="mt-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        {expandedCommission === commission.id ? 'Hide' : 'Show'} Details
                      </button>
                      
                      {expandedCommission === commission.id && (
                        <div className="mt-4 bg-gray-50 rounded-lg p-4">
                          <div className="space-y-2">
                            {commission.commission_details.map((detail) => (
                              <div key={detail.id} className="flex justify-between items-center py-1">
                                <span className="text-sm text-gray-700">{detail.deal.account_name}</span>
                                <span className="text-sm font-medium">
                                  £{Number(detail.commission_amount).toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No historical commission data available</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default CommissionsPage;