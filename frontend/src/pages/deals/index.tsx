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
  const [quotaPeriod, setQuotaPeriod] = useState<'weekly' | 'monthly' | 'quarterly' | 'annual'>('quarterly');
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
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        break;

      case 'quarterly':
        // Current quarter (Q1: Jan-Mar, Q2: Apr-Jun, Q3: Jul-Sep, Q4: Oct-Dec)
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        endDate = new Date(now.getFullYear(), quarter * 3 + 3, 0, 23, 59, 59, 999);
        break;

      case 'annual':
        // Current year
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        break;

      default:
        // Default to quarterly
        const defaultQuarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), defaultQuarter * 3, 1);
        endDate = new Date(now.getFullYear(), defaultQuarter * 3 + 3, 0, 23, 59, 59, 999);
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

  // Filter deals by current quota period
  const periodFilteredDeals = filterDealsByPeriod(deals, quotaPeriod);
  
  // Group deals by category (only include deals from current period)
  const dealsByCategory = {
    pipeline: periodFilteredDeals.filter((deal: Deal) => 
      deal.deal_type === 'pipeline' && deal.status === 'open'
    ),
    commit: periodFilteredDeals.filter((deal: Deal) => 
      deal.deal_type === 'commit' && deal.status === 'open'
    ),
    best_case: periodFilteredDeals.filter((deal: Deal) => 
      deal.deal_type === 'best_case' && deal.status === 'open'
    ),
    closed: periodFilteredDeals.filter((deal: Deal) => 
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

  // Calculate progress values
  const closedAmount = dealsByCategory.closed.reduce((sum: number, deal: Deal) => sum + Number(deal.amount), 0);
  const commitAmount = dealsByCategory.commit.reduce((sum: number, deal: Deal) => sum + Number(deal.amount), 0);
  const bestCaseAmount = dealsByCategory.best_case.reduce((sum: number, deal: Deal) => sum + Number(deal.amount), 0);
  const annualQuotaTarget = Number(currentTarget?.quota_amount) || 240000; // Default annual quota
  const quotaTarget = calculateQuotaForPeriod(annualQuotaTarget, quotaPeriod);
  
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
    
    // Commission calculations
    const actualCommission = calculateCommission(closedAmount);
    const projectedCommission = calculateCommission(projectedAmount);
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
                    Potential: £{(commitAmount * 0.10).toLocaleString()}
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
                    Potential: £{(bestCaseAmount * 0.10).toLocaleString()}
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
              Commission Forecasting
            </h1>
            <p className="mt-2 text-lg text-gray-600">
              Drag deals into confidence buckets to see your projected earnings and track quota attainment
            </p>
          </div>
          <div className="flex items-center space-x-3">
            {/* Quota Period Selector */}
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">View:</label>
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