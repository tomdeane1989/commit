import { useState, useEffect } from 'react';
import Layout from '../components/layout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import api, { integrationsApi } from '../lib/api';
import { 
  Target, 
  Calendar, 
  PoundSterling, 
  TrendingUp, 
  Save,
  Plus,
  Edit,
  Trash2,
  Settings as SettingsIcon,
  User,
  Users,
  Bell,
  Shield,
  Palette,
  Link,
  FileSpreadsheet,
  Database,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Eye,
  Clock,
  AlertTriangle,
  X,
  Download,
  ChevronUp,
  ChevronDown
} from 'lucide-react';

const SettingsPage = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('targets');
  const [showAddTarget, setShowAddTarget] = useState(false);
  const [editingTarget, setEditingTarget] = useState<any>(null);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<any>(null);
  const [expandedTeamTarget, setExpandedTeamTarget] = useState(false);
  const queryClient = useQueryClient();

  const [targetForm, setTargetForm] = useState({
    period_type: 'quarterly',
    period_start: '',
    period_end: '',
    quota_amount: '',
    commission_rate: '',
    role: '',
    team_target: false
  });

  const { data: targetsData, isLoading: targetsLoading } = useQuery({
    queryKey: ['targets', user?.id], // User-specific cache key
    queryFn: async () => {
      const response = await api.get('/targets');
      return response.data;
    },
    enabled: !!user // Only run query when user is available
  });

  // Fetch integrations
  const { data: integrationsData, isLoading: integrationsLoading } = useQuery({
    queryKey: ['integrations'],
    queryFn: async () => {
      return await integrationsApi.getIntegrations();
    },
    enabled: !!user && (user.is_manager === true || user.is_admin === true)
  });

  const integrations = integrationsData?.integrations || [];

  // Loading and authentication check
  if (loading || !user) {
    return null; // or optionally return a spinner/loading component
  }

  // Helper function to get integration icons
  const getIntegrationIcon = (crmType: string) => {
    switch (crmType) {
      case 'sheets':
        return FileSpreadsheet;
      case 'salesforce':
        return Database;
      case 'hubspot':
        return Database;
      case 'pipedrive':
        return Database;
      default:
        return Database;
    }
  };

  const createTargetMutation = useMutation({
    mutationFn: async (target: any) => {
      const response = await api.post('/targets', target);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['targets', user?.id] });
      setShowAddTarget(false);
      setTargetForm({
        period_type: 'quarterly',
        period_start: '',
        period_end: '',
        quota_amount: '',
        commission_rate: '',
        role: '',
        team_target: false
      });
    }
  });

  const updateTargetMutation = useMutation({
    mutationFn: async ({ id, target }: { id: string, target: any }) => {
      const response = await api.put(`/targets/${id}`, target);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['targets', user?.id] });
      setEditingTarget(null);
    }
  });

  const deleteTargetMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/targets/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['targets', user?.id] });
    }
  });

  const deleteTeamTargetsMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await api.delete(`/targets/team/${userId}/all`);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['targets', user?.id] });
      alert(`Successfully deleted ${data.deletedCount} targets for ${data.affectedUsers} team member(s)`);
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Failed to delete team targets');
    }
  });

  // Integration Mutations with longer timeout for sync
  const syncMutation = useMutation({
    mutationFn: async (integrationId: string) => {
      return await integrationsApi.syncIntegration(integrationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    }
  });

  const deleteIntegrationMutation = useMutation({
    mutationFn: async (integrationId: string) => {
      return await integrationsApi.deleteIntegration(integrationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
    }
  });

  const targets = targetsData?.targets || [];
  
  // Separate team targets and individual targets
  const teamTargets = targets.filter((t: any) => t.team_target);
  const individualTargets = targets.filter((t: any) => !t.team_target);
  
  // Calculate team totals
  const teamTotalQuota = teamTargets.reduce((sum: number, target: any) => sum + target.quota_amount, 0);
  const teamTotalAchievement = teamTargets.reduce((sum: number, target: any) => sum + (target.current_achievement || 0), 0);
  const teamProgress = teamTotalQuota > 0 ? (teamTotalAchievement / teamTotalQuota) * 100 : 0;

  // Integration helper functions
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getIntegrationName = (type: string) => {
    switch (type) {
      case 'sheets':
        return 'Google Sheets';
      case 'salesforce':
        return 'Salesforce';
      case 'hubspot':
        return 'HubSpot';
      case 'pipedrive':
        return 'Pipedrive';
      default:
        return type;
    }
  };

  const handleSync = (integration: any) => {
    syncMutation.mutate(integration.id);
  };

  const handleDeleteIntegration = (integration: any) => {
    if (confirm(`Are you sure you want to delete the ${getIntegrationName(integration.crm_type)} integration?`)) {
      deleteIntegrationMutation.mutate(integration.id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTarget) {
      updateTargetMutation.mutate({ id: editingTarget.id, target: targetForm });
    } else {
      createTargetMutation.mutate(targetForm);
    }
  };

  const startEdit = (target: any) => {
    setEditingTarget(target);
    setTargetForm({
      period_type: target.period_type,
      period_start: target.period_start?.split('T')[0] || '',
      period_end: target.period_end?.split('T')[0] || '',
      quota_amount: target.quota_amount.toString(),
      commission_rate: target.commission_rate.toString(),
      role: target.role || '',
      team_target: target.team_target || false
    });
    setShowAddTarget(true);
  };

  const cancelEdit = () => {
    setEditingTarget(null);
    setShowAddTarget(false);
    setTargetForm({
      period_type: 'quarterly',
      period_start: '',
      period_end: '',
      quota_amount: '',
      commission_rate: '',
      role: '',
      team_target: false
    });
  };

  const tabs = [
    { id: 'targets', name: 'Sales Targets', icon: Target },
    { id: 'integrations', name: 'Integrations', icon: Link, adminOnly: true },
    { id: 'profile', name: 'Profile', icon: User },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'security', name: 'Security', icon: Shield },
    { id: 'appearance', name: 'Appearance', icon: Palette }
  ];

  const TabButton = ({ tab, isActive, onClick }: { tab: any, isActive: boolean, onClick: () => void }) => {
    const Icon = tab.icon;
    return (
      <button
        onClick={onClick}
        className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
          isActive 
            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg' 
            : 'text-gray-700 hover:bg-gray-50'
        }`}
      >
        <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-500'}`} />
        <span className="font-medium">{tab.name}</span>
      </button>
    );
  };

  const TeamTargetCard = ({ teamTargets, isExpanded, onToggle }: { teamTargets: any[], isExpanded: boolean, onToggle: () => void }) => {
    // Calculate team totals with proper number conversion
    const totalQuota = teamTargets.reduce((sum, target) => sum + Number(target.quota_amount), 0);
    const totalAchievement = teamTargets.reduce((sum, target) => sum + Number(target.current_achievement || 0), 0);
    const progress = totalQuota > 0 ? (totalAchievement / totalQuota) * 100 : 0;
    
    // Get unique commission rate (assuming all team members have same rate)
    const commissionRate = teamTargets[0]?.commission_rate || 0;
    
    // Date range from first target
    const firstTarget = teamTargets[0];
    const dateRange = firstTarget ? `${new Date(firstTarget.period_start).toLocaleDateString()} - ${new Date(firstTarget.period_end).toLocaleDateString()}` : '';
    
    return (
      <div className="bg-white rounded-2xl border border-purple-300 shadow-sm hover:shadow-md transition-shadow">
        {/* Parent Row */}
        <div 
          className="p-6 cursor-pointer ring-2 ring-purple-200"
          onClick={onToggle}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <h3 className="text-lg font-semibold text-gray-900">
                  Team Target
                </h3>
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-600">
                  {teamTargets.length} Members
                </span>
              </div>
              <p className="text-sm text-gray-600">
                Combined team quota • {dateRange}
              </p>
              <div className="mt-2 flex items-center space-x-1">
                <Users className="w-4 h-4 text-purple-500" />
                <span className="text-xs text-purple-600 font-medium">
                  Click to {isExpanded ? 'collapse' : 'expand'} team member targets
                </span>
              </div>
            </div>
            <div className="flex items-center">
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <PoundSterling className="w-5 h-5 text-green-600" />
                <span className="text-sm text-gray-600">Total Team Quota</span>
              </div>
              <span className="text-lg font-bold text-gray-900">
                £{totalQuota.toLocaleString()}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                <span className="text-sm text-gray-600">Commission Rate</span>
              </div>
              <span className="text-lg font-bold text-blue-600">
                {commissionRate}%
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Team Progress</span>
                <span className="text-sm font-semibold text-gray-900">
                  {progress.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-gradient-to-r from-purple-500 to-purple-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                ></div>
              </div>
              <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                <span>£{totalAchievement.toLocaleString()}</span>
                <span>£{totalQuota.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Expandable Section */}
        {isExpanded && (
          <div className="border-t border-purple-200 bg-purple-50/30">
            <div className="p-6 space-y-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Team Member Targets</h4>
              {teamTargets.map((target) => (
                <div key={target.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="font-medium text-gray-900">
                        {target.user ? `${target.user.first_name} ${target.user.last_name}` : 'Team Member'}
                      </h5>
                      <p className="text-sm text-gray-600">
                        Individual quota: £{target.quota_amount.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-gray-900">
                        {target.current_achievement ? `£${target.current_achievement.toLocaleString()}` : '£0'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {target.quota_amount > 0 ? ((target.current_achievement || 0) / target.quota_amount * 100).toFixed(1) : '0.0'}% achieved
                      </div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-indigo-500 to-purple-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(((target.current_achievement || 0) / target.quota_amount * 100), 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const TargetCard = ({ target }: { target: any }) => {
    const progress = target.current_achievement ? (target.current_achievement / target.quota_amount) * 100 : 0;
    
    // Check if target is historical (period has ended)
    const isHistorical = new Date(target.period_end) < new Date();
    
    // Determine target type for display
    const getTargetType = () => {
      if (target.team_target) return 'Team Aggregated';
      if (target.role) return `Role-based (${target.role.replace('_', ' ')})`;
      return 'Individual';
    };
    
    const getTargetDescription = () => {
      const dateRange = `${new Date(target.period_start).toLocaleDateString()} - ${new Date(target.period_end).toLocaleDateString()}`;
      
      if (target.team_target) {
        return `Combined quota for entire team • ${dateRange}`;
      }
      if (target.role) {
        return `Applies to all users with ${target.role.replace('_', ' ')} role • ${dateRange}`;
      }
      return dateRange;
    };

    const getTargetIcon = () => {
      if (target.team_target) return 'bg-purple-100 text-purple-600';
      if (target.role) return 'bg-blue-100 text-blue-600';
      return 'bg-green-100 text-green-600';
    };
    
    return (
      <div className={`bg-white rounded-2xl border p-6 shadow-sm hover:shadow-md transition-shadow ${
        isHistorical 
          ? 'border-gray-300 bg-gray-50/50' 
          : target.team_target 
            ? 'ring-2 ring-purple-200 border-purple-300' 
            : 'border-gray-200'
      }`}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <h3 className="text-lg font-semibold text-gray-900 capitalize">
                {target.period_type} Target
              </h3>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getTargetIcon()}`}>
                {getTargetType()}
              </span>
            </div>
            <p className="text-sm text-gray-600">
              {getTargetDescription()}
            </p>
            {target.team_target && (
              <div className="mt-2 flex items-center space-x-1">
                <Users className="w-4 h-4 text-purple-500" />
                <span className="text-xs text-purple-600 font-medium">
                  Aggregated from individual team member quotas
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {isHistorical ? (
              <div className="flex items-center space-x-2 px-3 py-1 bg-gray-100 rounded-lg">
                <span className="text-xs text-gray-500">Historical</span>
              </div>
            ) : (
              <>
                <button
                  onClick={() => startEdit(target)}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Edit target"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    if (target.team_target) {
                      // For team aggregated targets, show warning and delete all team targets
                      if (confirm(
                        `⚠️ WARNING: This will delete ALL targets for this team!\n\n` +
                        `This action will permanently delete:\n` +
                        `• All parent (annual) targets\n` +
                        `• All child (quarterly/monthly) targets\n` +
                        `• Targets for ALL team members\n\n` +
                        `This cannot be undone. Are you sure you want to proceed?`
                      )) {
                        deleteTeamTargetsMutation.mutate(target.user_id);
                      }
                    } else {
                      // For regular targets, just deactivate
                      deleteTargetMutation.mutate(target.id);
                    }
                  }}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title={target.team_target ? "Delete all team targets" : "Deactivate target"}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <PoundSterling className="w-5 h-5 text-green-600" />
              <span className="text-sm text-gray-600">Quota Amount</span>
            </div>
            <span className="text-lg font-bold text-gray-900">
              £{target.quota_amount.toLocaleString()}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <span className="text-sm text-gray-600">Commission Rate</span>
            </div>
            <span className="text-lg font-bold text-blue-600">
              {target.commission_rate}%
            </span>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Progress</span>
              <span className="text-sm font-semibold text-gray-900">
                {progress.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className="bg-gradient-to-r from-indigo-500 to-purple-600 h-3 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(progress, 100)}%` }}
              ></div>
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
              <span>£{target.current_achievement?.toLocaleString() || 0}</span>
              <span>£{target.quota_amount.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700 bg-clip-text text-transparent">
              Settings
            </h1>
            <p className="mt-2 text-gray-600 text-lg">
              Manage your sales targets, profile, and application preferences
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <SettingsIcon className="w-8 h-8 text-gray-400" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-6 shadow-xl border border-gray-200/50 sticky top-8">
              <nav className="space-y-2">
                {tabs.filter(tab => {
                  // Show all tabs for managers/admins, hide admin-only tabs for sales reps
                  if (!tab.adminOnly) return true;
                  return user.is_manager === true || user.is_admin === true;
                }).map((tab) => (
                  <TabButton
                    key={tab.id}
                    tab={tab}
                    isActive={activeTab === tab.id}
                    onClick={() => setActiveTab(tab.id)}
                  />
                ))}
              </nav>
            </div>
          </div>

          {/* Content */}
          <div className="lg:col-span-3">
            {activeTab === 'targets' && (
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Sales Targets</h2>
                    <p className="text-gray-600">Set and manage your sales quotas and commission rates</p>
                  </div>
                  <button
                    onClick={() => setShowAddTarget(true)}
                    className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-medium rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Target
                  </button>
                </div>

                {/* Add/Edit Target Form */}
                {showAddTarget && (
                  <div className="bg-white rounded-3xl border border-gray-200 p-8 shadow-xl">
                    <h3 className="text-xl font-semibold text-gray-900 mb-6">
                      {editingTarget ? 'Edit Target' : 'Add New Target'}
                    </h3>
                    
                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Period Type
                          </label>
                          <select
                            value={targetForm.period_type}
                            onChange={(e) => setTargetForm({...targetForm, period_type: e.target.value})}
                            className="w-full py-3 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            required
                          >
                            <option value="monthly">Monthly</option>
                            <option value="quarterly">Quarterly</option>
                            <option value="yearly">Yearly</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Quota Amount (£)
                          </label>
                          <input
                            type="number"
                            value={targetForm.quota_amount}
                            onChange={(e) => setTargetForm({...targetForm, quota_amount: e.target.value})}
                            className="w-full py-3 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            placeholder="50000"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Period Start
                          </label>
                          <input
                            type="date"
                            value={targetForm.period_start}
                            onChange={(e) => setTargetForm({...targetForm, period_start: e.target.value})}
                            className="w-full py-3 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Period End
                          </label>
                          <input
                            type="date"
                            value={targetForm.period_end}
                            onChange={(e) => setTargetForm({...targetForm, period_end: e.target.value})}
                            className="w-full py-3 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Commission Rate (%)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={targetForm.commission_rate}
                            onChange={(e) => setTargetForm({...targetForm, commission_rate: e.target.value})}
                            className="w-full py-3 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            placeholder="5.0"
                            required
                          />
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <button
                          type="submit"
                          disabled={createTargetMutation.isPending || updateTargetMutation.isPending}
                          className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg disabled:opacity-50"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          {editingTarget ? 'Update Target' : 'Create Target'}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Targets List */}
                <div className="space-y-6">
                  {targetsLoading ? (
                    <div className="flex items-center justify-center h-48">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    </div>
                  ) : targets.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-3xl">
                      <Target className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No targets set</h3>
                      <p className="text-gray-600">Create your first sales target to start tracking progress</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Team Target Section */}
                      {teamTargets.length > 0 && (
                        <TeamTargetCard 
                          teamTargets={teamTargets}
                          isExpanded={expandedTeamTarget}
                          onToggle={() => setExpandedTeamTarget(!expandedTeamTarget)}
                        />
                      )}
                      
                      {/* Individual Targets */}
                      {individualTargets.length > 0 && (
                        <div>
                          {teamTargets.length > 0 && (
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">Individual Targets</h3>
                          )}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {individualTargets.map((target: any) => (
                              <TargetCard key={target.id} target={target} />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'integrations' && (
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Integrations</h2>
                    <p className="text-gray-600">Connect your CRM and other systems to sync deal data automatically</p>
                  </div>
                  <button
                    onClick={() => window.location.href = '/integrations'}
                    className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-medium rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Manage Integrations
                  </button>
                </div>

                {/* Integration Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {integrationsLoading ? (
                    <div className="flex items-center justify-center h-48 col-span-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    </div>
                  ) : integrations.length > 0 ? (
                    integrations.map((integration: any) => {
                      const Icon = getIntegrationIcon(integration.crm_type);
                      const isActive = integration.status === 'active';
                      const hasErrors = integration.summary.has_errors;

                      return (
                        <div
                          key={integration.id}
                          className="bg-white rounded-2xl shadow-lg border border-gray-200/50 p-6 hover:shadow-xl transition-all duration-300"
                        >
                          {/* Header */}
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center">
                              <div className={`p-3 rounded-xl ${isActive ? 'bg-green-100' : 'bg-gray-100'}`}>
                                <Icon className={`w-6 h-6 ${isActive ? 'text-green-600' : 'text-gray-500'}`} />
                              </div>
                              <div className="ml-4">
                                <h3 className="text-lg font-semibold text-gray-900">
                                  {getIntegrationName(integration.crm_type)}
                                </h3>
                                <div className="flex items-center space-x-2 mt-1">
                                  {isActive ? (
                                    <div className="flex items-center text-green-600">
                                      <CheckCircle className="w-4 h-4 mr-1" />
                                      <span className="text-sm font-medium">Active</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center text-gray-500">
                                      <AlertCircle className="w-4 h-4 mr-1" />
                                      <span className="text-sm font-medium">Inactive</span>
                                    </div>
                                  )}
                                  {hasErrors && (
                                    <div className="flex items-center text-red-600">
                                      <AlertTriangle className="w-4 h-4" />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleSync(integration)}
                                disabled={!isActive || syncMutation.isPending}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
                                title="Sync now"
                              >
                                <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                              </button>
                              <button
                                onClick={() => setSelectedIntegration(integration)}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                                title="View details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteIntegration(integration)}
                                disabled={deleteIntegrationMutation.isPending}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Stats */}
                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="bg-gray-50 rounded-xl p-3">
                              <p className="text-xs font-medium text-gray-600 mb-1">Total Deals</p>
                              <p className="text-xl font-bold text-gray-900">
                                {integration.summary.total_deals}
                              </p>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-3">
                              <p className="text-xs font-medium text-gray-600 mb-1">Last Sync</p>
                              <p className="text-sm font-semibold text-gray-700">
                                {integration.summary.last_sync_count} deals
                              </p>
                            </div>
                          </div>

                          {/* Last Sync Date */}
                          <div className="flex items-center text-sm text-gray-600 mb-3">
                            <Clock className="w-4 h-4 mr-1" />
                            <span>Last sync: {formatDate(integration.summary.last_sync)}</span>
                          </div>

                          {/* Sheet Info for Google Sheets */}
                          {integration.crm_type === 'sheets' && integration.sheet_name && (
                            <div className="text-sm text-gray-600 bg-blue-50 rounded-lg p-2">
                              <span className="font-medium">Sheet:</span> {integration.sheet_name}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="col-span-2 text-center py-12 bg-gray-50 rounded-3xl">
                      <Link className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        No Integrations Yet
                      </h3>
                      <p className="text-gray-600 mb-6">
                        Connect your first CRM or data source to start syncing deals automatically.
                      </p>
                      <button
                        onClick={() => window.location.href = '/integrations'}
                        className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Your First Integration
                      </button>
                    </div>
                  )}

                  {/* Add New Integration Card - only if there are existing integrations */}
                  {integrations.length > 0 && (
                    <div
                      onClick={() => window.location.href = '/integrations'}
                      className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl p-6 hover:border-indigo-400 hover:bg-indigo-50 cursor-pointer transition-all duration-300"
                    >
                      <div className="text-center">
                        <Plus className="w-8 h-8 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          Add Integration
                        </h3>
                        <p className="text-sm text-gray-600">
                          Connect another CRM or data source
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab !== 'targets' && activeTab !== 'integrations' && (
              <div className="bg-white rounded-3xl border border-gray-200 p-8 shadow-xl">
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <SettingsIcon className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {tabs.find(tab => tab.id === activeTab)?.name} Coming Soon
                  </h3>
                  <p className="text-gray-600">
                    This section will be available in a future update
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Setup Modal Placeholder */}
      {showSetupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Add Integration</h3>
              <button onClick={() => setShowSetupModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <p className="text-gray-600 text-center py-8">
              Integration setup coming soon. For now, use the dedicated Integrations page.
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setShowSetupModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal Placeholder */}
      {selectedIntegration && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Integration Details</h3>
              <button onClick={() => setSelectedIntegration(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-3 py-4">
              <div>
                <span className="text-sm font-medium text-gray-600">Type:</span>
                <span className="ml-2 text-sm text-gray-900">{getIntegrationName(selectedIntegration.crm_type)}</span>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600">Status:</span>
                <span className={`ml-2 text-sm ${selectedIntegration.status === 'active' ? 'text-green-600' : 'text-gray-500'}`}>
                  {selectedIntegration.status === 'active' ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600">Total Deals:</span>
                <span className="ml-2 text-sm text-gray-900">{selectedIntegration.summary.total_deals}</span>
              </div>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setSelectedIntegration(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Close
              </button>
              <button
                onClick={() => {
                  handleSync(selectedIntegration);
                  setSelectedIntegration(null);
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Sync Now
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default SettingsPage;