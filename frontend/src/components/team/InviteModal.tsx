import { useState } from 'react';
import { X, User, Mail, Building, MapPin, Users, Shield, UserCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';

interface TeamMember {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
}

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  managers: TeamMember[];
  loading: boolean;
}

interface Team {
  id: string;
  team_name: string;
  description?: string;
  team_lead?: {
    first_name: string;
    last_name: string;
  };
}

export const InviteModal: React.FC<InviteModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  managers,
  loading
}) => {
  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    role: 'sales_rep',
    is_admin: false,
    is_manager: false,
    manager_id: '',
    team_ids: [] as string[]
  });

  // Fetch available teams
  const { data: teamsData } = useQuery({
    queryKey: ['teams-for-invite'],
    queryFn: async () => {
      const response = await api.get('/teams');
      return response.data;
    },
    enabled: isOpen
  });

  const teams = teamsData?.teams || [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    
    // Reset form
    setFormData({
      email: '',
      first_name: '',
      last_name: '',
      role: 'sales_rep',
      is_admin: false,
      is_manager: false,
      manager_id: '',
      team_ids: []
    });
  };

  const handleClose = () => {
    setFormData({
      email: '',
      first_name: '',
      last_name: '',
      role: 'sales_rep',
      is_admin: false,
      is_manager: false,
      manager_id: '',
      team_ids: []
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Invite Team Member</h2>
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
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address *
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
                style={{ '--tw-ring-color': '#82a365' } as any}
                placeholder="john.doe@company.com"
                disabled={loading}
              />
            </div>
          </div>

          {/* First Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              First Name *
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                required
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
                style={{ '--tw-ring-color': '#82a365' } as any}
                placeholder="John"
                disabled={loading}
              />
            </div>
          </div>

          {/* Last Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Last Name *
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                required
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
                style={{ '--tw-ring-color': '#82a365' } as any}
                placeholder="Doe"
                disabled={loading}
              />
            </div>
          </div>

          {/* Permissions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Permissions
            </label>
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_manager}
                  onChange={(e) => {
                    const isManager = e.target.checked;
                    setFormData({ 
                      ...formData, 
                      is_manager: isManager,
                      role: isManager ? 'manager' : 'sales_rep',
                      is_admin: isManager ? formData.is_admin : false
                    });
                  }}
                  className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  disabled={loading}
                />
                <span className="flex items-center text-sm text-gray-700">
                  <UserCheck className="w-4 h-4 mr-2 text-gray-400" />
                  Manager (can view team data)
                </span>
              </label>
              {formData.is_manager && (
                <label className="flex items-center ml-6">
                  <input
                    type="checkbox"
                    checked={formData.is_admin}
                    onChange={(e) => setFormData({ ...formData, is_admin: e.target.checked })}
                    className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    disabled={loading}
                  />
                  <span className="flex items-center text-sm text-gray-700">
                    <Shield className="w-4 h-4 mr-2 text-gray-400" />
                    Administrator (can manage users and settings)
                  </span>
                </label>
              )}
            </div>
          </div>

          {/* Team Assignment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Team Assignment
            </label>
            <div className="relative">
              <Users className="absolute left-3 top-2 text-gray-400 w-4 h-4" />
              <select
                multiple
                value={formData.team_ids}
                onChange={(e) => {
                  const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
                  setFormData({ ...formData, team_ids: selectedOptions });
                }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent min-h-[100px]"
                style={{ '--tw-ring-color': '#82a365' } as any}
                disabled={loading}
              >
                {teams.map((team: Team) => (
                  <option key={team.id} value={team.id}>
                    {team.team_name} {team.team_lead && `(Lead: ${team.team_lead.first_name} ${team.team_lead.last_name})`}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Hold Ctrl/Cmd to select multiple teams
            </p>
          </div>


          {/* Manager */}
          {managers.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Manager
              </label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <select
                  value={formData.manager_id}
                  onChange={(e) => setFormData({ ...formData, manager_id: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
                style={{ '--tw-ring-color': '#82a365' } as any}
                  disabled={loading}
                >
                  <option value="">Select a manager (optional)</option>
                  {managers.map((manager) => (
                    <option key={manager.id} value={manager.id}>
                      {manager.first_name} {manager.last_name} ({manager.email})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

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
              {loading ? 'Inviting...' : 'Send Invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};