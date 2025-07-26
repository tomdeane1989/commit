import { useState } from 'react';
import { X, AlertTriangle, User, Calendar, DollarSign, TrendingUp, CheckCircle } from 'lucide-react';

interface ConflictData {
  user_id: string;
  name: string;
  email: string;
  role: string;
  existing_target: {
    id: string;
    period_start: string;
    period_end: string;
    quota_amount: number;
    commission_rate: number;
    period_type: string;
  };
  proposed_target: {
    period_start: string;
    period_end: string;
    quota_amount: number;
    commission_rate: number;
    period_type: string;
  };
}

interface ConflictResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResolve: (resolutions: any[]) => void;
  conflicts: ConflictData[];
  loading: boolean;
}

interface Resolution {
  user_id: string;
  action: 'replace' | 'keep' | 'concurrent';
  existing_target_id: string;
  proposed_target: any;
}

export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  isOpen,
  onClose,
  onResolve,
  conflicts,
  loading
}) => {
  const [resolutions, setResolutions] = useState<{ [key: string]: 'replace' | 'keep' | 'concurrent' }>({});

  const handleResolutionChange = (userId: string, action: 'replace' | 'keep' | 'concurrent') => {
    setResolutions(prev => ({
      ...prev,
      [userId]: action
    }));
  };

  const handleResolve = () => {
    const resolveData: Resolution[] = conflicts.map(conflict => ({
      user_id: conflict.user_id,
      action: resolutions[conflict.user_id] || 'keep',
      existing_target_id: conflict.existing_target.id,
      proposed_target: conflict.proposed_target
    }));

    onResolve(resolveData);
  };

  const canResolve = conflicts.every(conflict => 
    resolutions[conflict.user_id] !== undefined
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <AlertTriangle className="w-6 h-6 text-amber-600 mr-3" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Resolve Target Conflicts</h2>
              <p className="text-sm text-gray-600">
                {conflicts.length} user{conflicts.length !== 1 ? 's' : ''} already have overlapping targets
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conflicts List */}
        <div className="p-6">
          <div className="space-y-6">
            {conflicts.map((conflict, index) => (
              <div key={conflict.user_id} className="border border-gray-200 rounded-lg p-4">
                {/* User Info */}
                <div className="flex items-center mb-4">
                  <User className="w-5 h-5 text-gray-400 mr-3" />
                  <div>
                    <h3 className="font-medium text-gray-900">{conflict.name}</h3>
                    <p className="text-sm text-gray-600">{conflict.email} • {conflict.role}</p>
                  </div>
                </div>

                {/* Conflict Comparison */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {/* Existing Target */}
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center mb-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                      <h4 className="font-medium text-red-900">Existing Target</h4>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center text-red-700">
                        <Calendar className="w-4 h-4 mr-2" />
                        {new Date(conflict.existing_target.period_start).toLocaleDateString('en-GB')} - 
                        {new Date(conflict.existing_target.period_end).toLocaleDateString('en-GB')}
                      </div>
                      <div className="flex items-center text-red-700">
                        <DollarSign className="w-4 h-4 mr-2" />
                        {new Intl.NumberFormat('en-GB', {
                          style: 'currency',
                          currency: 'GBP',
                          minimumFractionDigits: 0
                        }).format(conflict.existing_target.quota_amount)}
                      </div>
                      <div className="flex items-center text-red-700">
                        <TrendingUp className="w-4 h-4 mr-2" />
                        {(conflict.existing_target.commission_rate * 100).toFixed(1)}% commission
                      </div>
                      <div className="text-red-600 capitalize">
                        {conflict.existing_target.period_type}
                      </div>
                    </div>
                  </div>

                  {/* Proposed Target */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center mb-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                      <h4 className="font-medium text-green-900">Proposed Target</h4>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center text-green-700">
                        <Calendar className="w-4 h-4 mr-2" />
                        {new Date(conflict.proposed_target.period_start).toLocaleDateString('en-GB')} - 
                        {new Date(conflict.proposed_target.period_end).toLocaleDateString('en-GB')}
                      </div>
                      <div className="flex items-center text-green-700">
                        <DollarSign className="w-4 h-4 mr-2" />
                        {new Intl.NumberFormat('en-GB', {
                          style: 'currency',
                          currency: 'GBP',
                          minimumFractionDigits: 0
                        }).format(conflict.proposed_target.quota_amount)}
                      </div>
                      <div className="flex items-center text-green-700">
                        <TrendingUp className="w-4 h-4 mr-2" />
                        {(conflict.proposed_target.commission_rate * 100).toFixed(1)}% commission
                      </div>
                      <div className="text-green-600 capitalize">
                        {conflict.proposed_target.period_type}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Resolution Options */}
                <div className="border-t border-gray-200 pt-4">
                  <h4 className="font-medium text-gray-900 mb-3">Choose Resolution:</h4>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => handleResolutionChange(conflict.user_id, 'keep')}
                      className={`flex items-center px-4 py-2 rounded-lg border transition-colors ${
                        resolutions[conflict.user_id] === 'keep'
                          ? 'border-red-500 bg-red-50 text-red-700'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full mr-2 ${
                        resolutions[conflict.user_id] === 'keep'
                          ? 'bg-red-500'
                          : 'bg-gray-300'
                      }`}></div>
                      Keep Existing Target
                    </button>
                    
                    <button
                      onClick={() => handleResolutionChange(conflict.user_id, 'replace')}
                      className={`flex items-center px-4 py-2 rounded-lg border transition-colors ${
                        resolutions[conflict.user_id] === 'replace'
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full mr-2 ${
                        resolutions[conflict.user_id] === 'replace'
                          ? 'bg-green-500'
                          : 'bg-gray-300'
                      }`}></div>
                      Replace with New Target
                    </button>
                    
                    <button
                      onClick={() => handleResolutionChange(conflict.user_id, 'concurrent')}
                      className={`flex items-center px-4 py-2 rounded-lg border transition-colors ${
                        resolutions[conflict.user_id] === 'concurrent'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full mr-2 ${
                        resolutions[conflict.user_id] === 'concurrent'
                          ? 'bg-blue-500'
                          : 'bg-gray-300'
                      }`}></div>
                      Add Concurrent Target
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          <div className="text-sm text-gray-600">
            {Object.keys(resolutions).length} of {conflicts.length} conflicts resolved
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            
            <button
              onClick={handleResolve}
              disabled={!canResolve || loading}
              className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                canResolve && !loading
                  ? 'text-white cursor-pointer'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
              style={canResolve && !loading ? { 
                backgroundColor: '#82a365',
                ':hover': { opacity: 0.9 }
              } : {}}
              onMouseEnter={(e) => {
                if (canResolve && !loading) {
                  e.currentTarget.style.opacity = '0.9';
                }
              }}
              onMouseLeave={(e) => {
                if (canResolve && !loading) {
                  e.currentTarget.style.opacity = '1';
                }
              }}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Resolving...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Resolve Conflicts
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};