import React from 'react';
import { BarChart3, Calendar } from 'lucide-react';
import { formatLargeCurrency } from '../utils/money';

interface Commission {
  period_key: string;
  period_start: string;
  period_end: string;
  user_id: string;
  user?: {
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
  commission_type?: string;
  status?: string;
  target_id?: string;
  deals_count?: number;
  deals_with_commission?: number;
  deals_without_commission?: number;
  warning?: string;
  commission_details?: Array<{
    id: string;
    deal: {
      deal_name: string;
      account_name: string;
      amount: string | number;
      close_date?: string;
      closed_date?: string;
    };
    commission_amount: number;
  }>;
}

interface TeamMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface CommissionChartProps {
  commissions: Commission[];
  isManager: boolean;
  managerView: string;
  isCalculating?: boolean;
  teamMemberCount?: number; // Total team size for accurate team attainment calculation
  teamMembers?: TeamMember[]; // Full team member list for showing 0% attainment members
  periodView?: 'monthly' | 'quarterly' | 'yearly';
}

interface ModalData {
  commission?: Commission;
  period: string;
  isVisible: boolean;
  isTeamView?: boolean;
  teamCommissions?: Commission[];
  teamTotals?: {
    totalCommission: number;
    totalQuota: number;
    totalActual: number;
    teamAttainment: number;
  };
}

const CommissionChart: React.FC<CommissionChartProps> = ({
  commissions,
  isManager,
  managerView,
  isCalculating = false,
  teamMemberCount,
  teamMembers = [],
  periodView = 'quarterly'
}) => {
  const [modalData, setModalData] = React.useState<ModalData | null>(null);
  
  // Create complete team member list including those with 0% attainment
  // Only include team members who had targets during the timeframe (appear in at least one commission record)
  const generateCompleteTeamData = (existingCommissions: Commission[], period: string) => {
    if (!teamMembers || teamMembers.length === 0) {
      return existingCommissions;
    }
    
    // Get team members who appear in ANY commission record (indicating they had targets during this timeframe)
    const activeMembers = teamMembers.filter(member => 
      commissions.some(c => c.user?.id === member.id)
    );
    
    const completeTeamData: (Commission | { isZeroAttainment: true; user: TeamMember; period: string })[] = [];
    
    // Add existing commission records
    existingCommissions.forEach(commission => {
      completeTeamData.push(commission);
    });
    
    // Add active team members with 0% attainment for this period (no commission records but had targets elsewhere)
    activeMembers.forEach(member => {
      const hasCommissionThisPeriod = existingCommissions.some(c => c.user?.id === member.id);
      if (!hasCommissionThisPeriod) {
        completeTeamData.push({
          isZeroAttainment: true,
          user: member,
          period: period
        });
      }
    });
    
    return completeTeamData;
  };

  // Group commissions by period for team views
  const groupedCommissions = React.useMemo(() => {
    if (!isManager || managerView === 'personal') {
      // For personal view, just show what we have
      return commissions
        .sort((a, b) => new Date(b.period_start).getTime() - new Date(a.period_start).getTime())
        .map(c => ({ period: c.period_start, commissions: [c] }));
    }
    
    const groups = commissions.reduce((acc, commission) => {
      // Normalize period to start of day to handle time differences
      const periodDate = new Date(commission.period_start);
      periodDate.setHours(0, 0, 0, 0);
      const periodKey = periodDate.toISOString().split('T')[0];
      
      if (!acc[periodKey]) {
        acc[periodKey] = [];
      }
      acc[periodKey].push(commission);
      return acc;
    }, {} as Record<string, Commission[]>);
    
    // Don't create empty periods - only work with periods that have actual data
    // The empty period generation was causing duplicates
    
    return Object.entries(groups)
      .map(([period, comms]) => ({ 
        period, 
        commissions: comms,
        completeTeamData: comms.length > 0 ? generateCompleteTeamData(comms, period) : [],
        hasNoData: comms.length === 0,
        periodLabel: null // Will be generated in render
      }))
      .sort((a, b) => new Date(b.period).getTime() - new Date(a.period).getTime());
  }, [commissions, isManager, managerView, periodView]);

  // Generate company green with opacity based on attainment percentage
  const getColorForMember = (attainmentPct: number) => {
    // Scale opacity from 30% (faint but visible) to 95% (nearly solid)
    const minOpacity = 0.3;
    const maxOpacity = 0.95;
    const opacity = minOpacity + (attainmentPct / 100) * (maxOpacity - minOpacity);
    
    // Return inline style object for dynamic opacity
    return {
      background: `linear-gradient(to right, rgba(34, 197, 94, ${opacity}), rgba(22, 163, 74, ${opacity}))`,
    };
  };

  // Generate dark blue with opacity for team aggregated bar
  const getTeamColor = (attainmentPct: number) => {
    // Scale opacity from 30% (faint but visible) to 95% (nearly solid)
    const minOpacity = 0.3;
    const maxOpacity = 0.95;
    const opacity = minOpacity + (attainmentPct / 100) * (maxOpacity - minOpacity);
    
    // Return inline style object for dynamic opacity using dark blue (gray-600 to gray-700 equivalent)
    return {
      background: `linear-gradient(to right, rgba(75, 85, 99, ${opacity}), rgba(55, 65, 81, ${opacity}))`,
    };
  };

  if (commissions.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="relative">
          {isCalculating ? (
            <div className="space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto" />
              <p className="text-gray-600">Calculating historical commissions...</p>
            </div>
          ) : (
            <div className="space-y-4">
              <BarChart3 className="w-16 h-16 text-gray-400 mx-auto" />
              <div>
                <p className="text-gray-600 mb-2">No historical commission data available</p>
                <p className="text-sm text-gray-500">
                  Create historical targets in Settings to see commission history
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Bars should represent quota attainment percentage (0-100%), not absolute amounts
  // No need for chartMax calculation as we'll use attainment percentages directly

  return (
    <div className="space-y-6">
      {/* Bar Chart */}
      <div className="relative">
        <div className="space-y-3">
          {groupedCommissions.map((group, groupIndex) => {
            // Determine period type and format label accordingly
            let periodLabel;
            
            if (group.commissions.length > 0) {
              const firstCommission = group.commissions[0];
              const periodStart = new Date(firstCommission.period_start);
              const periodEnd = new Date(firstCommission.period_end);
              const periodLengthDays = (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24);
              
              // Detect period type based on length
              if (periodLengthDays > 300) {
                // Yearly period (more than 300 days)
                periodLabel = periodStart.getFullYear().toString();
              } else if (periodLengthDays > 60) {
                // Quarterly period (60-300 days)
                const quarter = Math.floor(periodStart.getMonth() / 3) + 1;
                periodLabel = `Q${quarter} ${periodStart.getFullYear().toString().slice(-2)}`;
              } else {
                // Monthly period (60 days or less)
                periodLabel = periodStart.toLocaleDateString('en-GB', {
                  month: 'short',
                  year: '2-digit'
                });
              }
            } else {
              // Generate label from the period date for empty periods based on periodView
              const periodDate = new Date(group.period);
              
              if (periodView === 'yearly') {
                periodLabel = periodDate.getFullYear().toString();
              } else if (periodView === 'monthly') {
                periodLabel = periodDate.toLocaleDateString('en-GB', {
                  month: 'short',
                  year: '2-digit'
                });
              } else {
                // Default to quarterly
                const quarter = Math.floor(periodDate.getMonth() / 3) + 1;
                periodLabel = `Q${quarter} ${periodDate.getFullYear().toString().slice(-2)}`;
              }
            }
            
            const totalCommission = group.commissions.reduce((sum, c) => sum + Number(c.commission_earned), 0);
            const isTeamView = isManager && managerView !== 'personal';
            
            if (isTeamView) {
              // Team view: Show team aggregated bar + grouped individual bars
              const hasData = group.commissions.length > 0;
              const totalQuota = group.commissions.reduce((sum, c) => sum + Number(c.quota_amount), 0);
              const totalActual = group.commissions.reduce((sum, c) => sum + Number(c.actual_amount), 0);
              
              // Calculate true team attainment including members with 0% (no commission records)
              let teamAttainment;
              if (hasData && teamMemberCount && teamMemberCount > 0) {
                // If we have team member count, include those with 0% attainment
                const membersWithCommissions = group.commissions.length;
                const membersWithoutCommissions = teamMemberCount - membersWithCommissions;
                const totalAttainmentPoints = group.commissions.reduce((sum, c) => sum + Number(c.attainment_pct), 0);
                // Members without commissions contribute 0% attainment
                teamAttainment = totalAttainmentPoints / teamMemberCount;
              } else if (hasData) {
                // Fallback to quota-based calculation if team member count unavailable
                teamAttainment = totalQuota > 0 ? (totalActual / totalQuota) * 100 : 0;
              } else {
                teamAttainment = 0;
              }
              
              const teamBarWidth = Math.min(teamAttainment, 100); // Cap at 100% for visual consistency
              
              // Use the generated periodLabel
              const displayLabel = periodLabel;
              
              return (
                <div key={`group-${group.period}`} className="mb-6">
                  {/* Period Header */}
                  <div className={`flex items-center justify-between mb-3 pb-2 border-b border-gray-200 ${!hasData ? 'opacity-50' : ''}`}>
                    <h4 className="text-sm font-semibold text-gray-800">{displayLabel}</h4>
                    <div className="text-sm text-gray-600">
                      {hasData ? 
                        `Total: ${formatLargeCurrency(totalCommission)} (${group.commissions.length}${teamMemberCount ? ` of ${teamMemberCount}` : ''} members)` :
                        'No targets defined for this period'
                      }
                    </div>
                  </div>
                  
                  {/* Team Aggregated Bar */}
                  <div className="mb-3">
                    <div className="flex items-center space-x-3">
                      {/* Team Label */}
                      <div className="w-20 text-xs font-bold text-gray-800 text-right">
                        TEAM
                      </div>
                      
                      {/* Team Bar Container */}
                      <div 
                        className={`flex-1 relative h-8 bg-gray-100 rounded-lg overflow-hidden ${hasData ? 'cursor-pointer hover:bg-gray-200' : ''} transition-colors`}
                        onClick={() => hasData && setModalData({
                          period: displayLabel,
                          isVisible: true,
                          isTeamView: true,
                          teamCommissions: group.commissions,
                          teamTotals: {
                            totalCommission,
                            totalQuota,
                            totalActual,
                            teamAttainment
                          }
                        })}
                      >
                        {hasData ? (
                          <>
                            {/* Team Commission Bar (with performance-based opacity) */}
                            <div 
                              className="h-full rounded-lg"
                              style={{ 
                                width: `${Math.min(teamBarWidth, 100)}%`,
                                ...getTeamColor(teamAttainment)
                              }}
                            />
                            
                            {/* Team Attainment Indicator */}
                            <div className="absolute inset-0 flex items-center justify-start pl-3">
                              <span className="text-sm font-bold text-white drop-shadow">
                                {teamAttainment.toFixed(0)}%
                              </span>
                            </div>
                          </>
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
                            <span className="text-xs font-medium text-gray-500">
                              No targets defined
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {/* Team Total Amount */}
                      <div className="w-20 text-xs font-bold text-gray-900 text-right">
                        {hasData ? formatLargeCurrency(totalCommission) : '-'}
                      </div>
                    </div>
                  </div>
                  
                  {/* Individual Member Bars */}
                  {hasData && (
                    <div className="space-y-2 ml-4">
                      {(group.completeTeamData || group.commissions).map((memberData, index) => {
                      // Handle both commission records and zero-attainment members
                      const isZeroAttainment = 'isZeroAttainment' in memberData;
                      const commission = isZeroAttainment ? null : memberData as Commission;
                      const user = isZeroAttainment ? memberData.user : commission?.user;
                      
                      const commissionAmount = commission ? Number(commission.commission_earned) : 0;
                      const quotaAmount = commission ? Number(commission.quota_amount) : 0;
                      const actualAmount = commission ? Number(commission.actual_amount) : 0;
                      const attainment = commission ? Number(commission.attainment_pct) : 0;
                      const colorStyle = getColorForMember(attainment);
                      
                      // Calculate bar width based on quota attainment percentage
                      const barWidth = Math.min(attainment, 100); // Cap at 100% for visual consistency
                      
                      const memberKey = commission?.id || `zero-${user?.id}-${group.period}`;
                      
                      return (
                        <div key={memberKey}>
                          <div 
                            className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 p-1 rounded-md transition-colors"
                            onClick={() => {
                              if (commission) {
                                setModalData({
                                  commission,
                                  period: periodLabel,
                                  isVisible: true,
                                  isTeamView: false
                                });
                              }
                            }}
                          >
                            {/* Member Name */}
                            <div className="w-20 text-xs font-medium text-gray-700 text-right">
                              {user?.first_name?.charAt(0)}{user?.last_name?.charAt(0)}
                            </div>
                            
                            {/* Bar Container */}
                            <div className="flex-1 relative h-6 bg-gray-100 rounded-md overflow-hidden">
                              {/* 100% Quota Reference Line */}
                              <div 
                                className="absolute top-0 bottom-0 w-0.5 bg-gray-400 opacity-75"
                                style={{ left: '100%' }}
                                title="100% Quota Target"
                              />
                              
                              {/* Commission Bar (based on attainment %) */}
                              <div 
                                className="h-full rounded-md"
                                style={{ width: `${barWidth}%`, ...colorStyle }}
                              />
                              
                              {/* Attainment Indicator */}
                              <div className="absolute inset-0 flex items-center justify-start pl-2">
                                <span className="text-xs font-semibold text-white drop-shadow">
                                  {attainment.toFixed(0)}%
                                </span>
                              </div>
                            </div>
                            
                            {/* Commission Amount */}
                            <div className="w-20 text-xs font-medium text-gray-900 text-right">
                              {formatLargeCurrency(commissionAmount)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    </div>
                  )}
                </div>
              );
            } else {
              // Personal view or single commission: Show individual bar
              const hasData = group.commissions.length > 0;
              const commission = hasData ? group.commissions[0] : null;
              const commissionAmount = commission ? Number(commission.commission_earned) : 0;
              const quotaAmount = commission ? Number(commission.quota_amount) : 0;
              const actualAmount = commission ? Number(commission.actual_amount) : 0;
              const attainment = commission ? Number(commission.attainment_pct) : 0;
              
              // Calculate bar width based on quota attainment percentage
              const barWidth = Math.min(attainment, 100); // Cap at 100% for visual consistency
              
              // Use provided periodLabel or fallback to calculated one
              const displayLabel = group.periodLabel || periodLabel;
              
              return (
                <div key={commission?.id || `no-data-${group.period}`}>
                  <div 
                    className={`flex items-center space-x-4 p-2 rounded-lg transition-colors ${
                      hasData ? 'cursor-pointer hover:bg-gray-50' : 'opacity-50'
                    }`}
                    onClick={() => hasData && setModalData({
                      commission,
                      period: displayLabel,
                      isVisible: true,
                      isTeamView: false
                    })}
                  >
                    {/* Period Label */}
                    <div className="w-16 text-sm font-medium text-gray-700 text-right">
                      {displayLabel}
                    </div>
                    
                    {/* Bar Container */}
                    <div className="flex-1 relative h-8 bg-gray-100 rounded-lg overflow-hidden">
                      {hasData ? (
                        <>
                          {/* 100% Quota Reference Line */}
                          <div 
                            className="absolute top-0 bottom-0 w-0.5 bg-gray-400 opacity-75"
                            style={{ left: '100%' }}
                            title="100% Quota Target"
                          />
                          
                          {/* Commission Bar (based on attainment %) */}
                          <div 
                            className="h-full rounded-lg"
                            style={{ width: `${barWidth}%`, ...getColorForMember(attainment) }}
                          />
                          
                          {/* Attainment Indicator */}
                          <div className="absolute inset-0 flex items-center justify-start pl-2">
                            <span className="text-xs font-semibold text-white drop-shadow">
                              {attainment.toFixed(0)}%
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
                          <span className="text-xs font-medium text-gray-500">
                            No targets defined
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* Commission Amount */}
                    <div className="w-24 text-sm font-bold text-gray-900 text-right">
                      {hasData ? formatLargeCurrency(commissionAmount) : '-'}
                    </div>
                    
                    {/* User badge for manager views */}
                    {isManager && managerView !== 'personal' && commission.user && (
                      <div className="w-16">
                        <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
                          {commission.user.first_name.charAt(0)}{commission.user.last_name.charAt(0)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            }
          })}
        </div>
      </div>
      
      {/* Chart Legend */}
      <div className="flex items-center justify-center space-x-6 text-xs text-gray-600 pt-4 border-t border-gray-200">
        {isManager && managerView !== 'personal' ? (
          // Team view legend
          <>
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1">
                <div className="w-4 h-3 rounded-sm" style={{background: 'linear-gradient(to right, rgba(34, 197, 94, 0.95), rgba(22, 163, 74, 0.95))'}}></div>
                <span className="text-xs text-gray-500">High</span>
                <div className="w-4 h-3 rounded-sm" style={{background: 'linear-gradient(to right, rgba(34, 197, 94, 0.6), rgba(22, 163, 74, 0.6))'}}></div>
                <span className="text-xs text-gray-500">Med</span>
                <div className="w-4 h-3 rounded-sm" style={{background: 'linear-gradient(to right, rgba(34, 197, 94, 0.3), rgba(22, 163, 74, 0.3))'}}></div>
                <span className="text-xs text-gray-500">Low</span>
              </div>
              <span>Performance Intensity</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-0.5 bg-gray-400"></div>
              <span>100% Quota Target</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-gray-800 font-medium">%</span>
              <span>Individual Attainment</span>
            </div>
          </>
        ) : (
          // Personal view legend
          <>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded" style={{background: 'linear-gradient(to right, rgba(34, 197, 94, 0.8), rgba(22, 163, 74, 0.8))'}}></div>
              <span>Performance (Color Intensity = Attainment)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-0.5 bg-gray-400"></div>
              <span>100% Quota Target</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-gray-800 font-medium">%</span>
              <span>Attainment Percentage</span>
            </div>
          </>
        )}
      </div>
      
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">
            {commissions.length}
          </div>
          <div className="text-sm text-gray-600">Periods</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">
            {formatLargeCurrency(commissions.reduce((sum, c) => sum + Number(c.commission_earned), 0))}
          </div>
          <div className="text-sm text-gray-600">Total Earned</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">
            {(commissions.reduce((sum, c) => sum + Number(c.attainment_pct), 0) / commissions.length).toFixed(1)}%
          </div>
          <div className="text-sm text-gray-600">Avg Attainment</div>
        </div>
      </div>

      {/* Commission Details Modal */}
      {modalData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {modalData.isTeamView ? 'Team Commission Details' : 'Commission Details'} - {modalData.period}
                </h3>
                <p className="text-sm text-gray-600">
                  {modalData.isTeamView 
                    ? `${modalData.teamCommissions?.length || 0} team members`
                    : `${modalData.commission?.user?.first_name} ${modalData.commission?.user?.last_name}`
                  }
                </p>
              </div>
              <button
                onClick={() => setModalData(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {/* Commission Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    £{modalData.isTeamView 
                      ? modalData.teamTotals?.totalCommission.toLocaleString() 
                      : Number(modalData.commission?.commission_earned || 0).toLocaleString()
                    }
                  </div>
                  <div className="text-sm text-green-700">Commission Earned</div>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {modalData.isTeamView 
                      ? modalData.teamTotals?.teamAttainment.toFixed(1)
                      : Number(modalData.commission?.attainment_pct || 0).toFixed(1)
                    }%
                  </div>
                  <div className="text-sm text-blue-700">{modalData.isTeamView ? 'Team' : 'Quota'} Attainment</div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    £{modalData.isTeamView 
                      ? modalData.teamTotals?.totalActual.toLocaleString()
                      : Number(modalData.commission?.actual_amount || 0).toLocaleString()
                    }
                  </div>
                  <div className="text-sm text-purple-700">Actual Sales</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-gray-600">
                    £{modalData.isTeamView 
                      ? modalData.teamTotals?.totalQuota.toLocaleString()
                      : Number(modalData.commission?.quota_amount || 0).toLocaleString()
                    }
                  </div>
                  <div className="text-sm text-gray-700">Quota Target</div>
                </div>
              </div>

              {/* Period Details */}
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <h4 className="font-semibold text-gray-900 mb-3">
                  {modalData.isTeamView ? 'Team Performance Summary' : 'Period Information'}
                </h4>
                {modalData.isTeamView ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Team Members:</span>
                      <div className="text-gray-900">
                        {modalData.teamCommissions?.length || 0} active performers
                      </div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Average Commission Rate:</span>
                      <div className="text-gray-900">
                        {modalData.teamCommissions && modalData.teamCommissions.length > 0
                          ? (modalData.teamCommissions.reduce((sum, c) => sum + Number(c.commission_rate), 0) / modalData.teamCommissions.length * 100).toFixed(2)
                          : '0.00'
                        }%
                      </div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Total Base Commission:</span>
                      <div className="text-gray-900">
                        {formatLargeCurrency(modalData.teamCommissions?.reduce((sum, c) => sum + Number(c.base_commission || c.commission_earned), 0) || 0)}
                      </div>
                    </div>
                  </div>
                ) : modalData.commission ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Period:</span>
                      <div className="text-gray-900">
                        {new Date(modalData.commission.period_start).toLocaleDateString('en-GB')} - {new Date(modalData.commission.period_end).toLocaleDateString('en-GB')}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Commission Rate:</span>
                      <div className="text-gray-900">
                        {(Number(modalData.commission.commission_rate) * 100).toFixed(2)}%
                      </div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Base Commission:</span>
                      <div className="text-gray-900">
                        {formatLargeCurrency(modalData.commission.base_commission || modalData.commission.commission_earned)}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Deals Breakdown */}
              {(() => {
                const allDeals = modalData.isTeamView 
                  ? modalData.teamCommissions?.flatMap(c => c.commission_details || []) || []
                  : modalData.commission?.commission_details || [];
                
                return allDeals.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">
                      {modalData.isTeamView ? 'All Team Deals' : 'Closed Deals'} ({allDeals.length})
                    </h4>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Deal Name
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Account
                            </th>
                            {modalData.isTeamView && (
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Team Member
                              </th>
                            )}
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Deal Amount
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Commission
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Close Date
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {allDeals.map((detail) => {
                            // For team view, find which team member this deal belongs to
                            const dealOwner = modalData.isTeamView 
                              ? modalData.teamCommissions?.find(c => c.commission_details?.some(cd => cd.id === detail.id))
                              : null;
                            
                            return (
                              <tr key={detail.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  {detail.deal.deal_name}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  {detail.deal.account_name}
                                </td>
                                {modalData.isTeamView && (
                                  <td className="px-4 py-3 text-sm text-gray-900">
                                    {dealOwner?.user?.first_name} {dealOwner?.user?.last_name}
                                  </td>
                                )}
                                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                  {formatLargeCurrency(detail.deal.amount)}
                                </td>
                                <td className="px-4 py-3 text-sm font-medium text-green-600">
                                  {formatLargeCurrency(detail.commission_amount)}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  {new Date(detail.deal.close_date || detail.deal.closed_date).toLocaleDateString('en-GB')}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* No Deals Message */}
              {(() => {
                const allDeals = modalData.isTeamView 
                  ? modalData.teamCommissions?.flatMap(c => c.commission_details || []) || []
                  : modalData.commission?.commission_details || [];
                
                return allDeals.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-lg mb-2">
                      {modalData.isTeamView ? 'No deals closed by the team in this period' : 'No deals closed in this period'}
                    </div>
                    <div className="text-sm">Commission may be from base salary or other sources</div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setModalData(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommissionChart;