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

  // Calculate max value for scaling
  const maxCommission = Math.max(...commissions.map(c => Number(c.commission_earned)));
  const maxQuota = Math.max(...commissions.map(c => Number(c.quota_amount)));
  const chartMax = Math.max(maxCommission, maxQuota * 0.1); // Use 10% of max quota as reasonable scale

  return (
    <div className="space-y-6">
      {/* Bar Chart */}
      <div className="relative">
        <div className="space-y-3">
          {commissions
            .sort((a, b) => new Date(a.period_start).getTime() - new Date(b.period_start).getTime())
            .map((commission) => {
              const periodLabel = new Date(commission.period_start).toLocaleDateString('en-GB', {
                month: 'short',
                year: '2-digit'
              });
              const commissionAmount = Number(commission.commission_earned);
              const quotaAmount = Number(commission.quota_amount);
              const actualAmount = Number(commission.actual_amount);
              const attainment = Number(commission.attainment_pct);
              
              // Calculate bar width as percentage of max
              const barWidth = chartMax > 0 ? (commissionAmount / chartMax) * 100 : 0;
              const quotaIndicator = chartMax > 0 ? (quotaAmount * 0.1 / chartMax) * 100 : 0; // 10% commission on quota as reference
              
              return (
                <div key={commission.id} className="group">
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
                        className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-lg transition-all duration-500 group-hover:from-green-600 group-hover:to-green-700"
                        style={{ width: `${Math.min(barWidth, 100)}%` }}
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
                    
                    {/* User badge for manager views */}
                    {isManager && managerView !== 'personal' && commission.user && (
                      <div className="w-16">
                        <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
                          {commission.user.first_name.charAt(0)}{commission.user.last_name.charAt(0)}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* Hover Details */}
                  <div className="hidden group-hover:block mt-2 ml-20 p-3 bg-gray-50 rounded-lg text-xs text-gray-600">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="font-medium">Period:</span> {new Date(commission.period_start).toLocaleDateString('en-GB')} - {new Date(commission.period_end).toLocaleDateString('en-GB')}
                      </div>
                      <div>
                        <span className="font-medium">Actual Sales:</span> £{actualAmount.toLocaleString()}
                      </div>
                      <div>
                        <span className="font-medium">Quota:</span> £{quotaAmount.toLocaleString()}
                      </div>
                      <div>
                        <span className="font-medium">Commission Rate:</span> {(Number(commission.commission_rate) * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
      
      {/* Chart Legend */}
      <div className="flex items-center justify-center space-x-6 text-xs text-gray-600 pt-4 border-t border-gray-200">
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
            £{commissions.reduce((sum, c) => sum + Number(c.commission_earned), 0).toLocaleString()}
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
    </div>
  );
};

export default CommissionChart;