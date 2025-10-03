import React, { useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/layout';
import { useAuth } from '../hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { targetsApi, teamApi } from '../lib/api';
import { formatLargeCurrency } from '../utils/money';
import { QuotaWizard } from '../components/team/QuotaWizard';
// import { TargetModal } from '../components/team/TargetModal'; // Replaced with QuotaWizard edit mode
import { TargetDistributionModal } from '../components/team/TargetDistributionModal';
import { Target, Settings, TrendingUp, Plus, ChevronRight, Edit, Trash2, ChevronUp, ChevronDown, Users, PoundSterling, Clock, Eye, EyeOff } from 'lucide-react';

interface TargetData {
  id: string;
  name?: string | null;
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

const TargetsPage = () => {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  
  // Period filter - default to quarterly
  const [periodFilter, setPeriodFilter] = useState<'monthly' | 'quarterly' | 'yearly'>('quarterly');
  
  // Modal states
  const [quotaWizardOpen, setQuotaWizardOpen] = useState(false);
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [editingTarget, setEditingTarget] = useState<TargetData | null>(null);
  const [showDistributionModal, setShowDistributionModal] = useState(false);
  const [distributionData, setDistributionData] = useState<any>(null);
  const [expandedTeamTarget, setExpandedTeamTarget] = useState(false);
  const [showHistoricalTargets, setShowHistoricalTargets] = useState(false);

  // Check if user has admin/manager permissions using flags
  const canManageTargets = user?.is_admin === true || user?.is_manager === true;
  
  // If user doesn't have permissions, redirect
  React.useEffect(() => {
    if (!authLoading && user && !canManageTargets) {
      router.push('/dashboard');
    }
  }, [user, canManageTargets, authLoading, router]);

  // Fetch targets data - don't filter by user_id to show team targets
  const { data: targetsData, isLoading: targetsLoading } = useQuery({
    queryKey: ['targets', periodFilter],
    queryFn: async () => {
      const response = await targetsApi.getTargets({ 
        active_only: true
        // Removed user_id filter to show team targets as well
      });
      console.log('🎯 Targets API Response:', response);
      console.log('🎯 Targets Array:', response.targets);
      console.log('🎯 Targets Count:', response.targets?.length || 0);
      return response.targets || [];
    },
    enabled: canManageTargets && !authLoading
  });
  
  // Fetch team aggregate data
  const { data: teamAggregateData } = useQuery({
    queryKey: ['team-aggregate'],
    queryFn: async () => {
      const response = await api.get('/targets/team-aggregate');
      return response.data;
    },
    enabled: canManageTargets && !authLoading
  });

  // Fetch teams data for QuotaWizard
  const { data: teamsData } = useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      const response = await api.get('/teams');
      return response.data;
    },
    enabled: canManageTargets
  });

  // Fetch team members data for QuotaWizard
  const { data: teamMembersData } = useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      const response = await teamApi.getTeam({ 
        period: periodFilter,
        show_inactive: 'false'
      });
      return response.team_members || [];
    },
    enabled: canManageTargets
  });

  // Create target mutation
  const createTargetMutation = useMutation({
    mutationFn: targetsApi.createTarget,
    onSuccess: (data) => {
      // Check if this is a conflict response
      if ((data as any).isConflict) {
        console.log('Conflict response received in onSuccess:', data);
        return;
      }
      
      // Invalidate all related queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['targets'] });
      queryClient.invalidateQueries({ queryKey: ['team-aggregate'] });
      queryClient.invalidateQueries({ queryKey: ['team'] });
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
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
      
      if (quotaWizardOpen && error.response?.data?.skipped_users && error.response.data.skipped_users.length > 0) {
        console.log('Conflicts detected, wizard should handle this');
        return;
      }
      
      const errorMessage = error.response?.data?.error || 'Failed to create target';
      const additionalMessage = error.response?.data?.message || '';
      
      alert(`Error: ${errorMessage}${additionalMessage ? `\n\n${additionalMessage}` : ''}`);
    }
  });

  // Resolve conflicts mutation
  const resolveConflictsMutation = useMutation({
    mutationFn: targetsApi.resolveConflicts,
    onSuccess: (data) => {
      // Invalidate all related queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['targets'] });
      queryClient.invalidateQueries({ queryKey: ['team-aggregate'] });
      queryClient.invalidateQueries({ queryKey: ['team'] });
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setQuotaWizardOpen(false);
      
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

  // Update target mutation
  const updateTargetMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => targetsApi.updateTarget(id, data),
    onSuccess: () => {
      // Invalidate all related queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['targets'] });
      queryClient.invalidateQueries({ queryKey: ['team-aggregate'] });
      queryClient.invalidateQueries({ queryKey: ['team'] });
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setShowTargetModal(false);
      setEditingTarget(null);
    }
  });

  // Delete target mutation
  const deleteTargetMutation = useMutation({
    mutationFn: targetsApi.deactivateTarget,
    onSuccess: () => {
      // Invalidate all related queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['targets'] });
      queryClient.invalidateQueries({ queryKey: ['team-aggregate'] });
      queryClient.invalidateQueries({ queryKey: ['team'] });
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });

  // Delete all team targets mutation
  const deleteTeamTargetsMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await api.delete(`/targets/team/${userId}/all`);
      return response.data;
    },
    onSuccess: (data) => {
      // Invalidate all related queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['targets'] });
      queryClient.invalidateQueries({ queryKey: ['team-aggregate'] });
      queryClient.invalidateQueries({ queryKey: ['team'] });
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      alert(`Successfully deleted ${data.deletedCount} targets for ${data.affectedUsers} team member(s)`);
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Failed to delete team targets');
    }
  });

  const handleTargetEdit = (target: TargetData) => {
    setEditingTarget(target);
    setShowTargetModal(true);
  };

  const handleTargetDelete = async (targetId: string) => {
    if (confirm('Are you sure you want to deactivate this target?')) {
      deleteTargetMutation.mutate(targetId);
    }
  };

  const handleDistribution = (target: TargetData) => {
    setDistributionData(target);
    setShowDistributionModal(true);
  };

  // All targets are now individual targets
  const allIndividualTargets = targetsData || [];
  
  // Separate current and historical targets
  const currentDate = new Date();
  const currentTargets = allIndividualTargets.filter((t: TargetData) => {
    const endDate = new Date(t.period_end);
    return endDate >= currentDate;
  });
  
  const historicalTargets = allIndividualTargets.filter((t: TargetData) => {
    const endDate = new Date(t.period_end);
    return endDate < currentDate;
  });
  
  // Don't filter here - we'll display them in separate sections
  const individualTargets = currentTargets;
  
  // Get current period's team aggregate
  // Find the aggregate that contains the current date
  const currentTeamAggregate = teamAggregateData?.team_aggregates?.find(agg => {
    const periodStart = new Date(agg.period_start);
    const periodEnd = new Date(agg.period_end);
    // Check if current date falls within this period
    return currentDate >= periodStart && currentDate <= periodEnd;
  }) || teamAggregateData?.team_aggregates?.[0]; // Fallback to first if no current period found
  
  const teamMembers = currentTeamAggregate?.member_targets || [];
  const teamTotalQuota = currentTeamAggregate?.total_quota || 0;
  
  // Debug logging
  console.log('🎯 Team Aggregate Data:', teamAggregateData);
  console.log('🎯 Current Date:', currentDate);
  console.log('🎯 Current Team Aggregate:', currentTeamAggregate);
  console.log('🎯 Team Members:', teamMembers);
  console.log('🎯 Team Total Quota:', teamTotalQuota);

  // Show loading if still checking auth
  if (authLoading) {
    return <Layout>Loading...</Layout>;
  }

  // Don't render if user doesn't have permissions
  if (!canManageTargets) {
    return null;
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Targets & Quotas</h1>
            <p className="text-gray-600 mt-1">Manage sales targets and commission quotas</p>
          </div>
          <button
            onClick={() => setQuotaWizardOpen(true)}
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Target
          </button>
        </div>

        {/* Filters and Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700">Period:</label>
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value as 'monthly' | 'quarterly' | 'yearly')}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          
          {/* Historical Targets Toggle */}
          {historicalTargets.length > 0 && (
            <button
              onClick={() => setShowHistoricalTargets(!showHistoricalTargets)}
              className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {showHistoricalTargets ? (
                <>
                  <EyeOff className="w-4 h-4 mr-2" />
                  Hide historical targets
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 mr-2" />
                  Show targets for previous periods ({historicalTargets.length})
                </>
              )}
            </button>
          )}
        </div>

        {/* Targets List */}
        {targetsLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="text-gray-500 mt-2">Loading targets...</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Active Targets</h3>
            </div>
            <div className="">
              {targetsData && targetsData.length > 0 ? (
                <>
                  {/* Team Target Section */}
                  {currentTeamAggregate && teamMembers.length > 0 && (
                    <div className="px-6 py-4 hover:bg-gray-50 border-b-2 border-gray-200">
                      <div 
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => setExpandedTeamTarget(!expandedTeamTarget)}
                      >
                        <div className="flex-1">
                          <div className="flex items-center space-x-4">
                            <div className="flex-shrink-0">
                              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                                <Users className="w-5 h-5 text-purple-600" />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 flex items-center">
                                Team Target (Aggregated)
                                <span className="ml-2 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-600">
                                  {teamMembers.length} Members
                                </span>
                              </p>
                              <p className="text-sm text-gray-500">
                                {currentTeamAggregate.period_type.charAt(0).toUpperCase() + currentTeamAggregate.period_type.slice(1)} • 
                                {formatLargeCurrency(teamTotalQuota)} • 
                                {(currentTeamAggregate.commission_rate * 100).toFixed(1)}% commission
                              </p>
                              <p className="text-xs text-gray-400">
                                {new Date(currentTeamAggregate.period_start).toLocaleDateString()} - {new Date(currentTeamAggregate.period_end).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="text-xs text-gray-500 mr-2">
                            Dynamically calculated
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent expanding/collapsing
                              if (confirm(
                                `⚠️ WARNING: This will delete ALL targets for this team!\n\n` +
                                `This action will permanently delete:\n` +
                                `• All parent (annual) targets\n` +
                                `• All child (quarterly/monthly) targets\n` +
                                `• Targets for ALL ${teamMembers.length} team members\n\n` +
                                `This cannot be undone. Are you sure you want to proceed?`
                              )) {
                                // Use the current user's ID since this is for their team
                                deleteTeamTargetsMutation.mutate(user?.id || '');
                              }
                            }}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete all team targets"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <div className="pl-2">
                            {expandedTeamTarget ? (
                              <ChevronUp className="w-5 h-5 text-gray-400" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Expandable Team Members */}
                      {expandedTeamTarget && (
                        <div className="mt-4 ml-14 space-y-3">
                          <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Team Member Targets</h4>
                          {teamMembers.map((member: any) => {
                            // Find the actual target for this member
                            const memberTarget = individualTargets.find((t: TargetData) => t.user_id === member.user.id);
                            
                            return (
                              <div key={member.target_id} className="bg-gray-50 rounded-lg p-3">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm font-medium text-gray-900">
                                      {member.user ? `${member.user.first_name} ${member.user.last_name}` : 'Team Member'}
                                    </p>
                                    <p className="text-xs text-gray-600">
                                      Individual quota: {formatLargeCurrency(member.quota_amount)}
                                    </p>
                                  </div>
                                  {memberTarget && (
                                    <div className="flex items-center space-x-2">
                                      <button
                                        onClick={() => handleTargetEdit(memberTarget)}
                                        className="inline-flex items-center px-2 py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                                      >
                                        <Edit className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={() => handleTargetDelete(memberTarget.id)}
                                        className="inline-flex items-center px-2 py-1 border border-gray-300 text-xs font-medium rounded text-red-600 bg-white hover:bg-red-50"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Individual Targets */}
                  {individualTargets.map((target: TargetData) => (
                      <div key={target.id} className="px-6 py-4 border-b border-gray-200 hover:bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-4">
                              <div className="flex-shrink-0">
                                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                                  <Target className="w-5 h-5 text-indigo-600" />
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900">
                                  {target.name || 'Individual Target'}
                                  {target.user && ` - ${target.user.first_name} ${target.user.last_name}`}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {target.period_type.charAt(0).toUpperCase() + target.period_type.slice(1)} • 
                                  {formatLargeCurrency(target.quota_amount)} • 
                                  {(target.commission_rate * 100).toFixed(1)}% commission
                                </p>
                                <p className="text-xs text-gray-400">
                                  {new Date(target.period_start).toLocaleDateString()} - {new Date(target.period_end).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleDistribution(target)}
                              className="inline-flex items-center px-3 py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                            >
                              <TrendingUp className="w-3 h-3 mr-1" />
                              Distribute
                            </button>
                            <button
                              onClick={() => handleTargetEdit(target)}
                              className="inline-flex items-center px-3 py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                            >
                              <Edit className="w-3 h-3 mr-1" />
                              Edit
                            </button>
                            <button
                              onClick={() => handleTargetDelete(target.id)}
                              className="inline-flex items-center px-3 py-1 border border-gray-300 text-xs font-medium rounded text-red-600 bg-white hover:bg-red-50"
                            >
                              <Trash2 className="w-3 h-3 mr-1" />
                              Deactivate
                            </button>
                          </div>
                        </div>
                      </div>
                  ))}
                  
                  {/* Historical Targets Section */}
                  {showHistoricalTargets && historicalTargets.length > 0 && (
                    <>
                      <div className="px-6 py-3 bg-gray-100 border-y border-gray-300">
                        <div className="flex items-center space-x-2">
                          <Clock className="w-4 h-4 text-gray-500" />
                          <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                            Historical Targets (Previous Periods)
                          </h4>
                        </div>
                      </div>
                      
                      {historicalTargets.map((target: TargetData) => (
                        <div key={target.id} className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-4">
                                <div className="flex-shrink-0">
                                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                                    <Clock className="w-5 h-5 text-gray-400" />
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-600">
                                    {target.name || 'Individual Target'}
                                    {target.user && ` - ${target.user.first_name} ${target.user.last_name}`}
                                    <span className="ml-2 px-2 py-1 text-xs font-medium bg-gray-200 text-gray-600 rounded">
                                      Historical
                                    </span>
                                  </p>
                                  <p className="text-sm text-gray-400">
                                    {target.period_type.charAt(0).toUpperCase() + target.period_type.slice(1)} • 
                                    {formatLargeCurrency(target.quota_amount)} • 
                                    {(target.commission_rate * 100).toFixed(1)}% commission
                                  </p>
                                  <p className="text-xs text-gray-400">
                                    {new Date(target.period_start).toLocaleDateString()} - {new Date(target.period_end).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                className="inline-flex items-center px-3 py-1 border border-gray-200 text-xs font-medium rounded text-gray-400 bg-gray-50 cursor-not-allowed"
                                disabled
                              >
                                <TrendingUp className="w-3 h-3 mr-1" />
                                Distribute
                              </button>
                              <button
                                className="inline-flex items-center px-3 py-1 border border-gray-200 text-xs font-medium rounded text-gray-400 bg-gray-50 cursor-not-allowed"
                                disabled
                              >
                                <Edit className="w-3 h-3 mr-1" />
                                Edit
                              </button>
                              <button
                                className="inline-flex items-center px-3 py-1 border border-gray-200 text-xs font-medium rounded text-gray-400 bg-gray-50 cursor-not-allowed"
                                disabled
                              >
                                <Trash2 className="w-3 h-3 mr-1" />
                                Deactivate
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </>
              ) : (
                <div className="px-6 py-12 text-center">
                  <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No targets found</h3>
                  <p className="text-gray-600 mb-4">Get started by creating your first sales target.</p>
                  <button
                    onClick={() => setQuotaWizardOpen(true)}
                    className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Target
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Quota Wizard Modal */}
      {quotaWizardOpen && (
        <QuotaWizard
          isOpen={quotaWizardOpen}
          onClose={() => setQuotaWizardOpen(false)}
          onSubmit={(data) => createTargetMutation.mutate(data)}
          onResolveConflicts={(data) => resolveConflictsMutation.mutate(data)}
          loading={createTargetMutation.isPending || resolveConflictsMutation.isPending}
          teams={teamsData?.teams || []}
          teamMembers={teamMembersData || []}
        />
      )}

      {/* Target Edit Modal - Using QuotaWizard */}
      {showTargetModal && editingTarget && (
        <QuotaWizard
          isOpen={showTargetModal}
          onClose={() => {
            setShowTargetModal(false);
            setEditingTarget(null);
          }}
          onSubmit={(data) => updateTargetMutation.mutate({ id: editingTarget.id, data })}
          onResolveConflicts={() => {}} // Not needed for editing
          loading={updateTargetMutation.isPending}
          teams={teamsData?.teams || []}
          teamMembers={teamMembersData || []}
          editMode={true}
          editingTarget={editingTarget}
        />
      )}

      {/* Target Distribution Modal */}
      {showDistributionModal && distributionData && (
        <TargetDistributionModal
          isOpen={showDistributionModal}
          onClose={() => {
            setShowDistributionModal(false);
            setDistributionData(null);
          }}
          target={distributionData}
        />
      )}
    </Layout>
  );
};

export default TargetsPage;