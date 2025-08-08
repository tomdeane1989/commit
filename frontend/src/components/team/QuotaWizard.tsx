import React, { useState, useEffect } from 'react';
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

interface Team {
  id: string;
  team_name: string;
  _count?: {
    team_members: number;
  };
}

interface QuotaWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  onResolveConflicts: (data: any) => void;
  teamMembers?: TeamMember[];
  teams?: Team[];
  loading: boolean;
  onConflictDetected?: (conflicts: any[]) => void;
  mutationError?: any;
  mutationData?: any;
  editMode?: boolean;
  editingTarget?: any;
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
  
  // Step 2a: Seasonal distribution settings
  seasonal_granularity?: 'quarterly' | 'monthly';
  seasonal_allocation_method?: 'revenue' | 'percentage';
  seasonal_allocations?: {
    [key: string]: number; // e.g., 'Q1': 50000 or 'Jan': 25000 or 'Q1': 25 (percentage)
  };
  
  // Step 2b: Custom breakdown (for custom distribution)
  custom_breakdown?: Array<{
    period_start: string;
    period_end: string;
    quota_amount: number;
    period_type: 'monthly' | 'quarterly' | 'custom';
  }>;
  
  // Step 2c: One-time target settings
  one_time_period_start?: string;
  one_time_period_end?: string;
  
  // Step 3: Set Amounts
  annual_quota: number;
  commission_rate: number;
  commission_payment_schedule: 'monthly' | 'quarterly';
  
  // Step 4: Preview data
  breakdown?: any[];
  conflicts?: any[];
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const ROLES = ['sales_rep', 'manager', 'admin'];

// Helper functions for seasonal distribution
const getQuarterMonths = (quarter: string): string => {
  switch (quarter) {
    case 'Q1': return 'Jan-Mar';
    case 'Q2': return 'Apr-Jun';
    case 'Q3': return 'Jul-Sep';
    case 'Q4': return 'Oct-Dec';
    default: return '';
  }
};

const getMonthName = (monthKey: string): string => {
  const months = {
    'Jan': 'January', 'Feb': 'February', 'Mar': 'March', 'Apr': 'April',
    'May': 'May', 'Jun': 'June', 'Jul': 'July', 'Aug': 'August',
    'Sep': 'September', 'Oct': 'October', 'Nov': 'November', 'Dec': 'December'
  };
  return months[monthKey] || monthKey;
};

const generateDefaultAllocations = (granularity: 'quarterly' | 'monthly', method: 'revenue' | 'percentage', annualQuota: number) => {
  if (granularity === 'quarterly') {
    if (method === 'percentage') {
      return { Q1: 25, Q2: 25, Q3: 25, Q4: 25 };
    } else {
      const quarterlyAmount = Math.round(annualQuota / 4);
      return { Q1: quarterlyAmount, Q2: quarterlyAmount, Q3: quarterlyAmount, Q4: quarterlyAmount };
    }
  } else {
    const periods = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (method === 'percentage') {
      const monthlyPercentage = Math.round((100 / 12) * 10) / 10; // 8.3%
      const allocations: { [key: string]: number } = {};
      periods.forEach(period => {
        allocations[period] = monthlyPercentage;
      });
      return allocations;
    } else {
      const monthlyAmount = Math.round(annualQuota / 12);
      const allocations: { [key: string]: number } = {};
      periods.forEach(period => {
        allocations[period] = monthlyAmount;
      });
      return allocations;
    }
  }
};

export const QuotaWizard: React.FC<QuotaWizardProps> = ({
  isOpen,
  onClose,
  onSubmit,
  onResolveConflicts,
  teamMembers = [],
  teams = [],
  loading,
  onConflictDetected,
  mutationError,
  mutationData,
  editMode = false,
  editingTarget
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [conflicts, setConflicts] = useState<any[]>([]);
  
  // Initialize wizard data based on edit mode
  const getInitialData = (): WizardData => {
    if (editMode && editingTarget) {
      // When editing, skip to step 2 and pre-populate data
      const startDate = new Date(editingTarget.period_start);
      const endDate = new Date(editingTarget.period_end);
      const yearDiff = endDate.getFullYear() - startDate.getFullYear();
      
      return {
        scope: 'individual', // Always individual when editing
        user_id: editingTarget.user_id,
        year_type: 'calendar', // Default, could be enhanced
        fiscal_start_month: 4,
        start_date: startDate.toISOString().split('T')[0],
        distribution: editingTarget.distribution_method || 'even',
        annual_quota: editingTarget.quota_amount,
        commission_rate: editingTarget.commission_rate * 100, // Convert to percentage
        commission_payment_schedule: 'monthly',
        seasonal_granularity: 'quarterly',
        seasonal_allocation_method: 'percentage',
        seasonal_allocations: {}
      };
    }
    
    return {
      scope: 'individual', // Default to individual targets (team_target: false in backend)
      year_type: 'calendar',
      fiscal_start_month: 4, // April for UK fiscal year
      start_date: new Date().toISOString().split('T')[0],
      distribution: 'even',
    seasonal_granularity: 'quarterly',
    seasonal_allocation_method: 'percentage',
    seasonal_allocations: {
      Q1: 25,
      Q2: 25, 
      Q3: 25,
      Q4: 25
    },
    custom_breakdown: [],
    annual_quota: 0,
    commission_rate: 0,
    commission_payment_schedule: 'monthly',
    breakdown: [],
    conflicts: []
  };
  };
  
  const [wizardData, setWizardData] = useState<WizardData>(getInitialData());

  const updateWizardData = (updates: Partial<WizardData>) => {
    setWizardData(prev => ({ ...prev, ...updates }));
  };
  
  // When editing, start at step 2 (distribution)
  useEffect(() => {
    if (editMode) {
      setCurrentStep(2);
    }
  }, [editMode]);

  // Validation functions for each step
  const validateStep1 = (): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (!wizardData.scope) {
      errors.push('Please select a scope');
    }
    
    if (wizardData.scope === 'individual' && !wizardData.user_id) {
      errors.push('Please select a team member');
    }
    
    if (wizardData.scope === 'role' && !wizardData.role) {
      errors.push('Please select a role');
    }
    
    if (!wizardData.start_date) {
      errors.push('Please select a start date');
    }
    
    return { isValid: errors.length === 0, errors };
  };

  const validateStep2 = (): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (!wizardData.distribution) {
      errors.push('Please select a distribution method');
    }
    
    if (wizardData.distribution === 'seasonal') {
      if (!wizardData.seasonal_allocations) {
        errors.push('Seasonal allocations are required');
      } else {
        const allocations = wizardData.seasonal_allocations;
        const values = Object.values(allocations);
        
        // Check that all values are positive
        if (values.some(v => v <= 0)) {
          errors.push('All seasonal allocations must be greater than 0');
        }
        
        // Check totals based on allocation method
        if (wizardData.seasonal_allocation_method === 'percentage') {
          const totalPercentage = values.reduce((sum, v) => sum + v, 0);
          if (Math.abs(totalPercentage - 100) > 0.1) {
            errors.push(`Seasonal percentages must total 100% (currently ${totalPercentage.toFixed(1)}%)`);
          }
        } else if (wizardData.seasonal_allocation_method === 'revenue') {
          const totalRevenue = values.reduce((sum, v) => sum + v, 0);
          if (Math.abs(totalRevenue - wizardData.annual_quota) > 1) {
            errors.push(`Seasonal revenue allocations must total annual quota (currently £${totalRevenue.toLocaleString()} vs £${wizardData.annual_quota.toLocaleString()})`);
          }
        }
      }
    }
    
    if (wizardData.distribution === 'custom') {
      if (!wizardData.custom_breakdown || wizardData.custom_breakdown.length === 0) {
        errors.push('At least one custom period is required');
      } else {
        const breakdown = wizardData.custom_breakdown;
        // Check that each period has valid dates and amounts
        breakdown.forEach((period, index) => {
          if (!period.period_start) {
            errors.push(`Period ${index + 1}: Start date is required`);
          }
          if (!period.period_end) {
            errors.push(`Period ${index + 1}: End date is required`);
          }
          if (period.period_start && period.period_end && 
              new Date(period.period_start) >= new Date(period.period_end)) {
            errors.push(`Period ${index + 1}: Start date must be before end date`);
          }
          if (period.quota_amount <= 0) {
            errors.push(`Period ${index + 1}: Quota amount must be greater than 0`);
          }
        });
        
        // Check that total matches annual quota (allow for small rounding differences)
        const totalCustomAmount = breakdown.reduce((sum, period) => sum + period.quota_amount, 0);
        if (Math.abs(totalCustomAmount - wizardData.annual_quota) > 1) {
          errors.push(`Custom breakdown total (£${totalCustomAmount.toLocaleString()}) must equal annual quota (£${wizardData.annual_quota.toLocaleString()})`);
        }
      }
    }
    
    if (wizardData.distribution === 'one-time') {
      if (!wizardData.one_time_period_start) {
        errors.push('One-time target start date is required');
      }
      if (!wizardData.one_time_period_end) {
        errors.push('One-time target end date is required');
      }
      if (wizardData.one_time_period_start && wizardData.one_time_period_end && 
          new Date(wizardData.one_time_period_start) >= new Date(wizardData.one_time_period_end)) {
        errors.push('One-time target start date must be before end date');
      }
    }
    
    return { isValid: errors.length === 0, errors };
  };

  const validateStep3 = (): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (!wizardData.annual_quota || wizardData.annual_quota <= 0) {
      errors.push('Please enter a valid annual quota amount');
    }
    
    if (!wizardData.commission_rate || wizardData.commission_rate <= 0 || wizardData.commission_rate > 100) {
      errors.push('Please enter a valid commission rate (1-100%)');
    }
    
    if (!wizardData.commission_payment_schedule) {
      errors.push('Please select a commission payment schedule');
    }
    
    return { isValid: errors.length === 0, errors };
  };

  const validateCurrentStep = () => {
    switch (currentStep) {
      case 1: return validateStep1(); // Scope & Timing
      case 2: return validateStep3(); // Set Amounts (reusing old step 3 validation)
      case 3: return validateStep2(); // Distribution (reusing old step 2 validation)
      case 4: return { isValid: true, errors: [] }; // Review step, no validation needed
      default: return { isValid: true, errors: [] };
    }
  };

  // State for validation errors
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const nextStep = () => {
    const validation = validateCurrentStep();
    
    if (validation.isValid) {
      setValidationErrors([]);
      if (currentStep < 4) {
        setCurrentStep(prev => prev + 1);
      }
    } else {
      setValidationErrors(validation.errors);
    }
  };

  const prevStep = () => {
    setValidationErrors([]); // Clear validation errors when going back
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = () => {
    // Validate all steps before submitting
    const step1Validation = validateStep1(); // Scope & Timing
    const step2Validation = validateStep3(); // Set Amounts (using old step 3 validation)
    const step3Validation = validateStep2(); // Distribution (using old step 2 validation)
    
    const allErrors = [...step1Validation.errors, ...step2Validation.errors, ...step3Validation.errors];
    
    if (allErrors.length > 0) {
      setValidationErrors(allErrors);
      return;
    }
    
    setValidationErrors([]);
    
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
    // For edit mode, only send fields accepted by the backend update endpoint
    if (editMode) {
      return {
        period_type: data.distribution === 'one-time' ? 'custom' : 'annual',
        period_start: data.distribution === 'one-time' ? data.one_time_period_start : data.start_date,
        period_end: data.distribution === 'one-time' ? data.one_time_period_end : calculateEndDate(data.start_date, data.year_type, data.fiscal_start_month),
        quota_amount: data.annual_quota,
        commission_rate: data.commission_rate / 100,
        role: null,
        team_target: false
      };
    }
    
    // For create mode, send all fields
    const baseData = {
      target_type: data.scope,
      user_id: data.user_id,
      team_id: data.team_id,
      period_type: data.distribution === 'one-time' ? 'custom' : 'annual',
      period_start: data.distribution === 'one-time' ? data.one_time_period_start : data.start_date,
      period_end: data.distribution === 'one-time' ? data.one_time_period_end : calculateEndDate(data.start_date, data.year_type, data.fiscal_start_month),
      quota_amount: data.annual_quota,
      commission_rate: data.commission_rate / 100,
      commission_payment_schedule: data.commission_payment_schedule,
      distribution_method: data.distribution
    };

    // Add distribution-specific data
    if (data.distribution === 'seasonal' && data.seasonal_allocations) {
      baseData.seasonal_granularity = data.seasonal_granularity;
      baseData.seasonal_allocation_method = data.seasonal_allocation_method;
      baseData.seasonal_allocations = data.seasonal_allocations;
    }
    
    if (data.distribution === 'custom' && data.custom_breakdown) {
      baseData.custom_breakdown = data.custom_breakdown;
    }

    return baseData;
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
      seasonal_granularity: 'quarterly',
      seasonal_allocation_method: 'percentage',
      seasonal_allocations: {
        Q1: 25,
        Q2: 25, 
        Q3: 25,
        Q4: 25
      },
      custom_breakdown: [],
      annual_quota: 0,
      commission_rate: 0,
      commission_payment_schedule: 'monthly',
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
            <h2 className="text-xl font-semibold text-gray-900">
              {editMode ? 'Edit Target' : 'Quota Planning Wizard'}
            </h2>
            <p className="text-sm text-gray-600">
              Step {editMode ? currentStep - 1 : currentStep} of {editMode ? 3 : 4}
            </p>
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
            {(editMode ? [2, 3, 4] : [1, 2, 3, 4]).map((step, index) => (
              <div key={step} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step <= currentStep
                    ? 'text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
                style={step <= currentStep ? { backgroundColor: '#82a365' } : {}}>
                  {step < currentStep ? <CheckCircle className="w-4 h-4" /> : (editMode ? index + 1 : step)}
                </div>
                {index < (editMode ? 2 : 3) && (
                  <div className={`w-16 h-1 mx-2 ${
                    step < currentStep ? '' : 'bg-gray-200'
                  }`} 
                  style={step < currentStep ? { backgroundColor: '#82a365' } : {}} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-600">
            {editMode ? (
              <>
                <span>Set Amounts</span>
                <span>Distribution</span>
                <span>Review</span>
              </>
            ) : (
              <>
                <span>Scope & Timing</span>
                <span>Set Amounts</span>
                <span>Distribution</span>
                <span>Review</span>
              </>
            )}
          </div>
        </div>

        {/* Step Content */}
        <div className="p-6">
          {currentStep === 1 && !editMode && (
            <Step1ScopeAndTiming 
              data={wizardData} 
              updateData={updateWizardData}
              teamMembers={teamMembers}
              teams={teams}
            />
          )}
          {currentStep === 2 && (
            <Step2SetAmounts 
              data={wizardData} 
              updateData={updateWizardData}
            />
          )}
          {currentStep === 3 && (
            <Step3DistributionMethod 
              data={wizardData} 
              updateData={updateWizardData}
            />
          )}
          {currentStep === 4 && (
            <Step4ReviewAndConflicts 
              data={wizardData} 
              updateData={updateWizardData}
              teamMembers={teamMembers}
              teams={teams}
            />
          )}
        </div>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="px-6 py-4 bg-red-50 border-t border-red-200">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 mr-2" />
              <div>
                <h3 className="text-sm font-medium text-red-800">Please fix the following errors:</h3>
                <ul className="mt-1 text-sm text-red-700 list-disc list-inside">
                  {validationErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          <button
            onClick={prevStep}
            disabled={editMode ? currentStep === 2 : currentStep === 1}
            className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg ${
              (editMode ? currentStep === 2 : currentStep === 1)
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
                style={{ backgroundColor: '#82a365' }}
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
                {loading ? (editMode ? 'Updating...' : 'Creating...') : (editMode ? 'Update Target' : 'Create Targets')}
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
  teamMembers?: TeamMember[];
  teams?: Team[];
}> = ({ data, updateData, teamMembers = [], teams = [] }) => {
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
          Target Scope <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: 'individual', label: 'Individual', icon: Users, desc: 'Set targets for specific people' },
            { value: 'team', label: 'Team', icon: Users, desc: 'Set targets for a specific team' },
            { value: 'all', label: 'All Teams', icon: Users, desc: 'Set targets for everyone' }
          ].map(({ value, label, icon: Icon, desc }) => (
            <button
              key={value}
              onClick={() => updateData({ scope: value as any })}
              className={`p-4 border rounded-lg text-left transition-colors ${
                data.scope === value
                  ? 'bg-green-50 border-green-500'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              style={data.scope === value ? { color: '#82a365' } : {}}
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
            style={{ '--tw-ring-color': '#82a365' } as any}
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

      {/* Team Selection */}
      {data.scope === 'team' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Team
          </label>
          <select
            value={data.team_id || ''}
            onChange={(e) => updateData({ team_id: e.target.value })}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
            style={{ '--tw-ring-color': '#82a365' } as any}
          >
            <option value="">Choose team...</option>
            {teams.map(team => (
              <option key={team.id} value={team.id}>
                {team.team_name} ({team._count?.team_members || 0} members)
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
              style={data.year_type === value ? { color: '#82a365' } : {}}
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
          Start Date <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          value={data.start_date}
          onChange={(e) => updateData({ start_date: e.target.value })}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
          style={{ '--tw-ring-color': '#82a365' } as any}
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

// Step 3: Distribution Method (moved from step 2)
const Step3DistributionMethod: React.FC<{
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
            style={data.distribution === value ? { color: '#82a365' } : {}}
          >
            <div className="text-2xl mb-2">{icon}</div>
            <div className="font-medium">{label}</div>
            <div className="text-xs text-gray-500">{desc}</div>
          </button>
        ))}
      </div>

      {/* Configuration based on selection */}
      {data.distribution === 'seasonal' && (
        <SeasonalDistributionBuilder 
          data={data}
          updateData={updateData}
        />
      )}

      {data.distribution === 'custom' && (
        <CustomBreakdownBuilder 
          data={data}
          updateData={updateData}
        />
      )}

      {data.distribution === 'one-time' && (
        <div className="bg-green-50 p-4 rounded-lg">
          <h4 className="font-medium text-green-900 mb-4">One-time Target Setup</h4>
          <p className="text-sm text-green-700 mb-4">
            Set a specific date range for this target.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-green-800 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={data.one_time_period_start || data.start_date}
                onChange={(e) => updateData({ one_time_period_start: e.target.value })}
                className="w-full p-2 border border-green-300 rounded focus:ring-2 focus:border-transparent"
                style={{ '--tw-ring-color': '#10b981' } as any}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-green-800 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={data.one_time_period_end || ''}
                onChange={(e) => updateData({ one_time_period_end: e.target.value })}
                className="w-full p-2 border border-green-300 rounded focus:ring-2 focus:border-transparent"
                style={{ '--tw-ring-color': '#10b981' } as any}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Step 2: Set Amounts (moved from step 3)
const Step2SetAmounts: React.FC<{
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
            Annual Quota Amount <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-3 text-gray-500">£</span>
            <input
              type="number"
              min="1"
              value={data.annual_quota || ''}
              onChange={(e) => updateData({ annual_quota: parseFloat(e.target.value) || 0 })}
              className="w-full pl-8 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': '#82a365' } as any}
              placeholder="250000"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Commission Rate <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.1"
              min="0.1"
              max="100"
              value={data.commission_rate || ''}
              onChange={(e) => updateData({ commission_rate: parseFloat(e.target.value) || 0 })}
              className="w-full pr-8 pl-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': '#82a365' } as any}
              placeholder="7.5"
              required
            />
            <span className="absolute right-3 top-3 text-gray-500">%</span>
          </div>
        </div>
      </div>

      {/* Commission Payment Schedule */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Commission Payment Schedule <span className="text-red-500">*</span>
        </label>
        <p className="text-sm text-gray-600 mb-3">
          How often should commissions be paid out?
        </p>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => updateData({ commission_payment_schedule: 'monthly' })}
            className={`p-4 border rounded-lg text-left transition-colors ${
              data.commission_payment_schedule === 'monthly'
                ? 'border-green-500 bg-green-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <div className="font-medium text-gray-900">Monthly</div>
            <div className="text-sm text-gray-600">Commissions paid every month</div>
          </button>
          <button
            type="button"
            onClick={() => updateData({ commission_payment_schedule: 'quarterly' })}
            className={`p-4 border rounded-lg text-left transition-colors ${
              data.commission_payment_schedule === 'quarterly'
                ? 'border-green-500 bg-green-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <div className="font-medium text-gray-900">Quarterly</div>
            <div className="text-sm text-gray-600">Commissions paid every quarter</div>
          </button>
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
          <h4 className="font-medium mb-3" style={{ color: '#82a365' }}>Commission Preview</h4>
          <div className="text-sm" style={{ color: '#82a365' }}>
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
  teamMembers?: TeamMember[];
  teams?: Team[];
}> = ({ data, updateData, teamMembers = [], teams = [] }) => {
  const getAffectedMembers = () => {
    if (data.scope === 'individual') {
      return teamMembers.filter(m => m.id === data.user_id);
    } else if (data.scope === 'role') {
      return teamMembers.filter(m => m.role === data.role && m.is_active);
    } else if (data.scope === 'team') {
      // Filter by team membership
      return teamMembers.filter(m => 
        m.is_active && 
        m.team_memberships?.some(tm => tm.team_id === data.team_id)
      );
    } else {
      // All teams scope
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
               data.scope === 'team' ? `Team: ${teams.find(t => t.id === data.team_id)?.team_name || 'Selected Team'}` : 
               'All Teams'}
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
          <div className="flex justify-between">
            <span className="text-gray-600">Payment Schedule:</span>
            <span className="font-medium capitalize">{data.commission_payment_schedule}</span>
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
              <span style={{ color: '#82a365' }}>
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

// Custom Breakdown Builder Component
const CustomBreakdownBuilder: React.FC<{
  data: WizardData;
  updateData: (updates: Partial<WizardData>) => void;
}> = ({ data, updateData }) => {
  const addCustomPeriod = () => {
    const newPeriod = {
      period_start: data.start_date,
      period_end: data.start_date,
      quota_amount: 0,
      period_type: 'monthly' as const
    };
    
    const updatedBreakdown = [...(data.custom_breakdown || []), newPeriod];
    updateData({ custom_breakdown: updatedBreakdown });
  };

  const updateCustomPeriod = (index: number, updates: Partial<{ period_start: string; period_end: string; quota_amount: number; period_type: 'monthly' | 'quarterly' | 'custom' }>) => {
    const updatedBreakdown = [...(data.custom_breakdown || [])];
    updatedBreakdown[index] = { ...updatedBreakdown[index], ...updates };
    updateData({ custom_breakdown: updatedBreakdown });
  };

  const removeCustomPeriod = (index: number) => {
    const updatedBreakdown = [...(data.custom_breakdown || [])];
    updatedBreakdown.splice(index, 1);
    updateData({ custom_breakdown: updatedBreakdown });
  };

  const getTotalCustomAmount = () => {
    return (data.custom_breakdown || []).reduce((sum, period) => sum + period.quota_amount, 0);
  };

  const customBreakdown = data.custom_breakdown || [];
  const totalCustomAmount = getTotalCustomAmount();
  const remainingAmount = data.annual_quota - totalCustomAmount;

  return (
    <div className="bg-yellow-50 p-4 rounded-lg">
      <h4 className="font-medium text-yellow-900 mb-4">Custom Breakdown Setup</h4>
      <p className="text-sm text-yellow-700 mb-4">
        Define specific quota amounts for custom time periods.
      </p>

      {/* Summary */}
      <div className="mb-4 p-3 bg-yellow-100 rounded-lg">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-yellow-700">Annual Quota:</span>
            <div className="font-medium text-yellow-900">
              {new Intl.NumberFormat('en-GB', {
                style: 'currency',
                currency: 'GBP',
                minimumFractionDigits: 0
              }).format(data.annual_quota)}
            </div>
          </div>
          <div>
            <span className="text-yellow-700">Allocated:</span>
            <div className="font-medium text-yellow-900">
              {new Intl.NumberFormat('en-GB', {
                style: 'currency',
                currency: 'GBP',
                minimumFractionDigits: 0
              }).format(totalCustomAmount)}
            </div>
          </div>
          <div>
            <span className="text-yellow-700">Remaining:</span>
            <div className={`font-medium ${remainingAmount === 0 ? 'text-green-700' : remainingAmount < 0 ? 'text-red-700' : 'text-yellow-900'}`}>
              {new Intl.NumberFormat('en-GB', {
                style: 'currency',
                currency: 'GBP',
                minimumFractionDigits: 0
              }).format(remainingAmount)}
            </div>
          </div>
        </div>
      </div>

      {/* Custom Periods */}
      <div className="space-y-3 mb-4">
        {customBreakdown.map((period, index) => (
          <div key={index} className="bg-white p-3 rounded border border-yellow-200">
            <div className="grid grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-xs font-medium text-yellow-800 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={period.period_start}
                  onChange={(e) => updateCustomPeriod(index, { period_start: e.target.value })}
                  className="w-full p-2 text-sm border border-yellow-300 rounded focus:ring-2 focus:border-transparent"
                  style={{ '--tw-ring-color': '#f59e0b' } as any}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-yellow-800 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={period.period_end}
                  onChange={(e) => updateCustomPeriod(index, { period_end: e.target.value })}
                  className="w-full p-2 text-sm border border-yellow-300 rounded focus:ring-2 focus:border-transparent"
                  style={{ '--tw-ring-color': '#f59e0b' } as any}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-yellow-800 mb-1">
                  Quota Amount
                </label>
                <div className="relative">
                  <span className="absolute left-2 top-2 text-yellow-600 text-sm">£</span>
                  <input
                    type="number"
                    min="0"
                    value={period.quota_amount || ''}
                    onChange={(e) => updateCustomPeriod(index, { quota_amount: parseFloat(e.target.value) || 0 })}
                    className="w-full pl-6 pr-2 py-2 text-sm border border-yellow-300 rounded focus:ring-2 focus:border-transparent"
                    style={{ '--tw-ring-color': '#f59e0b' } as any}
                    placeholder="0"
                  />
                </div>
              </div>
              <div>
                <button
                  onClick={() => removeCustomPeriod(index)}
                  className="px-3 py-2 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded border border-red-300"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Period Button */}
      <button
        onClick={addCustomPeriod}
        className="w-full p-3 text-sm text-yellow-700 border-2 border-dashed border-yellow-300 rounded-lg hover:border-yellow-400 hover:bg-yellow-100 transition-colors"
      >
        + Add Custom Period
      </button>

      {/* Validation Messages */}
      {remainingAmount !== 0 && (
        <div className={`mt-3 p-2 rounded text-sm ${
          remainingAmount < 0 
            ? 'bg-red-100 text-red-700' 
            : 'bg-blue-100 text-blue-700'
        }`}>
          {remainingAmount < 0 
            ? `Over-allocated by ${Math.abs(remainingAmount).toLocaleString('en-GB', { style: 'currency', currency: 'GBP' })}`
            : `${remainingAmount.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' })} remaining to allocate`
          }
        </div>
      )}
    </div>
  );
};

// New Seasonal Distribution Builder Component
const SeasonalDistributionBuilder: React.FC<{
  data: WizardData;
  updateData: (updates: Partial<WizardData>) => void;
}> = ({ data, updateData }) => {
  
  // Auto-regenerate allocations when annual quota changes (for revenue method)
  useEffect(() => {
    if (data.seasonal_allocation_method === 'revenue' && data.annual_quota > 0) {
      const newAllocations = generateDefaultAllocations(
        data.seasonal_granularity || 'quarterly',
        'revenue',
        data.annual_quota
      );
      // Only update if allocations are currently default/empty
      const currentTotal = Object.values(data.seasonal_allocations || {}).reduce((sum, val) => sum + val, 0);
      if (currentTotal === 0) {
        updateData({ seasonal_allocations: newAllocations });
      }
    }
  }, [data.annual_quota, data.seasonal_allocation_method, data.seasonal_granularity]);
  
  // Handle granularity change and regenerate allocations
  const handleGranularityChange = (granularity: 'quarterly' | 'monthly') => {
    const newAllocations = generateDefaultAllocations(
      granularity, 
      data.seasonal_allocation_method || 'percentage', 
      data.annual_quota
    );
    
    updateData({
      seasonal_granularity: granularity,
      seasonal_allocations: newAllocations
    });
  };

  // Handle allocation method change and regenerate allocations
  const handleAllocationMethodChange = (method: 'revenue' | 'percentage') => {
    const newAllocations = generateDefaultAllocations(
      data.seasonal_granularity || 'quarterly',
      method,
      data.annual_quota
    );
    
    updateData({
      seasonal_allocation_method: method,
      seasonal_allocations: newAllocations
    });
  };

  // Update individual allocation
  const updateAllocation = (period: string, value: number) => {
    updateData({
      seasonal_allocations: {
        ...data.seasonal_allocations,
        [period]: value
      }
    });
  };

  // Calculate totals and remaining
  const allocations = data.seasonal_allocations || {};
  const totalAllocated = Object.values(allocations).reduce((sum, val) => sum + val, 0);
  const isPercentage = data.seasonal_allocation_method === 'percentage';
  const target = isPercentage ? 100 : data.annual_quota;
  const remaining = target - totalAllocated;

  // Get periods based on granularity
  const periods = data.seasonal_granularity === 'quarterly' 
    ? ['Q1', 'Q2', 'Q3', 'Q4']
    : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div className="bg-blue-50 p-4 rounded-lg">
      <h4 className="font-medium text-blue-900 mb-4">Seasonal Distribution Setup</h4>
      <p className="text-sm text-blue-700 mb-4">
        Configure how your annual quota should be distributed across different periods.
      </p>

      {/* Granularity Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-blue-800 mb-2">
          Time Period Granularity
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleGranularityChange('quarterly')}
            className={`p-3 border rounded-lg text-left transition-colors ${
              data.seasonal_granularity === 'quarterly'
                ? 'bg-blue-100 border-blue-500 text-blue-900'
                : 'bg-white border-blue-200 text-blue-700 hover:border-blue-300'
            }`}
          >
            <div className="font-medium">Quarterly</div>
            <div className="text-xs">Q1, Q2, Q3, Q4</div>
          </button>
          <button
            onClick={() => handleGranularityChange('monthly')}
            className={`p-3 border rounded-lg text-left transition-colors ${
              data.seasonal_granularity === 'monthly'
                ? 'bg-blue-100 border-blue-500 text-blue-900'
                : 'bg-white border-blue-200 text-blue-700 hover:border-blue-300'
            }`}
          >
            <div className="font-medium">Monthly</div>
            <div className="text-xs">Jan, Feb, Mar, etc.</div>
          </button>
        </div>
      </div>

      {/* Allocation Method Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-blue-800 mb-2">
          Allocation Method
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleAllocationMethodChange('percentage')}
            className={`p-3 border rounded-lg text-left transition-colors ${
              data.seasonal_allocation_method === 'percentage'
                ? 'bg-blue-100 border-blue-500 text-blue-900'
                : 'bg-white border-blue-200 text-blue-700 hover:border-blue-300'
            }`}
          >
            <div className="font-medium">Percentage</div>
            <div className="text-xs">Allocate % of annual quota</div>
          </button>
          <button
            onClick={() => handleAllocationMethodChange('revenue')}
            className={`p-3 border rounded-lg text-left transition-colors ${
              data.seasonal_allocation_method === 'revenue'
                ? 'bg-blue-100 border-blue-500 text-blue-900'
                : 'bg-white border-blue-200 text-blue-700 hover:border-blue-300'
            }`}
          >
            <div className="font-medium">Revenue Amount</div>
            <div className="text-xs">Allocate specific £ amounts</div>
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="mb-4 p-3 bg-blue-100 rounded-lg">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-blue-700">Annual Quota:</span>
            <div className="font-medium text-blue-900">
              {new Intl.NumberFormat('en-GB', {
                style: 'currency',
                currency: 'GBP',
                minimumFractionDigits: 0
              }).format(data.annual_quota)}
            </div>
          </div>
          <div>
            <span className="text-blue-700">Allocated:</span>
            <div className="font-medium text-blue-900">
              {isPercentage 
                ? `${totalAllocated.toFixed(1)}%`
                : new Intl.NumberFormat('en-GB', {
                    style: 'currency',
                    currency: 'GBP',
                    minimumFractionDigits: 0
                  }).format(totalAllocated)
              }
            </div>
          </div>
          <div>
            <span className="text-blue-700">Remaining:</span>
            <div className={`font-medium ${remaining === 0 ? 'text-green-700' : remaining < 0 ? 'text-red-700' : 'text-blue-900'}`}>
              {isPercentage 
                ? `${remaining.toFixed(1)}%`
                : new Intl.NumberFormat('en-GB', {
                    style: 'currency',
                    currency: 'GBP',
                    minimumFractionDigits: 0
                  }).format(remaining)
              }
            </div>
          </div>
        </div>
      </div>

      {/* Allocation Inputs */}
      <div className={`grid gap-3 mb-4 ${
        data.seasonal_granularity === 'quarterly' 
          ? 'grid-cols-2 lg:grid-cols-4' 
          : 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
      }`}>
        {periods.map((period) => (
          <div key={period} className="bg-white p-3 rounded border border-blue-200">
            <label className="block text-xs font-medium text-blue-800 mb-2">
              {data.seasonal_granularity === 'quarterly' 
                ? `${period} (${getQuarterMonths(period)})`
                : getMonthName(period)
              }
            </label>
            <div className="relative">
              {isPercentage ? (
                <>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={allocations[period] || 0}
                    onChange={(e) => updateAllocation(period, parseFloat(e.target.value) || 0)}
                    className="w-full pr-6 pl-2 py-2 text-sm border border-blue-300 rounded focus:ring-2 focus:border-transparent"
                    style={{ '--tw-ring-color': '#3b82f6' } as any}
                  />
                  <span className="absolute right-2 top-2 text-blue-600 text-sm">%</span>
                </>
              ) : (
                <>
                  <span className="absolute left-2 top-2 text-blue-600 text-sm">£</span>
                  <input
                    type="number"
                    min="0"
                    value={allocations[period] || 0}
                    onChange={(e) => updateAllocation(period, parseFloat(e.target.value) || 0)}
                    className="w-full pl-6 pr-2 py-2 text-sm border border-blue-300 rounded focus:ring-2 focus:border-transparent"
                    style={{ '--tw-ring-color': '#3b82f6' } as any}
                  />
                </>
              )}
            </div>
            {/* Show corresponding amount below the input */}
            <div className="text-xs text-blue-600 mt-1">
              {isPercentage ? (
                // Show revenue amount when using percentages
                new Intl.NumberFormat('en-GB', {
                  style: 'currency',
                  currency: 'GBP',
                  minimumFractionDigits: 0
                }).format((allocations[period] || 0) / 100 * data.annual_quota)
              ) : (
                // Show percentage when using revenue amounts
                `${((allocations[period] || 0) / data.annual_quota * 100).toFixed(1)}% of annual`
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Validation Messages */}
      {remaining !== 0 && (
        <div className={`p-3 rounded text-sm ${
          remaining < 0 
            ? 'bg-red-100 text-red-700' 
            : 'bg-yellow-100 text-yellow-700'
        }`}>
          {remaining < 0 
            ? `Over-allocated by ${Math.abs(remaining).toFixed(isPercentage ? 1 : 0)}${isPercentage ? '%' : ` (${Math.abs(remaining).toLocaleString('en-GB', { style: 'currency', currency: 'GBP' })})`}`
            : `${remaining.toFixed(isPercentage ? 1 : 0)}${isPercentage ? '%' : ` (${remaining.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' })})`} remaining to allocate`
          }
        </div>
      )}
    </div>
  );
};