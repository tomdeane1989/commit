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

interface TeamMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
}

interface CommissionChartProps {
  commissions: Commission[];
  isManager: boolean;
  managerView: string;
  isCalculating?: boolean;
  teamMembers?: TeamMember[];
}

const CommissionChart: React.FC<CommissionChartProps> = ({
  commissions,
  isManager,
  managerView,
  isCalculating = false,
  teamMembers = []
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
    
    // Ensure all team members appear in each period, even with zero commissions
    if (teamMembers.length > 0) {
      chartData.forEach((period: any) => {
        teamMembers.forEach(teamMember => {
          const existingMember = period.members.find((m: any) => m.user?.id === teamMember.id);
          if (!existingMember) {
            // Add team member with zero commission data
            period.members.push({
              user: {
                id: teamMember.id,
                first_name: teamMember.first_name,
                last_name: teamMember.last_name,
                email: teamMember.email
              },
              commission_earned: 0,
              quota_amount: 0,
              actual_amount: 0,
              attainment_pct: 0
            });
          }
        });
        
        // Sort members by name for consistent display
        period.members.sort((a: any, b: any) => {
          const nameA = `${a.user?.first_name} ${a.user?.last_name}`;
          const nameB = `${b.user?.first_name} ${b.user?.last_name}`;
          return nameA.localeCompare(nameB);
        });
      });
    }
    
    // Debug: Log team members found in commission data
    console.log('🔍 Team members in commission data (after padding):');
    chartData.forEach((period: any) => {
      console.log(`📅 ${period.period_start}:`, period.members.map((m: any) => `${m.user?.first_name} ${m.user?.last_name} (${m.user?.email}) £${m.commission_earned}`));
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
              // Team view - show stacked bar with member contributions
              const teamCommission = item.total_commission;
              const teamQuota = item.total_quota;
              const teamActual = item.total_actual;
              const teamAttainment = teamQuota > 0 ? (teamActual / teamQuota) * 100 : 0;
              
              const barWidth = chartMax > 0 ? (teamCommission / chartMax) * 100 : 0;
              const quotaIndicator = chartMax > 0 ? (teamQuota * 0.1 / chartMax) * 100 : 0;
              
              // Calculate member percentages of total commission
              const membersWithPercentages = item.members.map((member: any) => ({
                ...member,
                percentageOfTotal: teamCommission > 0 ? (member.commission_earned / teamCommission) * 100 : 0
              }));
              
              return (
                <div key={`team-${item.period_start}`} className="space-y-2">
                  {/* Period Label and Stats */}
                  <div className="flex items-center space-x-4">
                    <div className="w-16 text-sm font-medium text-gray-700 text-right">
                      {periodLabel}
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-gray-600 mb-1">
                        Sales Attainment: {teamAttainment.toFixed(1)}% • Total Commission: £{teamCommission.toLocaleString()}
                      </div>
                    </div>
                  </div>
                  
                  {/* Stacked Bar Container */}
                  <div className="flex items-center space-x-4">
                    <div className="w-16"></div> {/* Spacer for alignment */}
                    
                    <div className="flex-1 relative h-8 bg-gray-100 rounded-lg overflow-hidden">
                      {/* Quota Reference Line */}
                      <div 
                        className="absolute top-0 bottom-0 w-0.5 bg-gray-400 opacity-70 z-10"
                        style={{ left: `${Math.min(quotaIndicator, 100)}%` }}
                        title={`Team Commission Target: £${(teamQuota * 0.1).toLocaleString()}`}
                      />
                      
                      {/* Stacked Member Bars */}
                      <div className="flex h-full">
                        {membersWithPercentages.map((member: any, memberIndex: number) => {
                          const memberColors = [
                            '#10B981', // green
                            '#8B5CF6', // purple  
                            '#F59E0B', // orange
                            '#EC4899', // pink
                            '#6366F1'  // indigo
                          ];
                          const color = memberColors[memberIndex % memberColors.length];
                          const memberWidth = teamCommission > 0 ? (member.commission_earned / teamCommission) * barWidth : 0;
                          
                          if (member.commission_earned === 0) return null;
                          
                          return (
                            <div
                              key={`stack-${member.user?.id}`}
                              className="h-full relative"
                              style={{ 
                                width: `${memberWidth}%`,
                                backgroundColor: color
                              }}
                              title={`${member.user?.first_name} ${member.user?.last_name}: £${member.commission_earned.toLocaleString()} (${member.percentageOfTotal.toFixed(1)}% of team total)`}
                            >
                              {/* Member initials if bar is wide enough */}
                              {memberWidth > 8 && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <span className="text-xs font-medium text-white drop-shadow">
                                    {member.user?.first_name.charAt(0)}{member.user?.last_name.charAt(0)}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    
                    {/* Total Amount */}
                    <div className="w-28 text-sm font-bold text-gray-900 text-right">
                      £{teamCommission.toLocaleString()}
                    </div>
                  </div>
                  
                  {/* Member Legend */}
                  <div className="ml-20 flex flex-wrap gap-4 text-xs text-gray-600">
                    {membersWithPercentages.map((member: any, memberIndex: number) => {
                      const memberColors = [
                        '#10B981', '#8B5CF6', '#F59E0B', '#EC4899', '#6366F1'
                      ];
                      const color = memberColors[memberIndex % memberColors.length];
                      
                      return (
                        <div key={`legend-${member.user?.id}`} className="flex items-center space-x-1">
                          <div 
                            className="w-3 h-3 rounded"
                            style={{ backgroundColor: color }}
                          ></div>
                          <span>
                            {member.user?.first_name.charAt(0)}{member.user?.last_name.charAt(0)}: 
                            £{member.commission_earned.toLocaleString()}
                            {member.commission_earned > 0 && (
                              <span className="text-gray-500"> ({member.percentageOfTotal.toFixed(1)}%)</span>
                            )}
                          </span>
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