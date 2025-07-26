import { useState, useEffect } from 'react';
import { X, Target, Calendar, DollarSign, Percent, User } from 'lucide-react';

interface TeamMember {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
}

interface TargetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  teamMembers: TeamMember[];
  loading: boolean;
  editingTarget?: any;
}

export const TargetModal: React.FC<TargetModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  teamMembers,
  loading,
  editingTarget
}) => {
  const [formData, setFormData] = useState({
    user_id: '',
    role: '',
    period_type: 'quarterly',
    period_start: '',
    period_end: '',
    quota_amount: '',
    commission_rate: '3'
  });

  const [targetType, setTargetType] = useState<'individual' | 'role'>('individual');

  // Populate form when editing
  useEffect(() => {
    if (editingTarget) {
      setFormData({
        user_id: editingTarget.user_id || '',
        role: editingTarget.role || '',
        period_type: editingTarget.period_type,
        period_start: editingTarget.period_start?.split('T')[0] || '',
        period_end: editingTarget.period_end?.split('T')[0] || '',
        quota_amount: editingTarget.quota_amount.toString(),
        commission_rate: (editingTarget.commission_rate * 100).toString() // Convert to percentage
      });
      
      // Set target type based on existing target
      if (editingTarget.team_target) {
        setTargetType('role'); // Team targets are treated as role-based for UI
      } else if (editingTarget.role) {
        setTargetType('role');
      } else {
        setTargetType('individual');
      }
    } else {
      // Reset form for new target
      setFormData({
        user_id: '',
        role: '',
        period_type: 'quarterly',
        period_start: '',
        period_end: '',
        quota_amount: '',
        commission_rate: '3'
      });
      setTargetType('individual');
    }
  }, [editingTarget]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const data = {
      ...formData,
      target_type: targetType,
      quota_amount: parseFloat(formData.quota_amount),
      commission_rate: parseFloat(formData.commission_rate) / 100, // Convert percentage to decimal
      // Clear the field that's not being used
      user_id: targetType === 'individual' ? formData.user_id : null,
      role: targetType === 'role' ? formData.role : null
    };
    
    onSubmit(data);
    
    // Reset form
    setFormData({
      user_id: '',
      role: '',
      period_type: 'quarterly',
      period_start: '',
      period_end: '',
      quota_amount: '',
      commission_rate: '3'
    });
    setTargetType('individual');
  };

  const handleClose = () => {
    setFormData({
      user_id: '',
      role: '',
      period_type: 'quarterly',
      period_start: '',
      period_end: '',
      quota_amount: '',
      commission_rate: '3'
    });
    setTargetType('individual');
    onClose();
  };

  // Auto-calculate end date based on start date and period type
  const handleStartDateChange = (startDate: string) => {
    setFormData({ ...formData, period_start: startDate });
    
    if (startDate) {
      const start = new Date(startDate);
      let end = new Date(start);
      
      switch (formData.period_type) {
        case 'monthly':
          end.setMonth(end.getMonth() + 1);
          break;
        case 'quarterly':
          end.setMonth(end.getMonth() + 3);
          break;
        case 'yearly':
          end.setFullYear(end.getFullYear() + 1);
          break;
      }
      
      end.setDate(end.getDate() - 1); // End on the last day of the period
      setFormData(prev => ({ ...prev, period_end: end.toISOString().split('T')[0] }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {editingTarget ? 'Edit Sales Target' : 'Create Sales Target'}
          </h2>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            disabled={loading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Target Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Type *
            </label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="targetType"
                  value="individual"
                  checked={targetType === 'individual'}
                  onChange={(e) => setTargetType(e.target.value as 'individual' | 'role')}
                  className="mr-2"
                  disabled={loading || !!editingTarget}
                />
                Individual Member
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="targetType"
                  value="role"
                  checked={targetType === 'role'}
                  onChange={(e) => setTargetType(e.target.value as 'individual' | 'role')}
                  className="mr-2"
                  disabled={loading || !!editingTarget}
                />
                Role-Based
              </label>
            </div>
          </div>

          {/* Individual Member Selection */}
          {targetType === 'individual' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Team Member *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <select
                  required
                  value={formData.user_id}
                  onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
                  style={{ '--tw-ring-color': '#82a365' } as any}
                  disabled={loading || !!editingTarget}
                >
                  <option value="">Select a team member</option>
                  {teamMembers.filter(m => m.is_active).map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.first_name} {member.last_name} ({member.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Role Selection */}
          {targetType === 'role' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role *
              </label>
              <div className="relative">
                <Target className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <select
                  required
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
                  style={{ '--tw-ring-color': '#82a365' } as any}
                  disabled={loading || !!editingTarget}
                >
                  <option value="">Select a role</option>
                  <option value="sales_rep">Sales Representative</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
          )}

          {/* Period Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Period Type *
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <select
                required
                value={formData.period_type}
                onChange={(e) => setFormData({ ...formData, period_type: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
                style={{ '--tw-ring-color': '#82a365' } as any}
                disabled={loading}
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>

          {/* Period Start */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Period Start *
            </label>
            <input
              type="date"
              required
              value={formData.period_start}
              onChange={(e) => handleStartDateChange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': '#82a365' } as any}
              disabled={loading}
            />
          </div>

          {/* Period End */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Period End *
            </label>
            <input
              type="date"
              required
              value={formData.period_end}
              onChange={(e) => setFormData({ ...formData, period_end: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': '#82a365' } as any}
              disabled={loading}
            />
          </div>

          {/* Quota Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quota Amount (£) *
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="number"
                required
                min="0"
                step="1000"
                value={formData.quota_amount}
                onChange={(e) => setFormData({ ...formData, quota_amount: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
                style={{ '--tw-ring-color': '#82a365' } as any}
                placeholder="250000"
                disabled={loading}
              />
            </div>
          </div>

          {/* Commission Rate */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Commission Rate (%) *
            </label>
            <div className="relative">
              <Percent className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="number"
                required
                min="0"
                max="100"
                step="0.1"
                value={formData.commission_rate}
                onChange={(e) => setFormData({ ...formData, commission_rate: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
                style={{ '--tw-ring-color': '#82a365' } as any}
                placeholder="3.0"
                disabled={loading}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ 
                backgroundColor: '#82a365',
                ':hover': { opacity: 0.9 }
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              {loading ? (editingTarget ? 'Updating...' : 'Creating...') : (editingTarget ? 'Update Target' : 'Create Target')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};