import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Plus, Edit, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';

interface AllocationPeriod {
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
  allocation_periods: AllocationPeriod[];
}

interface AllocationPatternBuilderProps {
  data: any;
  updateData: (updates: any) => void;
}

export const AllocationPatternBuilder: React.FC<AllocationPatternBuilderProps> = ({ data, updateData }) => {
  const [customPeriods, setCustomPeriods] = useState<AllocationPeriod[]>([]);

  // Fetch available allocation patterns
  const { data: patternsData } = useQuery({
    queryKey: ['allocation-patterns'],
    queryFn: async () => {
      const response = await api.get('/allocation-patterns');
      return response.data;
    }
  });

  const patterns = patternsData?.patterns || [];

  // Generate template periods based on selection
  const generateTemplatePeriods = (template: string, year: number = new Date().getFullYear()) => {
    let periods: AllocationPeriod[] = [];

    if (template === 'even-quarterly') {
      periods = [
        { period_name: `Q1 ${year}`, start_date: `${year}-01-01`, end_date: `${year}-03-31`, allocation_percentage: 25, sort_order: 1 },
        { period_name: `Q2 ${year}`, start_date: `${year}-04-01`, end_date: `${year}-06-30`, allocation_percentage: 25, sort_order: 2 },
        { period_name: `Q3 ${year}`, start_date: `${year}-07-01`, end_date: `${year}-09-30`, allocation_percentage: 25, sort_order: 3 },
        { period_name: `Q4 ${year}`, start_date: `${year}-10-01`, end_date: `${year}-12-31`, allocation_percentage: 25, sort_order: 4 }
      ];
    } else if (template === 'even-monthly') {
      const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      
      periods = months.map((month, index) => {
        const monthNum = index + 1;
        const startDate = new Date(year, index, 1);
        const endDate = new Date(year, index + 1, 0);
        
        return {
          period_name: `${month} ${year}`,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          allocation_percentage: Math.round((100 / 12) * 100) / 100,
          sort_order: index + 1
        };
      });
    }

    setCustomPeriods(periods);
    updateData({ custom_periods: periods });
  };

  const addCustomPeriod = () => {
    const newPeriod: AllocationPeriod = {
      period_name: '',
      start_date: '',
      end_date: '',
      allocation_percentage: 0,
      sort_order: customPeriods.length + 1
    };
    
    const updatedPeriods = [...customPeriods, newPeriod];
    setCustomPeriods(updatedPeriods);
    updateData({ custom_periods: updatedPeriods });
  };

  const updateCustomPeriod = (index: number, field: keyof AllocationPeriod, value: string | number) => {
    const updatedPeriods = customPeriods.map((period, i) => 
      i === index ? { ...period, [field]: value } : period
    );
    setCustomPeriods(updatedPeriods);
    updateData({ custom_periods: updatedPeriods });
  };

  const removeCustomPeriod = (index: number) => {
    const updatedPeriods = customPeriods.filter((_, i) => i !== index);
    setCustomPeriods(updatedPeriods);
    updateData({ custom_periods: updatedPeriods });
  };

  const getTotalPercentage = () => {
    return customPeriods.reduce((sum, period) => sum + Number(period.allocation_percentage), 0);
  };

  return (
    <div className="space-y-6">
      {/* Mode Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Allocation Pattern Source
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => updateData({ allocation_pattern_mode: 'existing' })}
            className={`p-3 border rounded-lg text-left transition-colors ${
              data.allocation_pattern_mode === 'existing'
                ? 'bg-blue-100 border-blue-500 text-blue-900'
                : 'bg-white border-gray-200 text-gray-700 hover:border-blue-300'
            }`}
          >
            <div className="font-medium">Use Existing Pattern</div>
            <div className="text-sm text-gray-600">Apply a saved allocation pattern</div>
          </button>
          <button
            type="button"
            onClick={() => updateData({ allocation_pattern_mode: 'create-new' })}
            className={`p-3 border rounded-lg text-left transition-colors ${
              data.allocation_pattern_mode === 'create-new'
                ? 'bg-blue-100 border-blue-500 text-blue-900'
                : 'bg-white border-gray-200 text-gray-700 hover:border-blue-300'
            }`}
          >
            <div className="font-medium">Create New Pattern</div>
            <div className="text-sm text-gray-600">Define a new allocation pattern</div>
          </button>
        </div>
      </div>

      {/* Existing Pattern Selection */}
      {data.allocation_pattern_mode === 'existing' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Allocation Pattern
          </label>
          <select
            value={data.allocation_pattern_id || ''}
            onChange={(e) => updateData({ allocation_pattern_id: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Choose a pattern...</option>
            {patterns.map((pattern: AllocationPattern) => (
              <option key={pattern.id} value={pattern.id}>
                {pattern.pattern_name} ({pattern.base_period_type})
              </option>
            ))}
          </select>
          
          {/* Pattern Preview */}
          {data.allocation_pattern_id && (() => {
            const selectedPattern = patterns.find((p: AllocationPattern) => p.id === data.allocation_pattern_id);
            return selectedPattern ? (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                <div className="text-sm font-medium text-gray-900 mb-2">
                  {selectedPattern.pattern_name}
                </div>
                {selectedPattern.description && (
                  <div className="text-sm text-gray-600 mb-2">
                    {selectedPattern.description}
                  </div>
                )}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  {selectedPattern.allocation_periods.slice(0, 4).map(period => (
                    <div key={period.period_name} className="text-xs">
                      <span className="text-gray-600">{period.period_name}:</span>
                      <span className="font-medium ml-1">{period.allocation_percentage}%</span>
                    </div>
                  ))}
                  {selectedPattern.allocation_periods.length > 4 && (
                    <div className="text-xs text-gray-500">
                      +{selectedPattern.allocation_periods.length - 4} more
                    </div>
                  )}
                </div>
              </div>
            ) : null;
          })()}
        </div>
      )}

      {/* Create New Pattern */}
      {data.allocation_pattern_mode === 'create-new' && (
        <div className="space-y-4">
          {/* Pattern Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pattern Name
              </label>
              <input
                type="text"
                value={data.allocation_pattern_name || ''}
                onChange={(e) => updateData({ allocation_pattern_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Q4 Holiday Adjustment"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Template
              </label>
              <select
                value={data.allocation_pattern_template || ''}
                onChange={(e) => {
                  const template = e.target.value;
                  updateData({ allocation_pattern_template: template });
                  if (template !== 'custom') {
                    generateTemplatePeriods(template);
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose template...</option>
                <option value="even-quarterly">Even Quarterly (25% each)</option>
                <option value="even-monthly">Even Monthly (8.33% each)</option>
                <option value="custom">Custom Periods</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (Optional)
            </label>
            <textarea
              value={data.allocation_pattern_description || ''}
              onChange={(e) => updateData({ allocation_pattern_description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
              placeholder="Describe when this pattern should be used"
            />
          </div>

          {/* Custom Periods */}
          {(data.allocation_pattern_template === 'custom' || customPeriods.length > 0) && (
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  Allocation Periods
                </label>
                <div className="flex items-center space-x-4">
                  <div className="text-sm">
                    Total: <span className={`font-medium ${getTotalPercentage() === 100 ? 'text-green-600' : 'text-red-600'}`}>
                      {getTotalPercentage()}%
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={addCustomPeriod}
                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Period
                  </button>
                </div>
              </div>

              <div className="space-y-3 max-h-64 overflow-y-auto">
                {customPeriods.map((period, index) => (
                  <div key={index} className="p-3 border border-gray-200 rounded-lg bg-white">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Period Name
                        </label>
                        <input
                          type="text"
                          value={period.period_name}
                          onChange={(e) => updateCustomPeriod(index, 'period_name', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                          onChange={(e) => updateCustomPeriod(index, 'start_date', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          End Date
                        </label>
                        <input
                          type="date"
                          value={period.end_date}
                          onChange={(e) => updateCustomPeriod(index, 'end_date', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                            onChange={(e) => updateCustomPeriod(index, 'allocation_percentage', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeCustomPeriod(index)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {customPeriods.length === 0 && (
                <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                  <Calendar className="mx-auto h-8 w-8 text-gray-400" />
                  <p className="mt-2 text-sm text-gray-500">
                    No periods defined. Click "Add Period" to start.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};