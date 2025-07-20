import { useState, useEffect } from 'react';
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
  Plus,
  Timer,
  Award,
  ArrowRight,
  Trophy,
  Percent
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
  const queryClient = useQueryClient();

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

  // Helper function to calculate commission (using 10% for demo)
  const calculateCommission = (amount: number) => {
    return amount * 0.10;
  };

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
    queryKey: ['targets', user?.id],
    queryFn: async () => {
      // Pass user_id to ensure we only get the current user's targets
      const response = await api.get(`/targets?user_id=${user?.id}`);
      return response.data;
    },
    enabled: !!user?.id
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
  const quotaTarget = Number(currentTarget?.quota_amount) || 100000;
  
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
      const dealAmount = Number(draggedDeal.amount);
      const commissionChange = calculateCommission(dealAmount);
      
      updateDealCategoryMutation.mutate({ 
        dealId: draggedDeal.id, 
        category,
        previousCategory 
      });

      // Show success feedback
      const categoryLabel = category === 'commit' ? 'Commit' : 
                           category === 'best_case' ? 'Best Case' : 'Pipeline';
      
      // You could add a toast notification here
      console.log(`Moved to ${categoryLabel} - forecasting £${commissionChange.toLocaleString()} more commission`);
    }
    setDraggedDeal(null);
  };

  const handleDragEnd = () => {
    setDraggedDeal(null);
  };

  const DealCard = ({ deal }: { deal: Deal }) => {
    const commission = calculateCommission(Number(deal.amount));
    const daysToClose = deal.close_date ? 
      Math.max(0, Math.ceil((new Date(deal.close_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))) : 
      null;
    const isExpanded = expandedDeals.has(deal.id);

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
                <span className="text-xs font-medium text-gray-600">Time to close</span>
                <div className="flex items-center space-x-1">
                  <Clock className="w-3 h-3 text-orange-500" />
                  <span className="text-sm font-medium text-orange-600">
                    {daysToClose === 0 ? 'Today' : daysToClose === 1 ? '1 day' : `${daysToClose} days`}
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

  const DealsSection = ({ title, icon: Icon, deals, bgColor, borderColor, iconColor, textColor, category, badge, description }: any) => {
    const totalValue = deals.reduce((sum: number, deal: Deal) => sum + Number(deal.amount), 0);
    const totalCommission = calculateCommission(totalValue);
    
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
    const actualAttainment = (closedAmount / quotaTarget) * 100;
    const projectedTotal = commitAmount + bestCaseAmount;
    const totalPotential = closedAmount + projectedTotal;
    const totalPotentialAttainment = (totalPotential / quotaTarget) * 100;
    
    // Calculate progress percentages based on quota
    const actualProgress = Math.min(actualAttainment, 100);
    const projectedProgress = Math.min(((projectedTotal / quotaTarget) * 100), 100);
    
    // Commission calculations
    const actualCommission = calculateCommission(closedAmount);
    const projectedCommission = calculateCommission(projectedTotal);
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
              {/* Outer commission ring background */}
              <circle
                cx="90"
                cy="90"
                r="80"
                stroke="#f1f5f9"
                strokeWidth="10"
                fill="none"
                className="opacity-60"
              />
              
              {/* Outer commission ring - Actual (Blue tones for commission) */}
              <circle
                cx="90"
                cy="90"
                r="80"
                stroke="url(#blueGradientOuter)"
                strokeWidth="10"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${Math.min(actualProgress * 5.03, 503)} 503`}
                className="transition-all duration-300 cursor-pointer hover:stroke-width-[12]"
                style={{ pointerEvents: actualProgress > 0 ? 'stroke' : 'none' }}
                onMouseEnter={(e) => {
                  e.stopPropagation();
                  setHoveredSegment('actual');
                }}
                onMouseLeave={(e) => {
                  e.stopPropagation();
                  setHoveredSegment(null);
                }}
              />
              
              {/* Outer commission ring - Projected (Purple tones for projected commission) */}
              <circle
                cx="90"
                cy="90"
                r="80"
                stroke="url(#purpleGradientOuter)"
                strokeWidth="10"
                fill="none"
                strokeLinecap="round"
                strokeDasharray="8 4"
                strokeDashoffset={-actualProgress * 5.03}
                className="transition-all duration-300 opacity-85 cursor-pointer hover:stroke-width-[12] hover:opacity-100"
                style={{
                  strokeDasharray: `${Math.min(projectedProgress * 5.03, 503)} 503`,
                  strokeDashoffset: -actualProgress * 5.03,
                  pointerEvents: projectedProgress > 0 ? 'stroke' : 'none'
                }}
                onMouseEnter={(e) => {
                  e.stopPropagation();
                  setHoveredSegment('projected');
                }}
                onMouseLeave={(e) => {
                  e.stopPropagation();
                  setHoveredSegment(null);
                }}
              />
              
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
              
              {/* Inner quota ring - Actual Progress (Green for quota attainment) */}
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
              
              {/* Inner quota ring - Projected Progress (Amber for projected quota) */}
              <circle
                cx="90"
                cy="90"
                r="64"
                stroke="url(#amberGradient)"
                strokeWidth="12"
                fill="none"
                strokeLinecap="round"
                strokeDasharray="8 4"
                strokeDashoffset={-actualProgress * 4.02}
                className="transition-all duration-300 opacity-80 cursor-pointer hover:stroke-width-[14] hover:opacity-100"
                style={{
                  strokeDasharray: `${Math.min(projectedProgress * 4.02, 402)} 402`,
                  strokeDashoffset: -actualProgress * 4.02,
                  filter: 'drop-shadow(0 0 6px rgba(245, 158, 11, 0.2))',
                  pointerEvents: projectedProgress > 0 ? 'stroke' : 'none'
                }}
                onMouseEnter={(e) => {
                  e.stopPropagation();
                  setHoveredSegment('projected');
                }}
                onMouseLeave={(e) => {
                  e.stopPropagation();
                  setHoveredSegment(null);
                }}
              />

              {/* Gradient definitions */}
              <defs>
                <linearGradient id="greenGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10B981" />
                  <stop offset="100%" stopColor="#059669" />
                </linearGradient>
                <linearGradient id="amberGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#F59E0B" />
                  <stop offset="100%" stopColor="#D97706" />
                </linearGradient>
                <linearGradient id="blueGradientOuter" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3B82F6" />
                  <stop offset="100%" stopColor="#1D4ED8" />
                </linearGradient>
                <linearGradient id="purpleGradientOuter" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#8B5CF6" />
                  <stop offset="100%" stopColor="#7C3AED" />
                </linearGradient>
              </defs>
            </svg>
            
            {/* Center content with hover details */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              {hoveredSegment === 'actual' ? (
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {actualAttainment.toFixed(0)}%
                  </div>
                  <div className="text-sm text-green-700 font-medium">
                    £{closedAmount.toLocaleString()}
                  </div>
                  <div className="text-xs text-blue-600 font-semibold">
                    Commission: £{actualCommission.toLocaleString()}
                  </div>
                </div>
              ) : hoveredSegment === 'projected' ? (
                <div className="text-center">
                  <div className="text-3xl font-bold text-amber-600">
                    {((projectedTotal / quotaTarget) * 100).toFixed(0)}%
                  </div>
                  <div className="text-sm text-amber-700 font-medium">
                    £{projectedTotal.toLocaleString()}
                  </div>
                  <div className="text-xs text-purple-600 font-semibold">
                    Commission: £{projectedCommission.toLocaleString()}
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-4xl font-bold text-gray-900 transition-all duration-300">
                    {actualAttainment.toFixed(0)}%
                  </div>
                  <div className="text-sm text-gray-500">Quota Attainment</div>
                  <div className="text-xs text-gray-400 mt-1">
                    Hover segments for details
                  </div>
                </div>
              )}
            </div>

            {/* Commission labels around the outer ring */}
            <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
              <div className="text-xs font-semibold text-gray-600 bg-white px-3 py-1 rounded-full shadow-sm border">
                Total Commission
              </div>
            </div>
            <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2">
              <div className="text-sm font-bold text-gray-800 bg-gray-50 px-3 py-1 rounded-full shadow-sm border">
                £{totalCommission.toLocaleString()}
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
                £{projectedTotal.toLocaleString()}
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
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm font-medium text-green-800">Actual (Closed Won)</span>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-green-800">
                £{closedAmount.toLocaleString()}
              </div>
              <div className="text-xs text-green-600">
                Commission: £{calculateCommission(closedAmount).toLocaleString()}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-orange-500 rounded-full border-2 border-orange-300" style={{backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.3) 2px, rgba(255,255,255,0.3) 4px)'}}></div>
              <span className="text-sm font-medium text-orange-800">Projected (Commit + Best Case)</span>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-orange-800">
                £{projectedTotal.toLocaleString()}
              </div>
              <div className="text-xs text-orange-600">
                Commission: £{calculateCommission(projectedTotal).toLocaleString()}
              </div>
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
              Commission Forecasting
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
                Commission: £{calculateCommission(closedAmount).toLocaleString()}
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
                Commission: £{calculateCommission(commitAmount + bestCaseAmount).toLocaleString()}
              </div>
            </div>

            {/* Quota Target */}
            <div className="text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start mb-2">
                <Target className="w-5 h-5 mr-2 text-blue-200" />
                <span className="text-sm font-medium text-green-100">Quota Target</span>
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
                deals={dealsByCategory.pipeline}
                bgColor="bg-gray-100"
                borderColor="border-gray-300"
                iconColor="text-gray-500"
                textColor="text-gray-700"
                category="pipeline"
                description="CRM synced opportunities"
              />
            </div>

            {/* Commit Bucket */}
            <div className="lg:col-span-1">
              <DealsSection
                title="Commit"
                icon={Star}
                deals={dealsByCategory.commit}
                bgColor="bg-amber-100"
                borderColor="border-amber-300"
                iconColor="text-amber-600"
                textColor="text-amber-800"
                category="commit"
                description="High confidence deals"
              />
            </div>

            {/* Best Case Bucket */}
            <div className="lg:col-span-1">
              <DealsSection
                title="Best Case"
                icon={TrendingUp}
                deals={dealsByCategory.best_case}
                bgColor="bg-purple-100"
                borderColor="border-purple-300"
                iconColor="text-purple-600"
                textColor="text-purple-800"
                category="best_case"
                description="Potential upside opportunities"
              />
            </div>

            {/* Quota Progress */}
            <div className="md:col-span-2 lg:col-span-1">
              <QuotaProgress />
            </div>
          </div>
        )}

        {/* Enhanced Instructions */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6">
          <h3 className="text-lg font-bold text-blue-900 mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2" />
            Commission Forecasting Guide
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-blue-800">
            <div className="space-y-2">
              <p className="font-semibold">📊 Pipeline</p>
              <p>CRM-synced opportunities</p>
              <p>Starting point for all deals</p>
            </div>
            <div className="space-y-2">
              <p className="font-semibold">⭐ Commit</p>
              <p>High confidence deals</p>
              <p>Drag likely closes here</p>
            </div>
            <div className="space-y-2">
              <p className="font-semibold">🚀 Best Case</p>
              <p>Potential upside opportunities</p>
              <p>Optimistic forecast scenarios</p>
            </div>
          </div>
          <div className="mt-4 p-3 bg-white rounded-lg border border-blue-200">
            <p className="text-sm text-gray-700">
              <strong>Pro Tip:</strong> Only categorized deals count toward your commission forecast. 
              Drag deals to update your projected earnings in real-time.
            </p>
          </div>
        </div>

        {/* Floating Action Button */}
        <button
          onClick={() => setShowAddDeal(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-300 flex items-center justify-center z-50 group"
          title="Add Deal"
        >
          <Plus className="w-6 h-6" />
          <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
            Add Deal
          </div>
        </button>
      </div>
    </Layout>
  );
};

export default DealsPage;