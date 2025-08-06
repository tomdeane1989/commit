import { useState } from 'react';
import { X, Target, Users, Calendar, PoundSterling, TrendingUp } from 'lucide-react';

interface TeamTarget {
  id: string;
  role: string;
  quota_amount: number;
  commission_rate: number;
  period_type: string;
  period_start: string;
  period_end: string;
}

interface NewMember {
  first_name: string;
  last_name: string;
  role: string;
  email: string;
}

interface TeamTargetInterceptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyTarget: (targetId: string) => void;
  onSkip: () => void;
  newMember: NewMember;
  matchingTargets: TeamTarget[];
  loading?: boolean;
}

export const TeamTargetInterceptModal: React.FC<TeamTargetInterceptModalProps> = ({
  isOpen,
  onClose,
  onApplyTarget,
  onSkip,
  newMember,
  matchingTargets,
  loading = false
}) => {
  const [selectedTargetId, setSelectedTargetId] = useState<string>(
    matchingTargets.length > 0 ? matchingTargets[0].id : ''
  );

  const selectedTarget = matchingTargets.find(t => t.id === selectedTargetId);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatPeriod = (periodType: string, startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const startMonth = start.toLocaleDateString('en-GB', { month: 'short' });
    const endMonth = end.toLocaleDateString('en-GB', { month: 'short' });
    const year = start.getFullYear();
    
    if (periodType === 'quarterly') {
      return `${startMonth} - ${endMonth} ${year}`;
    } else if (periodType === 'monthly') {
      return `${startMonth} ${year}`;
    } else {
      return `${year}`;
    }
  };

  if (!isOpen || matchingTargets.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Target className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Apply Team Target?</h2>
              <p className="text-sm text-gray-500">New team member invitation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            disabled={loading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* New Member Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <Users className="w-5 h-5 text-gray-600" />
              <div>
                <h3 className="font-medium text-gray-900">
                  {newMember.first_name} {newMember.last_name}
                </h3>
                <p className="text-sm text-gray-500">{newMember.email}</p>
                <p className="text-sm text-blue-600 font-medium">{newMember.role}</p>
              </div>
            </div>
          </div>

          {/* Explanation */}
          <div className="text-sm text-gray-600">
            <p>
              We found existing team targets for the <strong>{newMember.role}</strong> role. 
              Would you like to automatically apply one of these targets to the new team member?
            </p>
          </div>

          {/* Target Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Select Target to Apply
            </label>
            {matchingTargets.map((target) => (
              <div
                key={target.id}
                className={`border rounded-lg p-4 cursor-pointer transition-all ${
                  selectedTargetId === target.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedTargetId(target.id)}
              >
                <div className="flex items-center space-x-3">
                  <input
                    type="radio"
                    checked={selectedTargetId === target.id}
                    onChange={() => setSelectedTargetId(target.id)}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <PoundSterling className="w-4 h-4 text-green-600" />
                        <span className="font-semibold text-gray-900">
                          {formatCurrency(target.quota_amount)}
                        </span>
                        <span className="text-sm text-gray-500">
                          @ {(target.commission_rate * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex items-center space-x-1 text-sm text-gray-500">
                        <Calendar className="w-4 h-4" />
                        <span>{formatPeriod(target.period_type, target.period_start, target.period_end)}</span>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                      <span className="capitalize">{target.period_type} Target</span>
                      <span>•</span>
                      <span>Role: {target.role}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Target Preview */}
          {selectedTarget && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-3">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <h4 className="font-medium text-green-900">Target Preview</h4>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Quota Amount:</span>
                  <span className="font-medium text-gray-900">
                    {formatCurrency(selectedTarget.quota_amount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Commission Rate:</span>
                  <span className="font-medium text-gray-900">
                    {(selectedTarget.commission_rate * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Period:</span>
                  <span className="font-medium text-gray-900">
                    {formatPeriod(selectedTarget.period_type, selectedTarget.period_start, selectedTarget.period_end)}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-green-200">
                  <span className="text-gray-600">Potential Commission:</span>
                  <span className="font-semibold text-green-700">
                    {formatCurrency(selectedTarget.quota_amount * selectedTarget.commission_rate)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex space-x-3 p-6 border-t border-gray-200">
          <button
            type="button"
            onClick={onSkip}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            disabled={loading}
          >
            Skip for Now
          </button>
          <button
            onClick={() => selectedTargetId && onApplyTarget(selectedTargetId)}
            disabled={loading || !selectedTargetId}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Applying...' : 'Apply Target'}
          </button>
        </div>
      </div>
    </div>
  );
};