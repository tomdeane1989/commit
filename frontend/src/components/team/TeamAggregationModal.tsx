import { useState, useEffect } from 'react';
import { X, Users, Target, TrendingUp, PoundSterling, Calendar, User, Save } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';

interface TeamAggregationModalProps {
  manager: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
  } | null;
  isOpen: boolean;
  onClose: () => void;
}

interface TeamTarget {
  id: string;
  user_id: string;
  quota_amount: number;
  commission_rate: number;
  period_start: string;
  period_end: string;
  period_type: string;
  is_active: boolean;
  user: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

interface TeamPerformance {
  user_id: string;
  closed_won_amount: number;
  commit_amount: number;
  best_case_amount: number;
  quota_progress_amount: number;
}

const TeamAggregationModal: React.FC<TeamAggregationModalProps> = ({
  manager,
  isOpen,
  onClose,
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState('current');
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  // Fetch team targets for this manager's direct reports
  const { data: teamData, isLoading } = useQuery({
    queryKey: ['team-aggregation', manager?.id],
    queryFn: async () => {
      if (!manager) return null;
      
      // Get team aggregation data for this manager
      const response = await api.get(`/team/manager/${manager.id}/aggregation`);
      return response.data;
    },
    enabled: isOpen && !!manager
  });

  // Save team aggregated target mutation
  const saveTeamTargetMutation = useMutation({
    mutationFn: async (targetData: {
      manager_id: string;
      total_quota: number;
      avg_commission_rate: number;
      period_start: string;
      period_end: string;
      period_type: string;
    }) => {
      const response = await api.post('/team/aggregated-target', targetData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-aggregation', manager?.id] });
      queryClient.invalidateQueries({ queryKey: ['team'] });
      setSaving(false);
    },
    onError: (error: any) => {
      console.error('Failed to save team target:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      setSaving(false);
      // Show user-friendly error message
      alert(`Failed to save team target: ${error.response?.data?.error || error.message}`);
    }
  });

  // Handle save team target
  const handleSaveTeamTarget = () => {
    if (!manager || !teamData) return;
    
    setSaving(true);
    
    // Calculate period based on the first target (assuming all team members have similar periods)
    const firstTarget = teamData.targets?.[0];
    if (!firstTarget) {
      alert('No team targets found to aggregate');
      setSaving(false);
      return;
    }

    const targetData = {
      manager_id: manager.id,
      total_quota: aggregatedData.totalQuota,
      avg_commission_rate: aggregatedData.avgCommissionRate,
      period_start: firstTarget.period_start,
      period_end: firstTarget.period_end,
      period_type: firstTarget.period_type
    };

    console.log('Creating team target with data:', targetData);
    console.log('Manager object:', manager);
    console.log('First target object:', firstTarget);
    console.log('Aggregated data:', aggregatedData);

    saveTeamTargetMutation.mutate(targetData);
  };

  if (!isOpen || !manager) return null;

  // Calculate aggregated totals
  const aggregatedData = teamData ? {
    totalQuota: teamData.targets?.reduce((sum: number, target: TeamTarget) => sum + Number(target.quota_amount), 0) || 0,
    totalClosedWon: teamData.performance?.reduce((sum: number, perf: TeamPerformance) => sum + Number(perf.closed_won_amount), 0) || 0,
    totalCommit: teamData.performance?.reduce((sum: number, perf: TeamPerformance) => sum + Number(perf.commit_amount), 0) || 0,
    totalBestCase: teamData.performance?.reduce((sum: number, perf: TeamPerformance) => sum + Number(perf.best_case_amount), 0) || 0,
    teamSize: teamData.targets?.length || 0,
    avgCommissionRate: teamData.targets?.length ? 
      (teamData.targets.reduce((sum: number, target: TeamTarget) => sum + Number(target.commission_rate), 0) / teamData.targets.length) : 0
  } : {
    totalQuota: 0,
    totalClosedWon: 0,
    totalCommit: 0,
    totalBestCase: 0,
    teamSize: 0,
    avgCommissionRate: 0
  };

  const totalProgress = aggregatedData.totalClosedWon + aggregatedData.totalCommit + aggregatedData.totalBestCase;
  const quotaAttainmentPercentage = aggregatedData.totalQuota > 0 ? 
    (totalProgress / aggregatedData.totalQuota) * 100 : 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Team Sales Target Aggregation
            </h3>
            <p className="text-sm text-gray-600">
              {manager.first_name} {manager.last_name}'s Team Performance
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleSaveTeamTarget}
              disabled={saving || isLoading || !teamData?.targets?.length}
              className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white text-sm font-medium rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-lg shadow-green-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Team Target
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading team aggregation data...</p>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Team Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Users className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-600">Team Size</p>
                    <p className="text-xl font-bold text-gray-900">{aggregatedData.teamSize}</p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <PoundSterling className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-600">Total Quota</p>
                    <p className="text-xl font-bold text-gray-900">
                      £{aggregatedData.totalQuota.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-purple-50 to-violet-50 rounded-lg p-4 border border-purple-200">
                <div className="flex items-center">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Target className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-600">Team Progress</p>
                    <p className="text-xl font-bold text-gray-900">
                      £{totalProgress.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg p-4 border border-orange-200">
                <div className="flex items-center">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-orange-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-600">Attainment</p>
                    <p className="text-xl font-bold text-gray-900">
                      {quotaAttainmentPercentage.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Progress Visualization */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Team Quota Progress</h4>
              
              <div className="w-full bg-gray-200 rounded-full h-6 mb-4">
                <div className="flex h-6 rounded-full overflow-hidden">
                  {/* Closed Won */}
                  <div 
                    className="bg-green-500 h-full flex items-center justify-center text-xs font-medium text-white"
                    style={{ 
                      width: `${aggregatedData.totalQuota > 0 ? (aggregatedData.totalClosedWon / aggregatedData.totalQuota) * 100 : 0}%`
                    }}
                  >
                    {aggregatedData.totalQuota > 0 && (aggregatedData.totalClosedWon / aggregatedData.totalQuota) * 100 > 10 && 'Closed'}
                  </div>
                  {/* Commit */}
                  <div 
                    className="bg-blue-500 h-full flex items-center justify-center text-xs font-medium text-white"
                    style={{ 
                      width: `${aggregatedData.totalQuota > 0 ? (aggregatedData.totalCommit / aggregatedData.totalQuota) * 100 : 0}%`
                    }}
                  >
                    {aggregatedData.totalQuota > 0 && (aggregatedData.totalCommit / aggregatedData.totalQuota) * 100 > 10 && 'Commit'}
                  </div>
                  {/* Best Case */}
                  <div 
                    className="bg-orange-500 h-full flex items-center justify-center text-xs font-medium text-white"
                    style={{ 
                      width: `${aggregatedData.totalQuota > 0 ? (aggregatedData.totalBestCase / aggregatedData.totalQuota) * 100 : 0}%`
                    }}
                  >
                    {aggregatedData.totalQuota > 0 && (aggregatedData.totalBestCase / aggregatedData.totalQuota) * 100 > 10 && 'Best Case'}
                  </div>
                </div>
              </div>

              <div className="flex justify-between text-sm text-gray-600">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded mr-2"></div>
                  Closed Won: £{aggregatedData.totalClosedWon.toLocaleString()}
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-blue-500 rounded mr-2"></div>
                  Commit: £{aggregatedData.totalCommit.toLocaleString()}
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-orange-500 rounded mr-2"></div>
                  Best Case: £{aggregatedData.totalBestCase.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Team Members Table */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h4 className="text-lg font-semibold text-gray-900">Team Member Breakdown</h4>
              </div>
              
              {teamData?.targets?.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Team Member
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Quota
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Progress
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Attainment
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Commission Rate
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {teamData.targets.map((target: TeamTarget) => {
                        const memberPerf = teamData.performance?.find((p: TeamPerformance) => p.user_id === target.user_id);
                        const memberProgress = memberPerf ? 
                          Number(memberPerf.closed_won_amount) + Number(memberPerf.commit_amount) + Number(memberPerf.best_case_amount) : 0;
                        const memberAttainment = Number(target.quota_amount) > 0 ? 
                          (memberProgress / Number(target.quota_amount)) * 100 : 0;
                          
                        return (
                          <tr key={target.id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                                  <User className="w-4 h-4 text-gray-600" />
                                </div>
                                <div className="ml-3">
                                  <div className="text-sm font-medium text-gray-900">
                                    {target.user.first_name} {target.user.last_name}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {target.user.email}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              £{Number(target.quota_amount).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              £{memberProgress.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                memberAttainment >= 100 
                                  ? 'bg-green-100 text-green-800'
                                  : memberAttainment >= 75
                                  ? 'bg-yellow-100 text-yellow-800'  
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {memberAttainment.toFixed(1)}%
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {(Number(target.commission_rate) * 100).toFixed(1)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>No team members with active targets found</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamAggregationModal;