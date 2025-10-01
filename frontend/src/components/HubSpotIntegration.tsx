import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  Settings,
  Trash2,
  Link2,
  Clock,
  Database,
  X,
  Eye,
  Sliders
} from 'lucide-react';
import api from '../lib/api';
import { useRouter } from 'next/router';
import HubSpotConfigWizard from './HubSpotConfigWizard';

interface HubSpotIntegrationProps {
  onClose?: () => void;
  onViewDeals?: (integrationId: string) => void;
}

const HubSpotIntegration: React.FC<HubSpotIntegrationProps> = ({ onClose, onViewDeals }) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);
  const [syncInProgress, setSyncInProgress] = useState(false);
  const [showFieldMapping, setShowFieldMapping] = useState(false);
  const [showConfigWizard, setShowConfigWizard] = useState(false);
  
  // Check for connection status from URL params
  useEffect(() => {
    if (router.query.hubspot === 'connected') {
      queryClient.invalidateQueries({ queryKey: ['hubspot-status'] });
      // Clear URL params
      router.replace('/integrations', undefined, { shallow: true });
    } else if (router.query.hubspot === 'error') {
      const errorMessage = router.query.message as string;
      alert(`HubSpot connection failed: ${errorMessage || 'Unknown error'}`);
      router.replace('/integrations', undefined, { shallow: true });
    }
  }, [router.query]);

  // Get HubSpot integration status
  const { data: status, isLoading: statusLoading, error: statusError } = useQuery({
    queryKey: ['hubspot-status'],
    queryFn: async () => {
      try {
        const response = await api.get('/integrations/hubspot/status');
        return response?.data || { connected: false };
      } catch (error) {
        console.error('Error fetching HubSpot status:', error);
        return { connected: false, error: 'Failed to fetch status' };
      }
    },
    retry: 1 // Only retry once on failure
  });

  // Get HubSpot integration details (including ID)
  const { data: integrationData } = useQuery({
    queryKey: ['hubspot-integration'],
    queryFn: async () => {
      try {
        const response = await api.get('/integrations');
        if (!response?.data) {
          console.error('No data received from integrations API');
          return null;
        }
        const hubspotIntegration = response.data.integrations?.find(
          (i: any) => i.crm_type === 'hubspot'
        );
        return hubspotIntegration || null;
      } catch (error) {
        console.error('Error fetching HubSpot integration:', error);
        return null;
      }
    },
    enabled: status?.connected,
    initialData: null // Provide initial data to prevent undefined
  });

  // Connect to HubSpot
  const connectMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/integrations/hubspot/connect');
      return response.data;
    },
    onSuccess: (data) => {
      if (data.auth_url) {
        window.location.href = data.auth_url;
      }
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Failed to connect to HubSpot');
      setIsConnecting(false);
    }
  });

  // Sync deals
  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/integrations/hubspot/sync', {
        limit: 100
      }, {
        timeout: 60000 // Increase timeout to 60 seconds for large syncs
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['hubspot-status'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      setSyncInProgress(false);
      alert(`Successfully synced ${data.deals_synced} deals from HubSpot`);
    },
    onError: (error: any) => {
      setSyncInProgress(false);
      // Handle timeout specifically
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        alert('Sync is taking longer than expected. It will continue in the background. Please refresh the page in a minute to see the results.');
      } else {
        alert(error.response?.data?.error || 'Failed to sync deals');
      }
    }
  });

  // Disconnect HubSpot
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await api.delete('/integrations/hubspot/disconnect');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hubspot-status'] });
      alert('HubSpot disconnected successfully');
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Failed to disconnect HubSpot');
    }
  });

  const handleConnect = () => {
    setIsConnecting(true);
    connectMutation.mutate();
  };

  const handleSync = () => {
    setSyncInProgress(true);
    syncMutation.mutate();
  };

  const handleDisconnect = () => {
    if (confirm('Are you sure you want to disconnect HubSpot? This will stop syncing deals.')) {
      disconnectMutation.mutate();
    }
  };

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

  if (statusLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-600" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.5 2h-11A2.5 2.5 0 004 4.5v15A2.5 2.5 0 006.5 22h11a2.5 2.5 0 002.5-2.5v-15A2.5 2.5 0 0017.5 2zm-6.25 17.5h-2.5v-7.5h2.5v7.5zm0-10h-2.5v-5h2.5v5z"/>
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">HubSpot CRM</h3>
              <p className="text-sm text-gray-500">Sync deals and contacts from HubSpot</p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-6">
        {status?.connected ? (
          // Connected State
          <div className="space-y-6">
            {/* Connection Status */}
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="font-medium text-green-900">Connected to HubSpot</span>
              </div>
              <button
                onClick={handleDisconnect}
                className="text-sm text-red-600 hover:text-red-700 font-medium"
                disabled={disconnectMutation.isPending}
              >
                Disconnect
              </button>
            </div>

            {/* Sync Information */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Database className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-500">Total Deals</span>
                </div>
                <p className="text-2xl font-semibold text-gray-900">
                  {status.total_deals_synced || 0}
                </p>
              </div>
              
              <div 
                className="bg-gray-50 rounded-lg p-4 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => {
                  if (onViewDeals && integrationData?.id) {
                    onViewDeals(integrationData.id);
                  }
                }}
                title="Click to view synced deals"
              >
                <div className="flex items-center space-x-2 mb-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-500">Last Sync</span>
                </div>
                <p className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors">
                  {formatDate(status.last_sync)}
                </p>
                {status.last_sync_deals_count !== undefined && (
                  <div className="text-xs text-gray-500 hover:text-blue-500 mt-1 transition-colors">
                    <p>{status.last_sync_deals_count} deals processed</p>
                    {(status.last_sync_created > 0 || status.last_sync_updated > 0) && (
                      <p className="mt-0.5">
                        {status.last_sync_created > 0 && <span className="text-green-600">{status.last_sync_created} created</span>}
                        {status.last_sync_created > 0 && status.last_sync_updated > 0 && <span className="mx-1">•</span>}
                        {status.last_sync_updated > 0 && <span className="text-blue-600">{status.last_sync_updated} updated</span>}
                      </p>
                    )}
                  </div>
                )}
                {onViewDeals && integrationData?.id && (
                  <div className="mt-2 flex items-center text-xs text-blue-600">
                    <Eye className="w-3 h-3 mr-1" />
                    <span>Click to view</span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex space-x-3">
              <button
                onClick={handleSync}
                disabled={syncInProgress || syncMutation.isPending}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {syncInProgress || syncMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Syncing...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    <span>Sync Now</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setShowConfigWizard(true)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center space-x-2"
              >
                <Sliders className="w-4 h-4" />
                <span>Configure Sync</span>
              </button>

              <button
                onClick={() => setShowFieldMapping(!showFieldMapping)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center space-x-2"
              >
                <Settings className="w-4 h-4" />
                <span>Field Mapping</span>
              </button>
            </div>

            {/* Sync Progress Indicator */}
            {(syncInProgress || syncMutation.isPending) && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center space-x-3">
                  <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-800">Sync in Progress</p>
                    <p className="text-xs text-blue-600 mt-1">
                      This may take a minute for large datasets. The sync will continue in the background even if this page times out.
                    </p>
                  </div>
                </div>
                <div className="mt-3 w-full bg-blue-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '100%' }}></div>
                </div>
              </div>
            )}

            {/* Field Mapping (if shown) */}
            {showFieldMapping && (
              <div className="border-t pt-4">
                <h4 className="font-medium text-gray-900 mb-3">Field Mapping Configuration</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-600">Deal Name</span>
                    <span className="font-mono text-gray-900">dealname</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-600">Amount</span>
                    <span className="font-mono text-gray-900">amount</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-600">Stage</span>
                    <span className="font-mono text-gray-900">dealstage</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-600">Close Date</span>
                    <span className="font-mono text-gray-900">closedate</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-gray-600">Owner</span>
                    <span className="font-mono text-gray-900">hubspot_owner_id</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          // Not Connected State
          <div className="space-y-6">
            {/* Benefits */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">What you'll get:</h4>
              <ul className="space-y-1 text-sm text-blue-700">
                <li className="flex items-start space-x-2">
                  <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>Automatic deal synchronization from HubSpot</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>Real-time commission calculations on closed deals</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>Webhook updates for instant deal changes</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>Custom field mapping support</span>
                </li>
              </ul>
            </div>

            {/* Connect Button */}
            <button
              onClick={handleConnect}
              disabled={isConnecting || connectMutation.isPending}
              className="w-full bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {isConnecting || connectMutation.isPending ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <Link2 className="w-5 h-5" />
                  <span>Connect to HubSpot</span>
                </>
              )}
            </button>

            <p className="text-xs text-gray-500 text-center">
              You'll be redirected to HubSpot to authorize the connection.
              Make sure you have admin access to your HubSpot account.
            </p>
          </div>
        )}
      </div>
    </div>

    {/* Configuration Wizard */}
    {showConfigWizard && (
      <HubSpotConfigWizard
        onClose={() => setShowConfigWizard(false)}
        onComplete={() => {
          setShowConfigWizard(false);
          queryClient.invalidateQueries({ queryKey: ['hubspot-status'] });
          alert('HubSpot sync configuration saved successfully!');
        }}
      />
    )}
    </>
  );
};

export default HubSpotIntegration;