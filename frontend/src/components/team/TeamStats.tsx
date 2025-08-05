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
    current_quota: number;
    total_commissions: number;
    open_deals_count: number;
  };
}

interface TeamStatsProps {
  members?: TeamMember[];
}

export const TeamStats: React.FC<TeamStatsProps> = ({ members = [] }) => {
  const activeMembers = members.filter(m => m.is_active);
  const totalOpenDeals = activeMembers.reduce((sum, m) => sum + m.performance.open_deals_amount, 0);
  const totalQuota = activeMembers.reduce((sum, m) => sum + m.performance.current_quota, 0);
  const totalCommissions = activeMembers.reduce((sum, m) => sum + m.performance.total_commissions, 0);
  const quotaAttainment = totalQuota > 0 ? (totalOpenDeals / totalQuota) * 100 : 0;

  const stats = [
    {
      label: 'Active Team Members',
      value: activeMembers.length,
      total: members?.length || 0,
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
      color: 'purple'
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
          <div key={index} className="bg-white rounded-xl border border-gray-200 p-6">
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
          </div>
        );
      })}
    </div>
  );
};