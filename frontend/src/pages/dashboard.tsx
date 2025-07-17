import { useState, useEffect } from 'react';
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
  TrendingDown
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

const DashboardPage = () => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        console.log('Dashboard: User exists?', !!user);
        
        // Use the API client which includes Authorization header
        const { dashboardApi } = await import('../lib/api');
        const data = await dashboardApi.getDashboardData();
        
        console.log('Dashboard: Data received', data);
        console.log('Dashboard: Metrics:', data.metrics);
        console.log('Dashboard: Quota Progress:', data.quota_progress);
        console.log('Dashboard: Deals:', data.deals);
        setDashboardData(data);
      } catch (err: any) {
        console.error('Dashboard: Error caught', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    console.log('Dashboard: useEffect triggered, user:', user, 'loading:', isLoading);
    
    if (user) {
      fetchDashboardData();
    } else if (!user && !isLoading) {
      // If no user and not loading, stop loading state
      setIsLoading(false);
    }
  }, [user]);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-600 border-t-transparent mx-auto"></div>
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
              <p className="text-red-600 mt-2">{error}</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  const { metrics, quota_progress, deals } = dashboardData || {};

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
              Welcome back, <span className="font-semibold text-indigo-600">{user?.first_name}</span>! 
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

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Quota Attainment */}
          <div className="relative overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-6 text-white shadow-2xl shadow-indigo-500/25">
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
          <div className="relative overflow-hidden bg-gradient-to-br from-purple-500 to-pink-600 rounded-3xl p-6 text-white shadow-2xl shadow-purple-500/25">
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
                  <div className="w-3 h-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full"></div>
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
                <div className="relative overflow-hidden bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-3xl p-6 border border-purple-200">
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
                        <Clock className="w-6 h-6 text-blue-600" />
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

        {/* Welcome Message */}
        <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-3xl p-8 text-white shadow-2xl">
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