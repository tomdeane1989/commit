import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/layout';
import { useAuth } from '../hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { teamApi } from '../lib/api';
import { TeamStats } from '../components/team/TeamStats';
import { TeamFilters } from '../components/team/TeamFilters';
import { TeamMemberCard } from '../components/team/TeamMemberCard';
import { InviteModal } from '../components/team/InviteModal';
import { InviteSuccessMessage } from '../components/team/InviteSuccessMessage';
import EditMemberModal from '../components/team/EditMemberModal';
import { 
  Users, 
  Plus, 
  Edit, 
  Trash2, 
  UserPlus,
  UserMinus,
  ChevronDown,
  ChevronUp,
  Shield,
  User,
  Calendar,
  Target,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

interface TeamMember {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_admin: boolean;
  is_manager?: boolean;
  is_active: boolean;
  hire_date: string | null;
  territory: string | null;
  created_at: string;
  manager: {
    first_name: string;
    last_name: string;
    email: string;
  } | null;
  team_memberships?: Array<{
    team_id: string;
    team: {
      id: string;
      team_name: string;
    };
  }>;
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
    target_period: {
      period_type: string;
      period_start: string;
      period_end: string;
    } | null;
    is_team_target: boolean;
  };
}

interface Team {
  id: string;
  team_name: string;
  description?: string;
  team_lead?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  team_members: Array<{
    id: string;
    user: {
      id: string;
      first_name: string;
      last_name: string;
      email: string;
      role: string;
    };
  }>;
  _count: {
    team_members: number;
  };
  performance?: {
    closed_amount: number;
    open_amount: number;
    total_quota: number;
    member_count: number;
  };
}

const TeamPage = () => {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'members' | 'management'>('members');
  
  // Period filter - default to quarterly
  const [periodFilter, setPeriodFilter] = useState<'monthly' | 'quarterly' | 'yearly'>('quarterly');
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showInactiveMembers, setShowInactiveMembers] = useState(false);
  
  // Modal states
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [editMemberModalOpen, setEditMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<{ email: string; tempPassword: string } | null>(null);

  // Team management states
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [selectedTeamMembers, setSelectedTeamMembers] = useState<string[]>([]);

  // Check if user has admin/manager permissions using flags
  const canManageTeam = user?.is_admin === true || user?.is_manager === true;
  const isAdmin = user?.is_admin === true;
  
  // If user doesn't have permissions, redirect
  useEffect(() => {
    if (!authLoading && user && !canManageTeam) {
      router.push('/dashboard');
    }
  }, [user, canManageTeam, authLoading, router]);

  // Fetch team data - ALWAYS call hooks at top level
  const { data: teamData, isLoading: teamLoading } = useQuery({
    queryKey: ['team', user?.id, periodFilter, showInactiveMembers],
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
      console.log('🔍 Team API - Team members count:', response.team_members?.length || 0);
      console.log('🔍 Team API - Team members:', response.team_members?.map(m => ({
        name: `${m.first_name} ${m.last_name}`,
        email: m.email,
        is_active: m.is_active,
        is_admin: m.is_admin,
        is_manager: m.is_manager,
        role: m.role
      })));
      
      // Check specific member - Tom
      const tom = response.team_members?.find(m => m.email === 'tom@test.com');
      console.log('🔍 Team API - Tom\'s data:', tom);
      console.log('🔍 Team API - Tom is_admin:', tom?.is_admin, 'type:', typeof tom?.is_admin);
      console.log('🔍 Team API - Tom is_manager:', tom?.is_manager, 'type:', typeof tom?.is_manager);
      
      return response.team_members || [];
    },
    enabled: canManageTeam && !authLoading
  });

  // Fetch teams for management tab
  const { data: teamsData, isLoading: teamsLoading } = useQuery({
    queryKey: ['teams-management'],
    queryFn: async () => {
      const response = await api.get('/teams');
      return response.data;
    },
    enabled: canManageTeam && activeTab === 'management'
  });

  const teams = teamsData?.teams || [];

  // Invite team member mutation
  const inviteMemberMutation = useMutation({
    mutationFn: teamApi.inviteTeamMember,
    onSuccess: (data) => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['team'] });
      queryClient.invalidateQueries({ queryKey: ['targets'] });
      queryClient.invalidateQueries({ queryKey: ['team-aggregate'] });
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setInviteModalOpen(false);
      setInviteSuccess({
        email: data.user.email,
        tempPassword: data.temp_password
      });
    }
  });

  // Update team member mutation
  const updateMemberMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => teamApi.updateTeamMember(id, data),
    onSuccess: () => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['team'] });
      queryClient.invalidateQueries({ queryKey: ['teams-management'] });
      queryClient.invalidateQueries({ queryKey: ['targets'] });
      queryClient.invalidateQueries({ queryKey: ['team-aggregate'] });
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setEditMemberModalOpen(false);
      setEditingMember(null);
    },
    onError: (error) => {
      console.error('Update member error:', error);
      alert('Failed to update team member. Please try again.');
    }
  });

  // Delete team member mutation
  const deleteMemberMutation = useMutation({
    mutationFn: teamApi.deactivateTeamMember,
    onSuccess: () => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['team'] });
      queryClient.invalidateQueries({ queryKey: ['targets'] });
      queryClient.invalidateQueries({ queryKey: ['team-aggregate'] });
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });

  // Create team mutation
  const createTeamMutation = useMutation({
    mutationFn: async (teamData: any) => {
      const response = await api.post('/teams', teamData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams-management'] });
      setShowCreateModal(false);
    }
  });

  // Filter team members
  const filteredMembers = (teamData || []).filter((member: TeamMember) => {
    const matchesSearch = 
      member.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = !roleFilter || member.role === roleFilter;
    const matchesStatus = statusFilter === '' || 
      (statusFilter === 'active' && member.is_active) ||
      (statusFilter === 'inactive' && !member.is_active);

    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleMemberEdit = (member: TeamMember) => {
    setEditingMember(member);
    setEditMemberModalOpen(true);
  };

  const handleMemberDelete = async (id: string) => {
    if (confirm('Are you sure you want to deactivate this team member?')) {
      deleteMemberMutation.mutate(id);
    }
  };

  const handleToggleActive = (id: string, active: boolean) => {
    updateMemberMutation.mutate({
      id,
      data: { is_active: active }
    });
  };


  // Show loading if still checking auth
  if (authLoading) {
    return <Layout>Loading...</Layout>;
  }

  // Don't render if user doesn't have permissions
  if (!canManageTeam) {
    return null;
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header with Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Team Management</h1>
              <p className="text-gray-600 mt-1">Manage your team members and team structure</p>
            </div>
            {activeTab === 'members' && (
              <button
                onClick={() => setInviteModalOpen(true)}
                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <Plus className="w-4 h-4 mr-2" />
                Invite Member
              </button>
            )}
            {activeTab === 'management' && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Team
              </button>
            )}
          </div>
          
          {/* Tab Navigation */}
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('members')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'members'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Team Members
            </button>
            <button
              onClick={() => setActiveTab('management')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'management'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Team Structure
            </button>
          </div>
        </div>

        {/* Tab Content */}
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
              periodFilter={periodFilter}
              setPeriodFilter={setPeriodFilter}
              showInactiveMembers={showInactiveMembers}
              setShowInactiveMembers={setShowInactiveMembers}
            />

            {/* Team Members Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {teamLoading ? (
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
                  <p className="text-gray-600">Get started by inviting your first team member using the button above.</p>
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

        {activeTab === 'management' && (
          <div className="space-y-6">
            {teamsLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                <p className="text-gray-500 mt-2">Loading teams...</p>
              </div>
            ) : teams.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No teams found</h3>
                <p className="text-gray-600 mb-4">Create your first team to get started.</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Team
                </button>
              </div>
            ) : (
              <div className="grid gap-4">
                {teams.map((team: Team) => (
                  <div key={team.id} className="bg-white rounded-lg shadow border border-gray-200">
                    <div className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900">{team.team_name}</h3>
                          {team.description && (
                            <p className="text-gray-600 mt-1">{team.description}</p>
                          )}
                          <div className="flex items-center mt-2 space-x-4">
                            <span className="text-sm text-gray-500">
                              {team._count.team_members} members
                            </span>
                            {team.team_lead && (
                              <span className="text-sm text-gray-500">
                                Lead: {team.team_lead.first_name} {team.team_lead.last_name}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setExpandedTeam(expandedTeam === team.id ? null : team.id)}
                            className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                          >
                            {expandedTeam === team.id ? (
                              <>
                                <ChevronUp className="w-4 h-4 mr-1" />
                                Hide Members
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-4 h-4 mr-1" />
                                Show Members
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => setEditingTeam(team)}
                            className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Edit
                          </button>
                        </div>
                      </div>
                      
                      {expandedTeam === team.id && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <h4 className="text-sm font-medium text-gray-900 mb-3">Team Members</h4>
                          <div className="space-y-2">
                            {team.team_members.map((member) => (
                              <div key={member.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded">
                                <div className="flex items-center">
                                  <User className="w-4 h-4 text-gray-400 mr-2" />
                                  <span className="text-sm text-gray-900">
                                    {member.user.first_name} {member.user.last_name}
                                  </span>
                                  <span className="text-xs text-gray-500 ml-2">
                                    ({member.user.email})
                                  </span>
                                </div>
                                <span className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded">
                                  {member.user.role}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {inviteModalOpen && (
        <InviteModal
          isOpen={inviteModalOpen}
          onClose={() => setInviteModalOpen(false)}
          onSubmit={(memberData) => inviteMemberMutation.mutate(memberData)}
          managers={teamData?.filter(m => m.is_manager || m.is_admin) || []}
          loading={inviteMemberMutation.isPending}
        />
      )}

      {/* Edit Member Modal */}
      {editMemberModalOpen && editingMember && (
        <EditMemberModal
          isOpen={editMemberModalOpen}
          onClose={() => {
            setEditMemberModalOpen(false);
            setEditingMember(null);
          }}
          onSave={(data) => updateMemberMutation.mutate({ id: data.id, data })}
          member={editingMember}
          managers={teamData?.filter(m => m.is_manager || m.is_admin) || []}
          loading={updateMemberMutation.isPending}
        />
      )}

      {/* Invite Success Message */}
      {inviteSuccess && (
        <InviteSuccessMessage
          isOpen={!!inviteSuccess}
          onClose={() => setInviteSuccess(null)}
          email={inviteSuccess.email}
          tempPassword={inviteSuccess.tempPassword}
        />
      )}


      {/* Create Team Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Create New Team</h2>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              createTeamMutation.mutate({
                team_name: formData.get('team_name') as string,
                description: formData.get('description') as string,
                team_lead_id: formData.get('team_lead_id') as string || undefined
              });
            }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Team Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="team_name"
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <textarea
                    name="description"
                    rows={3}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Team Lead
                  </label>
                  <select
                    name="team_lead_id"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  >
                    <option value="">Select a team lead...</option>
                    {teamData?.filter((member: TeamMember) => 
                      member.is_manager || member.is_admin
                    ).map((member: TeamMember) => (
                      <option key={member.id} value={member.id}>
                        {member.first_name} {member.last_name} ({member.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createTeamMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  {createTeamMutation.isPending ? 'Creating...' : 'Create Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default TeamPage;