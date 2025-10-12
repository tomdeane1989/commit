// CommissionStructureConfig.tsx - Reusable commission structure configuration component
import React, { useState } from 'react';
import { Plus, Trash2, Info, AlertCircle } from 'lucide-react';

interface AcceleratorTier {
  threshold: number;
  multiplier: number;
  description?: string;
}

interface DeceleratorTier {
  threshold: number;
  multiplier: number;
  description?: string;
}

interface PerformanceGate {
  id?: string;
  name: string;
  metric: 'quota_attainment' | 'total_sales' | 'deal_count' | 'average_deal_size';
  operator: '>=' | '>' | '<=' | '<' | '==';
  value: number;
  enforcement: 'hard' | 'soft';
  penalty_type: 'zero_commission' | 'percentage_reduction';
  penalty_value?: number;
  description?: string;
}

interface CommissionStructure {
  type: 'base_rate' | 'accelerator' | 'decelerator' | 'performance_gate';
  base_rate?: number;
  accelerators?: AcceleratorTier[];
  decelerators?: DeceleratorTier[];
}

interface CommissionStructureConfigProps {
  value?: {
    commission_structure?: CommissionStructure;
    performance_gates?: { gates: PerformanceGate[] };
  };
  onChange: (structure: any) => void;
  baseRate?: number;
}

const CommissionStructureConfig: React.FC<CommissionStructureConfigProps> = ({
  value,
  onChange,
  baseRate = 0.05
}) => {
  const [structureType, setStructureType] = useState<string>(
    value?.commission_structure?.type || 'base_rate'
  );
  const [accelerators, setAccelerators] = useState<AcceleratorTier[]>(
    value?.commission_structure?.accelerators || []
  );
  const [decelerators, setDecelerators] = useState<DeceleratorTier[]>(
    value?.commission_structure?.decelerators || []
  );
  const [gates, setGates] = useState<PerformanceGate[]>(
    value?.performance_gates?.gates || []
  );
  const [showGates, setShowGates] = useState(
    (value?.performance_gates?.gates?.length || 0) > 0
  );

  // Update parent when structure changes
  React.useEffect(() => {
    const structure: any = {};

    if (structureType !== 'base_rate') {
      structure.commission_structure = {
        type: structureType,
        base_rate: baseRate
      };

      if (structureType === 'accelerator' && accelerators.length > 0) {
        structure.commission_structure.accelerators = accelerators;
      }

      if (structureType === 'decelerator' && decelerators.length > 0) {
        structure.commission_structure.decelerators = decelerators;
      }
    }

    if (showGates && gates.length > 0) {
      structure.performance_gates = { gates };
    }

    onChange(structure);
  }, [structureType, accelerators, decelerators, gates, showGates, baseRate]);

  const addAccelerator = () => {
    setAccelerators([
      ...accelerators,
      { threshold: 100, multiplier: 1.0, description: '' }
    ]);
  };

  const removeAccelerator = (index: number) => {
    setAccelerators(accelerators.filter((_, i) => i !== index));
  };

  const updateAccelerator = (index: number, field: keyof AcceleratorTier, value: any) => {
    const updated = [...accelerators];
    updated[index] = { ...updated[index], [field]: value };
    setAccelerators(updated);
  };

  const addDecelerator = () => {
    setDecelerators([
      ...decelerators,
      { threshold: 90, multiplier: 0.8, description: '' }
    ]);
  };

  const removeDecelerator = (index: number) => {
    setDecelerators(decelerators.filter((_, i) => i !== index));
  };

  const updateDecelerator = (index: number, field: keyof DeceleratorTier, value: any) => {
    const updated = [...decelerators];
    updated[index] = { ...updated[index], [field]: value };
    setDecelerators(updated);
  };

  const addGate = () => {
    setGates([
      ...gates,
      {
        name: 'Minimum Quota',
        metric: 'quota_attainment',
        operator: '>=',
        value: 70,
        enforcement: 'hard',
        penalty_type: 'zero_commission',
        description: ''
      }
    ]);
  };

  const removeGate = (index: number) => {
    setGates(gates.filter((_, i) => i !== index));
  };

  const updateGate = (index: number, field: keyof PerformanceGate, value: any) => {
    const updated = [...gates];
    updated[index] = { ...updated[index], [field]: value };
    setGates(updated);
  };

  return (
    <div className="space-y-6">
      {/* Structure Type Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Commission Structure Type
        </label>
        <select
          value={structureType}
          onChange={(e) => setStructureType(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
        >
          <option value="base_rate">Base Rate (Simple Percentage)</option>
          <option value="accelerator">Accelerators (Bonus for Exceeding Quota)</option>
          <option value="decelerator">Decelerators (Penalty for Underperformance)</option>
        </select>

        <div className="mt-2 flex items-start space-x-2 text-sm text-gray-600">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <p>
            {structureType === 'base_rate' && 'Simple percentage commission on all deals'}
            {structureType === 'accelerator' && 'Increase commission rates when quota is exceeded'}
            {structureType === 'decelerator' && 'Reduce commission rates when performance is below quota'}
          </p>
        </div>
      </div>

      {/* Accelerators Configuration */}
      {structureType === 'accelerator' && (
        <div className="border border-green-200 rounded-lg p-4 bg-green-50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Accelerator Tiers</h3>
            <button
              type="button"
              onClick={addAccelerator}
              className="flex items-center space-x-1 px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add Tier</span>
            </button>
          </div>

          {accelerators.length === 0 && (
            <div className="text-center py-4 text-gray-500 text-sm">
              No accelerator tiers defined. Click "Add Tier" to create one.
            </div>
          )}

          <div className="space-y-3">
            {accelerators.map((acc, index) => (
              <div key={index} className="bg-white border border-gray-200 rounded-lg p-3">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Tier {index + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeAccelerator(index)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Quota Threshold (%)
                    </label>
                    <input
                      type="number"
                      value={acc.threshold}
                      onChange={(e) => updateAccelerator(index, 'threshold', Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      min="0"
                      step="1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Multiplier (e.g., 1.5 = 150%)
                    </label>
                    <input
                      type="number"
                      value={acc.multiplier}
                      onChange={(e) => updateAccelerator(index, 'multiplier', Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      min="1"
                      step="0.1"
                    />
                  </div>
                </div>

                <div className="mt-2">
                  <label className="block text-xs text-gray-600 mb-1">
                    Description (Optional)
                  </label>
                  <input
                    type="text"
                    value={acc.description || ''}
                    onChange={(e) => updateAccelerator(index, 'description', e.target.value)}
                    placeholder="e.g., Exceed quota by 25%"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>

                <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded">
                  <strong>Effect:</strong> At {acc.threshold}% quota → Commission × {acc.multiplier}
                  {' '}({(baseRate * acc.multiplier * 100).toFixed(1)}% effective rate)
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Decelerators Configuration */}
      {structureType === 'decelerator' && (
        <div className="border border-orange-200 rounded-lg p-4 bg-orange-50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Decelerator Tiers</h3>
            <button
              type="button"
              onClick={addDecelerator}
              className="flex items-center space-x-1 px-3 py-1 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add Tier</span>
            </button>
          </div>

          {decelerators.length === 0 && (
            <div className="text-center py-4 text-gray-500 text-sm">
              No decelerator tiers defined. Click "Add Tier" to create one.
            </div>
          )}

          <div className="space-y-3">
            {decelerators.map((dec, index) => (
              <div key={index} className="bg-white border border-gray-200 rounded-lg p-3">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Tier {index + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeDecelerator(index)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Below Threshold (%)
                    </label>
                    <input
                      type="number"
                      value={dec.threshold}
                      onChange={(e) => updateDecelerator(index, 'threshold', Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      min="0"
                      max="100"
                      step="1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Multiplier (e.g., 0.8 = 80%)
                    </label>
                    <input
                      type="number"
                      value={dec.multiplier}
                      onChange={(e) => updateDecelerator(index, 'multiplier', Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      min="0"
                      max="1"
                      step="0.1"
                    />
                  </div>
                </div>

                <div className="mt-2">
                  <label className="block text-xs text-gray-600 mb-1">
                    Description (Optional)
                  </label>
                  <input
                    type="text"
                    value={dec.description || ''}
                    onChange={(e) => updateDecelerator(index, 'description', e.target.value)}
                    placeholder="e.g., 10% below quota"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>

                <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded">
                  <strong>Effect:</strong> Below {dec.threshold}% quota → Commission × {dec.multiplier}
                  {' '}({(baseRate * dec.multiplier * 100).toFixed(1)}% effective rate)
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Performance Gates */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={showGates}
              onChange={(e) => setShowGates(e.target.checked)}
              className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
            />
            <span className="text-sm font-medium text-gray-700">
              Add Performance Gates (Optional)
            </span>
          </label>
          {showGates && (
            <button
              type="button"
              onClick={addGate}
              className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add Gate</span>
            </button>
          )}
        </div>

        {showGates && (
          <div className="border border-blue-200 rounded-lg p-4 bg-blue-50 space-y-3">
            <div className="flex items-start space-x-2 text-sm text-blue-800">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p>
                Performance gates set minimum requirements. If not met, commission can be reduced or blocked entirely.
              </p>
            </div>

            {gates.length === 0 && (
              <div className="text-center py-4 text-gray-500 text-sm">
                No performance gates defined. Click "Add Gate" to create one.
              </div>
            )}

            {gates.map((gate, index) => (
              <div key={index} className="bg-white border border-gray-200 rounded-lg p-3">
                <div className="flex items-start justify-between mb-2">
                  <input
                    type="text"
                    value={gate.name}
                    onChange={(e) => updateGate(index, 'name', e.target.value)}
                    placeholder="Gate name"
                    className="flex-1 px-3 py-1 border border-gray-300 rounded-lg text-sm font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => removeGate(index)}
                    className="ml-2 text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Metric</label>
                    <select
                      value={gate.metric}
                      onChange={(e) => updateGate(index, 'metric', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                    >
                      <option value="quota_attainment">Quota %</option>
                      <option value="total_sales">Total Sales</option>
                      <option value="deal_count">Deal Count</option>
                      <option value="average_deal_size">Avg Deal Size</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Operator</label>
                    <select
                      value={gate.operator}
                      onChange={(e) => updateGate(index, 'operator', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                    >
                      <option value=">=">&gt;=</option>
                      <option value=">">&gt;</option>
                      <option value="<=">&lt;=</option>
                      <option value="<">&lt;</option>
                      <option value="==">=</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Value</label>
                    <input
                      type="number"
                      value={gate.value}
                      onChange={(e) => updateGate(index, 'value', Number(e.target.value))}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Enforcement</label>
                    <select
                      value={gate.enforcement}
                      onChange={(e) => updateGate(index, 'enforcement', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                    >
                      <option value="hard">Hard (Block Commission)</option>
                      <option value="soft">Soft (Warning Only)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Penalty</label>
                    <select
                      value={gate.penalty_type}
                      onChange={(e) => updateGate(index, 'penalty_type', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                      disabled={gate.enforcement === 'soft'}
                    >
                      <option value="zero_commission">Zero Commission</option>
                      <option value="percentage_reduction">% Reduction</option>
                    </select>
                  </div>
                </div>

                {gate.penalty_type === 'percentage_reduction' && gate.enforcement === 'hard' && (
                  <div className="mt-2">
                    <label className="block text-xs text-gray-600 mb-1">Reduction %</label>
                    <input
                      type="number"
                      value={gate.penalty_value || 0}
                      onChange={(e) => updateGate(index, 'penalty_value', Number(e.target.value))}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                      min="0"
                      max="100"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CommissionStructureConfig;
