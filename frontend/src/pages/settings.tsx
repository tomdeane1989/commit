import { useState, useEffect } from 'react';
import Layout from '../components/layout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
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
  Bell,
  Shield,
  Palette
} from 'lucide-react';

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState('targets');
  const [showAddTarget, setShowAddTarget] = useState(false);
  const [editingTarget, setEditingTarget] = useState<any>(null);
  const queryClient = useQueryClient();

  const [targetForm, setTargetForm] = useState({
    period_type: 'quarterly',
    period_start: '',
    period_end: '',
    quota_amount: '',
    commission_rate: ''
  });

  const { data: targetsData, isLoading: targetsLoading } = useQuery({
    queryKey: ['targets', user?.id], // User-specific cache key
    queryFn: async () => {
      const response = await api.get('/targets');
      return response.data;
    }
  });

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
        commission_rate: ''
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

  const targets = targetsData?.targets || [];

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
      commission_rate: target.commission_rate.toString()
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
      commission_rate: ''
    });
  };

  const tabs = [
    { id: 'targets', name: 'Sales Targets', icon: Target },
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

  const TargetCard = ({ target }: { target: any }) => {
    const progress = target.current_achievement ? (target.current_achievement / target.quota_amount) * 100 : 0;
    
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 capitalize">
              {target.period_type} Target
            </h3>
            <p className="text-sm text-gray-600">
              {new Date(target.period_start).toLocaleDateString()} - {new Date(target.period_end).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => startEdit(target)}
              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={() => deleteTargetMutation.mutate(target.id)}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
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
                {tabs.map((tab) => (
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {targets.map((target: any) => (
                        <TargetCard key={target.id} target={target} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab !== 'targets' && (
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
    </Layout>
  );
};

export default SettingsPage;