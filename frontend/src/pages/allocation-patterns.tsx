import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Calendar, Users, Settings, CheckCircle, AlertCircle } from 'lucide-react';
import Layout from '../components/layout';
import { api } from '../lib/api';

interface AllocationPeriod {
  id?: string;
  period_name: string;
  start_date: string;
  end_date: string;
  allocation_percentage: number;
  notes?: string;
  sort_order: number;
}

interface AllocationPattern {
  id: string;
  pattern_name: string;
  description?: string;
  base_period_type: string;
  is_active: boolean;
  created_at: string;
  allocation_periods: AllocationPeriod[];
  created_by: {
    first_name: string;
    last_name: string;
    email: string;
  };
  _count: {
    targets: number;
  };
}

interface CreatePatternData {
  pattern_name: string;
  description?: string;
  base_period_type: string;
  periods: AllocationPeriod[];
}

export default function AllocationPatterns() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPattern, setEditingPattern] = useState<AllocationPattern | null>(null);
  const [newPattern, setNewPattern] = useState<CreatePatternData>({
    pattern_name: '',
    description: '',
    base_period_type: 'quarterly',
    periods: []
  });

  const queryClient = useQueryClient();

  // Fetch allocation patterns
  const { data: patternsData, isLoading } = useQuery({
    queryKey: ['allocation-patterns'],
    queryFn: async () => {
      const response = await api.get('/allocation-patterns');
      return response.data;
    }
  });

  // Create pattern mutation
  const createPatternMutation = useMutation({
    mutationFn: async (patternData: CreatePatternData) => {
      const response = await api.post('/allocation-patterns', patternData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allocation-patterns'] });
      setShowCreateModal(false);
      resetForm();
    }
  });

  // Update pattern mutation
  const updatePatternMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreatePatternData> }) => {
      const response = await api.put(`/allocation-patterns/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allocation-patterns'] });
      setEditingPattern(null);
      resetForm();
    }
  });

  // Delete pattern mutation
  const deletePatternMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/allocation-patterns/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allocation-patterns'] });
    }
  });

  const resetForm = () => {
    setNewPattern({
      pattern_name: '',
      description: '',
      base_period_type: 'quarterly',
      periods: []
    });
  };

  const addPeriod = () => {
    const newPeriod: AllocationPeriod = {
      period_name: '',
      start_date: '',
      end_date: '',
      allocation_percentage: 0,
      notes: '',
      sort_order: newPattern.periods.length + 1
    };
    setNewPattern(prev => ({
      ...prev,
      periods: [...prev.periods, newPeriod]
    }));
  };

  const updatePeriod = (index: number, field: keyof AllocationPeriod, value: string | number) => {
    setNewPattern(prev => ({
      ...prev,
      periods: prev.periods.map((period, i) => 
        i === index ? { ...period, [field]: value } : period
      )
    }));
  };

  const removePeriod = (index: number) => {
    setNewPattern(prev => ({
      ...prev,
      periods: prev.periods.filter((_, i) => i !== index)
    }));
  };

  const generateQuarterlyPeriods = (year: number = new Date().getFullYear()) => {
    const quarters = [
      { name: 'Q1', start: `${year}-01-01`, end: `${year}-03-31` },
      { name: 'Q2', start: `${year}-04-01`, end: `${year}-06-30` },
      { name: 'Q3', start: `${year}-07-01`, end: `${year}-09-30` },
      { name: 'Q4', start: `${year}-10-01`, end: `${year}-12-31` }
    ];

    const periods: AllocationPeriod[] = quarters.map((quarter, index) => ({
      period_name: `${quarter.name} ${year}`,
      start_date: quarter.start,
      end_date: quarter.end,
      allocation_percentage: 25,
      notes: '',
      sort_order: index + 1
    }));

    setNewPattern(prev => ({ ...prev, periods }));
  };

  const generateMonthlyPeriods = (year: number = new Date().getFullYear()) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const periods: AllocationPeriod[] = months.map((month, index) => {
      const monthNum = index + 1;
      const startDate = new Date(year, index, 1);
      const endDate = new Date(year, index + 1, 0); // Last day of month

      return {
        period_name: `${month} ${year}`,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        allocation_percentage: Math.round((100 / 12) * 100) / 100, // 8.33%
        notes: '',
        sort_order: index + 1
      };
    });

    setNewPattern(prev => ({ ...prev, periods }));
  };

  const getTotalPercentage = () => {
    return newPattern.periods.reduce((sum, period) => sum + Number(period.allocation_percentage), 0);
  };

  const isPastPeriod = (endDate: string) => {
    if (!endDate) return false;
    return new Date(endDate) < new Date();
  };

  const handleSubmit = () => {
    if (editingPattern) {
      updatePatternMutation.mutate({
        id: editingPattern.id,
        data: newPattern
      });
    } else {
      createPatternMutation.mutate(newPattern);
    }
  };

  const startEdit = (pattern: AllocationPattern) => {
    setEditingPattern(pattern);
    setNewPattern({
      pattern_name: pattern.pattern_name,
      description: pattern.description || '',
      base_period_type: pattern.base_period_type,
      periods: pattern.allocation_periods.map(period => ({
        period_name: period.period_name,
        start_date: period.start_date,
        end_date: period.end_date,
        allocation_percentage: period.allocation_percentage,
        notes: period.notes || '',
        sort_order: period.sort_order
      }))
    });
    setShowCreateModal(true);
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      </Layout>
    );
  }

  const patterns = patternsData?.patterns || [];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Allocation Patterns</h1>
            <p className="text-gray-600 mt-1">
              Create and manage configurable quota allocation patterns for your organization
            </p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setEditingPattern(null);
              setShowCreateModal(true);
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Pattern
          </button>
        </div>

        {/* Patterns Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {patterns.map((pattern: AllocationPattern) => (
            <div key={pattern.id} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center">
                  <div className={`p-2 rounded-lg ${pattern.is_active ? 'bg-green-100' : 'bg-gray-100'}`}>
                    <Calendar className={`w-5 h-5 ${pattern.is_active ? 'text-green-600' : 'text-gray-400'}`} />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-lg font-medium text-gray-900">{pattern.pattern_name}</h3>
                    <p className="text-sm text-gray-500 capitalize">{pattern.base_period_type}</p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => startEdit(pattern)}
                    className="p-1 text-gray-400 hover:text-indigo-600"
                    title="Edit pattern (past periods are protected)"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deletePatternMutation.mutate(pattern.id)}
                    className="p-1 text-gray-400 hover:text-red-600"
                    title="Delete pattern"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {pattern.description && (
                <p className="text-sm text-gray-600 mb-4">{pattern.description}</p>
              )}

              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Periods:</span>
                  <span className="font-medium">{pattern.allocation_periods.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Targets using:</span>
                  <span className="font-medium">{pattern._count.targets}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Status:</span>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    pattern.is_active 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {pattern.is_active ? (
                      <>
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Active
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Inactive
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* Period Preview */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Allocation Breakdown</h4>
                <div className="space-y-1">
                  {pattern.allocation_periods.slice(0, 3).map(period => (
                    <div key={period.id} className="flex justify-between text-xs">
                      <span className="text-gray-600">{period.period_name}</span>
                      <span className="font-medium">{period.allocation_percentage}%</span>
                    </div>
                  ))}
                  {pattern.allocation_periods.length > 3 && (
                    <div className="text-xs text-gray-500">
                      +{pattern.allocation_periods.length - 3} more periods
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 text-xs text-gray-500">
                Created by {pattern.created_by.first_name} {pattern.created_by.last_name}
              </div>
            </div>
          ))}
        </div>

        {patterns.length === 0 && (
          <div className="text-center py-12">
            <Calendar className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No allocation patterns</h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by creating your first allocation pattern.
            </p>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900">
                  {editingPattern ? 'Edit Allocation Pattern' : 'Create Allocation Pattern'}
                </h3>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingPattern(null);
                    resetForm();
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>

              <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Pattern Name *
                    </label>
                    <input
                      type="text"
                      value={newPattern.pattern_name}
                      onChange={(e) => setNewPattern(prev => ({ ...prev, pattern_name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g., UK Tech Sales 2025"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Base Period Type *
                    </label>
                    <select
                      value={newPattern.base_period_type}
                      onChange={(e) => setNewPattern(prev => ({ ...prev, base_period_type: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="quarterly">Quarterly</option>
                      <option value="monthly">Monthly</option>
                      <option value="annual">Annual</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={newPattern.description}
                    onChange={(e) => setNewPattern(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    rows={2}
                    placeholder="Describe when and how this pattern should be used"
                  />
                </div>

                {/* Quick Templates */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quick Templates
                  </label>
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() => generateQuarterlyPeriods()}
                      className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Even Quarterly
                    </button>
                    <button
                      type="button"
                      onClick={() => generateMonthlyPeriods()}
                      className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Even Monthly
                    </button>
                    <button
                      type="button"
                      onClick={addPeriod}
                      className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Add Custom Period
                    </button>
                  </div>
                </div>

                {/* Periods */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="block text-sm font-medium text-gray-700">
                      Allocation Periods
                    </label>
                    <div className="text-sm">
                      Total: <span className={`font-medium ${getTotalPercentage() === 100 ? 'text-green-600' : 'text-red-600'}`}>
                        {getTotalPercentage()}%
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {newPattern.periods.map((period, index) => {
                      const isPast = isPastPeriod(period.end_date);
                      const isEditable = !editingPattern || !isPast;
                      
                      return (
                        <div key={index} className={`p-4 border rounded-lg ${
                          isPast ? 'border-gray-300 bg-gray-50' : 'border-gray-200 bg-white'
                        }`}>
                          {isPast && (
                            <div className="flex items-center mb-2 text-sm text-gray-600">
                              <div className="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>
                              Past period - allocation locked
                            </div>
                          )}
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Period Name
                              </label>
                              <input
                                type="text"
                                value={period.period_name}
                                onChange={(e) => updatePeriod(index, 'period_name', e.target.value)}
                                disabled={!isEditable}
                                className={`w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                                  isEditable ? 'border-gray-300' : 'border-gray-200 bg-gray-100 text-gray-500'
                                }`}
                                placeholder="Q1 2025"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Start Date
                              </label>
                              <input
                                type="date"
                                value={period.start_date}
                                onChange={(e) => updatePeriod(index, 'start_date', e.target.value)}
                                disabled={!isEditable}
                                className={`w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                                  isEditable ? 'border-gray-300' : 'border-gray-200 bg-gray-100 text-gray-500'
                                }`}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                End Date
                              </label>
                              <input
                                type="date"
                                value={period.end_date}
                                onChange={(e) => updatePeriod(index, 'end_date', e.target.value)}
                                disabled={!isEditable}
                                className={`w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                                  isEditable ? 'border-gray-300' : 'border-gray-200 bg-gray-100 text-gray-500'
                                }`}
                              />
                            </div>
                            <div className="flex items-end space-x-2">
                              <div className="flex-1">
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                  Allocation %
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="100"
                                  value={period.allocation_percentage}
                                  onChange={(e) => updatePeriod(index, 'allocation_percentage', parseFloat(e.target.value) || 0)}
                                  disabled={!isEditable}
                                  className={`w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                                    isEditable ? 'border-gray-300' : 'border-gray-200 bg-gray-100 text-gray-500'
                                  }`}
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => removePeriod(index)}
                                disabled={!isEditable}
                                className={`p-1 rounded ${
                                  isEditable 
                                    ? 'text-red-600 hover:bg-red-50' 
                                    : 'text-gray-400 cursor-not-allowed'
                                }`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          {period.notes !== undefined && (
                            <div className="mt-2">
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Notes
                              </label>
                              <input
                                type="text"
                                value={period.notes}
                                onChange={(e) => updatePeriod(index, 'notes', e.target.value)}
                                disabled={!isEditable}
                                className={`w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                                  isEditable ? 'border-gray-300' : 'border-gray-200 bg-gray-100 text-gray-500'
                                }`}
                                placeholder="Optional notes about this period"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {newPattern.periods.length === 0 && (
                    <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                      <Calendar className="mx-auto h-8 w-8 text-gray-400" />
                      <p className="mt-2 text-sm text-gray-500">
                        No periods defined. Use quick templates or add custom periods.
                      </p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex justify-end space-x-3 pt-6 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setEditingPattern(null);
                      resetForm();
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={
                      !newPattern.pattern_name || 
                      newPattern.periods.length === 0 || 
                      getTotalPercentage() !== 100 ||
                      createPatternMutation.isPending ||
                      updatePatternMutation.isPending
                    }
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
                  >
                    {createPatternMutation.isPending || updatePatternMutation.isPending ? (
                      'Saving...'
                    ) : editingPattern ? (
                      'Update Pattern'
                    ) : (
                      'Create Pattern'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}