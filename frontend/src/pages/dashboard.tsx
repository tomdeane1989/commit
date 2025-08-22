import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import Layout from '../components/layout';
import ProtectedRoute from '../components/ProtectedRoute';
import { useAuth } from '../hooks/useAuth';
import { formatLargeCurrency } from '../utils/money';
import { 
  DollarSign, 
  TrendingUp, 
  Target, 
  Award, 
  ArrowUp, 
  ArrowDown, 
  Calendar, 
  Users,
  Activity,
  Zap,
  Clock,
  CheckCircle,
  AlertTriangle,
  Star,
  TrendingDown,
  User
} from 'lucide-react';

const MonthDisplay = () => {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  if (!mounted) {
    return <span>Loading...</span>;
  }
  
  return (
    <span>
      {new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
    </span>
  );
};

interface TeamMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
}

const DashboardPage = () => {
  const { user } = useAuth();
  const [managerView, setManagerView] = useState<'personal' | 'team' | 'member' | 'all'>('personal');
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const isManager = user?.is_manager === true || user?.is_admin === true;

  // Fetch dashboard data with team filtering
  const { data: dashboardData, isLoading, error } = useQuery({
    queryKey: ['dashboard', user?.id, managerView, selectedMemberId],
    queryFn: async () => {
      const apiModule = await import('../lib/api');
      const api = apiModule.default;
      const params = new URLSearchParams();
      
      if (isManager && managerView) {
        params.append('view', managerView);
        if (managerView === 'member' && selectedMemberId) {
          params.append('user_id', selectedMemberId);
        }
      }
      
      const queryString = params.toString();
      const endpoint = queryString ? `/dashboard/sales-rep?${queryString}` : '/dashboard/sales-rep';
      
      const response = await api.get(endpoint);
      return response.data;
    },
    enabled: !!user
  });

  // Fetch team members for dropdown
  const { data: teamMembersResponse } = useQuery({
    queryKey: ['dashboard-team-members', user?.id],
    queryFn: async () => {
      const apiModule = await import('../lib/api');
      const teamApi = apiModule.teamApi;
      const response = await teamApi.getTeam();
      return response;
    },
    enabled: isManager
  });

  const teamMembers: TeamMember[] = teamMembersResponse?.team_members || [];

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-t-transparent mx-auto" style={{ borderColor: '#82a365' }}></div>
            <p className="mt-6 text-gray-600 font-medium">Loading your dashboard...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="bg-red-50 border border-red-200 rounded-2xl p-8">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-red-800 font-semibold text-lg">Failed to load dashboard data</p>
              <p className="text-red-600 mt-2">{error?.message || 'Unknown error'}</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  const { metrics, quota_progress, deals, deal_analytics, recent_movements } = dashboardData || {};

  return (
    <ProtectedRoute>
      <Layout>
        <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700 bg-clip-text text-transparent">
              Sales Dashboard
            </h1>
            <p className="mt-2 text-gray-600 text-lg">
              Welcome back, <span className="font-semibold" style={{ color: '#82a365' }}>{user?.first_name}</span>! 
              Here's your performance overview.
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="bg-white/70 backdrop-blur-sm border border-gray-200 rounded-2xl px-6 py-3 shadow-sm">
              <div className="flex items-center text-sm font-medium text-gray-700">
                <Calendar className="w-4 h-4 mr-2" />
                <MonthDisplay />
              </div>
            </div>
            <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-2xl px-6 py-3 shadow-lg">
              <div className="flex items-center text-sm font-bold">
                <Activity className="w-4 h-4 mr-2" />
                Live Performance
              </div>
            </div>
          </div>
        </div>

        {/* Team Filtering Controls */}
        {isManager && (
          <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-6 shadow-xl border border-gray-200/50">
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
                  onClick={() => { setManagerView('all'); setSelectedMemberId(''); }}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    managerView === 'all' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Users className="w-4 h-4 inline mr-2" />
                  All
                </button>
              </div>
              
              {/* Team Member Selection */}
              <div className="flex items-center space-x-4">
                <select
                  value={selectedMemberId}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSelectedMemberId(value);
                    if (value) {
                      setManagerView('member');
                    }
                  }}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-48"
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
              {managerView === 'personal' && 'Showing your personal dashboard data'}
              {managerView === 'team' && `Showing aggregated data for all ${teamMembers.length} direct reports`}
              {managerView === 'member' && selectedMemberId && 
                `Showing dashboard data for ${teamMembers.find(m => m.id === selectedMemberId)?.first_name} ${teamMembers.find(m => m.id === selectedMemberId)?.last_name}`}
              {managerView === 'all' && `Showing combined data (you + ${teamMembers.length} team members)`}
            </div>
          </div>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Quota Attainment */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <Target className="w-5 h-5 text-indigo-600" />
              </div>
              {metrics?.quota_attainment > 0 && (
                <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                  On Track
                </span>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Quota Attainment</p>
              <p className="text-2xl font-bold text-gray-900">
                {metrics?.quota_attainment?.toFixed(1) || 0}%
              </p>
              <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(metrics?.quota_attainment || 0, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Closed Amount */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-green-50 rounded-lg">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Closed Amount</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatLargeCurrency(metrics?.closed_amount || 0)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {dashboardData?.period ? `${new Date(dashboardData.period.start).toLocaleDateString('en-GB', { month: 'short' })} - ${new Date(dashboardData.period.end).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}` : 'This Period'}
              </p>
            </div>
          </div>

          {/* Commission Earned */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-purple-50 rounded-lg">
                <Award className="w-5 h-5 text-purple-600" />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Commission Earned</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatLargeCurrency(metrics?.commission_earned || 0)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {dashboardData?.current_target && `${(dashboardData.current_target.commission_rate * 100).toFixed(1)}% rate`}
              </p>
            </div>
          </div>

          {/* Projected Commission */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-amber-50 rounded-lg">
                <TrendingUp className="w-5 h-5 text-amber-600" />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Projected Commission</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatLargeCurrency(metrics?.projected_commission || 0)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Including committed deals
              </p>
            </div>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Quota Progress */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold text-gray-900">Quota Progress</h3>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: 'linear-gradient(to right, #82a365, #6b8950)' }}></div>
                  <span className="text-2xl font-bold text-gray-900">
                    {metrics?.quota_attainment?.toFixed(0) || 0}%
                  </span>
                </div>
              </div>
              
              <div className="space-y-8">
                {/* Progress Ring */}
                <div className="relative flex items-center justify-center">
                  <div className="w-48 h-48 relative">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="none"
                        className="text-gray-200"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        stroke="url(#gradient)"
                        strokeWidth="8"
                        fill="none"
                        strokeDasharray={`${(metrics?.quota_attainment || 0) * 2.51} 251`}
                        className="transition-all duration-1000"
                      />
                      <defs>
                        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#6366f1" />
                          <stop offset="100%" stopColor="#a855f7" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-gray-900">
                          {metrics?.quota_attainment?.toFixed(0) || 0}%
                        </div>
                        <div className="text-sm text-gray-500">Complete</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Breakdown */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center">
                      <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                      <span className="text-sm font-medium text-gray-700">Closed</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">
                      {formatLargeCurrency(quota_progress?.closed_amount || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="flex items-center">
                      <Star className="w-4 h-4 text-amber-600 mr-2" />
                      <span className="text-sm font-medium text-gray-700">Commit</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">
                      {formatLargeCurrency(quota_progress?.commit_amount || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center">
                      <Zap className="w-4 h-4 text-blue-600 mr-2" />
                      <span className="text-sm font-medium text-gray-700">Best Case</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">
                      {formatLargeCurrency(quota_progress?.best_case_amount || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center">
                      <Target className="w-4 h-4 text-gray-600 mr-2" />
                      <span className="text-sm font-medium text-gray-700">Total Quota</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">
                      {formatLargeCurrency(quota_progress?.total_quota || 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Deal Pipeline */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Deal Pipeline</h3>
                <div className="flex items-center space-x-2">
                  <Users className="w-5 h-5 text-gray-600" />
                  <span className="text-sm font-medium text-gray-600">
                    {(deals?.closed?.length || 0) + (deals?.commit?.length || 0) + (deals?.best_case?.length || 0) + (deals?.pipeline?.length || 0)} total deals
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                {/* Closed Deals */}
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center">
                      <div className="p-2 bg-green-100 rounded-lg mr-3">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      </div>
                      <h4 className="text-sm font-semibold text-gray-900">Closed Won</h4>
                    </div>
                    <span className="text-lg font-bold text-green-600">
                      {deals?.closed?.length || 0}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">
                    {deals?.closed?.length ? 'Deals won this period' : 'No closed deals yet'}
                  </p>
                </div>

                {/* Commit Deals */}
                <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center">
                      <div className="p-2 bg-amber-100 rounded-lg mr-3">
                        <Star className="w-4 h-4 text-amber-600" />
                      </div>
                      <h4 className="text-sm font-semibold text-gray-900">Commit</h4>
                    </div>
                    <span className="text-lg font-bold text-amber-600">
                      {deals?.commit?.length || 0}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">
                    {deals?.commit?.length ? 'High confidence deals' : 'No commit deals'}
                  </p>
                </div>

                {/* Best Case Deals */}
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center">
                      <div className="p-2 bg-blue-100 rounded-lg mr-3">
                        <Zap className="w-4 h-4 text-blue-600" />
                      </div>
                      <h4 className="text-sm font-semibold text-gray-900">Best Case</h4>
                    </div>
                    <span className="text-lg font-bold text-blue-600">
                      {deals?.best_case?.length || 0}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">
                    {deals?.best_case?.length ? 'Potential upside' : 'No best case deals'}
                  </p>
                </div>

                {/* Pipeline Deals */}
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center">
                      <div className="p-2 bg-gray-100 rounded-lg mr-3">
                        <Clock className="w-4 h-4 text-gray-600" />
                      </div>
                      <h4 className="text-sm font-semibold text-gray-900">Pipeline</h4>
                    </div>
                    <span className="text-lg font-bold text-gray-600">
                      {deals?.pipeline?.length || 0}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">
                    {deals?.pipeline?.length ? 'Active opportunities' : 'No pipeline deals'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Deal Intelligence Metrics */}
        {deal_analytics && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Commit Analytics */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className="p-2 bg-amber-50 rounded-lg mr-3">
                    <Star className="w-5 h-5 text-amber-600" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-900">Commit Analytics</h3>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">Close Rate</span>
                  <span className="text-2xl font-bold text-orange-600">
                    {deal_analytics.commit?.close_rate?.toFixed(1) || 0}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">Avg Attempts</span>
                  <span className="text-lg font-semibold text-gray-800">
                    {deal_analytics.commit?.average_attempts?.toFixed(1) || 0}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  {deal_analytics.commit?.closed_deals || 0}/{deal_analytics.commit?.total_deals || 0} deals closed
                </div>
              </div>
            </div>

            {/* Best Case Analytics */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-50 rounded-lg mr-3">
                    <Zap className="w-5 h-5 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Best Case Analytics</h3>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">Close Rate</span>
                  <span className="text-2xl font-bold text-purple-600">
                    {deal_analytics.best_case?.close_rate?.toFixed(1) || 0}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">Avg Attempts</span>
                  <span className="text-lg font-semibold text-gray-800">
                    {deal_analytics.best_case?.average_attempts?.toFixed(1) || 0}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  {deal_analytics.best_case?.closed_deals || 0}/{deal_analytics.best_case?.total_deals || 0} deals closed
                </div>
              </div>
            </div>

            {/* Sandbagging Analytics */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className="p-2 bg-red-50 rounded-lg mr-3">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-900">Sandbagging</h3>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">Sandbagged</span>
                  <span className="text-2xl font-bold text-red-600">
                    {deal_analytics.sandbagging?.percentage?.toFixed(1) || 0}%
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  {deal_analytics.sandbagging?.sandbagged_deals || 0} deals closed without forecast
                </div>
                <div className="text-xs text-gray-400">
                  Out of {deal_analytics.sandbagging?.total_closed_deals || 0} total closed deals
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Deal Activity */}
        {recent_movements && recent_movements.length > 0 && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Recent Deal Activity</h3>
              <div className="flex items-center space-x-2">
                <Activity className="w-5 h-5 text-gray-600" />
                <span className="text-sm font-medium text-gray-600">Last 10 movements</span>
              </div>
            </div>
            
            <div className="space-y-2">
              {recent_movements.map((movement, index) => (
                <div key={movement.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center space-x-4">
                    <div className={`p-1.5 rounded-lg ${
                      movement.category === 'commit' ? 'bg-amber-100 text-amber-600' :
                      movement.category === 'best_case' ? 'bg-blue-100 text-blue-600' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {movement.category === 'commit' && <Star className="w-4 h-4" />}
                      {movement.category === 'best_case' && <Zap className="w-4 h-4" />}
                      {movement.category === 'pipeline' && <Clock className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{movement.deal_name}</p>
                      <p className="text-sm text-gray-600">
                        Moved to <span className="font-medium capitalize">{movement.category.replace('_', ' ')}</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">
                      {formatLargeCurrency(movement.deal_amount)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(movement.timestamp).toLocaleDateString('en-GB')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </Layout>
    </ProtectedRoute>
  );
};

export default DashboardPage;