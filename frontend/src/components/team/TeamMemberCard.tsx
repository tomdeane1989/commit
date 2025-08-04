import { useState } from 'react';
import { User, Mail, Building, Calendar, MoreVertical, Edit, Trash2, UserCheck, UserX, Users, Target } from 'lucide-react';

interface TeamMember {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_admin: boolean;
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
    // Legacy fields for backward compatibility
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
    target_period: {
      period_type: string;
      period_start: string;
      period_end: string;
    } | null;
    is_team_target: boolean;
    
    // New conditional metrics for dual/single progress meters
    personal_metrics?: {
      closedAmount: number;
      commitAmount: number;
      bestCaseAmount: number;
      pipelineAmount: number;
      quotaAmount: number;
      commissionRate: number;
      quotaProgress: number;
    } | null;
    team_metrics?: {
      closedAmount: number;
      commitAmount: number;
      bestCaseAmount: number;
      pipelineAmount: number;
      quotaAmount: number;
      commissionRate: number;
      quotaProgress: number;
      teamMemberCount: number;
    } | null;
    has_personal_quota: boolean;
    has_team_quota: boolean;
    display_mode: 'dual' | 'team_only' | 'personal_only' | 'none';
  };
}

interface TeamMemberCardProps {
  member: TeamMember;
  onEdit: (member: TeamMember) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, active: boolean) => void;
  onViewTeamTargets?: (member: TeamMember) => void;
}

export const TeamMemberCard: React.FC<TeamMemberCardProps> = ({
  member,
  onEdit,
  onDelete,
  onToggleActive,
  onViewTeamTargets
}) => {
  const [showActions, setShowActions] = useState(false);

  // Progress Meter Component
  const ProgressMeter = ({ 
    metrics, 
    title, 
    subtitle, 
    color = 'bg-gray-100',
    isTeam = false 
  }: {
    metrics: any;
    title: string;
    subtitle?: string;
    color?: string;
    isTeam?: boolean;
  }) => {
    const closedContribution = metrics.quotaAmount > 0
      ? (metrics.closedAmount / metrics.quotaAmount) * 100
      : 0;
      
    const commitContribution = metrics.quotaAmount > 0
      ? (metrics.commitAmount / metrics.quotaAmount) * 100
      : 0;
      
    const bestCaseContribution = metrics.quotaAmount > 0
      ? (metrics.bestCaseAmount / metrics.quotaAmount) * 100
      : 0;

    const totalProgress = closedContribution + commitContribution + bestCaseContribution;

    return (
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <p className="text-xs text-gray-500">{title}</p>
            {subtitle && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {subtitle}
              </span>
            )}
            {isTeam && metrics.teamMemberCount && (
              <span className="ml-2 text-xs text-gray-400">
                ({metrics.teamMemberCount} members)
              </span>
            )}
          </div>
          <p className="text-xs text-gray-600">{totalProgress.toFixed(1)}%</p>
        </div>
        
        {/* Three-tier Stacked Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-1 relative overflow-hidden">
          {/* Best Case (bottom layer - full width) */}
          <div
            className="absolute inset-0 bg-yellow-300 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(totalProgress, 100)}%` }}
          />
          {/* Commit (middle layer) */}
          <div
            className="absolute inset-0 bg-blue-400 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(closedContribution + commitContribution, 100)}%` }}
          />
          {/* Closed Won (top layer) */}
          <div
            className={`absolute inset-0 rounded-full transition-all duration-300 ${
              closedContribution >= 100
                ? 'bg-green-600'
                : closedContribution >= 75
                ? 'bg-green-500'
                : 'bg-green-400'
            }`}
            style={{ width: `${Math.min(closedContribution, 100)}%` }}
          />
        </div>
        
        {/* Progress Breakdown */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
          <div className="flex items-center">
            <div className="w-2 h-2 bg-green-400 rounded-full mr-1"></div>
            <span>Closed: {new Intl.NumberFormat('en-GB', {
              style: 'currency',
              currency: 'GBP',
              notation: 'compact'
            }).format(metrics.closedAmount)}</span>
          </div>
          <div className="flex items-center">
            <div className="w-2 h-2 bg-blue-400 rounded-full mr-1"></div>
            <span>Commit: {new Intl.NumberFormat('en-GB', {
              style: 'currency',
              currency: 'GBP',
              notation: 'compact'
            }).format(metrics.commitAmount)}</span>
          </div>
          <div className="flex items-center">
            <div className="w-2 h-2 bg-yellow-300 rounded-full mr-1"></div>
            <span>Best Case: {new Intl.NumberFormat('en-GB', {
              style: 'currency',
              currency: 'GBP',
              notation: 'compact'
            }).format(metrics.bestCaseAmount)}</span>
          </div>
          <div className="flex items-center">
            <div className="w-2 h-2 bg-gray-400 rounded-full mr-1"></div>
            <span>Pipeline: {new Intl.NumberFormat('en-GB', {
              style: 'currency',
              currency: 'GBP',
              notation: 'compact'
            }).format(metrics.pipelineAmount)}</span>
          </div>
        </div>
        
        {/* Quota Info */}
        <div className="text-xs text-gray-500">
          Quota: {new Intl.NumberFormat('en-GB', {
            style: 'currency',
            currency: 'GBP',
            notation: 'compact'
          }).format(metrics.quotaAmount)}
        </div>
      </div>
    );
  };

  // Format period display
  const formatPeriod = (targetPeriod: { period_type: string; period_start: string; period_end: string } | null) => {
    if (!targetPeriod) return 'No Target';
    
    const startDate = new Date(targetPeriod.period_start);
    const endDate = new Date(targetPeriod.period_end);
    const startYear = startDate.getFullYear();
    const endYear = endDate.getFullYear();
    
    if (targetPeriod.period_type === 'quarterly') {
      const quarter = Math.ceil((startDate.getMonth() + 1) / 3);
      return `Q${quarter} ${startYear}`;
    } else if (targetPeriod.period_type === 'monthly') {
      return startDate.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
    } else if (targetPeriod.period_type === 'yearly') {
      return startYear === endYear ? `${startYear}` : `${startYear}-${endYear}`;
    }
    
    return `${startDate.toLocaleDateString('en-GB', { month: 'short' })} - ${endDate.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`;
  };

  // Calculate individual contributions (for stacked progress bar)
  const closedContribution = member.performance.current_quota > 0
    ? (member.performance.closed_won_amount / member.performance.current_quota) * 100
    : 0;
    
  const commitContribution = member.performance.current_quota > 0
    ? (member.performance.commit_amount / member.performance.current_quota) * 100
    : 0;
    
  const bestCaseContribution = member.performance.current_quota > 0
    ? (member.performance.best_case_amount / member.performance.current_quota) * 100
    : 0;

  // Total quota progress (closed + commit + best case)
  const totalQuotaProgress = closedContribution + commitContribution + bestCaseContribution;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow relative">
      {/* Actions Menu */}
      <div className="absolute top-4 right-4">
        <button
          onClick={() => setShowActions(!showActions)}
          className="p-1 text-gray-400 hover:text-gray-600 rounded-md"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
        
        {showActions && (
          <div className="absolute right-0 top-8 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 min-w-40">
            <button
              onClick={() => {
                onEdit(member);
                setShowActions(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center"
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit Member
            </button>
            
            {/* Team Aggregation option - only for managers */}
            {member.is_manager && onViewTeamTargets && (
              <button
                onClick={() => {
                  onViewTeamTargets(member);
                  setShowActions(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center"
              >
                <Target className="w-4 h-4 mr-2" />
                Aggregate Team Sales Target
              </button>
            )}
            <button
              onClick={() => {
                onToggleActive(member.id, !member.is_active);
                setShowActions(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center"
            >
              {member.is_active ? (
                <>
                  <UserX className="w-4 h-4 mr-2" />
                  Deactivate
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4 mr-2" />
                  Activate
                </>
              )}
            </button>
            <button
              onClick={() => {
                onDelete(member.id);
                setShowActions(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Member Info */}
      <div className="flex items-start space-x-4">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
          member.is_active ? 'bg-gray-100' : 'bg-gray-100'
        }`}
        style={member.is_active ? { backgroundColor: 'rgba(56, 64, 49, 0.1)' } : {}}>
          <User className={`w-6 h-6 ${member.is_active ? '' : 'text-gray-400'}`}
          style={member.is_active ? { color: '#82a365' } : {}} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {member.first_name} {member.last_name}
            </h3>
            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
              member.is_active
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800'
            }`}>
              {member.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          
          <div className="mt-1 space-y-1">
            <div className="flex items-center text-sm text-gray-600">
              <Mail className="w-4 h-4 mr-2" />
              {member.email}
            </div>
            
            {/* Display permission level instead of role */}
            <div className="flex items-center text-sm text-gray-600">
              <Building className="w-4 h-4 mr-2" />
              <span>
                {member.is_admin ? 'Administrator' : member.is_manager ? 'Manager' : 'Sales User'}
              </span>
              {member.territory && (
                <span className="ml-2 px-2 py-1 bg-gray-100 text-xs rounded">
                  {member.territory}
                </span>
              )}
            </div>
            
            {member.hire_date && (
              <div className="flex items-center text-sm text-gray-600">
                <Calendar className="w-4 h-4 mr-2" />
                Hired {new Date(member.hire_date).toLocaleDateString('en-GB')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="mt-4 space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500">Open Deals</p>
            <p className="text-sm font-semibold text-gray-900">
              {new Intl.NumberFormat('en-GB', {
                style: 'currency',
                currency: 'GBP',
                minimumFractionDigits: 0
              }).format(member.performance.open_deals_amount)}
            </p>
          </div>
          
          <div>
            <p className="text-xs text-gray-500">Commissions</p>
            <p className="text-sm font-semibold text-gray-900">
              {new Intl.NumberFormat('en-GB', {
                style: 'currency',
                currency: 'GBP',
                minimumFractionDigits: 0
              }).format(member.performance.total_commissions)}
            </p>
          </div>
        </div>

        {/* Conditional Progress Meters */}
        {member.performance.display_mode === 'dual' && member.performance.personal_metrics && member.performance.team_metrics && (
          <div className="space-y-4">
            {/* Personal Progress Meter */}
            <ProgressMeter
              metrics={member.performance.personal_metrics}
              title="Personal Quota Progress"
              subtitle="Individual"
            />
            
            {/* Divider */}
            <div className="border-t border-gray-200"></div>
            
            {/* Team Progress Meter */}
            <ProgressMeter
              metrics={member.performance.team_metrics}
              title="Team Quota Progress"
              subtitle="Aggregated"
              isTeam={true}
            />
          </div>
        )}
        
        {member.performance.display_mode === 'personal_only' && member.performance.personal_metrics && (
          <ProgressMeter
            metrics={member.performance.personal_metrics}
            title="Quota Progress"
          />
        )}
        
        {member.performance.display_mode === 'team_only' && member.performance.team_metrics && (
          <ProgressMeter
            metrics={member.performance.team_metrics}
            title="Team Quota Progress"
            subtitle="Team Target"
            isTeam={true}
          />
        )}
        
        {/* Legacy fallback for backward compatibility */}
        {member.performance.display_mode === 'none' && member.performance.current_quota > 0 && (
          <div>
            <div className="flex justify-between items-center mb-1">
              <p className="text-xs text-gray-500">Quota Progress</p>
              <p className="text-xs text-gray-600">{member.performance.quota_attainment.toFixed(1)}%</p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-400 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(member.performance.quota_attainment, 100)}%` }}
              />
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Quota: {new Intl.NumberFormat('en-GB', {
                style: 'currency',
                currency: 'GBP',
                notation: 'compact'
              }).format(member.performance.current_quota)}
            </div>
          </div>
        )}

        {/* Manager Info */}
        {member.manager && (
          <div>
            <p className="text-xs text-gray-500">Reports to</p>
            <p className="text-sm text-gray-700">
              {member.manager.first_name} {member.manager.last_name}
            </p>
          </div>
        )}

        {/* Reports Count */}
        {member.reports_count > 0 && (
          <div>
            <p className="text-xs text-gray-500">Direct Reports</p>
            <p className="text-sm text-gray-700">{member.reports_count} team members</p>
          </div>
        )}
      </div>
    </div>
  );
};