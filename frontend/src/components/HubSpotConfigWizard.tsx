import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Users,
  GitBranch,
  FileText,
  Settings,
  Check,
  AlertTriangle,
  Loader,
  UserPlus
} from 'lucide-react';
import api from '../lib/api';

interface HubSpotConfigWizardProps {
  onClose: () => void;
  onComplete: () => void;
}

interface Pipeline {
  id: string;
  label: string;
  stages: Stage[];
}

interface Stage {
  id: string;
  label: string;
  displayOrder: number;
}

interface HubSpotUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  teams: any[];
}

interface Team {
  id: string;
  name: string;
}

const HubSpotConfigWizard: React.FC<HubSpotConfigWizardProps> = ({ onClose, onComplete }) => {
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState({
    pipelines: [] as string[],
    stages: [] as string[],
    users: [] as string[],
    teams: [] as string[],
    syncOptions: {
      syncClosedDeals: true,
      syncOpenDeals: true,
      autoCreateUsers: false,
      mapTeamsToGroups: true
    }
  });

  // Fetch HubSpot metadata
  const { data: metadata, isLoading, error } = useQuery({
    queryKey: ['hubspot-metadata'],
    queryFn: async () => {
      const response = await api.get('/integrations/hubspot/metadata');
      return response.data.metadata;
    }
  });

  // Save configuration
  const saveMutation = useMutation({
    mutationFn: async () => {
      const response = await api.put('/integrations/hubspot/config', config);
      return response.data;
    },
    onSuccess: () => {
      onComplete();
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Failed to save configuration');
    }
  });

  // Initialize with current config if exists
  useEffect(() => {
    if (metadata?.currentConfig) {
      setConfig(prev => ({
        ...prev,
        ...metadata.currentConfig
      }));
    }
  }, [metadata]);

  const handlePipelineToggle = (pipelineId: string) => {
    setConfig(prev => {
      const pipelines = prev.pipelines.includes(pipelineId)
        ? prev.pipelines.filter(id => id !== pipelineId)
        : [...prev.pipelines, pipelineId];
      
      // Auto-select all stages for selected pipelines
      const selectedPipeline = metadata?.pipelines?.find((p: Pipeline) => p.id === pipelineId);
      let stages = [...prev.stages];
      
      if (pipelines.includes(pipelineId) && selectedPipeline) {
        // Add all stages from this pipeline
        selectedPipeline.stages.forEach((stage: Stage) => {
          if (!stages.includes(stage.id)) {
            stages.push(stage.id);
          }
        });
      } else if (selectedPipeline) {
        // Remove all stages from this pipeline
        stages = stages.filter(stageId => 
          !selectedPipeline.stages.some((stage: Stage) => stage.id === stageId)
        );
      }
      
      return { ...prev, pipelines, stages };
    });
  };

  const handleStageToggle = (stageId: string) => {
    setConfig(prev => ({
      ...prev,
      stages: prev.stages.includes(stageId)
        ? prev.stages.filter(id => id !== stageId)
        : [...prev.stages, stageId]
    }));
  };

  const handleUserToggle = (userId: string) => {
    setConfig(prev => ({
      ...prev,
      users: prev.users.includes(userId)
        ? prev.users.filter(id => id !== userId)
        : [...prev.users, userId]
    }));
  };

  const handleTeamToggle = (teamId: string) => {
    setConfig(prev => ({
      ...prev,
      teams: prev.teams.includes(teamId)
        ? prev.teams.filter(id => id !== teamId)
        : [...prev.teams, teamId]
    }));
  };

  const renderStep = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <Loader className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-8">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600">Failed to load HubSpot data</p>
        </div>
      );
    }

    switch (step) {
      case 1:
        // Pipeline & Stage Selection
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <GitBranch className="w-12 h-12 text-blue-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900">Select Pipelines & Stages</h3>
              <p className="text-sm text-gray-600 mt-2">
                Choose which deal pipelines and stages to sync from HubSpot
              </p>
            </div>

            <div className="space-y-4 max-h-96 overflow-y-auto">
              {metadata?.pipelines?.map((pipeline: Pipeline) => (
                <div key={pipeline.id} className="border rounded-lg p-4">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={config.pipelines.includes(pipeline.id)}
                        onChange={() => handlePipelineToggle(pipeline.id)}
                        className="mr-3 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="font-medium text-gray-900">{pipeline.label}</span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {pipeline.stages.length} stages
                    </span>
                  </label>

                  {config.pipelines.includes(pipeline.id) && (
                    <div className="ml-7 mt-3 space-y-2">
                      {pipeline.stages.map((stage: Stage) => (
                        <label key={stage.id} className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={config.stages.includes(stage.id)}
                            onChange={() => handleStageToggle(stage.id)}
                            className="mr-2 text-blue-600 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">{stage.label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {(!metadata?.pipelines || metadata.pipelines.length === 0) && (
                <div className="text-center py-8 text-gray-500">
                  No pipelines found in HubSpot
                </div>
              )}
            </div>
          </div>
        );

      case 2:
        // User Selection
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <Users className="w-12 h-12 text-blue-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900">Select Users to Import</h3>
              <p className="text-sm text-gray-600 mt-2">
                Choose which HubSpot users should be imported to Commit
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.syncOptions.autoCreateUsers}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    syncOptions: { ...prev.syncOptions, autoCreateUsers: e.target.checked }
                  }))}
                  className="mr-3 text-blue-600 rounded focus:ring-blue-500"
                />
                <div>
                  <span className="font-medium text-blue-900">Auto-create missing users</span>
                  <p className="text-sm text-blue-700 mt-1">
                    Automatically create Commit accounts for HubSpot users not in the system
                  </p>
                </div>
              </label>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {metadata?.users?.map((user: HubSpotUser) => (
                <label key={user.id} className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={config.users.includes(user.id)}
                    onChange={() => handleUserToggle(user.id)}
                    className="mr-3 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">
                      {user.firstName} {user.lastName}
                    </div>
                    <div className="text-sm text-gray-600">{user.email}</div>
                    {user.teams?.length > 0 && (
                      <div className="text-xs text-gray-500 mt-1">
                        Teams: {user.teams.length}
                      </div>
                    )}
                  </div>
                </label>
              ))}

              {(!metadata?.users || metadata.users.length === 0) && (
                <div className="text-center py-8 text-gray-500">
                  No users found in HubSpot
                </div>
              )}
            </div>

            <div className="flex items-center space-x-4">
              <button
                onClick={() => setConfig(prev => ({
                  ...prev,
                  users: metadata?.users?.map((u: HubSpotUser) => u.id) || []
                }))}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Select All
              </button>
              <button
                onClick={() => setConfig(prev => ({ ...prev, users: [] }))}
                className="text-sm text-gray-600 hover:text-gray-700"
              >
                Clear All
              </button>
            </div>
          </div>
        );

      case 3:
        // Team Mapping
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <UserPlus className="w-12 h-12 text-blue-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900">Team Configuration</h3>
              <p className="text-sm text-gray-600 mt-2">
                Configure how HubSpot teams map to Commit teams
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.syncOptions.mapTeamsToGroups}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    syncOptions: { ...prev.syncOptions, mapTeamsToGroups: e.target.checked }
                  }))}
                  className="mr-3 text-blue-600 rounded focus:ring-blue-500"
                />
                <div>
                  <span className="font-medium text-blue-900">Map HubSpot teams to Commit teams</span>
                  <p className="text-sm text-blue-700 mt-1">
                    Automatically assign users to Commit teams based on their HubSpot team membership
                  </p>
                </div>
              </label>
            </div>

            {metadata?.teams && metadata.teams.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {metadata.teams.map((team: Team) => (
                  <label key={team.id} className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={config.teams.includes(team.id)}
                      onChange={() => handleTeamToggle(team.id)}
                      className="mr-3 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{team.name}</div>
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No teams found in HubSpot</p>
                <p className="text-sm mt-2">Teams may require additional HubSpot permissions</p>
              </div>
            )}
          </div>
        );

      case 4:
        // Review & Confirm
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <Settings className="w-12 h-12 text-blue-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900">Review Configuration</h3>
              <p className="text-sm text-gray-600 mt-2">
                Review your sync settings before saving
              </p>
            </div>

            <div className="space-y-4">
              <div className="border rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Sync Settings</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center">
                    {config.syncOptions.syncClosedDeals ? (
                      <Check className="w-4 h-4 text-green-600 mr-2" />
                    ) : (
                      <X className="w-4 h-4 text-red-600 mr-2" />
                    )}
                    <span>Sync closed deals</span>
                  </div>
                  <div className="flex items-center">
                    {config.syncOptions.syncOpenDeals ? (
                      <Check className="w-4 h-4 text-green-600 mr-2" />
                    ) : (
                      <X className="w-4 h-4 text-red-600 mr-2" />
                    )}
                    <span>Sync open deals</span>
                  </div>
                  <div className="flex items-center">
                    {config.syncOptions.autoCreateUsers ? (
                      <Check className="w-4 h-4 text-green-600 mr-2" />
                    ) : (
                      <X className="w-4 h-4 text-red-600 mr-2" />
                    )}
                    <span>Auto-create missing users</span>
                  </div>
                  <div className="flex items-center">
                    {config.syncOptions.mapTeamsToGroups ? (
                      <Check className="w-4 h-4 text-green-600 mr-2" />
                    ) : (
                      <X className="w-4 h-4 text-red-600 mr-2" />
                    )}
                    <span>Map teams</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">Selected Pipelines</h4>
                  <p className="text-2xl font-bold text-blue-600">{config.pipelines.length}</p>
                  <p className="text-sm text-gray-600">
                    {config.stages.length} stages selected
                  </p>
                </div>

                <div className="border rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">Users to Import</h4>
                  <p className="text-2xl font-bold text-blue-600">{config.users.length}</p>
                  <p className="text-sm text-gray-600">
                    {config.teams.length} teams selected
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return config.pipelines.length > 0;
      case 2:
        return config.users.length > 0 || config.syncOptions.autoCreateUsers;
      case 3:
        return true; // Team selection is optional
      case 4:
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              Configure HubSpot Sync
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="mt-4 flex items-center space-x-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`flex-1 h-2 rounded-full ${
                  i <= step ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-600">
            <span>Pipelines</span>
            <span>Users</span>
            <span>Teams</span>
            <span>Review</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {renderStep()}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between">
          <button
            onClick={() => setStep(Math.max(1, step - 1))}
            disabled={step === 1}
            className={`px-4 py-2 flex items-center space-x-2 ${
              step === 1 
                ? 'text-gray-400 cursor-not-allowed' 
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            
            {step < 4 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={!canProceed()}
                className={`px-4 py-2 flex items-center space-x-2 rounded-lg ${
                  canProceed()
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center space-x-2"
              >
                {saveMutation.isPending ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Save Configuration</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HubSpotConfigWizard;