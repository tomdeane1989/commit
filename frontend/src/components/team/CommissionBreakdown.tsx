// CommissionBreakdown.tsx - Displays detailed commission calculation breakdown
import React from 'react';
import { TrendingUp, TrendingDown, Target, Users, Award, ShieldAlert, DollarSign, Info } from 'lucide-react';

interface CommissionBreakdownProps {
  baseAmount: number;
  baseRate: number;
  finalAmount: number;
  structure?: any;
  performanceGates?: any;
  metadata?: any;
  className?: string;
}

const CommissionBreakdown: React.FC<CommissionBreakdownProps> = ({
  baseAmount,
  baseRate,
  finalAmount,
  structure,
  performanceGates,
  metadata,
  className = ''
}) => {
  const hasStructure = !!structure;
  const hasGates = !!performanceGates?.gates?.length;

  if (!hasStructure && !hasGates) {
    // Simple commission - just show base calculation
    return (
      <div className={`bg-gray-50 border border-gray-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-start space-x-3">
          <DollarSign className="w-5 h-5 text-gray-600 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Commission Calculation</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Deal Amount:</span>
                <span className="font-medium">£{baseAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Commission Rate:</span>
                <span className="font-medium">{(baseRate * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-300">
                <span className="text-gray-900 font-semibold">Total Commission:</span>
                <span className="font-semibold text-green-600">£{finalAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Advanced commission with structures/gates
  return (
    <div className={`bg-gradient-to-br from-blue-50 to-green-50 border border-blue-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-start space-x-3">
        <Award className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Advanced Commission Breakdown</h4>

          <div className="space-y-3">
            {/* Base Calculation */}
            <div className="bg-white rounded-md p-3 border border-gray-200">
              <div className="text-xs font-semibold text-gray-700 mb-2">Base Calculation</div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Deal Amount:</span>
                  <span className="font-medium">£{baseAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Base Rate:</span>
                  <span className="font-medium">{(baseRate * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-gray-200">
                  <span className="text-gray-700">Base Commission:</span>
                  <span className="font-medium">£{(baseAmount * baseRate).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Performance Gates */}
            {hasGates && performanceGates.gates && (
              <div className="bg-white rounded-md p-3 border border-yellow-200">
                <div className="flex items-center space-x-2 mb-2">
                  <ShieldAlert className="w-4 h-4 text-yellow-600" />
                  <div className="text-xs font-semibold text-gray-700">Performance Gates</div>
                </div>
                <div className="space-y-2">
                  {performanceGates.gates.map((gate: any, index: number) => {
                    const passed = metadata?.gateResults?.[index]?.passed ?? true;
                    return (
                      <div key={index} className="flex items-start space-x-2 text-xs">
                        {passed ? (
                          <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center mt-0.5">
                            <div className="w-2 h-2 rounded-full bg-green-600"></div>
                          </div>
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-red-100 flex items-center justify-center mt-0.5">
                            <div className="w-2 h-2 rounded-full bg-red-600"></div>
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{gate.name}</div>
                          <div className="text-gray-600">
                            {gate.metric} {gate.operator} {gate.value}
                            {gate.enforcement === 'hard' && ' (Required)'}
                          </div>
                          {!passed && gate.penalty_type === 'zero_commission' && (
                            <div className="text-red-600 font-medium mt-1">❌ Commission blocked</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Commission Structure Adjustments */}
            {hasStructure && (
              <div className="bg-white rounded-md p-3 border border-green-200">
                <div className="flex items-center space-x-2 mb-2">
                  {structure.type === 'accelerator' && <TrendingUp className="w-4 h-4 text-green-600" />}
                  {structure.type === 'decelerator' && <TrendingDown className="w-4 h-4 text-orange-600" />}
                  {structure.type === 'tiered' && <Target className="w-4 h-4 text-blue-600" />}
                  {structure.type === 'team_split' && <Users className="w-4 h-4 text-purple-600" />}
                  <div className="text-xs font-semibold text-gray-700">
                    {structure.type === 'accelerator' && 'Accelerator Applied'}
                    {structure.type === 'decelerator' && 'Decelerator Applied'}
                    {structure.type === 'tiered' && 'Tiered Commission'}
                    {structure.type === 'team_split' && 'Team Split'}
                    {!['accelerator', 'decelerator', 'tiered', 'team_split'].includes(structure.type) && 'Structure Applied'}
                  </div>
                </div>

                {/* Accelerator */}
                {structure.type === 'accelerator' && (
                  <div className="space-y-1 text-sm">
                    {structure.accelerators && (
                      <>
                        <div className="text-xs text-gray-600 mb-1">Active Multiplier:</div>
                        {structure.accelerators.map((acc: any, index: number) => {
                          const isActive = metadata?.appliedMultiplier === acc.multiplier;
                          return (
                            <div key={index} className={`flex justify-between ${isActive ? 'font-semibold text-green-600' : 'text-gray-500'}`}>
                              <span>At {acc.threshold}% quota:</span>
                              <span>{acc.multiplier}× multiplier {isActive && '✓'}</span>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                )}

                {/* Decelerator */}
                {structure.type === 'decelerator' && (
                  <div className="space-y-1 text-sm">
                    {structure.decelerators && (
                      <>
                        <div className="text-xs text-gray-600 mb-1">Active Penalty:</div>
                        {structure.decelerators.map((dec: any, index: number) => {
                          const isActive = metadata?.appliedMultiplier === dec.multiplier;
                          return (
                            <div key={index} className={`flex justify-between ${isActive ? 'font-semibold text-orange-600' : 'text-gray-500'}`}>
                              <span>Below {dec.threshold}% quota:</span>
                              <span>{dec.multiplier}× multiplier {isActive && '✓'}</span>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                )}

                {/* Tiered */}
                {structure.type === 'tiered' && (
                  <div className="space-y-1 text-sm">
                    {structure.tiers && (
                      <>
                        <div className="text-xs text-gray-600 mb-1">Commission Tiers:</div>
                        {structure.tiers.map((tier: any, index: number) => (
                          <div key={index} className="flex justify-between text-gray-700">
                            <span>£{tier.from?.toLocaleString() || 0} - £{tier.to?.toLocaleString() || '∞'}:</span>
                            <span>{(tier.rate * 100).toFixed(1)}%</span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}

                {/* Team Split */}
                {structure.type === 'team_split' && (
                  <div className="space-y-1 text-sm">
                    {structure.splits && (
                      <>
                        <div className="text-xs text-gray-600 mb-1">Split Distribution:</div>
                        {structure.splits.map((split: any, index: number) => (
                          <div key={index} className="flex justify-between text-gray-700">
                            <span>{split.role || `User ${index + 1}`}:</span>
                            <span>{split.percentage}%</span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Final Calculation */}
            <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-md p-3 text-white">
              <div className="flex justify-between items-center">
                <span className="font-semibold">Final Commission:</span>
                <span className="text-lg font-bold">£{finalAmount.toLocaleString()}</span>
              </div>
              {finalAmount !== (baseAmount * baseRate) && (
                <div className="text-xs mt-1 text-green-100">
                  {finalAmount > (baseAmount * baseRate) ? (
                    <>↑ +£{(finalAmount - (baseAmount * baseRate)).toLocaleString()} from base</>
                  ) : (
                    <>↓ -£{((baseAmount * baseRate) - finalAmount).toLocaleString()} from base</>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Info Note */}
          <div className="mt-3 flex items-start space-x-2 text-xs text-gray-600">
            <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <p>This commission was calculated using advanced commission structures. Contact your manager if you have questions.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommissionBreakdown;
