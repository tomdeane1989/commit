import React from 'react';
import { X, Calendar, DollarSign, TrendingUp } from 'lucide-react';

interface Target {
  id: string;
  user_id: string;
  role: string | null;
  team_target: boolean;
  period_type: string;
  period_start: string;
  period_end: string;
  quota_amount: number;
  commission_rate: number;
  is_active: boolean;
  distribution_method?: string | null;
  distribution_config?: any | null;
  parent_target_id?: string | null;
  user: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
}

interface TargetDistributionModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: Target | null;
}

export const TargetDistributionModal: React.FC<TargetDistributionModalProps> = ({
  isOpen,
  onClose,
  target
}) => {
  if (!isOpen || !target) return null;

  const getDistributionBreakdown = () => {
    if (!target.distribution_config) return [];
    
    const method = target.distribution_method;
    const config = target.distribution_config;
    
    switch (method) {
      case 'seasonal':
        return getSeasonalBreakdown(config.seasonal, target.quota_amount);
      case 'custom':
        return config.custom || [];
      case 'one-time':
        return [{
          period_name: 'One-time Target',
          period_start: target.period_start,
          period_end: target.period_end,
          quota_amount: target.quota_amount,
          period_type: 'custom'
        }];
      default:
        return [];
    }
  };

  const getSeasonalBreakdown = (seasonalConfig: any, totalQuota: number) => {
    if (!seasonalConfig) return [];
    
    const { seasonal_granularity, seasonal_allocation_method, seasonal_allocations } = seasonalConfig;
    const breakdown = [];
    
    if (seasonal_granularity === 'quarterly') {
      const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
      quarters.forEach(quarter => {
        const allocation = seasonal_allocations[quarter] || 0;
        let quotaAmount;
        
        if (seasonal_allocation_method === 'percentage') {
          quotaAmount = totalQuota * (allocation / 100);
        } else {
          quotaAmount = allocation;
        }
        
        breakdown.push({
          period_name: `${quarter} (${getQuarterMonths(quarter)})`,
          period_start: getQuarterStartDate(quarter, target.period_start),
          period_end: getQuarterEndDate(quarter, target.period_start),
          quota_amount: quotaAmount,
          allocation_value: allocation,
          allocation_type: seasonal_allocation_method,
          period_type: 'quarterly'
        });
      });
    } else {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      months.forEach(month => {
        const allocation = seasonal_allocations[month] || 0;
        let quotaAmount;
        
        if (seasonal_allocation_method === 'percentage') {
          quotaAmount = totalQuota * (allocation / 100);
        } else {
          quotaAmount = allocation;
        }
        
        breakdown.push({
          period_name: getFullMonthName(month),
          period_start: getMonthStartDate(month, target.period_start),
          period_end: getMonthEndDate(month, target.period_start),
          quota_amount: quotaAmount,
          allocation_value: allocation,
          allocation_type: seasonal_allocation_method,
          period_type: 'monthly'
        });
      });
    }
    
    return breakdown;
  };

  const getQuarterMonths = (quarter: string): string => {
    switch (quarter) {
      case 'Q1': return 'Jan-Mar';
      case 'Q2': return 'Apr-Jun';
      case 'Q3': return 'Jul-Sep';
      case 'Q4': return 'Oct-Dec';
      default: return '';
    }
  };

  const getFullMonthName = (monthKey: string): string => {
    const months = {
      'Jan': 'January', 'Feb': 'February', 'Mar': 'March', 'Apr': 'April',
      'May': 'May', 'Jun': 'June', 'Jul': 'July', 'Aug': 'August',
      'Sep': 'September', 'Oct': 'October', 'Nov': 'November', 'Dec': 'December'
    };
    return months[monthKey] || monthKey;
  };

  // Simplified date calculations - in a real app, you'd want more precise date handling
  const getQuarterStartDate = (quarter: string, targetStart: string): string => {
    const year = new Date(targetStart).getFullYear();
    const quarterStartMonths = { Q1: 0, Q2: 3, Q3: 6, Q4: 9 };
    return new Date(year, quarterStartMonths[quarter], 1).toISOString().split('T')[0];
  };

  const getQuarterEndDate = (quarter: string, targetStart: string): string => {
    const year = new Date(targetStart).getFullYear();
    const quarterEndMonths = { Q1: 2, Q2: 5, Q3: 8, Q4: 11 };
    const month = quarterEndMonths[quarter];
    return new Date(year, month + 1, 0).toISOString().split('T')[0];
  };

  const getMonthStartDate = (monthKey: string, targetStart: string): string => {
    const year = new Date(targetStart).getFullYear();
    const monthIndex = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(monthKey);
    return new Date(year, monthIndex, 1).toISOString().split('T')[0];
  };

  const getMonthEndDate = (monthKey: string, targetStart: string): string => {
    const year = new Date(targetStart).getFullYear();
    const monthIndex = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(monthKey);
    return new Date(year, monthIndex + 1, 0).toISOString().split('T')[0];
  };

  const breakdown = getDistributionBreakdown();
  const method = target.distribution_method || 'even';
  
  const methodInfo = {
    seasonal: { icon: '📊', name: 'Seasonal Distribution', color: 'text-blue-600' },
    custom: { icon: '⚙️', name: 'Custom Distribution', color: 'text-yellow-600' },
    'one-time': { icon: '🎯', name: 'One-time Target', color: 'text-green-600' }
  };

  const info = methodInfo[method] || { icon: '📈', name: 'Even Distribution', color: 'text-gray-600' };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <span className="text-2xl mr-3">{info.icon}</span>
            <div>
              <h2 className={`text-xl font-semibold ${info.color}`}>{info.name}</h2>
              <p className="text-sm text-gray-600">
                {target.user ? `${target.user.first_name} ${target.user.last_name}` : 
                 target.role ? `All ${target.role.replace('_', ' ')}s` : 'Team Target'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Target Summary */}
        <div className="p-6 bg-gray-50 border-b">
          <div className="grid grid-cols-3 gap-6">
            <div className="flex items-center">
              <DollarSign className="w-5 h-5 text-green-600 mr-2" />
              <div>
                <div className="text-sm text-gray-600">Total Annual Quota</div>
                <div className="text-lg font-semibold text-gray-900">
                  {new Intl.NumberFormat('en-GB', {
                    style: 'currency',
                    currency: 'GBP',
                    minimumFractionDigits: 0
                  }).format(target.quota_amount)}
                </div>
              </div>
            </div>
            <div className="flex items-center">
              <TrendingUp className="w-5 h-5 text-blue-600 mr-2" />
              <div>
                <div className="text-sm text-gray-600">Commission Rate</div>
                <div className="text-lg font-semibold text-gray-900">
                  {(target.commission_rate * 100).toFixed(1)}%
                </div>
              </div>
            </div>
            <div className="flex items-center">
              <Calendar className="w-5 h-5 text-purple-600 mr-2" />
              <div>
                <div className="text-sm text-gray-600">Target Period</div>
                <div className="text-lg font-semibold text-gray-900">
                  {new Date(target.period_start).toLocaleDateString('en-GB')} - {new Date(target.period_end).toLocaleDateString('en-GB')}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Distribution Breakdown */}
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Distribution Breakdown</h3>
          
          {breakdown.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Period
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date Range
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quota Amount
                    </th>
                    {method === 'seasonal' && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Allocation
                      </th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      % of Total
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {breakdown.map((period, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {period.period_name}
                        </div>
                        <div className="text-xs text-gray-500 capitalize">
                          {period.period_type}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                        {new Date(period.period_start).toLocaleDateString('en-GB')} - {new Date(period.period_end).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {new Intl.NumberFormat('en-GB', {
                            style: 'currency',
                            currency: 'GBP',
                            minimumFractionDigits: 0
                          }).format(period.quota_amount)}
                        </div>
                      </td>
                      {method === 'seasonal' && (
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                          {period.allocation_type === 'percentage' ? 
                            `${period.allocation_value}%` : 
                            new Intl.NumberFormat('en-GB', {
                              style: 'currency',
                              currency: 'GBP',
                              minimumFractionDigits: 0
                            }).format(period.allocation_value)
                          }
                        </td>
                      )}
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                        {((period.quota_amount / target.quota_amount) * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No distribution breakdown available for this target.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};