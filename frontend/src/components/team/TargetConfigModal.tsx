// TargetConfigModal.tsx - Hybrid collapsible modal for target configuration
import React, { useState, useEffect } from 'react';
import { X, Users, Calendar, DollarSign, Target, TrendingUp, AlertTriangle } from 'lucide-react';
import SectionCollapse from './SectionCollapse';
import CommissionStructureConfig from './CommissionStructureConfig';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

interface Team {
  id: string;
  name: string;
  team_lead: {
    first_name: string;
    last_name: string;
  };
  _count?: {
    team_members: number;
  };
}

interface ProductCategory {
  id: string;
  name: string;
  code: string;
}

interface TargetConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  editMode?: boolean;
  initialData?: any;
}

const TargetConfigModal: React.FC<TargetConfigModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editMode = false,
  initialData
}) => {
  // Form state
  const [formData, setFormData] = useState({
    // Basic Configuration
    name: initialData?.name || '',
    target_type: initialData?.target_type || 'team',
    team_id: initialData?.team_id || '',
    user_id: initialData?.user_id || '',
    period_type: initialData?.period_type || 'annual',
    period_start: initialData?.period_start || '',
    period_end: initialData?.period_end || '',

    // Amounts
    quota_amount: initialData?.quota_amount || '',
    commission_rate: initialData?.commission_rate ? initialData.commission_rate * 100 : 5,

    // Product Category (Optional)
    product_category_id: initialData?.product_category_id || '',

    // Commission Structure (Optional)
    commission_structure: initialData?.commission_structure || null,
    performance_gates: initialData?.performance_gates || null,

    // Advanced Options
    allow_overlapping: initialData?.allow_overlapping || false,
    distribution_method: initialData?.distribution_method || 'even'
  });

  // Validation state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touchedSections, setTouchedSections] = useState<Set<string>>(new Set());

  // Fetch teams
  const { data: teamsData } = useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      const response = await api.get('/teams');
      return response.data;
    }
  });

  // Fetch product categories
  const { data: categoriesData } = useQuery({
    queryKey: ['product-categories'],
    queryFn: async () => {
      const response = await api.get('/product-categories');
      return response.data;
    }
  });

  const teams: Team[] = teamsData?.teams || [];
  const categories: ProductCategory[] = categoriesData?.categories || [];

  // Auto-set period dates based on period type
  useEffect(() => {
    if (formData.period_type && !editMode) {
      const now = new Date();
      const year = now.getFullYear();

      if (formData.period_type === 'annual') {
        setFormData(prev => ({
          ...prev,
          period_start: `${year}-01-01`,
          period_end: `${year}-12-31`
        }));
      } else if (formData.period_type === 'quarterly') {
        const quarter = Math.floor(now.getMonth() / 3) + 1;
        const quarterStart = new Date(year, (quarter - 1) * 3, 1);
        const quarterEnd = new Date(year, quarter * 3, 0);

        setFormData(prev => ({
          ...prev,
          period_start: quarterStart.toISOString().split('T')[0],
          period_end: quarterEnd.toISOString().split('T')[0]
        }));
      }
    }
  }, [formData.period_type, editMode]);

  // Validation logic
  const validateSection = (section: string): boolean => {
    const newErrors: Record<string, string> = {};

    if (section === 'basic') {
      if (!formData.name?.trim()) {
        newErrors.name = 'Target name is required';
      }
      if (!formData.target_type) {
        newErrors.target_type = 'Target type is required';
      }
      if (formData.target_type === 'team' && !formData.team_id) {
        newErrors.team_id = 'Team selection is required';
      }
      if (!formData.period_type) {
        newErrors.period_type = 'Period type is required';
      }
      if (!formData.period_start) {
        newErrors.period_start = 'Start date is required';
      }
      if (!formData.period_end) {
        newErrors.period_end = 'End date is required';
      }
    }

    if (section === 'amounts') {
      if (!formData.quota_amount || Number(formData.quota_amount) <= 0) {
        newErrors.quota_amount = 'Quota amount must be greater than 0';
      }
      if (formData.commission_rate < 0 || formData.commission_rate > 100) {
        newErrors.commission_rate = 'Commission rate must be between 0 and 100';
      }
    }

    setErrors(prev => ({ ...prev, ...newErrors }));
    return Object.keys(newErrors).length === 0;
  };

  const isBasicValid = () => {
    return formData.name && formData.target_type && formData.period_type &&
           formData.period_start && formData.period_end &&
           (formData.target_type !== 'team' || formData.team_id);
  };

  const isAmountsValid = () => {
    return formData.quota_amount && Number(formData.quota_amount) > 0 &&
           formData.commission_rate >= 0 && formData.commission_rate <= 100;
  };

  // Calculate preview data
  const getPreviewData = () => {
    const selectedTeam = teams.find(t => t.id === formData.team_id);
    const memberCount = selectedTeam?._count?.team_members || 1;
    const totalQuota = Number(formData.quota_amount) || 0;
    const perMemberQuota = formData.target_type === 'team' ? totalQuota / memberCount : totalQuota;
    const commissionRate = Number(formData.commission_rate) / 100;

    return {
      teamName: selectedTeam?.name || 'Individual',
      memberCount,
      totalQuota,
      perMemberQuota,
      commissionRate,
      hasStructure: !!formData.commission_structure,
      hasGates: !!formData.performance_gates?.gates?.length
    };
  };

  const preview = getPreviewData();

  // Handle form submission
  const handleSubmit = () => {
    // Validate all sections
    const basicValid = validateSection('basic');
    const amountsValid = validateSection('amounts');

    if (!basicValid || !amountsValid) {
      alert('Please fix validation errors before submitting');
      return;
    }

    // Prepare submission data
    const submissionData = {
      ...formData,
      commission_rate: formData.commission_rate / 100, // Convert back to decimal
      quota_amount: Number(formData.quota_amount)
    };

    onSubmit(submissionData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Backdrop */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="inline-block w-full max-w-4xl my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-green-50 to-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {editMode ? 'Edit Target' : 'Create New Target'}
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Configure target parameters using the sections below
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-4 max-h-[calc(100vh-300px)] overflow-y-auto">
            <div className="space-y-4">
              {/* Section 1: Basic Configuration */}
              <SectionCollapse
                number={1}
                title="Basic Configuration"
                required
                validated={isBasicValid()}
                hasError={Object.keys(errors).some(k => ['name', 'target_type', 'team_id', 'period_type', 'period_start', 'period_end'].includes(k))}
                defaultOpen={true}
                info="Define the target name, scope, and time period"
              >
                <div className="space-y-4">
                  {/* Target Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Target Name <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Q4 2025 Sales Target"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                    {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
                  </div>

                  {/* Target Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Target Type <span className="text-red-600">*</span>
                    </label>
                    <select
                      value={formData.target_type}
                      onChange={(e) => setFormData({ ...formData, target_type: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      <option value="team">Team Target</option>
                      <option value="individual">Individual Target</option>
                      <option value="role">Role-Based Target</option>
                    </select>
                  </div>

                  {/* Team Selection */}
                  {formData.target_type === 'team' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Team <span className="text-red-600">*</span>
                      </label>
                      <select
                        value={formData.team_id}
                        onChange={(e) => setFormData({ ...formData, team_id: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      >
                        <option value="">Choose a team...</option>
                        {teams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name} ({team._count?.team_members || 0} members)
                          </option>
                        ))}
                      </select>
                      {errors.team_id && <p className="mt-1 text-sm text-red-600">{errors.team_id}</p>}
                    </div>
                  )}

                  {/* Period Type and Dates */}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Period Type <span className="text-red-600">*</span>
                      </label>
                      <select
                        value={formData.period_type}
                        onChange={(e) => setFormData({ ...formData, period_type: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      >
                        <option value="annual">Annual</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Start Date <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="date"
                        value={formData.period_start}
                        onChange={(e) => setFormData({ ...formData, period_start: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        End Date <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="date"
                        value={formData.period_end}
                        onChange={(e) => setFormData({ ...formData, period_end: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              </SectionCollapse>

              {/* Section 2: Amounts */}
              <SectionCollapse
                number={2}
                title="Quota & Commission"
                required
                validated={isAmountsValid()}
                hasError={Object.keys(errors).some(k => ['quota_amount', 'commission_rate'].includes(k))}
                defaultOpen={isBasicValid()}
                info="Set the quota target and base commission rate"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Quota Amount (£) <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="number"
                      value={formData.quota_amount}
                      onChange={(e) => setFormData({ ...formData, quota_amount: e.target.value })}
                      placeholder="e.g., 240000"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      min="0"
                      step="1000"
                    />
                    {errors.quota_amount && <p className="mt-1 text-sm text-red-600">{errors.quota_amount}</p>}
                    {formData.target_type === 'team' && preview.memberCount > 0 && (
                      <p className="mt-1 text-sm text-gray-600">
                        £{preview.perMemberQuota.toLocaleString()} per member
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Base Commission Rate (%) <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="number"
                      value={formData.commission_rate}
                      onChange={(e) => setFormData({ ...formData, commission_rate: Number(e.target.value) })}
                      placeholder="e.g., 5"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      min="0"
                      max="100"
                      step="0.1"
                    />
                    {errors.commission_rate && <p className="mt-1 text-sm text-red-600">{errors.commission_rate}</p>}
                  </div>
                </div>
              </SectionCollapse>

              {/* Section 3: Product Category (Optional) */}
              <SectionCollapse
                number={3}
                title="Product Category"
                optional
                defaultOpen={false}
                info="Optionally restrict this target to a specific product category"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Product Category
                  </label>
                  <select
                    value={formData.product_category_id}
                    onChange={(e) => setFormData({ ...formData, product_category_id: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="">No category (all products)</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name} ({cat.code})
                      </option>
                    ))}
                  </select>
                  {formData.product_category_id && (
                    <p className="mt-2 text-sm text-blue-600">
                      This target will only track deals in the selected product category
                    </p>
                  )}
                </div>
              </SectionCollapse>

              {/* Section 4: Commission Structure (Optional) */}
              <SectionCollapse
                number={4}
                title="Commission Structure"
                optional
                validated={!!formData.commission_structure}
                defaultOpen={false}
                info="Add accelerators, decelerators, or performance gates to create advanced commission rules"
              >
                <CommissionStructureConfig
                  value={{
                    commission_structure: formData.commission_structure,
                    performance_gates: formData.performance_gates
                  }}
                  onChange={(structure) => {
                    setFormData({
                      ...formData,
                      commission_structure: structure.commission_structure || null,
                      performance_gates: structure.performance_gates || null
                    });
                  }}
                  baseRate={formData.commission_rate / 100}
                />
              </SectionCollapse>

              {/* Section 5: Advanced Options */}
              <SectionCollapse
                number={5}
                title="Advanced Options"
                optional
                defaultOpen={false}
                info="Additional configuration options"
              >
                <div className="space-y-4">
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={formData.allow_overlapping}
                      onChange={(e) => setFormData({ ...formData, allow_overlapping: e.target.checked })}
                      className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-700">
                        Allow Concurrent Targets
                      </span>
                      <p className="text-xs text-gray-600">
                        Enable multiple overlapping targets for the same period (e.g., separate product targets)
                      </p>
                    </div>
                  </label>
                </div>
              </SectionCollapse>
            </div>
          </div>

          {/* Live Preview Panel */}
          <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-white border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
              <Target className="w-4 h-4 mr-2" />
              Preview
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Target</p>
                <p className="font-semibold text-gray-900">{formData.name || 'Unnamed'}</p>
              </div>
              <div>
                <p className="text-gray-600">Total Quota</p>
                <p className="font-semibold text-gray-900">£{preview.totalQuota.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-600">Base Rate</p>
                <p className="font-semibold text-gray-900">{formData.commission_rate}%</p>
              </div>
              <div>
                <p className="text-gray-600">Enhancements</p>
                <div className="flex items-center space-x-1">
                  {preview.hasStructure && (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">Structure</span>
                  )}
                  {preview.hasGates && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">Gates</span>
                  )}
                  {!preview.hasStructure && !preview.hasGates && (
                    <span className="text-xs text-gray-500">None</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
            <button
              onClick={onClose}
              className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!isBasicValid() || !isAmountsValid()}
              className="px-6 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {editMode ? 'Update Target' : 'Create Target'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TargetConfigModal;
