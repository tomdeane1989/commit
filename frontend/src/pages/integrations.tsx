import { useState, useEffect } from 'react';
import Layout from '../components/layout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import api from '../lib/api';
import { 
  Plus, 
  Link2, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  Settings,
  Trash2,
  Eye,
  Play,
  Clock,
  FileSpreadsheet,
  Database,
  AlertTriangle,
  X,
  Download
} from 'lucide-react';

interface Integration {
  id: string;
  crm_type: string;
  spreadsheet_id?: string;
  sheet_name?: string;
  is_active: boolean;
  last_sync?: string;
  column_mapping?: any;
  status: 'active' | 'inactive';
  summary: {
    total_deals: number;
    last_sync?: string;
    last_sync_count: number;
    has_errors: boolean;
  };
  created_at: string;
}

const IntegrationsPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);

  // Fetch integrations
  const { data: integrationsData, isLoading } = useQuery({
    queryKey: ['integrations'],
    queryFn: async () => {
      const response = await api.get('/integrations');
      return response.data;
    },
    enabled: !!user
  });

  const integrations = integrationsData?.integrations || [];

  // Manual sync mutation
  const syncMutation = useMutation({
    mutationFn: async (integrationId: string) => {
      const response = await api.post(`/integrations/${integrationId}/sync`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    }
  });

  // Delete integration mutation
  const deleteMutation = useMutation({
    mutationFn: async (integrationId: string) => {
      const response = await api.delete(`/integrations/${integrationId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
    }
  });

  const handleSync = (integration: Integration) => {
    syncMutation.mutate(integration.id);
  };

  const handleDelete = (integration: Integration) => {
    if (confirm(`Are you sure you want to delete the ${integration.crm_type} integration?`)) {
      deleteMutation.mutate(integration.id);
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

  const getIntegrationIcon = (type: string) => {
    switch (type) {
      case 'sheets':
        return FileSpreadsheet;
      case 'salesforce':
      case 'hubspot':
      case 'pipedrive':
        return Database;
      default:
        return Link2;
    }
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
            <h1 className="text-3xl font-bold text-gray-900">Integrations</h1>
            <p className="text-gray-600 mt-1">
              Connect your CRM and other systems to sync deal data automatically
            </p>
          </div>
          <button
            onClick={() => setShowSetupModal(true)}
            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Integration
          </button>
        </div>

        {/* Integration Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {integrations.map((integration: Integration) => {
            const Icon = getIntegrationIcon(integration.crm_type);
            const isActive = integration.status === 'active';
            const hasErrors = integration.summary.has_errors;

            return (
              <div
                key={integration.id}
                className="bg-white rounded-lg shadow border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center">
                    <div className={`p-2 rounded-lg ${isActive ? 'bg-green-100' : 'bg-gray-100'}`}>
                      <Icon className={`w-5 h-5 ${isActive ? 'text-green-600' : 'text-gray-500'}`} />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {getIntegrationName(integration.crm_type)}
                      </h3>
                      <div className="flex items-center space-x-2">
                        {isActive ? (
                          <div className="flex items-center text-green-600">
                            <CheckCircle className="w-4 h-4 mr-1" />
                            <span className="text-sm">Active</span>
                          </div>
                        ) : (
                          <div className="flex items-center text-gray-500">
                            <AlertCircle className="w-4 h-4 mr-1" />
                            <span className="text-sm">Inactive</span>
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
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                      title="Sync now"
                    >
                      <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                      onClick={() => setSelectedIntegration(integration)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                      title="View details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(integration)}
                      disabled={deleteMutation.isPending}
                      className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-50"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs font-medium text-gray-600">Total Deals</p>
                    <p className="text-lg font-bold text-gray-900">
                      {integration.summary.total_deals}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-600">Last Sync</p>
                    <p className="text-sm text-gray-700">
                      {integration.summary.last_sync_count} deals
                    </p>
                  </div>
                </div>

                {/* Last Sync Date */}
                <div className="flex items-center text-sm text-gray-600">
                  <Clock className="w-4 h-4 mr-1" />
                  <span>Last sync: {formatDate(integration.summary.last_sync)}</span>
                </div>

                {/* Sheet Info for Google Sheets */}
                {integration.crm_type === 'sheets' && integration.sheet_name && (
                  <div className="mt-2 text-sm text-gray-600">
                    <span className="font-medium">Sheet:</span> {integration.sheet_name}
                  </div>
                )}
              </div>
            );
          })}

          {/* Add New Integration Card */}
          <div
            onClick={() => setShowSetupModal(true)}
            className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-gray-400 cursor-pointer transition-colors"
          >
            <div className="text-center">
              <Plus className="w-8 h-8 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Add Integration
              </h3>
              <p className="text-sm text-gray-600">
                Connect Google Sheets, Salesforce, HubSpot, or other CRMs
              </p>
            </div>
          </div>
        </div>

        {/* Empty State */}
        {integrations.length === 0 && (
          <div className="text-center py-12">
            <Link2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No Integrations Yet
            </h3>
            <p className="text-gray-600 mb-6">
              Connect your first CRM or data source to start syncing deals automatically.
            </p>
            <button
              onClick={() => setShowSetupModal(true)}
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Integration
            </button>
          </div>
        )}
      </div>

      {/* Setup Modal */}
      {showSetupModal && (
        <SetupModal
          onClose={() => setShowSetupModal(false)}
          onSuccess={() => {
            setShowSetupModal(false);
            queryClient.invalidateQueries({ queryKey: ['integrations'] });
          }}
        />
      )}

      {/* Detail Modal */}
      {selectedIntegration && (
        <DetailModal
          integration={selectedIntegration}
          onClose={() => setSelectedIntegration(null)}
          onSync={() => handleSync(selectedIntegration)}
        />
      )}
    </Layout>
  );
};

// Setup Modal Component
const SetupModal = ({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) => {
  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    spreadsheet_url: '',
    sheet_name: 'Sheet1',
    column_mapping: {}
  });
  const [previewData, setPreviewData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const integrationTypes = [
    {
      id: 'sheets',
      name: 'Google Sheets',
      description: 'Connect a Google Sheets spreadsheet with your deal data',
      icon: FileSpreadsheet,
      available: true
    },
    {
      id: 'salesforce',
      name: 'Salesforce',
      description: 'Connect to your Salesforce CRM',
      icon: Database,
      available: false
    },
    {
      id: 'hubspot',
      name: 'HubSpot',
      description: 'Connect to your HubSpot CRM',
      icon: Database,
      available: false
    },
    {
      id: 'pipedrive',
      name: 'Pipedrive',
      description: 'Connect to your Pipedrive CRM',
      icon: Database,
      available: false
    }
  ];

  const defaultColumnMapping = {
    deal_id: 'Deal ID',
    deal_name: 'Deal Name',
    account_name: 'Account Name',
    amount: 'Amount',
    probability: 'Probability',
    status: 'Status',
    stage: 'Stage',
    close_date: 'Close Date',
    created_date: 'Created Date',
    owned_by: 'Owned By'
  };

  const testConnection = async () => {
    if (!formData.spreadsheet_url) {
      setError('Please enter a spreadsheet URL');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await api.post('/integrations/test-connection', {
        crm_type: selectedType,
        spreadsheet_url: formData.spreadsheet_url
      });

      if (response.data.success) {
        // Get preview data
        const previewResponse = await api.post('/integrations/preview-data', {
          crm_type: selectedType,
          spreadsheet_url: formData.spreadsheet_url,
          sheet_name: formData.sheet_name
        });

        setPreviewData(previewResponse.data.preview);
        setFormData(prev => ({
          ...prev,
          column_mapping: defaultColumnMapping
        }));
        setStep(3);
      }
    } catch (error: any) {
      setError(error.response?.data?.error || 'Connection failed');
    } finally {
      setIsLoading(false);
    }
  };

  const createIntegration = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await api.post('/integrations', {
        crm_type: selectedType,
        name: formData.name || `${selectedType} Integration`,
        spreadsheet_url: formData.spreadsheet_url,
        sheet_name: formData.sheet_name,
        column_mapping: formData.column_mapping
      });

      if (response.data.success) {
        onSuccess();
      }
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to create integration');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadTemplate = () => {
    // Create a link to download the template
    const link = document.createElement('a');
    link.href = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/api/integrations/template/sheets?format=csv`;
    link.download = 'sales-pipeline-template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">
            Add Integration {step > 1 && `- Step ${step} of 3`}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <AlertTriangle className="w-4 h-4 text-red-500 mr-2" />
              <span className="text-red-700">{error}</span>
            </div>
          </div>
        )}

        {/* Step 1: Select Integration Type */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-gray-600 mb-6">
              Choose the system you'd like to connect to sync your deal data.
            </p>
            
            <div className="grid grid-cols-1 gap-4">
              {integrationTypes.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.id}
                    onClick={() => {
                      if (type.available) {
                        setSelectedType(type.id);
                        setStep(2);
                      }
                    }}
                    disabled={!type.available}
                    className={`p-4 border-2 rounded-lg text-left transition-colors ${
                      type.available
                        ? 'border-gray-200 hover:border-green-500 cursor-pointer'
                        : 'border-gray-100 bg-gray-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center">
                      <Icon className={`w-6 h-6 mr-3 ${type.available ? 'text-gray-700' : 'text-gray-400'}`} />
                      <div className="flex-1">
                        <h3 className={`font-medium ${type.available ? 'text-gray-900' : 'text-gray-500'}`}>
                          {type.name}
                          {!type.available && <span className="ml-2 text-sm">(Coming Soon)</span>}
                        </h3>
                        <p className={`text-sm ${type.available ? 'text-gray-600' : 'text-gray-400'}`}>
                          {type.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2: Configuration */}
        {step === 2 && selectedType === 'sheets' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Google Sheets Configuration</h3>
              <p className="text-gray-600 mb-4">
                Enter the URL of your Google Sheets spreadsheet. 
              </p>
              
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-green-900">Required: Shareable Link</h4>
                    <p className="text-sm text-green-700 mt-1">
                      Use the <strong>"Anyone with the link"</strong> sharing option from your Google Sheet. The URL should look like:
                    </p>
                    <code className="text-xs bg-green-100 px-2 py-1 rounded mt-2 block">
                      https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit?usp=sharing
                    </code>
                  </div>
                </div>
              </div>
              
              {/* Template Download Section */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-start space-x-3">
                  <FileSpreadsheet className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-blue-900">Need a template?</h4>
                    <p className="text-sm text-blue-700 mt-1 mb-3">
                      Download our sample CSV template with the correct format and example data to get started quickly.
                    </p>
                    
                    <div className="text-xs text-blue-600 mb-3">
                      <div className="mb-1"><strong>Expected columns:</strong> Deal Name, Account Name, Amount, Probability (%), Status, Stage, Close Date, Created Date, Owned By</div>
                      <div><strong>Data formats:</strong> Amount (number), Probability (0-100), Status (Open/Closed Won/Closed Lost), Dates (YYYY-MM-DD), Owned By (email)</div>
                    </div>
                    
                    <button
                      onClick={downloadTemplate}
                      className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-700 bg-blue-100 border border-blue-300 rounded-lg hover:bg-blue-200 transition-colors"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Template (CSV)
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Spreadsheet URL *
              </label>
              <input
                type="url"
                value={formData.spreadsheet_url}
                onChange={(e) => setFormData(prev => ({ ...prev, spreadsheet_url: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
                style={{ '--tw-ring-color': '#82a365' } as any}
                placeholder="https://docs.google.com/spreadsheets/d/..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sheet Name
              </label>
              <input
                type="text"
                value={formData.sheet_name}
                onChange={(e) => setFormData(prev => ({ ...prev, sheet_name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
                style={{ '--tw-ring-color': '#82a365' } as any}
                placeholder="Sheet1"
              />
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Back
              </button>
              <button
                onClick={testConnection}
                disabled={isLoading || !formData.spreadsheet_url}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {isLoading ? 'Testing...' : 'Test Connection'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Column Mapping */}
        {step === 3 && previewData && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Column Mapping</h3>
              <p className="text-gray-600 mb-4">
                Map your spreadsheet columns to deal fields. Preview shows first 5 rows.
              </p>
            </div>

            {/* Preview Table */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2">
                <h4 className="font-medium text-gray-900">Data Preview</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      {previewData.headers.map((header: string, index: number) => (
                        <th key={index} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {previewData.data.slice(0, 3).map((row: any, index: number) => (
                      <tr key={index}>
                        {previewData.headers.map((header: string, colIndex: number) => (
                          <td key={colIndex} className="px-4 py-2 text-sm text-gray-900">
                            {row[header] || '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Column Mapping */}
            <div>
              <h4 className="font-medium text-gray-900 mb-4">Field Mapping</h4>
              <div className="space-y-3">
                {Object.entries(formData.column_mapping).map(([field, mappedColumn]) => (
                  <div key={field} className="flex items-center space-x-4">
                    <div className="w-32">
                      <span className="text-sm font-medium text-gray-700">
                        {field.replace('_', ' ')} {['deal_name', 'account_name', 'amount', 'close_date', 'owned_by'].includes(field) && '*'}
                      </span>
                    </div>
                    <div className="flex-1">
                      <select
                        value={mappedColumn as string}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          column_mapping: {
                            ...prev.column_mapping,
                            [field]: e.target.value
                          }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
                        style={{ '--tw-ring-color': '#82a365' } as any}
                      >
                        <option value="">Select column...</option>
                        {previewData.headers.map((header: string) => (
                          <option key={header} value={header}>
                            {header}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep(2)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Back
              </button>
              <button
                onClick={createIntegration}
                disabled={isLoading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {isLoading ? 'Creating...' : 'Create Integration'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Detail Modal Component
const DetailModal = ({ 
  integration, 
  onClose, 
  onSync 
}: { 
  integration: Integration; 
  onClose: () => void; 
  onSync: () => void;
}) => {
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">
            {getIntegrationName(integration.crm_type)} Details
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <span className="text-sm font-medium text-gray-600">Status:</span>
            <span className={`ml-2 text-sm ${
              integration.status === 'active' ? 'text-green-600' : 'text-gray-500'
            }`}>
              {integration.status === 'active' ? 'Active' : 'Inactive'}
            </span>
          </div>

          <div>
            <span className="text-sm font-medium text-gray-600">Total Deals Synced:</span>
            <span className="ml-2 text-sm text-gray-900">{integration.summary.total_deals}</span>
          </div>

          <div>
            <span className="text-sm font-medium text-gray-600">Last Sync:</span>
            <span className="ml-2 text-sm text-gray-900">
              {integration.summary.last_sync 
                ? new Date(integration.summary.last_sync).toLocaleString()
                : 'Never'
              }
            </span>
          </div>

          {integration.crm_type === 'sheets' && (
            <>
              <div>
                <span className="text-sm font-medium text-gray-600">Sheet Name:</span>
                <span className="ml-2 text-sm text-gray-900">{integration.sheet_name}</span>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600">Spreadsheet ID:</span>
                <span className="ml-2 text-sm font-mono text-gray-700">
                  {integration.spreadsheet_id?.substring(0, 20)}...
                </span>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Close
          </button>
          <button
            onClick={() => {
              onSync();
              onClose();
            }}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Sync Now
          </button>
        </div>
      </div>
    </div>
  );
};

export default IntegrationsPage;