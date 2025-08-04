import React, { useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/layout';
import { useAuth } from '../hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { targetsApi, teamApi } from '../lib/api';
import { QuotaWizard } from '../components/team/QuotaWizard';
import { TargetModal } from '../components/team/TargetModal';
import { TargetDistributionModal } from '../components/team/TargetDistributionModal';
import { Target, Settings, TrendingUp, Plus, ChevronRight, Edit, Trash2 } from 'lucide-react';

interface TargetData {
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
      queryClient.invalidateQueries({ queryKey: ['targets'] });
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

        {/* Period Filter */}
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
            <div className="divide-y divide-gray-200">
              {targetsData && targetsData.length > 0 ? (
                targetsData.map((target: TargetData) => (
                  <div key={target.id} className="px-6 py-4 hover:bg-gray-50">
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
                              {target.team_target ? 'Team Target' : 'Individual Target'}
                              {target.user && ` - ${target.user.first_name} ${target.user.last_name}`}
                            </p>
                            <p className="text-sm text-gray-500">
                              {target.period_type.charAt(0).toUpperCase() + target.period_type.slice(1)} • 
                              £{target.quota_amount.toLocaleString()} • 
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
                ))
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

      {/* Target Edit Modal */}
      {showTargetModal && editingTarget && (
        <TargetModal
          isOpen={showTargetModal}
          onClose={() => {
            setShowTargetModal(false);
            setEditingTarget(null);
          }}
          onSubmit={(data) => updateTargetMutation.mutate({ id: editingTarget.id, data })}
          target={editingTarget}
          loading={updateTargetMutation.isPending}
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