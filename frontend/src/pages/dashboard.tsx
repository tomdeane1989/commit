import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import Layout from '../components/layout';
import ProtectedRoute from '../components/ProtectedRoute';
import { useAuth } from '../hooks/useAuth';
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
  const isManager = user?.role === 'manager';

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
        {/* Build Version Indicator */}
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-2 rounded">
          ✅ NEW BUILD v0.2.0 - Team Filtering Features Active - If you see this, the latest code deployed!
        </div>
        
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
                  onClick={() => setManagerView('all')}
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
          <div className="relative overflow-hidden rounded-3xl p-6 text-white shadow-2xl" style={{ background: 'linear-gradient(to bottom right, #82a365, #6b8950)', boxShadow: '0 25px 50px -12px rgba(56, 64, 49, 0.25)' }}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
            <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/10 rounded-full -ml-10 -mb-10"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-white/20 rounded-2xl">
                  <Target className="w-6 h-6 text-white" />
                </div>
                <div className="flex items-center text-sm font-medium">
                  <ArrowUp className="w-4 h-4 mr-1" />
                  +2.5%
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-white/80 mb-1">Quota Attainment</p>
                <p className="text-4xl font-bold text-white">
                  {metrics?.quota_attainment?.toFixed(1) || 0}%
                </p>
              </div>
            </div>
          </div>

          {/* Closed Amount */}
          <div className="relative overflow-hidden bg-gradient-to-br from-green-500 to-emerald-600 rounded-3xl p-6 text-white shadow-2xl shadow-green-500/25">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
            <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/10 rounded-full -ml-10 -mb-10"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-white/20 rounded-2xl">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
                <div className="flex items-center text-sm font-medium">
                  <ArrowUp className="w-4 h-4 mr-1" />
                  +12.3%
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-white/80 mb-1">Closed Amount</p>
                <p className="text-4xl font-bold text-white">
                  £{metrics?.closed_amount?.toLocaleString() || 0}
                </p>
              </div>
            </div>
          </div>

          {/* Commission Earned */}
          <div className="relative overflow-hidden rounded-3xl p-6 text-white shadow-2xl" style={{ background: 'linear-gradient(to bottom right, #6b8950, #5a6450)', boxShadow: '0 25px 50px -12px rgba(74, 82, 64, 0.25)' }}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
            <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/10 rounded-full -ml-10 -mb-10"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-white/20 rounded-2xl">
                  <Award className="w-6 h-6 text-white" />
                </div>
                <div className="flex items-center text-sm font-medium">
                  <ArrowUp className="w-4 h-4 mr-1" />
                  +8.7%
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-white/80 mb-1">Commission Earned</p>
                <p className="text-4xl font-bold text-white">
                  £{metrics?.commission_earned?.toLocaleString() || 0}
                </p>
              </div>
            </div>
          </div>

          {/* Projected Commission */}
          <div className="relative overflow-hidden bg-gradient-to-br from-orange-500 to-red-600 rounded-3xl p-6 text-white shadow-2xl shadow-orange-500/25">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
            <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/10 rounded-full -ml-10 -mb-10"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-white/20 rounded-2xl">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div className="flex items-center text-sm font-medium">
                  <TrendingDown className="w-4 h-4 mr-1" />
                  -1.2%
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-white/80 mb-1">Projected Commission</p>
                <p className="text-4xl font-bold text-white">
                  £{metrics?.projected_commission?.toLocaleString() || 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Quota Progress */}
          <div className="lg:col-span-2">
            <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-gray-200/50">
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
                  <div className="flex justify-between items-center p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl border border-green-200">
                    <div className="flex items-center">
                      <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
                      <span className="font-semibold text-green-800">Closed</span>
                    </div>
                    <span className="font-bold text-green-900">
                      £{quota_progress?.closed_amount?.toLocaleString() || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl border border-orange-200">
                    <div className="flex items-center">
                      <Star className="w-5 h-5 text-orange-600 mr-3" />
                      <span className="font-semibold text-orange-800">Commit</span>
                    </div>
                    <span className="font-bold text-orange-900">
                      £{quota_progress?.commit_amount?.toLocaleString() || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl border border-purple-200">
                    <div className="flex items-center">
                      <Zap className="w-5 h-5 text-purple-600 mr-3" />
                      <span className="font-semibold text-purple-800">Best Case</span>
                    </div>
                    <span className="font-bold text-purple-900">
                      £{quota_progress?.best_case_amount?.toLocaleString() || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-gradient-to-r from-gray-50 to-slate-50 rounded-2xl border border-gray-300">
                    <div className="flex items-center">
                      <Target className="w-5 h-5 text-gray-600 mr-3" />
                      <span className="font-semibold text-gray-800">Total Quota</span>
                    </div>
                    <span className="font-bold text-gray-900">
                      £{quota_progress?.total_quota?.toLocaleString() || 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Deal Pipeline */}
          <div className="lg:col-span-3">
            <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-gray-200/50">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold text-gray-900">Deal Pipeline</h3>
                <div className="flex items-center space-x-2">
                  <Users className="w-5 h-5 text-gray-600" />
                  <span className="text-sm font-medium text-gray-600">
                    {(deals?.closed?.length || 0) + (deals?.commit?.length || 0) + (deals?.best_case?.length || 0) + (deals?.pipeline?.length || 0)} total deals
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                {/* Closed Deals */}
                <div className="relative overflow-hidden bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-3xl p-6 border border-green-200">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-green-500/10 rounded-full -mr-10 -mt-10"></div>
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-3 bg-green-500/20 rounded-2xl">
                        <CheckCircle className="w-6 h-6 text-green-600" />
                      </div>
                      <span className="bg-green-500 text-white text-sm font-bold px-3 py-1 rounded-full">
                        {deals?.closed?.length || 0}
                      </span>
                    </div>
                    <h4 className="text-lg font-bold text-green-800 mb-2">Closed</h4>
                    <p className="text-sm text-green-700">
                      {deals?.closed?.length ? 'Deals won this period' : 'No closed deals yet'}
                    </p>
                  </div>
                </div>

                {/* Commit Deals */}
                <div className="relative overflow-hidden bg-gradient-to-br from-orange-500/10 to-amber-500/10 rounded-3xl p-6 border border-orange-200">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-orange-500/10 rounded-full -mr-10 -mt-10"></div>
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-3 bg-orange-500/20 rounded-2xl">
                        <Star className="w-6 h-6 text-orange-600" />
                      </div>
                      <span className="bg-orange-500 text-white text-sm font-bold px-3 py-1 rounded-full">
                        {deals?.commit?.length || 0}
                      </span>
                    </div>
                    <h4 className="text-lg font-bold text-orange-800 mb-2">Commit</h4>
                    <p className="text-sm text-orange-700">
                      {deals?.commit?.length ? 'High confidence deals' : 'No commit deals'}
                    </p>
                  </div>
                </div>

                {/* Best Case Deals */}
                <div className="relative overflow-hidden rounded-3xl p-6 border" style={{ background: 'linear-gradient(to bottom right, rgba(56, 64, 49, 0.1), rgba(74, 82, 64, 0.1))', borderColor: 'rgba(56, 64, 49, 0.2)' }}>
                  <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/10 rounded-full -mr-10 -mt-10"></div>
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-3 bg-purple-500/20 rounded-2xl">
                        <Zap className="w-6 h-6 text-purple-600" />
                      </div>
                      <span className="bg-purple-500 text-white text-sm font-bold px-3 py-1 rounded-full">
                        {deals?.best_case?.length || 0}
                      </span>
                    </div>
                    <h4 className="text-lg font-bold text-purple-800 mb-2">Best Case</h4>
                    <p className="text-sm text-purple-700">
                      {deals?.best_case?.length ? 'Potential upside opportunities' : 'No best case deals'}
                    </p>
                  </div>
                </div>

                {/* Pipeline Deals */}
                <div className="relative overflow-hidden bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-3xl p-6 border border-blue-200">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full -mr-10 -mt-10"></div>
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-3 bg-blue-500/20 rounded-2xl">
                        <Clock className="w-6 h-6" style={{ color: '#82a365' }} />
                      </div>
                      <span className="bg-blue-500 text-white text-sm font-bold px-3 py-1 rounded-full">
                        {deals?.pipeline?.length || 0}
                      </span>
                    </div>
                    <h4 className="text-lg font-bold text-blue-800 mb-2">Pipeline</h4>
                    <p className="text-sm text-blue-700">
                      {deals?.pipeline?.length ? 'Active opportunities' : 'No pipeline deals'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Deal Intelligence Metrics */}
        {deal_analytics && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Commit Analytics */}
            <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-6 shadow-xl border border-gray-200/50">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className="p-3 bg-orange-500/20 rounded-2xl mr-3">
                    <Star className="w-6 h-6 text-orange-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Commit Analytics</h3>
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
            <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-6 shadow-xl border border-gray-200/50">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className="p-3 bg-purple-500/20 rounded-2xl mr-3">
                    <Zap className="w-6 h-6 text-purple-600" />
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
            <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-6 shadow-xl border border-gray-200/50">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className="p-3 bg-red-500/20 rounded-2xl mr-3">
                    <AlertTriangle className="w-6 h-6 text-red-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Sandbagging</h3>
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
          <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-gray-200/50">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Recent Deal Activity</h3>
              <div className="flex items-center space-x-2">
                <Activity className="w-5 h-5 text-gray-600" />
                <span className="text-sm font-medium text-gray-600">Last 10 movements</span>
              </div>
            </div>
            
            <div className="space-y-3">
              {recent_movements.map((movement, index) => (
                <div key={movement.id} className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-white rounded-2xl border border-gray-100">
                  <div className="flex items-center space-x-4">
                    <div className={`p-2 rounded-xl ${
                      movement.category === 'commit' ? 'bg-orange-100 text-orange-600' :
                      movement.category === 'best_case' ? 'bg-purple-100 text-purple-600' :
                      'bg-blue-100 text-blue-600'
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
                      £{movement.deal_amount?.toLocaleString()}
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

        {/* Welcome Message */}
        <div className="relative overflow-hidden rounded-3xl p-8 text-white shadow-2xl" style={{ background: 'linear-gradient(to right, #82a365, #6b8950, #5a6450)' }}>
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full -ml-16 -mb-16"></div>
          <div className="relative z-10">
            <div className="flex items-center mb-4">
              <div className="p-3 bg-white/20 rounded-2xl mr-4">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white">Welcome to your Sales Dashboard!</h3>
            </div>
            <p className="text-white/90 text-lg leading-relaxed">
              This is your central hub for tracking sales performance and managing your commission pipeline. 
              Set up your targets and start adding deals to see your progress in real-time.
            </p>
          </div>
        </div>
      </div>
    </Layout>
    </ProtectedRoute>
  );
};

export default DashboardPage;