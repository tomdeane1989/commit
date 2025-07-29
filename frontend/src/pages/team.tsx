import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/layout';
import { useAuth } from '../hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teamApi, targetsApi } from '../lib/api';
import { TeamStats } from '../components/team/TeamStats';
import { TeamFilters } from '../components/team/TeamFilters';
import { TeamMemberCard } from '../components/team/TeamMemberCard';
import { InviteModal } from '../components/team/InviteModal';
import { InviteSuccessMessage } from '../components/team/InviteSuccessMessage';
import { QuotaWizard } from '../components/team/QuotaWizard';
import { TargetModal } from '../components/team/TargetModal';
import { TargetDistributionModal } from '../components/team/TargetDistributionModal';
import EditMemberModal from '../components/team/EditMemberModal';
import TeamAggregationModal from '../components/team/TeamAggregationModal';
import { Target, Users, Settings, TrendingUp, Plus, ChevronRight, ChevronDown, ChevronUp, Edit, Trash2, X } from 'lucide-react';

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
    open_deals_amount: number; // Pipeline deals (for reference)
    closed_won_amount: number;
    commit_amount: number;
    best_case_amount: number;
    quota_progress_amount: number; // closed + commit + best case
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
  };
}

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

const TeamPage = () => {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'members' | 'targets'>('members');
  
  // Period filter - default to quarterly
  const [periodFilter, setPeriodFilter] = useState<'monthly' | 'quarterly' | 'yearly'>('quarterly');
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Modals
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [quotaWizardOpen, setQuotaWizardOpen] = useState(false);
  const [distributionModalOpen, setDistributionModalOpen] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<Target | null>(null);
  
  // Success message state
  const [successMessageOpen, setSuccessMessageOpen] = useState(false);
  const [invitedUserData, setInvitedUserData] = useState<{ email: string; tempPassword: string } | null>(null);
  
  // Target filters
  const [showInactiveTargets, setShowInactiveTargets] = useState(false);
  const [expandedTargets, setExpandedTargets] = useState<Set<string>>(new Set());
  
  // Team member filters
  const [showInactiveMembers, setShowInactiveMembers] = useState(false);
  
  // Edit member modal state
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Team aggregation modal state
  const [selectedManager, setSelectedManager] = useState<TeamMember | null>(null);
  const [showTeamAggregationModal, setShowTeamAggregationModal] = useState(false);
  
  // Target edit modal state
  const [editingTarget, setEditingTarget] = useState<Target | null>(null);
  const [showTargetModal, setShowTargetModal] = useState(false);
  
  // Target distribution modal state (selectedTargetForDistribution only, distributionModalOpen declared above)
  const [selectedTargetForDistribution, setSelectedTargetForDistribution] = useState<Target | null>(null);
  
  // Debug log for inactive members toggle
  useEffect(() => {
    console.log('🔍 Team UI - showInactiveMembers state changed:', showInactiveMembers);
  }, [showInactiveMembers]);

  // Check if user has admin/manager permissions
  const canManageTeam = user?.role === 'manager';
  const isAdmin = user?.is_admin === true && user?.role === 'manager';

  // Redirect if user doesn't have permission - MUST be before conditional returns
  useEffect(() => {
    if (user && !canManageTeam) {
      router.push('/dashboard');
    }
  }, [user, canManageTeam, router]);

  // Fetch team data - MUST be called before any conditional returns
  const { data: teamData, isLoading: teamLoading } = useQuery({
    queryKey: ['team', user?.id, periodFilter, showInactiveMembers], // User-specific cache key
    queryFn: async () => {
      console.log('🔍 Team API - Fetching with params:', { 
        period: periodFilter, 
        show_inactive: showInactiveMembers.toString() 
      });
      const response = await teamApi.getTeam({ 
        period: periodFilter,
        show_inactive: showInactiveMembers.toString()
      });
      console.log('🔍 Team API - Response received:', response);
      console.log('🔍 Team API - Team members count:', response?.length || 0);
      console.log('🔍 Team API - Team members:', response?.map(m => ({
        name: `${m.first_name} ${m.last_name}`,
        email: m.email,
        is_active: m.is_active
      })));
      return response || [];
    },
    enabled: canManageTeam
  });

  // Fetch targets data
  const { data: targetsData, isLoading: targetsLoading } = useQuery({
    queryKey: ['targets', showInactiveTargets],
    queryFn: async () => {
      const response = await targetsApi.getTargets({ active_only: !showInactiveTargets });
      return response.targets || [];
    },
    enabled: canManageTeam
  });

  // Invite team member mutation
  const inviteMutation = useMutation({
    mutationFn: teamApi.inviteTeamMember,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['team', user?.id] });
      setInviteModalOpen(false);
      
      // Show success message with temporary password
      if (data.temp_password) {
        setInvitedUserData({
          email: data.user.email,
          tempPassword: data.temp_password
        });
        setSuccessMessageOpen(true);
      }
    }
  });

  // Create target mutation
  const createTargetMutation = useMutation({
    mutationFn: targetsApi.createTarget,
    onSuccess: (data) => {
      // Check if this is a conflict response
      if ((data as any).isConflict) {
        console.log('Conflict response received in onSuccess:', data);
        // Don't close the wizard, let it handle the conflict
        return;
      }
      
      queryClient.invalidateQueries({ queryKey: ['targets'] });
      setQuotaWizardOpen(false);
      
      // Show warning if some users were skipped or pro-rated
      if (data.warning || data.pro_rated_info) {
        let message = data.message;
        if (data.warning) message += `\n\nWarning: ${data.warning}`;
        if (data.pro_rated_info) message += `\n\nInfo: ${data.pro_rated_info}`;
        alert(message);
      }
    },
    onError: (error: any) => {
      console.error('Target creation error:', error);
      console.log('Error response:', error.response?.data);
      
      // Check if this is a conflict error and the wizard is open
      if (quotaWizardOpen && error.response?.data?.skipped_users && error.response.data.skipped_users.length > 0) {
        console.log('Conflicts detected, wizard should handle this');
        // Don't show alert, let the wizard handle it
        return;
      }
      
      // Show regular error
      const errorMessage = error.response?.data?.error || 'Failed to create target';
      const additionalMessage = error.response?.data?.message || '';
      
      alert(`Error: ${errorMessage}${additionalMessage ? `\n\n${additionalMessage}` : ''}`);
    }
  });

  // Resolve conflicts mutation
  const resolveConflictsMutation = useMutation({
    mutationFn: targetsApi.resolveConflicts,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['targets'] });
      setQuotaWizardOpen(false);
      
      // Show success message with details
      let message = data.message;
      if (data.pro_rated_info) message += `\n\nInfo: ${data.pro_rated_info}`;
      if (data.errors && data.errors.length > 0) {
        message += `\n\nSome errors occurred: ${data.errors.map((e: any) => e.error).join(', ')}`;
      }
      alert(message);
    },
    onError: (error: any) => {
      console.error('Conflict resolution error:', error);
      const errorMessage = error.response?.data?.error || 'Failed to resolve conflicts';
      alert(`Error: ${errorMessage}`);
    }
  });

  // Update team member mutation
  const updateMemberMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => teamApi.updateTeamMember(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', user?.id] });
    }
  });

  // Delete team member mutation
  const deleteMemberMutation = useMutation({
    mutationFn: teamApi.deactivateTeamMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', user?.id] });
    }
  });

  // Update target mutation
  const updateTargetMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => targetsApi.updateTarget(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['targets'] });
      setShowTargetModal(false);
      setEditingTarget(null);
    }
  });

  // Delete target mutation
  const deleteTargetMutation = useMutation({
    mutationFn: targetsApi.deactivateTarget,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['targets'] });
    }
  });

  // Filter team members
  const filteredMembers = (teamData || []).filter((member: TeamMember) => {
    const matchesSearch = 
      member.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = !roleFilter || member.role === roleFilter;
    const matchesStatus = !statusFilter || 
      (statusFilter === 'active' && member.is_active) ||
      (statusFilter === 'inactive' && !member.is_active);
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  // Get managers for invite modal
  const managers = (teamData || []).filter((member: TeamMember) => 
    member.role === 'manager' && member.is_active
  );

  // Group targets for display - MUST be before conditional returns
  const groupedTargets = React.useMemo(() => {
    if (!targetsData) return [];
    
    const groups: { [key: string]: Target[] } = {};
    
    targetsData.forEach((target: Target) => {
      if (target.role) {
        // Role-based target - group by role + period + quota + commission
        const key = `${target.role}-${target.period_start}-${target.period_end}-${target.quota_amount}-${target.commission_rate}`;
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

  // Show loading while authentication is in progress - AFTER all hooks
  if (authLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </Layout>
    );
  }

  // Helper function to get distribution type info
  const getDistributionInfo = (target: Target) => {
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

  // Handle invite submission
  const handleInviteSubmit = (data: any) => {
    inviteMutation.mutate(data);
  };

  // Handle target creation
  const handleTargetSubmit = (data: any) => {
    console.log('Submitting target data:', data);
    console.log('Current mutation state:', {
      isError: createTargetMutation.isError,
      error: createTargetMutation.error,
      isPending: createTargetMutation.isPending
    });
    createTargetMutation.mutate(data);
  };

  // Handle conflict resolution
  const handleResolveConflicts = (data: any) => {
    resolveConflictsMutation.mutate(data);
  };

  // Handle member edit
  const handleMemberEdit = (member: TeamMember) => {
    console.log('Member edit requested for:', member.email);
    setEditingMember(member);
    setShowEditModal(true);
  };

  // Handle saving member edits
  const handleSaveMemberEdit = (memberData: {
    id: string;
    first_name: string;
    last_name: string;
    role: string;
    territory: string;
    manager_id: string | null;
  }) => {
    updateMemberMutation.mutate(
      { 
        id: memberData.id, 
        data: {
          first_name: memberData.first_name,
          last_name: memberData.last_name,
          role: memberData.role,
          territory: memberData.territory,
          manager_id: memberData.manager_id
        }
      },
      {
        onSuccess: () => {
          setShowEditModal(false);
          setEditingMember(null);
          console.log('✅ Team member updated successfully');
        },
        onError: (error) => {
          console.error('❌ Error updating team member:', error);
        }
      }
    );
  };

  // Handle viewing team aggregation
  const handleViewTeamTargets = (manager: TeamMember) => {
    console.log('Team aggregation requested for manager:', manager.email);
    setSelectedManager(manager);
    setShowTeamAggregationModal(true);
  };

  // Handle member delete
  const handleMemberDelete = (id: string) => {
    if (confirm('Are you sure you want to deactivate this team member?')) {
      deleteMemberMutation.mutate(id);
    }
  };

  // Handle toggle active status
  const handleToggleActive = (id: string, active: boolean) => {
    updateMemberMutation.mutate({ id, data: { is_active: active } });
  };

  // Handle target edit
  const handleTargetEdit = (target: Target) => {
    console.log('Target edit requested for:', target.id);
    setEditingTarget(target);
    setShowTargetModal(true);
  };

  // Handle saving target edits
  const handleSaveTargetEdit = (targetData: any) => {
    if (editingTarget) {
      updateTargetMutation.mutate({
        id: editingTarget.id,
        data: {
          quota_amount: targetData.quota_amount,
          commission_rate: targetData.commission_rate,
          period_type: targetData.period_type,
          period_start: targetData.period_start,
          period_end: targetData.period_end,
        }
      });
    }
  };

  // Handle target delete
  const handleTargetDelete = (targetId: string) => {
    if (confirm('Are you sure you want to deactivate this target?')) {
      deleteTargetMutation.mutate(targetId);
    }
  };

  if (!canManageTeam) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-64">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600">You don't have permission to access team management.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Team Management</h1>
            <p className="text-gray-600 mt-1">
              Manage your team members and set performance targets
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Period Filter - only show on members tab */}
            {activeTab === 'members' && (
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setPeriodFilter('monthly')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    periodFilter === 'monthly'
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setPeriodFilter('quarterly')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    periodFilter === 'quarterly'
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Quarterly
                </button>
                <button
                  onClick={() => setPeriodFilter('yearly')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    periodFilter === 'yearly'
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Yearly
                </button>
              </div>
            )}
            
            {/* Tab Navigation */}
            <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('members')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'members'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Users className="w-4 h-4 inline mr-2" />
              Team Members
            </button>
            <button
              onClick={() => setActiveTab('targets')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'targets'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Target className="w-4 h-4 inline mr-2" />
              Targets & Quotas
            </button>
          </div>
          </div>
        </div>

        {/* Team Members Tab */}
        {activeTab === 'members' && (
          <>
            {/* Team Stats */}
            <TeamStats members={teamData || []} />

            {/* Filters */}
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

            {/* Team Members Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {teamLoading ? (
                // Loading skeletons
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
                    <div className="h-12 bg-gray-200 rounded mb-4" />
                    <div className="h-4 bg-gray-200 rounded mb-2" />
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                  </div>
                ))
              ) : filteredMembers.length === 0 ? (
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
                    onViewTeamTargets={handleViewTeamTargets}
                  />
                ))
              )}
            </div>
          </>
        )}

        {/* Targets Tab */}
        {activeTab === 'targets' && (
          <>
            {/* Targets Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Sales Targets & Quotas</h2>
                <p className="text-gray-600 mt-1">Set and manage performance targets for your team</p>
              </div>
              <div className="flex items-center space-x-4">
                {/* Show Inactive Toggle */}
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={showInactiveTargets}
                    onChange={(e) => setShowInactiveTargets(e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Show inactive targets</span>
                </label>
                
                <button
                  onClick={() => setQuotaWizardOpen(true)}
                  className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-medium rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg shadow-indigo-500/25"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Target
                </button>
              </div>
            </div>

            {/* Targets List */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {targetsLoading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto" />
                  <p className="text-gray-600 mt-2">Loading targets...</p>
                </div>
              ) : !targetsData || targetsData.length === 0 ? (
                <div className="p-8 text-center">
                  <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No targets found</h3>
                  <p className="text-gray-600 mb-4">Create your first target to start tracking team performance.</p>
                  <button
                    onClick={() => setQuotaWizardOpen(true)}
                    className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Target
                  </button>
                </div>
              ) : (
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
                      {groupedTargets.map((group: Target[]) => {
                        const mainTarget = group[0];
                        const groupKey = mainTarget.role ? 
                          `${mainTarget.role}-${mainTarget.period_start}-${mainTarget.period_end}-${mainTarget.quota_amount}-${mainTarget.commission_rate}` : 
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
                                          mainTarget.user ? `${mainTarget.user.first_name} ${mainTarget.user.last_name}` : 'N/A'
                                        ) : (
                                          `All ${mainTarget.role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}s`
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
                                            Team Target
                                          </span>
                                        ) : !isRoleBased ? (
                                          <>
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 mr-2">
                                              Individual
                                            </span>
                                            <span className="text-gray-500">{mainTarget.user?.email || 'N/A'}</span>
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
                                        })()}
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
                                  {new Intl.NumberFormat('en-GB', {
                                    style: 'currency',
                                    currency: 'GBP',
                                    minimumFractionDigits: 0
                                  }).format(mainTarget.quota_amount)}
                                </div>
                                {isRoleBased && (
                                  <div className="text-xs text-gray-500">
                                    per person
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                  {(mainTarget.commission_rate * 100).toFixed(1)}%
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
                                    onClick={() => handleTargetEdit(mainTarget)}
                                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Edit target"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleTargetDelete(mainTarget.id)}
                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Delete target"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                            
                            {/* Expanded rows for seasonal/custom distribution child targets */}
                            {expandedTargets.has(mainTarget.id) && mainTarget.distribution_method && mainTarget.distribution_method !== 'even' && (
                              <ChildTargetsDisplay parentTargetId={mainTarget.id} />
                            )}
                            
                            {/* Expanded rows for role-based targets */}
                            {isRoleBased && isExpanded && group.map((target: Target) => (
                              <tr key={target.id} className="bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center">
                                    <div className="w-8 h-8 mr-3" /> {/* Spacer */}
                                    <div className="flex-shrink-0 w-6 h-6 bg-white rounded-full flex items-center justify-center mr-3 border">
                                      <Users className="w-3 h-3 text-gray-600" />
                                    </div>
                                    <div>
                                      <div className="text-sm font-medium text-gray-900">
                                        {target.user ? `${target.user.first_name} ${target.user.last_name}` : 'N/A'}
                                      </div>
                                      <div className="text-sm text-gray-500">
                                        {target.user?.email || 'N/A'}
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
                                    {new Intl.NumberFormat('en-GB', {
                                      style: 'currency',
                                      currency: 'GBP',
                                      minimumFractionDigits: 0
                                    }).format(target.quota_amount)}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-700">
                                    {(target.commission_rate * 100).toFixed(1)}%
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
                                      onClick={() => handleTargetEdit(target)}
                                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                      title="Edit target"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => handleTargetDelete(target.id)}
                                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                      title="Delete target"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      <InviteModal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        onSubmit={handleInviteSubmit}
        managers={managers}
        loading={inviteMutation.isPending}
      />

      <QuotaWizard
        isOpen={quotaWizardOpen}
        onClose={() => setQuotaWizardOpen(false)}
        onSubmit={handleTargetSubmit}
        onResolveConflicts={handleResolveConflicts}
        teamMembers={teamData || []}
        loading={createTargetMutation.isPending || resolveConflictsMutation.isPending}
        onConflictDetected={(conflicts) => {
          console.log('Conflicts detected in team.tsx:', conflicts);
        }}
        mutationError={createTargetMutation.error}
        mutationData={createTargetMutation.data}
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

      <TeamAggregationModal
        manager={selectedManager}
        isOpen={showTeamAggregationModal}
        onClose={() => {
          setShowTeamAggregationModal(false);
          setSelectedManager(null);
        }}
      />

      <TargetModal
        isOpen={showTargetModal}
        onClose={() => {
          setShowTargetModal(false);
          setEditingTarget(null);
        }}
        onSubmit={handleSaveTargetEdit}
        teamMembers={teamData || []}
        loading={updateTargetMutation.isPending}
        editingTarget={editingTarget}
      />

      {/* Target Distribution Modal */}
      <TargetDistributionModal
        isOpen={distributionModalOpen}
        onClose={() => setDistributionModalOpen(false)}
        target={selectedTargetForDistribution}
      />
    </Layout>
  );
};

// Component to display child targets when expanded
const ChildTargetsDisplay: React.FC<{ parentTargetId: string }> = ({ parentTargetId }) => {
  const { data: childrenData, isLoading } = useQuery({
    queryKey: ['child-targets', parentTargetId],
    queryFn: () => targetsApi.getChildTargets(parentTargetId),
    enabled: !!parentTargetId
  });

  if (isLoading) {
    return (
      <tr>
        <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
          Loading child targets...
        </td>
      </tr>
    );
  }

  if (!childrenData?.children || childrenData.children.length === 0) {
    return (
      <tr>
        <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
          No child periods found
        </td>
      </tr>
    );
  }

  return (
    <>
      {childrenData.children.map((child: any) => (
        <tr key={child.id} className="bg-blue-50 border-l-4 border-blue-200">
          <td className="px-6 py-3 whitespace-nowrap">
            <div className="flex items-center">
              <div className="w-8 h-8 mr-3" /> {/* Spacer */}
              <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mr-3 border">
                <Target className="w-3 h-3 text-blue-600" />
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {child.distribution_config?.period_name || 'Period'}
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(child.period_start).toLocaleDateString('en-GB')} - {new Date(child.period_end).toLocaleDateString('en-GB')}
                </div>
              </div>
            </div>
          </td>
          <td className="px-6 py-3 whitespace-nowrap">
            <div className="text-sm font-medium text-gray-900">
              {new Intl.NumberFormat('en-GB', {
                style: 'currency',
                currency: 'GBP',
                minimumFractionDigits: 0
              }).format(child.quota_amount)}
            </div>
          </td>
          <td className="px-6 py-3 whitespace-nowrap">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              📅 Child Period
            </span>
          </td>
          <td className="px-6 py-3 whitespace-nowrap">
            <div className="text-xs text-gray-500">
              Child of parent target
            </div>
          </td>
        </tr>
      ))}
    </>
  );
};

export default TeamPage;