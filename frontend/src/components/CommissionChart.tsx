import React from 'react';
import { BarChart3, Calendar } from 'lucide-react';

interface Commission {
  id: string;
  period_start: string;
  period_end: string;
  quota_amount: number;
  actual_amount: number;
  attainment_pct: number;
  commission_rate: number;
  commission_earned: number;
  user?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
}

interface CommissionChartProps {
  commissions: Commission[];
  isManager: boolean;
  managerView: string;
  isCalculating?: boolean;
}

const CommissionChart: React.FC<CommissionChartProps> = ({
  commissions,
  isManager,
  managerView,
  isCalculating = false
}) => {
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

  // For team views, group commissions by period and aggregate
  const isTeamView = isManager && (managerView === 'team' || managerView === 'all');
  
  let chartData;
  let chartMax;
  
  if (isTeamView) {
    // Group commissions by period for team view
    const periodGroups = commissions.reduce((groups, commission) => {
      const periodKey = commission.period_start;
      if (!groups[periodKey]) {
        groups[periodKey] = {
          period_start: commission.period_start,
          period_end: commission.period_end,
          total_commission: 0,
          total_quota: 0,
          total_actual: 0,
          members: []
        };
      }
      
      groups[periodKey].total_commission += Number(commission.commission_earned);
      groups[periodKey].total_quota += Number(commission.quota_amount);
      groups[periodKey].total_actual += Number(commission.actual_amount);
      groups[periodKey].members.push({
        user: commission.user,
        commission_earned: Number(commission.commission_earned),
        quota_amount: Number(commission.quota_amount),
        actual_amount: Number(commission.actual_amount),
        attainment_pct: Number(commission.attainment_pct)
      });
      
      return groups;
    }, {} as any);
    
    chartData = Object.values(periodGroups).sort((a: any, b: any) => 
      new Date(a.period_start).getTime() - new Date(b.period_start).getTime()
    );
    
    // Debug: Log team members found in commission data
    console.log('🔍 Team members in commission data:');
    chartData.forEach((period: any) => {
      console.log(`📅 ${period.period_start}:`, period.members.map((m: any) => `${m.user?.first_name} ${m.user?.last_name} (${m.user?.email})`));
    });
    
    chartMax = Math.max(...chartData.map((period: any) => period.total_commission));
  } else {
    // Individual view - use existing logic
    chartData = commissions.sort((a, b) => new Date(a.period_start).getTime() - new Date(b.period_start).getTime());
    const maxCommission = Math.max(...commissions.map(c => Number(c.commission_earned)));
    const maxQuota = Math.max(...commissions.map(c => Number(c.quota_amount)));
    chartMax = Math.max(maxCommission, maxQuota * 0.1); // Use 10% of max quota as reasonable scale
  }

  return (
    <div className="space-y-6">
      {/* Bar Chart */}
      <div className="relative">
        <div className="space-y-4">
          {chartData.map((item: any, index: number) => {
            const periodLabel = new Date(item.period_start).toLocaleDateString('en-GB', {
              month: 'short',
              year: '2-digit'
            });
            
            if (isTeamView) {
              // Team view - show aggregated team data with member breakdown
              const teamCommission = item.total_commission;
              const teamQuota = item.total_quota;
              const teamActual = item.total_actual;
              const teamAttainment = teamQuota > 0 ? (teamActual / teamQuota) * 100 : 0;
              
              const barWidth = chartMax > 0 ? (teamCommission / chartMax) * 100 : 0;
              const quotaIndicator = chartMax > 0 ? (teamQuota * 0.1 / chartMax) * 100 : 0;
              
              return (
                <div key={`team-${item.period_start}`} className="space-y-2">
                  {/* Team Total Bar */}
                  <div className="flex items-center space-x-4">
                    {/* Period Label */}
                    <div className="w-16 text-sm font-medium text-gray-700 text-right">
                      {periodLabel}
                    </div>
                    
                    {/* Bar Container */}
                    <div className="flex-1 relative h-10 bg-gray-100 rounded-lg overflow-hidden">
                      {/* Quota Reference Line */}
                      <div 
                        className="absolute top-0 bottom-0 w-0.5 bg-gray-400 opacity-50"
                        style={{ left: `${Math.min(quotaIndicator, 100)}%` }}
                        title={`Team Target: £${teamQuota.toLocaleString()}`}
                      />
                      
                      {/* Team Commission Bar */}
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg"
                        style={{ width: `${Math.min(barWidth, 100)}%` }}
                        title={`Team Commission: £${teamCommission.toLocaleString()}, Attainment: ${teamAttainment.toFixed(1)}%`}
                      />
                      
                      {/* Team Attainment Indicator */}
                      <div className="absolute inset-0 flex items-center justify-start pl-3">
                        <span className="text-sm font-semibold text-white drop-shadow">
                          TEAM {teamAttainment.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    
                    {/* Team Commission Amount */}
                    <div className="w-28 text-sm font-bold text-gray-900 text-right">
                      £{teamCommission.toLocaleString()}
                    </div>
                    
                    {/* Team Members Count */}
                    <div className="w-16 text-xs text-gray-600 text-center">
                      {item.members.length} members
                    </div>
                  </div>
                  
                  {/* Individual Member Bars */}
                  <div className="ml-20 space-y-1">
                    {item.members.map((member: any, memberIndex: number) => {
                      const memberBarWidth = chartMax > 0 ? (member.commission_earned / chartMax) * 100 : 0;
                      const memberColors = [
                        'from-green-400 to-green-500',
                        'from-purple-400 to-purple-500', 
                        'from-orange-400 to-orange-500',
                        'from-pink-400 to-pink-500',
                        'from-indigo-400 to-indigo-500'
                      ];
                      const colorClass = memberColors[memberIndex % memberColors.length];
                      
                      return (
                        <div key={`member-${member.user?.id}-${item.period_start}`} className="flex items-center space-x-3">
                          {/* Member Bar */}
                          <div className="flex-1 relative h-6 bg-gray-50 rounded overflow-hidden">
                            <div 
                              className={`h-full bg-gradient-to-r ${colorClass} rounded`}
                              style={{ width: `${Math.min(memberBarWidth, 100)}%` }}
                              title={`${member.user?.first_name} ${member.user?.last_name}: £${member.commission_earned.toLocaleString()}, ${member.attainment_pct.toFixed(1)}% attainment`}
                            />
                            
                            {/* Member Attainment */}
                            <div className="absolute inset-0 flex items-center justify-start pl-2">
                              <span className="text-xs font-medium text-white drop-shadow">
                                {member.attainment_pct.toFixed(0)}%
                              </span>
                            </div>
                          </div>
                          
                          {/* Member Amount */}
                          <div className="w-20 text-xs font-medium text-gray-700 text-right">
                            £{member.commission_earned.toLocaleString()}
                          </div>
                          
                          {/* Member Badge */}
                          <div className="w-12">
                            {member.user && (
                              <span className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-700 rounded">
                                {member.user.first_name.charAt(0)}{member.user.last_name.charAt(0)}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                </div>
              );
            } else {
              // Individual view - use existing logic
              const commission = item as Commission;
              const commissionAmount = Number(commission.commission_earned);
              const quotaAmount = Number(commission.quota_amount);
              const actualAmount = Number(commission.actual_amount);
              const attainment = Number(commission.attainment_pct);
              
              const barWidth = chartMax > 0 ? (commissionAmount / chartMax) * 100 : 0;
              const quotaIndicator = chartMax > 0 ? (quotaAmount * 0.1 / chartMax) * 100 : 0;
              
              return (
                <div key={commission.id}>
                  <div className="flex items-center space-x-4">
                    {/* Period Label */}
                    <div className="w-16 text-sm font-medium text-gray-700 text-right">
                      {periodLabel}
                    </div>
                    
                    {/* Bar Container */}
                    <div className="flex-1 relative h-8 bg-gray-100 rounded-lg overflow-hidden">
                      {/* Quota Reference Line */}
                      <div 
                        className="absolute top-0 bottom-0 w-0.5 bg-gray-400 opacity-50"
                        style={{ left: `${Math.min(quotaIndicator, 100)}%` }}
                        title={`Target: £${quotaAmount.toLocaleString()}`}
                      />
                      
                      {/* Commission Bar */}
                      <div 
                        className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-lg"
                        style={{ width: `${Math.min(barWidth, 100)}%` }}
                        title={`Commission: £${commissionAmount.toLocaleString()}, Sales: £${actualAmount.toLocaleString()}, Attainment: ${attainment.toFixed(1)}%`}
                      />
                      
                      {/* Attainment Indicator */}
                      <div className="absolute inset-0 flex items-center justify-start pl-2">
                        <span className="text-xs font-semibold text-white drop-shadow">
                          {attainment.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    
                    {/* Commission Amount */}
                    <div className="w-24 text-sm font-bold text-gray-900 text-right">
                      £{commissionAmount.toLocaleString()}
                    </div>
                    
                    {/* User badge for member views */}
                    {isManager && managerView === 'member' && commission.user && (
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
        {isTeamView ? (
          <>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-blue-600 rounded"></div>
              <span>Team Total Commission</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-gradient-to-r from-green-400 to-green-500 rounded"></div>
              <span>Individual Member Commission</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-0.5 bg-gray-400"></div>
              <span>Team Target (10% of quota)</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-gray-800 font-medium">%</span>
              <span>Attainment Percentage</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-gradient-to-r from-green-500 to-green-600 rounded"></div>
              <span>Commission Earned</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-0.5 bg-gray-400"></div>
              <span>Target Commission (10% of quota)</span>
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
            {isTeamView ? chartData.length : commissions.length}
          </div>
          <div className="text-sm text-gray-600">Periods</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">
            £{isTeamView 
              ? chartData.reduce((sum: number, period: any) => sum + period.total_commission, 0).toLocaleString()
              : commissions.reduce((sum, c) => sum + Number(c.commission_earned), 0).toLocaleString()
            }
          </div>
          <div className="text-sm text-gray-600">
            {isTeamView ? 'Team Total Earned' : 'Total Earned'}
          </div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">
            {isTeamView 
              ? (chartData.reduce((sum: number, period: any) => {
                  const periodAttainment = period.total_quota > 0 ? (period.total_actual / period.total_quota) * 100 : 0;
                  return sum + periodAttainment;
                }, 0) / chartData.length).toFixed(1)
              : (commissions.reduce((sum, c) => sum + Number(c.attainment_pct), 0) / commissions.length).toFixed(1)
            }%
          </div>
          <div className="text-sm text-gray-600">
            {isTeamView ? 'Avg Team Attainment' : 'Avg Attainment'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommissionChart;