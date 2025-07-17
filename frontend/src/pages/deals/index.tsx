import { useState, useEffect } from 'react';
import Layout from '../../components/layout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  Package
} from 'lucide-react';

const DealsPage = () => {
  const [filters, setFilters] = useState({
    status: '',
    search: '',
    from_date: '',
    to_date: ''
  });
  const [draggedDeal, setDraggedDeal] = useState<Deal | null>(null);
  const queryClient = useQueryClient();

  // Initialize session tracking for ML data
  useEffect(() => {
    if (!sessionStorage.getItem('session_id')) {
      sessionStorage.setItem('session_id', `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    }
  }, []);

  const { data: dealsData, isLoading, refetch } = useQuery({
    queryKey: ['deals', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      
      const response = await api.get(`/deals?${params}`);
      return response.data;
    }
  });

  // Get current user's quota from settings
  const { data: targetsData } = useQuery({
    queryKey: ['targets'],
    queryFn: async () => {
      const response = await api.get('/targets');
      return response.data;
    }
  });

  const updateDealCategoryMutation = useMutation({
    mutationFn: async ({ dealId, category, previousCategory }: { dealId: string, category: string, previousCategory: string }) => {
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
      return response.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      logCategorizationChange(variables.dealId, variables.previousCategory, variables.category);
    }
  });

  const deals = dealsData?.deals || [];
  const targets = targetsData?.targets || [];
  const currentTarget = targets.find((t: any) => t.is_active) || null;

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

  // Group deals by category
  const dealsByCategory = {
    pipeline: deals.filter((deal: Deal) => 
      deal.deal_type === 'pipeline' && deal.status === 'open'
    ),
    commit: deals.filter((deal: Deal) => deal.deal_type === 'commit'),
    best_case: deals.filter((deal: Deal) => deal.deal_type === 'best_case'),
    closed: deals.filter((deal: Deal) => deal.status === 'closed_won')
  };

  // Calculate progress values
  const closedAmount = dealsByCategory.closed.reduce((sum: number, deal: Deal) => sum + Number(deal.amount), 0);
  const commitAmount = dealsByCategory.commit.reduce((sum: number, deal: Deal) => sum + Number(deal.amount), 0);
  const bestCaseAmount = dealsByCategory.best_case.reduce((sum: number, deal: Deal) => sum + Number(deal.amount), 0);
  const quotaTarget = currentTarget?.quota_amount || 100000;
  
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
      updateDealCategoryMutation.mutate({ 
        dealId: draggedDeal.id, 
        category,
        previousCategory 
      });
    }
    setDraggedDeal(null);
  };

  const handleDragEnd = () => {
    setDraggedDeal(null);
  };

  const DealCard = ({ deal }: { deal: Deal }) => (
    <div
      draggable
      onDragStart={(e) => handleDragStart(e, deal)}
      onDragEnd={handleDragEnd}
      className={`p-3 bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 cursor-move select-none relative group ${
        draggedDeal?.id === deal.id 
          ? 'opacity-50 scale-95' 
          : 'hover:scale-[1.02]'
      }`}
    >
      {/* Hover tooltip */}
      <div className="absolute top-full left-0 mt-2 bg-gray-900 text-white text-xs px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-30 shadow-lg">
        <div className="font-medium mb-1">{deal.deal_name}</div>
        <div className="flex items-center space-x-4 text-xs opacity-90">
          <div className="flex items-center space-x-1">
            <Calendar className="w-3 h-3" />
            <span>{deal.close_date ? new Date(deal.close_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'TBD'}</span>
          </div>
          <div className="flex items-center space-x-1">
            <BarChart3 className="w-3 h-3" />
            <span>{deal.probability}%</span>
          </div>
        </div>
      </div>

      {/* Company name */}
      <div className="text-sm font-medium text-gray-900 mb-2 truncate">
        {deal.account_name}
      </div>
      
      {/* Deal value */}
      <div className="flex items-center space-x-1">
        <PoundSterling className="w-3 h-3 text-green-600" />
        <span className="font-semibold text-green-700 text-sm">
          £{Number(deal.amount).toLocaleString()}
        </span>
      </div>
    </div>
  );

  const DealsSection = ({ title, icon: Icon, deals, bgColor, borderColor, iconColor, textColor, category }: any) => (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2">
            <div className={`p-1.5 ${bgColor} rounded-lg`}>
              <Icon className={`w-4 h-4 ${iconColor}`} />
            </div>
            <div>
              <h3 className={`text-sm font-semibold ${textColor} mb-1`}>
                {title}
              </h3>
              <div className={`text-xs font-medium ${textColor} opacity-90 mb-0.5`}>
                £{deals.reduce((sum: number, deal: Deal) => sum + Number(deal.amount), 0).toLocaleString()}
              </div>
              <p className={`text-xs ${textColor} opacity-60`}>
                {deals.length} deal{deals.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <div 
        className={`p-3 transition-all duration-200 ${category ? 'min-h-[200px]' : 'min-h-[150px]'} ${
          draggedDeal && category && draggedDeal.deal_type !== category 
            ? 'bg-blue-50 border-2 border-blue-300 border-dashed' 
            : ''
        }`}
        onDragOver={category ? handleDragOver : undefined}
        onDragEnter={category ? handleDragEnter : undefined}
        onDragLeave={category ? handleDragLeave : undefined}
        onDrop={category ? (e) => handleDrop(e, category) : undefined}
      >
        {deals.length === 0 ? (
          <div className="text-center py-8">
            <Icon className={`w-8 h-8 ${iconColor} mx-auto mb-2 opacity-40`} />
            <p className="text-xs text-gray-500">
              {category ? 'Drop deals here' : 'No deals available'}
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {deals.map((deal: Deal) => (
              <DealCard key={deal.id} deal={deal} />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const ProgressMeter = () => {
    const meterHeight = 320;
    const maxProgress = 120; // Scale to 120% instead of 100%
    
    // Calculate heights based on 120% scale
    const closedHeight = Math.min((closedProgress / maxProgress) * meterHeight, meterHeight);
    const commitHeight = Math.min((commitProgress / maxProgress) * meterHeight, meterHeight - closedHeight);
    const bestCaseHeight = Math.min((bestCaseProgress / maxProgress) * meterHeight, meterHeight - closedHeight - commitHeight);
    
    // Target line position (100% = 100/120 = 83.33% up the meter)
    const targetLinePosition = (100 / maxProgress) * meterHeight;

    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="text-center mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quota Progress</h2>
          
          {/* Primary metric: Percentage complete */}
          <div className="text-4xl font-bold text-gray-900 mb-2">
            {totalProgress.toFixed(0)}%
          </div>
          
          {/* Secondary metric: Amount closed */}
          <div className="text-lg font-semibold text-gray-700 mb-1">
            £{totalCategorized.toLocaleString()}
          </div>
          
          {/* Supporting information: Target amount */}
          <div className="text-sm text-gray-500">
            of £{quotaTarget.toLocaleString()} target
          </div>
        </div>

        <div className="relative mx-auto mb-6" style={{ width: '60px', height: `${meterHeight}px` }}>
          {/* Background meter */}
          <div 
            className="absolute bottom-0 w-full bg-gray-100 rounded-full border border-gray-200"
            style={{ height: `${meterHeight}px` }}
          />
          
          {/* Target line at 100% */}
          <div 
            className="absolute left-0 right-0 border-t-2 border-dashed border-gray-500 z-10"
            style={{ bottom: `${targetLinePosition}px` }}
          >
            <div className="absolute -right-16 -top-2 text-xs text-gray-700 font-medium whitespace-nowrap bg-white px-1 rounded">
              Target
            </div>
          </div>

          {/* Closed Won (bottom) */}
          <div 
            className="absolute bottom-0 w-full bg-gradient-to-t from-green-500 to-green-400 rounded-b-full transition-all duration-1000 group cursor-pointer"
            style={{ height: `${closedHeight}px` }}
          >
            <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-20">
              Closed: £{closedAmount.toLocaleString()}
            </div>
          </div>

          {/* Commit (middle) */}
          <div 
            className="absolute w-full bg-gradient-to-t from-orange-500 to-orange-400 transition-all duration-1000 group cursor-pointer"
            style={{ 
              height: `${commitHeight}px`,
              bottom: `${closedHeight}px`
            }}
          >
            <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-20">
              Commit: £{commitAmount.toLocaleString()}
            </div>
          </div>

          {/* Best Case (top) */}
          <div 
            className="absolute w-full bg-gradient-to-t from-purple-500 to-purple-400 transition-all duration-1000 group cursor-pointer"
            style={{ 
              height: `${bestCaseHeight}px`,
              bottom: `${closedHeight + commitHeight}px`
            }}
          >
            <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-20">
              Best Case: £{bestCaseAmount.toLocaleString()}
            </div>
          </div>

        </div>

        {/* Compact Legend */}
        <div className="space-y-3">
          <div className="flex items-center p-3 bg-green-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm font-medium text-green-800">Closed</span>
            </div>
          </div>

          <div className="flex items-center p-3 bg-orange-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
              <span className="text-sm font-medium text-orange-800">Commit</span>
            </div>
          </div>

          <div className="flex items-center p-3 bg-purple-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
              <span className="text-sm font-medium text-purple-800">Best Case</span>
            </div>
          </div>

          <div className="flex items-center p-3 bg-gray-50 rounded-lg border-t border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
              <span className="text-sm font-medium text-gray-700">Target</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Deal Categorization</h1>
            <p className="mt-1 text-gray-600">
              Drag deals from Pipeline into commitment buckets to track your commission forecast
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => refetch()}
              disabled={isLoading}
              className="inline-flex items-center px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Sync CRM
            </button>
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
                className="pl-10 pr-4 py-2 w-full bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <select
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
              className="py-2 px-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="py-2 px-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            
            <input
              type="date"
              value={filters.to_date}
              onChange={(e) => setFilters({...filters, to_date: e.target.value})}
              className="py-2 px-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Main Content */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading deals...</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Pipeline Deals */}
            <div className="lg:col-span-1">
              <DealsSection
                title="Pipeline"
                icon={Package}
                deals={dealsByCategory.pipeline}
                bgColor="bg-blue-100"
                borderColor="border-blue-200"
                iconColor="text-blue-600"
                textColor="text-blue-800"
                category="pipeline"
              />
            </div>

            {/* Commit Bucket */}
            <div className="lg:col-span-1">
              <DealsSection
                title="Commit"
                icon={Star}
                deals={dealsByCategory.commit}
                bgColor="bg-orange-100"
                borderColor="border-orange-200"
                iconColor="text-orange-600"
                textColor="text-orange-800"
                category="commit"
              />
            </div>

            {/* Best Case Bucket */}
            <div className="lg:col-span-1">
              <DealsSection
                title="Best Case"
                icon={Zap}
                deals={dealsByCategory.best_case}
                bgColor="bg-purple-100"
                borderColor="border-purple-200"
                iconColor="text-purple-600"
                textColor="text-purple-800"
                category="best_case"
              />
            </div>

            {/* Progress Meter */}
            <div className="lg:col-span-1">
              <ProgressMeter />
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">
            💡 How to Use
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-blue-800">
            <div>
              <p>• <strong>CRM Sync:</strong> All deals start in "Pipeline"</p>
              <p>• <strong>Drag & Drop:</strong> Move to Commit or Best Case buckets</p>
            </div>
            <div>
              <p>• <strong>Progress Meter:</strong> Shows categorized deals only</p>
              <p>• <strong>Commission:</strong> Based on your manual categorization</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default DealsPage;