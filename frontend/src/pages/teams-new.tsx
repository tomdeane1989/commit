import React, { useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/layout';
import { useAuth } from '../hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teamsNewApi } from '../lib/api';
import { Target, Users, Settings, TrendingUp, Building2, Crown, Star, Plus, Edit, Trash2, Eye, EyeOff, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { TeamQuotaWizard } from '../components/team/TeamQuotaWizard';
import { TargetModal } from '../components/team/TargetModal';
import { TeamTargetInterceptModal } from '../components/team/TeamTargetInterceptModal';
import { InviteModal } from '../components/team/InviteModal';
import { InviteSuccessMessage } from '../components/team/InviteSuccessMessage';
import EditMemberModal from '../components/team/EditMemberModal';
import { TargetDistributionModal } from '../components/team/TargetDistributionModal';
import TeamAggregationModal from '../components/team/TeamAggregationModal';
import { TeamStats } from '../components/team/TeamStats';
import { TeamFilters } from '../components/team/TeamFilters';
import { TeamMemberCard } from '../components/team/TeamMemberCard';
import { targetsApi, teamApi, userManagementApi } from '../lib/api';

interface TeamMember {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  sub_role: string;
  team_role_override?: string;
  team_sub_role_override?: string;
  team_id: string;
  team_name: string;
  joined_date: string;
  is_team_lead: boolean;
  is_admin: boolean;
  is_manager: boolean;
  is_active: boolean;
  
  // Performance metrics
  closed_won_amount: number;
  commit_amount: number;
  best_case_amount: number;
  pipeline_amount: number;
  quota_amount: number;
  commission_rate: number;
  quota_progress: number;
  quota_attainment: number;
  calculated_commissions: number;
  
  // Counts
  closed_won_count: number;
  commit_count: number;
  best_case_count: number;
  pipeline_count: number;
  
  // Target info
  has_personal_quota: boolean;
  has_team_quota: boolean;
  target_period: string;
  
  // Management info
  reports_count: number;
  
  // Team aggregation (for team leads)
  team_metrics?: {
    team_closed_amount: number;
    team_commit_amount: number;
    team_best_case_amount: number;
    team_pipeline_amount: number;
    team_quota_amount: number;
    team_member_count: number;
    team_quota_attainment: number;
  };
  display_mode?: 'dual' | 'team_only' | 'personal_only';
}

interface Team {
  team_id: string;
  team_name: string;
  team_description: string;
  team_lead_id: string;
  default_role: string;
  default_sub_role: string;
  members: TeamMember[];
}

interface TeamsData {
  teams: Team[];
  period: string;
  date_range: {
    start: string;
    end: string;
  };
}

export default function TeamsNewPage() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<'monthly' | 'quarterly' | 'yearly'>('quarterly');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'members' | 'targets'>('members');
  
  // Target management state
  const [showQuotaWizard, setShowQuotaWizard] = useState(false);
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [showTargetIntercept, setShowTargetIntercept] = useState(false);
  const [interceptData, setInterceptData] = useState<any>(null);
  const [showInactiveTargets, setShowInactiveTargets] = useState(false);
  const [editingTarget, setEditingTarget] = useState<any>(null);
  const [expandedTargets, setExpandedTargets] = useState<Set<string>>(new Set());
  
  // User management state
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [successMessageOpen, setSuccessMessageOpen] = useState(false);
  const [invitedUserData, setInvitedUserData] = useState<{ email: string; tempPassword: string } | null>(null);
  
  // Advanced features state
  const [distributionModalOpen, setDistributionModalOpen] = useState(false);
  const [selectedTargetForDistribution, setSelectedTargetForDistribution] = useState<any>(null);
  const [showTeamAggregationModal, setShowTeamAggregationModal] = useState(false);
  const [selectedManager, setSelectedManager] = useState<TeamMember | null>(null);
  
  // Team filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showInactiveMembers, setShowInactiveMembers] = useState(false);

  // Fetch teams data
  const { data: teamsData, isLoading, error } = useQuery<TeamsData>({
    queryKey: ['teams-new', period, selectedTeamId],
    queryFn: () => teamsNewApi.getTeams({ 
      period,
      ...(selectedTeamId && { team_id: selectedTeamId })
    }),
    enabled: !!user
  });

  // Fetch targets data for targets tab
  const { data: targetsData, isLoading: targetsLoading } = useQuery({
    queryKey: ['targets', period, showInactiveTargets],
    queryFn: () => targetsApi.getTargets({ active_only: !showInactiveTargets }),
    enabled: !!user && activeTab === 'targets'
  });

  // Target mutation for deactivate/activate
  const deactivateTargetMutation = useMutation({
    mutationFn: (targetId: string) => targetsApi.deactivateTarget(targetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['targets'] });
      queryClient.invalidateQueries({ queryKey: ['teams-new'] });
    }
  });

  // Fetch available roles for invite modal
  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: () => userManagementApi.getRoles(),
    enabled: !!user
  });

  // User management mutations
  const inviteMutation = useMutation({
    mutationFn: teamApi.inviteTeamMember,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['teams-new'] });
      setInviteModalOpen(false);
      
      if (data.temp_password) {
        setInvitedUserData({
          email: data.user.email,
          tempPassword: data.temp_password
        });
        setSuccessMessageOpen(true);
      }
    }
  });

  const updateMemberMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => teamApi.updateTeamMember(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams-new'] });
      setShowEditModal(false);
      setEditingMember(null);
    }
  });

  const deleteMemberMutation = useMutation({
    mutationFn: teamApi.deactivateTeamMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams-new'] });
    }
  });

  // Group targets for display
  const groupedTargets = React.useMemo(() => {
    if (!targetsData?.targets) return [];
    
    const groups: { [key: string]: any[] } = {};
    
    targetsData.targets.forEach((target: any) => {
      if (target.role) {
        // Role-based target - group by role + period + quota + commission
        const key = `${target.role}-${target.period_start}-${target.period_end}-${target.quota_amount}-${target.commission_rate}`;
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push(target);
      } else if (target.team_target) {
        // Team target - group by team + period + quota + commission
        const key = `team-${target.period_start}-${target.period_end}-${target.quota_amount}-${target.commission_rate}`;
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push(target);
      } else {
        // Individual target - each gets its own group
        const key = `individual-${target.id}`;
        groups[key] = [target];
      }
    });
    
    return Object.values(groups);
  }, [targetsData]);

  if (!user) {
    return <div>Loading...</div>;
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading teams...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <p className="text-red-600">Error loading teams</p>
            <p className="text-gray-600 mt-2">{(error as Error).message}</p>
          </div>
        </div>
      </Layout>
    );
  }

  const teams = teamsData?.teams || [];
  const allMembers = teams.flatMap(team => team.members);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  // Helper function to get distribution type info
  const getDistributionInfo = (target: any) => {
    const method = target.distribution_method || 'even';
    
    switch (method) {
      case 'seasonal':
        const config = target.distribution_config?.seasonal;
        const granularity = config?.seasonal_granularity || 'quarterly';
        const allocMethod = config?.seasonal_allocation_method || 'percentage';
        return {
          label: `Seasonal (${granularity})`,
          color: 'bg-blue-100 text-blue-800',
          icon: '📊',
          description: `${allocMethod === 'percentage' ? 'Percentage' : 'Revenue'} based ${granularity} distribution`
        };
      case 'custom':
        const customPeriods = target.distribution_config?.custom?.length || 0;
        return {
          label: `Custom (${customPeriods} periods)`,
          color: 'bg-yellow-100 text-yellow-800',
          icon: '⚙️',
          description: `Custom breakdown across ${customPeriods} periods`
        };
      case 'one-time':
        return {
          label: 'One-time',
          color: 'bg-green-100 text-green-800',
          icon: '🎯',
          description: 'Single target for specific period'
        };
      default:
        return {
          label: 'Even',
          color: 'bg-gray-100 text-gray-800',
          icon: '📈',
          description: 'Evenly distributed across months'
        };
    }
  };

  // Toggle expanded state for a target group
  const toggleExpanded = (groupKey: string) => {
    setExpandedTargets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupKey)) {
        newSet.delete(groupKey);
      } else {
        newSet.add(groupKey);
      }
      return newSet;
    });
  };


  const getMemberDisplayName = (member: TeamMember) => {
    const effectiveRole = member.team_role_override || member.role;
    const effectiveSubRole = member.team_sub_role_override || member.sub_role;
    
    if (member.is_team_lead) {
      return `${effectiveRole} - Team Lead`;
    }
    
    return effectiveSubRole ? `${effectiveRole} - ${effectiveSubRole}` : effectiveRole;
  };

  // User management handlers
  const handleInviteSubmit = (data: any) => {
    inviteMutation.mutate(data);
  };

  const handleMemberEdit = (member: TeamMember) => {
    setEditingMember(member);
    setShowEditModal(true);
  };

  const handleSaveMemberEdit = (memberData: { id: string; first_name: string; last_name: string; role: string; territory: string; manager_id: string | null }) => {
    updateMemberMutation.mutate({
      id: memberData.id,
      data: {
        first_name: memberData.first_name,
        last_name: memberData.last_name,
        role: memberData.role,
        territory: memberData.territory,
        manager_id: memberData.manager_id
      }
    });
  };

  const handleMemberDelete = (id: string) => {
    if (confirm('Are you sure you want to deactivate this team member?')) {
      deleteMemberMutation.mutate(id);
    }
  };

  const handleToggleActive = (id: string, active: boolean) => {
    updateMemberMutation.mutate({ id, data: { is_active: active } });
  };


  // Filter team members for search and filters
  const filteredMembers = allMembers.filter((member: TeamMember) => {
    const matchesSearch = 
      member.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = !roleFilter || (member.team_role_override || member.role) === roleFilter;
    const matchesStatus = !statusFilter || 
      (statusFilter === 'active' && member.is_active) ||
      (statusFilter === 'inactive' && !member.is_active);
    
    const matchesActiveFilter = showInactiveMembers || member.is_active;
    
    return matchesSearch && matchesRole && matchesStatus && matchesActiveFilter;
  });

  // Get managers for invite modal
  const managers = allMembers.filter((member: TeamMember) => 
    (member.is_manager || member.is_admin) && member.is_active
  );

  const renderMemberCard = (member: TeamMember) => {
    const progressPercentage = member.quota_amount > 0 
      ? Math.min((member.quota_progress / member.quota_amount) * 100, 100)
      : 0;

    return (
      <div key={member.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold ${
              member.is_team_lead ? 'bg-purple-600' : 'bg-blue-600'
            }`}>
              {member.is_team_lead ? <Crown className="w-5 h-5" /> : member.first_name.charAt(0)}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">
                {member.first_name} {member.last_name}
              </h3>
              <p className="text-sm text-gray-500">{getMemberDisplayName(member)}</p>
              <p className="text-xs text-gray-400">{member.team_name}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {member.is_team_lead && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                <Crown className="w-3 h-3 mr-1" />
                Team Lead
              </span>
            )}
            {member.is_admin && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                Admin
              </span>
            )}
          </div>
        </div>

        {/* Personal Metrics */}
        {(member.has_personal_quota || member.display_mode !== 'team_only') && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Personal Performance</span>
              <span className="text-sm text-gray-500">{formatPercentage(member.quota_attainment)}</span>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(progressPercentage, 100)}%` }}
              ></div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Quota Progress</p>
                <p className="font-semibold">{formatCurrency(member.quota_progress)}</p>
              </div>
              <div className="text-right">
                <p className="text-gray-500">Target</p>
                <p className="font-semibold">{formatCurrency(member.quota_amount)}</p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 mt-3 text-xs">
              <div className="text-center">
                <p className="text-gray-500">Closed</p>
                <p className="font-medium text-green-600">{formatCurrency(member.closed_won_amount)}</p>
              </div>
              <div className="text-center">
                <p className="text-gray-500">Commit</p>
                <p className="font-medium text-blue-600">{formatCurrency(member.commit_amount)}</p>
              </div>
              <div className="text-center">
                <p className="text-gray-500">Best Case</p>
                <p className="font-medium text-orange-600">{formatCurrency(member.best_case_amount)}</p>
              </div>
              <div className="text-center">
                <p className="text-gray-500">Pipeline</p>
                <p className="font-medium text-gray-600">{formatCurrency(member.pipeline_amount)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Team Metrics (for team leads) */}
        {member.team_metrics && (
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-purple-700 flex items-center">
                <Users className="w-4 h-4 mr-1" />
                Team Performance ({member.team_metrics.team_member_count} members)
              </span>
              <span className="text-sm text-purple-600">{formatPercentage(member.team_metrics.team_quota_attainment)}</span>
            </div>
            
            <div className="w-full bg-purple-100 rounded-full h-2 mb-3">
              <div 
                className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(member.team_metrics.team_quota_attainment, 100)}%` }}
              ></div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Team Progress</p>
                <p className="font-semibold text-purple-700">
                  {formatCurrency(member.team_metrics.team_closed_amount + member.team_metrics.team_commit_amount + member.team_metrics.team_best_case_amount)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-gray-500">Team Target</p>
                <p className="font-semibold text-purple-700">{formatCurrency(member.team_metrics.team_quota_amount)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Commission */}
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Commission Earned</span>
            <span className="font-semibold text-green-600">{formatCurrency(member.calculated_commissions)}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <Building2 className="w-8 h-8 mr-3 text-blue-600" />
              Teams Dashboard
            </h1>
            <p className="text-gray-600 mt-2">Team-based performance management</p>
          </div>
          
          {/* Period Filter */}
          <div className="flex items-center space-x-3">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as 'monthly' | 'quarterly' | 'yearly')}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('members')}
              className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'members'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Users className="w-4 h-4 inline-block mr-2" />
              Team Management
            </button>
            <button
              onClick={() => setActiveTab('targets')}
              className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'targets'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Target className="w-4 h-4 inline-block mr-2" />
              Quotas & Targets
            </button>
          </nav>
        </div>

        {/* Team Selection */}
        {teams.length > 1 && (
          <div className="mb-6">
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Teams</option>
              {teams.map(team => (
                <option key={team.team_id} value={team.team_id}>
                  {team.team_name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Tab Content */}

        {/* Team Management Tab (formerly Members Tab) */}
        {activeTab === 'members' && (
          <div className="space-y-8">
            {/* Team Performance Overview */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center mb-6">
                <TrendingUp className="w-6 h-6 mr-3 text-green-600" />
                <h2 className="text-xl font-semibold text-gray-900">Team Performance Overview</h2>
              </div>
              <TeamStats members={filteredMembers} period={period} />
            </div>

            {/* Team Member Management */}
            <div>
              <div className="flex items-center mb-6">
                <Users className="w-6 h-6 mr-3 text-blue-600" />
                <h2 className="text-xl font-semibold text-gray-900">Team Members</h2>
              </div>
              
              {/* Team Filters */}
              <div className="mb-6">
                <TeamFilters
                  searchTerm={searchTerm}
                  setSearchTerm={setSearchTerm}
                  roleFilter={roleFilter}
                  setRoleFilter={setRoleFilter}
                  statusFilter={statusFilter}
                  setStatusFilter={setStatusFilter}
                  showInactiveMembers={showInactiveMembers}
                  setShowInactiveMembers={setShowInactiveMembers}
                  onInviteClick={() => setInviteModalOpen(true)}
                />
              </div>

              {/* Team Members Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredMembers.length === 0 ? (
                  <div className="col-span-full text-center py-12">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No team members found</h3>
                    <p className="text-gray-600 mb-4">Get started by inviting your first team member.</p>
                    <button
                      onClick={() => setInviteModalOpen(true)}
                      className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Invite Member
                    </button>
                  </div>
                ) : (
                  filteredMembers.map((member: TeamMember) => (
                    <TeamMemberCard
                      key={member.id}
                      member={member}
                      onEdit={handleMemberEdit}
                      onDelete={handleMemberDelete}
                      onToggleActive={handleToggleActive}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Targets Tab */}
        {activeTab === 'targets' && (
          <div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                  <Target className="w-6 h-6 mr-2 text-blue-600" />
                  Team Quotas & Targets
                </h2>
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setShowInactiveTargets(!showInactiveTargets)}
                      className={`inline-flex items-center px-3 py-2 border text-sm leading-4 font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                        showInactiveTargets
                          ? 'border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100'
                          : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                      }`}
                    >
                      {showInactiveTargets ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
                      {showInactiveTargets ? 'Hide Inactive' : 'Show Inactive'}
                    </button>
                  </div>
                  
                  <div className="border-l border-gray-300 h-6"></div>
                  
                  <button
                    onClick={() => setShowTargetModal(true)}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Set Target
                  </button>
                  <button
                    onClick={() => setShowQuotaWizard(true)}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <Settings className="w-4 h-4 mr-1" />
                    Quota Wizard
                  </button>
                </div>
              </div>
              
              {targetsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Loading targets...</p>
                </div>
              ) : groupedTargets && groupedTargets.length > 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Assigned To
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Period
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Quota
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Commission
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {groupedTargets.map((group: any[]) => {
                          const mainTarget = group[0];
                          const groupKey = mainTarget.role ? 
                            `${mainTarget.role}-${mainTarget.period_start}-${mainTarget.period_end}-${mainTarget.quota_amount}-${mainTarget.commission_rate}` : 
                            mainTarget.team_target ?
                            `team-${mainTarget.period_start}-${mainTarget.period_end}-${mainTarget.quota_amount}-${mainTarget.commission_rate}` :
                            `individual-${mainTarget.id}`;
                          const isExpanded = expandedTargets.has(groupKey);
                          const isRoleBased = !!mainTarget.role;
                          const isTeamTarget = !!mainTarget.team_target;
                          
                          return (
                            <React.Fragment key={groupKey}>
                              {/* Main target row */}
                              <tr className={`hover:bg-gray-50 ${isTeamTarget ? 'bg-purple-50' : ''}`}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center">
                                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                                      isTeamTarget ? 'bg-purple-100' : 
                                      isRoleBased ? 'bg-blue-100' : 'bg-gray-100'
                                    }`}>
                                      {isTeamTarget ? (
                                        <Users className="w-4 h-4 text-purple-600" />
                                      ) : !isRoleBased ? (
                                        <Users className="w-4 h-4 text-gray-600" />
                                      ) : (
                                        <Target className="w-4 h-4 text-blue-600" />
                                      )}
                                    </div>
                                    <div className="flex-1">
                                      <div className="flex items-center">
                                        <div className="text-sm font-medium text-gray-900">
                                          {isTeamTarget ? (
                                            'Team Aggregated Target'
                                          ) : !isRoleBased ? (
                                            (() => {
                                              const targetMember = teams.flatMap(team => team.members).find(member => member.id === mainTarget.user_id);
                                              return targetMember ? `${targetMember.first_name} ${targetMember.last_name}` : 'Unknown User';
                                            })()
                                          ) : (
                                            `All ${mainTarget.role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} Members`
                                          )}
                                        </div>
                                        {isTeamTarget && (
                                          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                            Team Target
                                          </span>
                                        )}
                                        {isRoleBased && !isTeamTarget && (
                                          <button
                                            onClick={() => toggleExpanded(groupKey)}
                                            className="ml-2 p-1 hover:bg-gray-200 rounded-full transition-colors"
                                          >
                                            {isExpanded ? (
                                              <ChevronDown className="w-4 h-4 text-gray-500" />
                                            ) : (
                                              <ChevronRight className="w-4 h-4 text-gray-500" />
                                            )}
                                          </button>
                                        )}
                                      </div>
                                      <div className="text-sm text-gray-500">
                                        <div className="flex items-center space-x-2">
                                          {isTeamTarget ? (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                              Team Target ({group.length} members)
                                            </span>
                                          ) : !isRoleBased ? (
                                            <>
                                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 mr-2">
                                                Individual
                                              </span>
                                              {(() => {
                                                const targetMember = teams.flatMap(team => team.members).find(member => member.id === mainTarget.user_id);
                                                const targetTeam = teams.find(team => team.members.some(member => member.id === mainTarget.user_id));
                                                return (
                                                  <>
                                                    <span className="text-gray-500">{targetMember?.email || 'N/A'}</span>
                                                    {targetTeam && (
                                                      <span className="text-gray-500">({targetTeam.team_name})</span>
                                                    )}
                                                  </>
                                                );
                                              })()}
                                            </>
                                          ) : (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                              Role-based ({group.length} members)
                                            </span>
                                          )}
                                          
                                          {/* Distribution Type Badge */}
                                          {(() => {
                                            const distInfo = getDistributionInfo(mainTarget);
                                            return (
                                              <span 
                                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${distInfo.color}`}
                                                title={distInfo.description}
                                              >
                                                <span className="mr-1">{distInfo.icon}</span>
                                                {distInfo.label}
                                              </span>
                                            );
                                          })()
                                        }
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900">
                                    {new Date(mainTarget.period_start).toLocaleDateString('en-GB')} - {new Date(mainTarget.period_end).toLocaleDateString('en-GB')}
                                  </div>
                                  <div className="text-sm text-gray-500 capitalize">
                                    {mainTarget.period_type}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-medium text-gray-900">
                                    {formatCurrency(Number(mainTarget.quota_amount))}
                                  </div>
                                  {(isRoleBased || isTeamTarget) && (
                                    <div className="text-xs text-gray-500">
                                      {isTeamTarget ? 'per team' : 'per person'}
                                    </div>
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900">
                                    {(Number(mainTarget.commission_rate) * 100).toFixed(1)}%
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                    mainTarget.is_active
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {mainTarget.is_active ? 'Active' : 'Inactive'}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center space-x-2">
                                    {/* View Distribution Button - only show for non-even distributions */}
                                    {mainTarget.distribution_method && mainTarget.distribution_method !== 'even' && (
                                      <button
                                        onClick={() => {
                                          setSelectedTargetForDistribution(mainTarget);
                                          setDistributionModalOpen(true);
                                        }}
                                        className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                        title="View distribution breakdown"
                                      >
                                        <Target className="w-4 h-4" />
                                      </button>
                                    )}
                                    {/* Expand/Collapse Button for distributed targets */}
                                    {mainTarget.distribution_method && mainTarget.distribution_method !== 'even' && (
                                      <button
                                        onClick={() => {
                                          if (expandedTargets.has(mainTarget.id)) {
                                            setExpandedTargets(prev => {
                                              const newSet = new Set(prev);
                                              newSet.delete(mainTarget.id);
                                              return newSet;
                                            });
                                          } else {
                                            setExpandedTargets(prev => new Set(prev).add(mainTarget.id));
                                          }
                                        }}
                                        className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                        title={expandedTargets.has(mainTarget.id) ? "Collapse periods" : "Expand periods"}
                                      >
                                        {expandedTargets.has(mainTarget.id) ? 
                                          <ChevronUp className="w-4 h-4" /> : 
                                          <ChevronDown className="w-4 h-4" />
                                        }
                                      </button>
                                    )}
                                    <button
                                      onClick={() => {
                                        setEditingTarget(mainTarget);
                                        setShowTargetModal(true);
                                      }}
                                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                      title="Edit target"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => {
                                        if (window.confirm(`Are you sure you want to ${mainTarget.is_active ? 'deactivate' : 'activate'} this target?`)) {
                                          deactivateTargetMutation.mutate(mainTarget.id);
                                        }
                                      }}
                                      disabled={deactivateTargetMutation.isPending}
                                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                      title="Delete target"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                              
                              {/* Expanded rows for role-based targets */}
                              {isRoleBased && isExpanded && group.map((target: any) => {
                                const targetMember = teams.flatMap(team => team.members).find(member => member.id === target.user_id);
                                const targetTeam = teams.find(team => team.members.some(member => member.id === target.user_id));
                                
                                return (
                                  <tr key={target.id} className="bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="flex items-center">
                                        <div className="w-8 h-8 mr-3" /> {/* Spacer */}
                                        <div className="flex-shrink-0 w-6 h-6 bg-white rounded-full flex items-center justify-center mr-3 border">
                                          <Users className="w-3 h-3 text-gray-600" />
                                        </div>
                                        <div>
                                          <div className="text-sm font-medium text-gray-900">
                                            {targetMember ? `${targetMember.first_name} ${targetMember.last_name}` : 'Unknown User'}
                                          </div>
                                          <div className="text-sm text-gray-500">
                                            {targetMember?.email || 'N/A'} {targetTeam && `(${targetTeam.team_name})`}
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="text-sm text-gray-700">
                                        Individual assignment
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="text-sm text-gray-700">
                                        {formatCurrency(Number(target.quota_amount))}
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="text-sm text-gray-700">
                                        {(Number(target.commission_rate) * 100).toFixed(1)}%
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                        target.is_active
                                          ? 'bg-green-100 text-green-800'
                                          : 'bg-gray-100 text-gray-800'
                                      }`}>
                                        {target.is_active ? 'Active' : 'Inactive'}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="flex items-center space-x-2">
                                        <button
                                          onClick={() => {
                                            setEditingTarget(target);
                                            setShowTargetModal(true);
                                          }}
                                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                          title="Edit target"
                                        >
                                          <Edit className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={() => {
                                            if (window.confirm(`Are you sure you want to ${target.is_active ? 'deactivate' : 'activate'} this target for ${targetMember?.first_name} ${targetMember?.last_name}?`)) {
                                              deactivateTargetMutation.mutate(target.id);
                                            }
                                          }}
                                          disabled={deactivateTargetMutation.isPending}
                                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                          title="Delete target"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Target className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p>No targets found for your teams</p>
                  <p className="text-sm mt-2">Use the buttons above to set individual or team targets.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modals */}
        {showQuotaWizard && (
          <TeamQuotaWizard
            isOpen={showQuotaWizard}
            onClose={() => setShowQuotaWizard(false)}
            onSubmit={(data) => {
              console.log('Team-based quota wizard data:', data);
              setShowQuotaWizard(false);
              // TODO: Submit to team-based targets API
            }}
            onResolveConflicts={(data) => {
              console.log('Resolving team-based conflicts:', data);
              // TODO: Handle conflicts in team-based system
            }}
            teams={teams}
            loading={false}
          />
        )}

        {showTargetModal && (
          <TargetModal
            isOpen={showTargetModal}
            onClose={() => {
              setShowTargetModal(false);
              setEditingTarget(null);
            }}
            onSubmit={(data) => {
              console.log('Target modal data:', data);
              if (editingTarget) {
                console.log('Editing existing target:', editingTarget.id);
              } else {
                console.log('Creating new target');
              }
              setShowTargetModal(false);
              setEditingTarget(null);
              // TODO: Submit to team-based targets API
            }}
            teamMembers={teams.flatMap(team => team.members.map(member => ({
              id: member.id,
              email: member.email,
              first_name: member.first_name,
              last_name: member.last_name,
              role: member.role,
              is_active: member.is_active
            })))}
            loading={false}
            editingTarget={editingTarget}
          />
        )}

        {showTargetIntercept && interceptData && (
          <TeamTargetInterceptModal
            isOpen={showTargetIntercept}
            onClose={() => setShowTargetIntercept(false)}
            interceptData={interceptData}
            onResolve={() => {
              setShowTargetIntercept(false);
              setInterceptData(null);
              // Refresh teams data
            }}
          />
        )}

        {/* User Management Modals */}
        <InviteModal
          isOpen={inviteModalOpen}
          onClose={() => setInviteModalOpen(false)}
          onSubmit={handleInviteSubmit}
          managers={managers}
          roles={rolesData || []}
          loading={inviteMutation.isPending}
        />

        <InviteSuccessMessage
          isOpen={successMessageOpen}
          onClose={() => {
            setSuccessMessageOpen(false);
            setInvitedUserData(null);
          }}
          email={invitedUserData?.email || ''}
          tempPassword={invitedUserData?.tempPassword || ''}
        />

        <EditMemberModal
          member={editingMember}
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditingMember(null);
          }}
          onSave={handleSaveMemberEdit}
        />

        {/* Advanced Feature Modals */}
        <TeamAggregationModal
          manager={selectedManager}
          isOpen={showTeamAggregationModal}
          onClose={() => {
            setShowTeamAggregationModal(false);
            setSelectedManager(null);
          }}
        />

        <TargetDistributionModal
          isOpen={distributionModalOpen}
          onClose={() => setDistributionModalOpen(false)}
          target={selectedTargetForDistribution}
        />
      </div>
    </Layout>
  );
}