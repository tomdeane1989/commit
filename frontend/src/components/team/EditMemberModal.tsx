import { useState, useEffect } from 'react';
import { X, User, Mail, Users, UserCheck, Save, Shield } from 'lucide-react';
import { teamApi } from '../../lib/api';
import api from '../../lib/api';
import { useQuery } from '@tanstack/react-query';

interface EditMemberModalProps {
  member: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
    is_admin: boolean;
    is_manager?: boolean;
    territory: string | null;
    manager: {
      first_name: string;
      last_name: string;
      email: string;
    } | null;
    team_memberships?: Array<{
      team_id: string;
      team: {
        id: string;
        team_name: string;
      };
    }>;
  } | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (memberData: {
    id: string;
    first_name: string;
    last_name: string;
    is_admin: boolean;
    is_manager: boolean;
    manager_id: string | null;
  }) => void;
  managers?: any[];
  loading?: boolean;
}

const EditMemberModal: React.FC<EditMemberModalProps> = ({
  member,
  isOpen,
  onClose,
  onSave,
  managers,
  loading
}) => {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    is_admin: false,
    is_manager: false,
    manager_id: null as string | null,
    team_ids: [] as string[],
  });

  // Use managers prop passed from parent
  const managersData = managers || [];

  // Fetch all teams
  const { data: teamsData } = useQuery({
    queryKey: ['teams-for-assignment'],
    queryFn: async () => {
      const response = await api.get('/teams');
      return response.data;
    },
    enabled: isOpen
  });

  const teams = teamsData?.teams || [];

  // Initialize form when member changes
  useEffect(() => {
    if (member) {
      const currentTeamIds = member.team_memberships?.map(tm => tm.team.id) || [];
      setFormData({
        first_name: member.first_name || '',
        last_name: member.last_name || '',
        is_admin: member.is_admin || false,
        is_manager: member.is_manager || member.role === 'manager' || false,
        manager_id: member.manager ? 
          managersData?.find((m: any) => m.email === member.manager?.email)?.id || null : null,
        team_ids: currentTeamIds,
      });
    }
  }, [member, managersData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!member) return;

    // First, update the basic user info
    onSave({
      id: member.id,
      first_name: formData.first_name,
      last_name: formData.last_name,
      is_admin: formData.is_admin,
      is_manager: formData.is_manager,
      manager_id: formData.manager_id,
    });

    // Handle team assignments separately
    const currentTeamIds = member.team_memberships?.map(tm => tm.team.id) || [];
    const newTeamIds = formData.team_ids;
    
    // Find teams to add and remove
    const teamsToAdd = newTeamIds.filter(id => !currentTeamIds.includes(id));
    const teamsToRemove = currentTeamIds.filter(id => !newTeamIds.includes(id));

    try {
      // Add member to new teams
      for (const teamId of teamsToAdd) {
        await api.post(`/teams/${teamId}/members`, {
          user_ids: [member.id]
        });
      }

      // Remove member from teams they're no longer in
      for (const teamId of teamsToRemove) {
        await api.delete(`/teams/${teamId}/members/${member.id}`);
      }
    } catch (error) {
      console.error('Error updating team assignments:', error);
      alert('Team assignments were partially updated. Please refresh to see the current state.');
    }
  };

  if (!isOpen || !member) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Edit Team Member</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="First name"
                  required
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Last name"
                  required
                />
              </div>
            </div>
          </div>

          {/* Email (Read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="email"
                value={member.email}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                disabled
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
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
                  onChange={(e) => setFormData({ ...formData, is_manager: e.target.checked })}
                  className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="flex items-center text-sm text-gray-700">
                  <UserCheck className="w-4 h-4 mr-2 text-gray-400" />
                  Manager (can view team data)
                </span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_admin}
                  onChange={(e) => setFormData({ ...formData, is_admin: e.target.checked })}
                  className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="flex items-center text-sm text-gray-700">
                  <Shield className="w-4 h-4 mr-2 text-gray-400" />
                  Administrator (can manage users and settings)
                </span>
              </label>
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
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
              >
                {teams.map((team: any) => (
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

          {/* Reports To (Manager Assignment) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reports To
            </label>
            <div className="relative">
              <UserCheck className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <select
                value={formData.manager_id || ''}
                onChange={(e) => setFormData({ ...formData, manager_id: e.target.value || null })}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">No Manager (Independent)</option>
                {managersData?.map((manager: any) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.first_name} {manager.last_name} ({manager.email})
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Select which manager this team member reports to
            </p>
          </div>

          {/* Submit Buttons */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 flex items-center"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditMemberModal;