import { useState, useEffect } from 'react';
import { X, User, Mail, Building, UserCheck, Save } from 'lucide-react';
import { teamApi } from '../../lib/api';
import { useQuery } from '@tanstack/react-query';

interface EditMemberModalProps {
  member: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
    is_admin: boolean;
    territory: string | null;
    manager: {
      first_name: string;
      last_name: string;
      email: string;
    } | null;
  } | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (memberData: {
    id: string;
    first_name: string;
    last_name: string;
    role: string;
    territory: string;
    manager_id: string | null;
  }) => void;
}

const EditMemberModal: React.FC<EditMemberModalProps> = ({
  member,
  isOpen,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    role: 'sales_rep',
    territory: '',
    manager_id: null as string | null,
  });

  // Fetch all potential managers (users with manager role in the same company)
  const { data: managersData } = useQuery({
    queryKey: ['managers'],
    queryFn: async () => {
      const response = await teamApi.getTeam();
      // Filter for managers only
      return response.team_members?.filter((user: any) => user.role === 'manager') || [];
    },
    enabled: isOpen
  });

  // Initialize form when member changes
  useEffect(() => {
    if (member) {
      setFormData({
        first_name: member.first_name || '',
        last_name: member.last_name || '',
        role: member.role || 'sales_rep',
        territory: member.territory || '',
        manager_id: member.manager ? 
          managersData?.find((m: any) => m.email === member.manager?.email)?.id || null : null,
      });
    }
  }, [member, managersData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!member) return;

    onSave({
      id: member.id,
      first_name: formData.first_name,
      last_name: formData.last_name,
      role: formData.role,
      territory: formData.territory,
      manager_id: formData.manager_id,
    });
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

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <div className="relative">
              <UserCheck className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="sales_rep">Sales Representative</option>
                <option value="manager">Manager</option>
              </select>
            </div>
          </div>

          {/* Territory */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Territory
            </label>
            <div className="relative">
              <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={formData.territory}
                onChange={(e) => setFormData({ ...formData, territory: e.target.value })}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., North, South, Enterprise, etc."
              />
            </div>
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