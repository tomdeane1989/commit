import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '../components/layout';
import { useAuth } from '../hooks/useAuth';
import api from '../lib/api';
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

const TeamsManagementPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [selectedTeamMembers, setSelectedTeamMembers] = useState<string[]>([]);

  // Check if user has admin permissions
  const isAdmin = user?.is_admin === true;
  const isManager = user?.is_manager === true || user?.is_admin === true;

  // Fetch teams
  const { data: teamsData, isLoading } = useQuery({
    queryKey: ['teams-management'],
    queryFn: async () => {
      const response = await api.get('/teams');
      return response.data;
    },
    enabled: isManager
  });

  // Fetch available users for adding to teams
  const { data: usersData } = useQuery({
    queryKey: ['available-users'],
    queryFn: async () => {
      const response = await api.get('/team');
      return response.data;
    },
    enabled: isAdmin
  });

  const teams = teamsData?.teams || [];
  const availableUsers = usersData?.team_members || [];

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

  // Update team mutation
  const updateTeamMutation = useMutation({
    mutationFn: async ({ teamId, data }: { teamId: string; data: any }) => {
      const response = await api.put(`/teams/${teamId}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams-management'] });
      setEditingTeam(null);
    }
  });

  // Add members mutation
  const addMembersMutation = useMutation({
    mutationFn: async ({ teamId, userIds }: { teamId: string; userIds: string[] }) => {
      const response = await api.post(`/teams/${teamId}/members`, { user_ids: userIds });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams-management'] });
      setSelectedTeamMembers([]);
    }
  });

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async ({ teamId, userId }: { teamId: string; userId: string }) => {
      const response = await api.delete(`/teams/${teamId}/members/${userId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams-management'] });
    }
  });

  // Delete team mutation
  const deleteTeamMutation = useMutation({
    mutationFn: async (teamId: string) => {
      const response = await api.delete(`/teams/${teamId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams-management'] });
    }
  });

  const toggleTeamExpansion = (teamId: string) => {
    setExpandedTeam(expandedTeam === teamId ? null : teamId);
  };

  const handleDeleteTeam = (team: Team) => {
    if (confirm(`Are you sure you want to delete the team "${team.team_name}"? This will remove all team members.`)) {
      deleteTeamMutation.mutate(team.id);
    }
  };

  const handleRemoveMember = (teamId: string, userId: string) => {
    if (confirm('Are you sure you want to remove this member from the team?')) {
      removeMemberMutation.mutate({ teamId, userId });
    }
  };

  if (!isManager) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Restricted</h2>
            <p className="text-gray-600">Only managers and administrators can access team management.</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-500"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Team Management</h1>
            <p className="text-gray-600 mt-1">
              {isAdmin ? 'Create and manage teams across your organization' : 'View team structure and performance'}
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Team
            </button>
          )}
        </div>

        {/* Teams List */}
        <div className="space-y-4">
          {teams.length === 0 ? (
            <div className="bg-gray-50 rounded-xl p-12 text-center">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Teams Yet</h3>
              <p className="text-gray-600 mb-6">
                {isAdmin ? 'Create your first team to organize your sales force.' : 'No teams have been created yet.'}
              </p>
              {isAdmin && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Team
                </button>
              )}
            </div>
          ) : (
            teams.map((team: Team) => (
              <div key={team.id} className="bg-white rounded-xl shadow-sm border border-gray-200">
                {/* Team Header */}
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h3 className="text-xl font-semibold text-gray-900">{team.team_name}</h3>
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full">
                          {team._count.team_members} members
                        </span>
                      </div>
                      {team.description && (
                        <p className="text-gray-600 mt-2">{team.description}</p>
                      )}
                      {team.team_lead && (
                        <div className="flex items-center mt-3 text-sm text-gray-600">
                          <Shield className="w-4 h-4 mr-2" />
                          Team Lead: {team.team_lead.first_name} {team.team_lead.last_name}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => setEditingTeam(team)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteTeam(team)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => toggleTeamExpansion(team.id)}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg"
                      >
                        {expandedTeam === team.id ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Team Performance Summary */}
                  {team.performance && (
                    <div className="mt-4 grid grid-cols-3 gap-4">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-600">Closed Amount</p>
                        <p className="text-lg font-semibold text-gray-900">
                          £{team.performance.closed_amount.toLocaleString()}
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-600">Pipeline</p>
                        <p className="text-lg font-semibold text-gray-900">
                          £{team.performance.open_amount.toLocaleString()}
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-600">Team Quota</p>
                        <p className="text-lg font-semibold text-gray-900">
                          £{team.performance.total_quota.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Expanded Team Members */}
                {expandedTeam === team.id && (
                  <div className="border-t border-gray-200">
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold text-gray-900">Team Members</h4>
                        {isAdmin && (
                          <button
                            onClick={() => {
                              setSelectedTeamMembers([]);
                              // Show add members modal
                            }}
                            className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700"
                          >
                            <UserPlus className="w-4 h-4 mr-1" />
                            Add Members
                          </button>
                        )}
                      </div>
                      <div className="space-y-3">
                        {team.team_members.map((member) => (
                          <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                                <User className="w-5 h-5 text-gray-600" />
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">
                                  {member.user.first_name} {member.user.last_name}
                                </p>
                                <p className="text-sm text-gray-600">{member.user.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-3">
                              <span className="text-sm text-gray-500 capitalize">{member.user.role}</span>
                              {isAdmin && (
                                <button
                                  onClick={() => handleRemoveMember(team.id, member.user.id)}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                                >
                                  <UserMinus className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create/Edit Team Modal */}
      {(showCreateModal || editingTeam) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {editingTeam ? 'Edit Team' : 'Create New Team'}
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const data = {
                  team_name: formData.get('team_name'),
                  description: formData.get('description'),
                  team_lead_id: formData.get('team_lead_id') || undefined
                };
                
                if (editingTeam) {
                  updateTeamMutation.mutate({ teamId: editingTeam.id, data });
                } else {
                  createTeamMutation.mutate(data);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Team Name</label>
                <input
                  name="team_name"
                  type="text"
                  defaultValue={editingTeam?.team_name}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  name="description"
                  defaultValue={editingTeam?.description}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Team Lead</label>
                <select
                  name="team_lead_id"
                  defaultValue={editingTeam?.team_lead?.id}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Select a team lead...</option>
                  {availableUsers
                    .filter((u: any) => u.role === 'manager')
                    .map((user: any) => (
                      <option key={user.id} value={user.id}>
                        {user.first_name} {user.last_name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingTeam(null);
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createTeamMutation.isPending || updateTeamMutation.isPending}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {editingTeam ? 'Update Team' : 'Create Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default TeamsManagementPage;