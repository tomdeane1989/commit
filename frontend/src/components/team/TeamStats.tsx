import { useState } from 'react';
import { Users, Target, TrendingUp, DollarSign } from 'lucide-react';

interface TeamMember {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  hire_date: string | null;
  territory: string | null;
  created_at: string;
  manager: {
    first_name: string;
    last_name: string;
    email: string;
  } | null;
  reports_count: number;
  performance: {
    open_deals_amount: number;
    closed_won_amount: number;
    commit_amount: number;
    best_case_amount: number;
    quota_progress_amount: number;
    current_quota: number;
    total_commissions: number;
    open_deals_count: number;
    closed_won_count: number;
    commit_count: number;
    best_case_count: number;
    quota_attainment: number;
  };
}

interface TeamStatsProps {
  members: TeamMember[];
}

export const TeamStats: React.FC<TeamStatsProps> = ({ members }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const activeMembers = members.filter(m => m.is_active);
  const totalOpenDeals = activeMembers.reduce((sum, m) => sum + m.performance.open_deals_amount, 0);
  const totalQuota = activeMembers.reduce((sum, m) => sum + m.performance.current_quota, 0);
  const totalCommissions = activeMembers.reduce((sum, m) => sum + m.performance.total_commissions, 0);
  
  // Calculate cash attainment components
  const totalClosedWon = activeMembers.reduce((sum, m) => sum + m.performance.closed_won_amount, 0);
  const totalCommit = activeMembers.reduce((sum, m) => sum + m.performance.commit_amount, 0);
  const totalBestCase = activeMembers.reduce((sum, m) => sum + m.performance.best_case_amount, 0);
  const totalProgress = totalClosedWon + totalCommit + totalBestCase;
  const quotaAttainment = totalQuota > 0 ? (totalProgress / totalQuota) * 100 : 0;

  const stats = [
    {
      label: 'Active Team Members',
      value: activeMembers.length,
      total: members.length,
      icon: Users,
      color: 'indigo'
    },
    {
      label: 'Open Pipeline',
      value: new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'GBP',
        minimumFractionDigits: 0
      }).format(totalOpenDeals),
      icon: TrendingUp,
      color: 'blue'
    },
    {
      label: 'Team Quota',
      value: new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'GBP',
        minimumFractionDigits: 0
      }).format(totalQuota),
      subtitle: `${quotaAttainment.toFixed(1)}% attainment`,
      icon: Target,
      color: 'purple',
      hasTooltip: true,
      tooltipData: {
        totalProgress: totalProgress,
        closedWon: totalClosedWon,
        commit: totalCommit,
        bestCase: totalBestCase,
        quota: totalQuota,
        attainment: quotaAttainment
      }
    },
    {
      label: 'Total Commissions',
      value: new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'GBP',
        minimumFractionDigits: 0
      }).format(totalCommissions),
      icon: DollarSign,
      color: 'green'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        const colorClasses = {
          indigo: 'bg-indigo-500 text-indigo-100',
          blue: 'bg-blue-500 text-blue-100',
          purple: 'bg-purple-500 text-purple-100',
          green: 'bg-green-500 text-green-100'
        };

        return (
          <div 
            key={index} 
            className={`bg-white rounded-xl border border-gray-200 p-6 ${stat.hasTooltip ? 'relative' : ''}`}
            onMouseEnter={() => stat.hasTooltip && setShowTooltip(true)}
            onMouseLeave={() => stat.hasTooltip && setShowTooltip(false)}
          >
            <div className="flex items-center">
              <div className={`p-3 rounded-lg ${colorClasses[stat.color]}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stat.value}
                  {stat.total && (
                    <span className="text-base font-normal text-gray-500">
                      /{stat.total}
                    </span>
                  )}
                </p>
                {stat.subtitle && (
                  <p className="text-sm text-gray-500">{stat.subtitle}</p>
                )}
              </div>
            </div>
            
            {/* Tooltip for Team Quota */}
            {stat.hasTooltip && showTooltip && stat.tooltipData && (
              <div className="absolute z-50 bg-gray-900 text-white text-sm rounded-lg p-4 shadow-lg top-full mt-2 left-1/2 -translate-x-1/2 w-64">
                <div className="space-y-2">
                  <div className="font-semibold border-b border-gray-700 pb-2">
                    Cash Attainment Breakdown
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-300">Closed Won:</span>
                    <span className="font-medium">
                      {new Intl.NumberFormat('en-GB', {
                        style: 'currency',
                        currency: 'GBP',
                        minimumFractionDigits: 0
                      }).format(stat.tooltipData.closedWon)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-300">Commit:</span>
                    <span className="font-medium">
                      {new Intl.NumberFormat('en-GB', {
                        style: 'currency',
                        currency: 'GBP',
                        minimumFractionDigits: 0
                      }).format(stat.tooltipData.commit)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-orange-300">Best Case:</span>
                    <span className="font-medium">
                      {new Intl.NumberFormat('en-GB', {
                        style: 'currency',
                        currency: 'GBP',
                        minimumFractionDigits: 0
                      }).format(stat.tooltipData.bestCase)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-gray-700 pt-2 font-semibold">
                    <span>Total Progress:</span>
                    <span>
                      {new Intl.NumberFormat('en-GB', {
                        style: 'currency',
                        currency: 'GBP',
                        minimumFractionDigits: 0
                      }).format(stat.tooltipData.totalProgress)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-300">
                    <span>vs Quota:</span>
                    <span>{stat.tooltipData.attainment.toFixed(1)}%</span>
                  </div>
                </div>
                {/* Tooltip arrow pointing up */}
                <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                  <div className="border-l-8 border-r-8 border-b-8 border-transparent border-b-gray-900"></div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};