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
import { QuotaWizard } from '../components/team/QuotaWizard';
import { Target, Users, Settings, TrendingUp, Plus, ChevronRight, ChevronDown } from 'lucide-react';

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

interface Target {
  id: string;
  user_id: string;
  role: string | null;
  period_type: string;
  period_start: string;
  period_end: string;
  quota_amount: number;
  commission_rate: number;
  is_active: boolean;
  user: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
}

const TeamPage = () => {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'members' | 'targets'>('members');
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Modals
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [quotaWizardOpen, setQuotaWizardOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  
  // Target filters
  const [showInactiveTargets, setShowInactiveTargets] = useState(false);
  const [expandedTargets, setExpandedTargets] = useState<Set<string>>(new Set());

  // Check if user has admin/manager permissions
  const canManageTeam = user?.role === 'admin' || user?.role === 'manager';

  // Fetch team data
  const { data: teamData, isLoading: teamLoading } = useQuery({
    queryKey: ['team'],
    queryFn: async () => {
      const response = await teamApi.getTeam();
      return response.team_members || [];
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      setInviteModalOpen(false);
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
      queryClient.invalidateQueries({ queryKey: ['team'] });
    }
  });

  // Delete team member mutation
  const deleteMemberMutation = useMutation({
    mutationFn: teamApi.deactivateTeamMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
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

  // Group targets for display
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
    setEditingMember(member);
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

  // Redirect if user doesn't have permission
  useEffect(() => {
    if (user && !canManageTeam) {
      router.push('/dashboard');
    }
  }, [user, canManageTeam, router]);


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
                        
                        return (
                          <React.Fragment key={groupKey}>
                            {/* Main target row */}
                            <tr className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center mr-3">
                                    {!isRoleBased ? (
                                      <Users className="w-4 h-4 text-gray-600" />
                                    ) : (
                                      <Target className="w-4 h-4 text-blue-600" />
                                    )}
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center">
                                      <div className="text-sm font-medium text-gray-900">
                                        {!isRoleBased ? (
                                          mainTarget.user ? `${mainTarget.user.first_name} ${mainTarget.user.last_name}` : 'N/A'
                                        ) : (
                                          `All ${mainTarget.role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}s`
                                        )}
                                      </div>
                                      {isRoleBased && (
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
                                      {!isRoleBased ? (
                                        <>
                                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 mr-2">
                                            Individual
                                          </span>
                                          {mainTarget.user?.email || 'N/A'}
                                        </>
                                      ) : (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                          Role-based ({group.length} members)
                                        </span>
                                      )}
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
                            </tr>
                            
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
    </Layout>
  );
};

export default TeamPage;