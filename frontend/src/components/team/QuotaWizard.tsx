import { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Calendar, Users, Target, CheckCircle, AlertCircle } from 'lucide-react';
import { ConflictResolutionModal } from './ConflictResolutionModal';

interface TeamMember {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  hire_date: string | null;
}

interface QuotaWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  onResolveConflicts: (data: any) => void;
  teamMembers: TeamMember[];
  loading: boolean;
  onConflictDetected?: (conflicts: any[]) => void;
  mutationError?: any;
  mutationData?: any;
}

interface WizardData {
  // Step 1: Scope & Timing
  scope: 'individual' | 'role' | 'team';
  user_id?: string;
  role?: string;
  year_type: 'calendar' | 'fiscal';
  fiscal_start_month?: number;
  start_date: string;
  
  // Step 2: Distribution Method
  distribution: 'even' | 'seasonal' | 'custom' | 'one-time';
  
  // Step 3: Set Amounts
  annual_quota: number;
  commission_rate: number;
  
  // Step 4: Preview data
  breakdown?: any[];
  conflicts?: any[];
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const ROLES = ['sales_rep', 'manager', 'admin'];

export const QuotaWizard: React.FC<QuotaWizardProps> = ({
  isOpen,
  onClose,
  onSubmit,
  onResolveConflicts,
  teamMembers,
  loading,
  onConflictDetected,
  mutationError,
  mutationData
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [wizardData, setWizardData] = useState<WizardData>({
    scope: 'role',
    year_type: 'calendar',
    fiscal_start_month: 4, // April for UK fiscal year
    start_date: new Date().toISOString().split('T')[0],
    distribution: 'even',
    annual_quota: 0,
    commission_rate: 0,
    breakdown: [],
    conflicts: []
  });

  const updateWizardData = (updates: Partial<WizardData>) => {
    setWizardData(prev => ({ ...prev, ...updates }));
  };

  const nextStep = () => {
    if (currentStep < 4) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = () => {
    // Transform wizard data to API format
    const apiData = transformWizardDataToApiFormat(wizardData);
    onSubmit(apiData);
  };

  const handleConflictResponse = (error: any) => {
    console.log('handleConflictResponse called with:', error);
    
    // Check if error is null or doesn't have the expected structure
    if (!error || !error.response) {
      console.log('Error is null or missing response structure');
      return false;
    }
    
    // Check if the error contains conflict information
    if (error.response?.data?.skipped_users && error.response.data.skipped_users.length > 0) {
      console.log('Conflicts detected:', error.response.data.skipped_users);
      setConflicts(error.response.data.skipped_users);
      setConflictModalOpen(true);
      if (onConflictDetected) {
        onConflictDetected(error.response.data.skipped_users);
      }
      return true; // Indicate that conflicts were handled
    }
    return false; // No conflicts to handle
  };

  const handleResolveConflicts = (resolutions: any[]) => {
    const conflictData = {
      conflicts: resolutions,
      wizard_data: wizardData
    };
    onResolveConflicts(conflictData);
    setConflictModalOpen(false);
  };

  const transformWizardDataToApiFormat = (data: WizardData) => {
    // This will be implemented based on our backend API expectations
    return {
      target_type: data.scope,
      user_id: data.user_id,
      role: data.role,
      period_type: data.distribution === 'one-time' ? 'custom' : 'annual',
      period_start: data.start_date,
      period_end: calculateEndDate(data.start_date, data.year_type, data.fiscal_start_month),
      quota_amount: data.annual_quota,
      commission_rate: data.commission_rate / 100,
      distribution_method: data.distribution
    };
  };

  const calculateEndDate = (startDate: string, yearType: string, fiscalStartMonth?: number) => {
    const start = new Date(startDate);
    let end = new Date(start);
    
    if (yearType === 'calendar') {
      // Calendar year: Jan 1 - Dec 31
      end.setFullYear(start.getFullYear());
      end.setMonth(11); // December (0-indexed)
      end.setDate(31); // December 31st
    } else if (yearType === 'fiscal' && fiscalStartMonth) {
      // UK fiscal year: April 6 - April 5
      if (fiscalStartMonth === 4) {
        // If start date is before April 6, fiscal year ends April 5 of same year
        // If start date is April 6 or later, fiscal year ends April 5 of next year
        const currentYear = start.getFullYear();
        const fiscalYearStart = new Date(currentYear, 3, 6); // April 6
        
        if (start >= fiscalYearStart) {
          // Started in current fiscal year, ends April 5 next year
          end.setFullYear(currentYear + 1);
          end.setMonth(3); // April (0-indexed)
          end.setDate(5); // April 5th
        } else {
          // Started before fiscal year, ends April 5 same year
          end.setFullYear(currentYear);
          end.setMonth(3); // April (0-indexed)
          end.setDate(5); // April 5th
        }
      }
    }
    
    return end.toISOString().split('T')[0];
  };

  const resetWizard = () => {
    setCurrentStep(1);
    setConflictModalOpen(false);
    setConflicts([]);
    setWizardData({
      scope: 'role',
      year_type: 'calendar',
      fiscal_start_month: 4,
      start_date: new Date().toISOString().split('T')[0],
      distribution: 'even',
      annual_quota: 0,
      commission_rate: 0,
      breakdown: [],
      conflicts: []
    });
  };

  useEffect(() => {
    if (!isOpen) {
      resetWizard();
    }
  }, [isOpen]);

  // Handle mutation errors for conflict detection
  useEffect(() => {
    console.log('Mutation error changed:', mutationError);
    if (mutationError && mutationError.response?.data?.skipped_users) {
      console.log('Handling conflict response for mutation error');
      handleConflictResponse(mutationError);
    }
  }, [mutationError]);

  // Handle mutation success data for conflict detection
  useEffect(() => {
    console.log('Mutation data changed:', mutationData);
    if (mutationData && mutationData.isConflict && mutationData.skipped_users) {
      console.log('Handling conflict response for mutation success data');
      // Create a fake error object for the conflict handler
      const fakeError = {
        response: {
          data: mutationData
        }
      };
      handleConflictResponse(fakeError);
    }
  }, [mutationData]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Quota Planning Wizard</h2>
            <p className="text-sm text-gray-600">Step {currentStep} of 4</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-4 bg-gray-50">
          <div className="flex items-center justify-between">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step <= currentStep
                    ? 'text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
                style={step <= currentStep ? { backgroundColor: '#384031' } : {}}>
                  {step < currentStep ? <CheckCircle className="w-4 h-4" /> : step}
                </div>
                {step < 4 && (
                  <div className={`w-16 h-1 mx-2 ${
                    step < currentStep ? '' : 'bg-gray-200'
                  }`} 
                  style={step < currentStep ? { backgroundColor: '#384031' } : {}} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-600">
            <span>Scope & Timing</span>
            <span>Distribution</span>
            <span>Set Amounts</span>
            <span>Review</span>
          </div>
        </div>

        {/* Step Content */}
        <div className="p-6">
          {currentStep === 1 && (
            <Step1ScopeAndTiming 
              data={wizardData} 
              updateData={updateWizardData}
              teamMembers={teamMembers}
            />
          )}
          {currentStep === 2 && (
            <Step2DistributionMethod 
              data={wizardData} 
              updateData={updateWizardData}
            />
          )}
          {currentStep === 3 && (
            <Step3SetAmounts 
              data={wizardData} 
              updateData={updateWizardData}
            />
          )}
          {currentStep === 4 && (
            <Step4ReviewAndConflicts 
              data={wizardData} 
              updateData={updateWizardData}
              teamMembers={teamMembers}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          <button
            onClick={prevStep}
            disabled={currentStep === 1}
            className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg ${
              currentStep === 1
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Previous
          </button>

          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            
            {currentStep < 4 ? (
              <button
                onClick={nextStep}
                className="flex items-center px-4 py-2 text-sm font-medium text-white rounded-lg transition-all"
                style={{ backgroundColor: '#384031' }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                Next
                <ChevronRight className="w-4 h-4 ml-2" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Targets'}
              </button>
            )}
          </div>
        </div>

        {/* Conflict Resolution Modal */}
        <ConflictResolutionModal
          isOpen={conflictModalOpen}
          onClose={() => setConflictModalOpen(false)}
          onResolve={handleResolveConflicts}
          conflicts={conflicts}
          loading={loading}
        />
      </div>
    </div>
  );
};

// Step 1: Scope & Timing
const Step1ScopeAndTiming: React.FC<{
  data: WizardData;
  updateData: (updates: Partial<WizardData>) => void;
  teamMembers: TeamMember[];
}> = ({ data, updateData, teamMembers }) => {
  const activeMembers = teamMembers.filter(m => m.is_active);
  const uniqueRoles = [...new Set(activeMembers.map(m => m.role))];

  // Helper function to suggest appropriate start dates
  const getSuggestedStartDate = (yearType: string) => {
    const now = new Date();
    if (yearType === 'calendar') {
      // Suggest January 1st of current year
      return new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
    } else if (yearType === 'fiscal') {
      // Suggest April 6th of current or next fiscal year
      const currentYear = now.getFullYear();
      const thisYearFiscalStart = new Date(currentYear, 3, 6); // April 6
      
      if (now >= thisYearFiscalStart) {
        // We're in the current fiscal year, suggest start of this fiscal year
        return thisYearFiscalStart.toISOString().split('T')[0];
      } else {
        // We're before this fiscal year, suggest start of last fiscal year
        return new Date(currentYear - 1, 3, 6).toISOString().split('T')[0];
      }
    }
    return data.start_date;
  };

  const handleYearTypeChange = (yearType: 'calendar' | 'fiscal') => {
    const suggestedDate = getSuggestedStartDate(yearType);
    updateData({ 
      year_type: yearType,
      start_date: suggestedDate
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Who and When</h3>
        <p className="text-sm text-gray-600 mb-6">
          Set up targets for individuals, roles, or your entire team.
        </p>
      </div>

      {/* Scope Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Target Scope
        </label>
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: 'individual', label: 'Individual', icon: Users, desc: 'Set targets for specific people' },
            { value: 'role', label: 'Role-Based', icon: Target, desc: 'Set targets for all people in a role' },
            { value: 'team', label: 'Entire Team', icon: Users, desc: 'Set targets for everyone' }
          ].map(({ value, label, icon: Icon, desc }) => (
            <button
              key={value}
              onClick={() => updateData({ scope: value as any })}
              className={`p-4 border rounded-lg text-left transition-colors ${
                data.scope === value
                  ? 'bg-green-50 border-green-500'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              style={data.scope === value ? { color: '#384031' } : {}}
            >
              <Icon className="w-5 h-5 mb-2" />
              <div className="font-medium">{label}</div>
              <div className="text-xs text-gray-500">{desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Individual Selection */}
      {data.scope === 'individual' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Team Member
          </label>
          <select
            value={data.user_id || ''}
            onChange={(e) => updateData({ user_id: e.target.value })}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
            style={{ '--tw-ring-color': '#384031' } as any}
          >
            <option value="">Choose team member...</option>
            {activeMembers.map(member => (
              <option key={member.id} value={member.id}>
                {member.first_name} {member.last_name} ({member.role})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Role Selection */}
      {data.scope === 'role' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Role
          </label>
          <select
            value={data.role || ''}
            onChange={(e) => updateData({ role: e.target.value })}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
            style={{ '--tw-ring-color': '#384031' } as any}
          >
            <option value="">Choose role...</option>
            {uniqueRoles.map(role => (
              <option key={role} value={role}>
                {role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Year Type Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Year Type
        </label>
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: 'calendar', label: 'Calendar Year', desc: 'January - December' },
            { value: 'fiscal', label: 'Fiscal Year', desc: 'April - March (UK)' }
          ].map(({ value, label, desc }) => (
            <button
              key={value}
              onClick={() => handleYearTypeChange(value as any)}
              className={`p-4 border rounded-lg text-left transition-colors ${
                data.year_type === value
                  ? 'bg-green-50 border-green-500'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              style={data.year_type === value ? { color: '#384031' } : {}}
            >
              <Calendar className="w-5 h-5 mb-2" />
              <div className="font-medium">{label}</div>
              <div className="text-xs text-gray-500">{desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Start Date */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Start Date
        </label>
        <input
          type="date"
          value={data.start_date}
          onChange={(e) => updateData({ start_date: e.target.value })}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
          style={{ '--tw-ring-color': '#384031' } as any}
        />
        <p className="text-xs text-gray-500 mt-1">
          {data.year_type === 'fiscal' 
            ? 'UK fiscal year runs April 6th - April 5th'
            : 'Calendar year runs January 1st - December 31st'
          }
        </p>
      </div>
    </div>
  );
};

// Step 2: Distribution Method
const Step2DistributionMethod: React.FC<{
  data: WizardData;
  updateData: (updates: Partial<WizardData>) => void;
}> = ({ data, updateData }) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Distribution Method</h3>
        <p className="text-sm text-gray-600 mb-6">
          How should the quota be distributed throughout the year?
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {[
          { 
            value: 'even', 
            label: 'Even Distribution', 
            desc: 'Split quota evenly across all periods',
            icon: '📊'
          },
          { 
            value: 'seasonal', 
            label: 'Seasonal Adjustment', 
            desc: 'Higher targets in certain quarters',
            icon: '🌟'
          },
          { 
            value: 'custom', 
            label: 'Custom Breakdown', 
            desc: 'Set specific amounts for each period',
            icon: '⚙️'
          },
          { 
            value: 'one-time', 
            label: 'One-time Target', 
            desc: 'Single target for a specific period',
            icon: '🎯'
          }
        ].map(({ value, label, desc, icon }) => (
          <button
            key={value}
            onClick={() => updateData({ distribution: value as any })}
            className={`p-4 border rounded-lg text-left transition-colors ${
              data.distribution === value
                ? 'bg-green-50 border-green-500'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            style={data.distribution === value ? { color: '#384031' } : {}}
          >
            <div className="text-2xl mb-2">{icon}</div>
            <div className="font-medium">{label}</div>
            <div className="text-xs text-gray-500">{desc}</div>
          </button>
        ))}
      </div>

      {/* Preview based on selection */}
      {data.distribution === 'seasonal' && (
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Seasonal Distribution Preview</h4>
          <p className="text-sm text-blue-700">
            You'll be able to set higher targets for peak seasons (e.g., Q4 holiday season).
          </p>
        </div>
      )}

      {data.distribution === 'custom' && (
        <div className="bg-yellow-50 p-4 rounded-lg">
          <h4 className="font-medium text-yellow-900 mb-2">Custom Breakdown Preview</h4>
          <p className="text-sm text-yellow-700">
            You'll create a detailed month-by-month or quarter-by-quarter breakdown.
          </p>
        </div>
      )}

      {data.distribution === 'one-time' && (
        <div className="bg-green-50 p-4 rounded-lg">
          <h4 className="font-medium text-green-900 mb-2">One-time Target Preview</h4>
          <p className="text-sm text-green-700">
            Perfect for special projects, new hire ramp-up, or specific campaign targets.
          </p>
        </div>
      )}
    </div>
  );
};

// Step 3: Set Amounts
const Step3SetAmounts: React.FC<{
  data: WizardData;
  updateData: (updates: Partial<WizardData>) => void;
}> = ({ data, updateData }) => {
  const monthlyQuota = data.annual_quota / 12;
  const quarterlyQuota = data.annual_quota / 4;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Set Amounts</h3>
        <p className="text-sm text-gray-600 mb-6">
          Define the quota amount and commission structure.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Annual Quota Amount
          </label>
          <div className="relative">
            <span className="absolute left-3 top-3 text-gray-500">£</span>
            <input
              type="number"
              value={data.annual_quota || ''}
              onChange={(e) => updateData({ annual_quota: parseFloat(e.target.value) || 0 })}
              className="w-full pl-8 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': '#384031' } as any}
              placeholder="250000"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Commission Rate
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.1"
              value={data.commission_rate || ''}
              onChange={(e) => updateData({ commission_rate: parseFloat(e.target.value) || 0 })}
              className="w-full pr-8 pl-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': '#384031' } as any}
              placeholder="7.5"
            />
            <span className="absolute right-3 top-3 text-gray-500">%</span>
          </div>
        </div>
      </div>

      {/* Preview Breakdown */}
      {data.annual_quota > 0 && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-3">Quota Breakdown Preview</h4>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Annual:</span>
              <div className="font-medium">
                {new Intl.NumberFormat('en-GB', {
                  style: 'currency',
                  currency: 'GBP',
                  minimumFractionDigits: 0
                }).format(data.annual_quota)}
              </div>
            </div>
            <div>
              <span className="text-gray-600">Quarterly:</span>
              <div className="font-medium">
                {new Intl.NumberFormat('en-GB', {
                  style: 'currency',
                  currency: 'GBP',
                  minimumFractionDigits: 0
                }).format(quarterlyQuota)}
              </div>
            </div>
            <div>
              <span className="text-gray-600">Monthly:</span>
              <div className="font-medium">
                {new Intl.NumberFormat('en-GB', {
                  style: 'currency',
                  currency: 'GBP',
                  minimumFractionDigits: 0
                }).format(monthlyQuota)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Commission Preview */}
      {data.annual_quota > 0 && data.commission_rate > 0 && (
        <div className="bg-green-50 p-4 rounded-lg">
          <h4 className="font-medium mb-3" style={{ color: '#384031' }}>Commission Preview</h4>
          <div className="text-sm" style={{ color: '#384031' }}>
            <p>
              If targets are met, commission earnings will be:{' '}
              <span className="font-medium">
                {new Intl.NumberFormat('en-GB', {
                  style: 'currency',
                  currency: 'GBP',
                  minimumFractionDigits: 0
                }).format(data.annual_quota * (data.commission_rate / 100))}
              </span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

// Step 4: Review and Conflicts
const Step4ReviewAndConflicts: React.FC<{
  data: WizardData;
  updateData: (updates: Partial<WizardData>) => void;
  teamMembers: TeamMember[];
}> = ({ data, updateData, teamMembers }) => {
  const getAffectedMembers = () => {
    if (data.scope === 'individual') {
      return teamMembers.filter(m => m.id === data.user_id);
    } else if (data.scope === 'role') {
      return teamMembers.filter(m => m.role === data.role && m.is_active);
    } else {
      return teamMembers.filter(m => m.is_active);
    }
  };

  const affectedMembers = getAffectedMembers();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Review & Confirm</h3>
        <p className="text-sm text-gray-600 mb-6">
          Review your target configuration before creating.
        </p>
      </div>

      {/* Configuration Summary */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h4 className="font-medium text-gray-900 mb-3">Configuration Summary</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Scope:</span>
            <span className="font-medium">
              {data.scope === 'individual' ? 'Individual Target' : 
               data.scope === 'role' ? `Role-based (${data.role})` : 
               'Entire Team'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Year Type:</span>
            <span className="font-medium">
              {data.year_type === 'calendar' ? 'Calendar Year' : 'Fiscal Year'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Distribution:</span>
            <span className="font-medium">
              {data.distribution === 'even' ? 'Even Distribution' :
               data.distribution === 'seasonal' ? 'Seasonal Adjustment' :
               data.distribution === 'custom' ? 'Custom Breakdown' :
               'One-time Target'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Annual Quota:</span>
            <span className="font-medium">
              {new Intl.NumberFormat('en-GB', {
                style: 'currency',
                currency: 'GBP',
                minimumFractionDigits: 0
              }).format(data.annual_quota)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Commission Rate:</span>
            <span className="font-medium">{data.commission_rate}%</span>
          </div>
        </div>
      </div>

      {/* Affected Members */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-3">
          Affected Team Members ({affectedMembers.length})
        </h4>
        <div className="space-y-2">
          {affectedMembers.map(member => (
            <div key={member.id} className="flex items-center justify-between text-sm">
              <span style={{ color: '#2f3427' }}>
                {member.first_name} {member.last_name}
              </span>
              <span style={{ color: '#384031' }}>
                {member.role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Warning for potential conflicts */}
      <div className="bg-yellow-50 p-4 rounded-lg">
        <div className="flex items-start">
          <AlertCircle className="w-5 h-5 text-yellow-600 mr-3 mt-0.5" />
          <div>
            <h4 className="font-medium text-yellow-900 mb-2">Important Notes</h4>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>• This will create targets for all affected team members</li>
              <li>• Any overlapping existing targets will be flagged</li>
              <li>• Mid-year hires will receive pro-rated targets automatically</li>
              <li>• You can modify individual targets after creation</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};