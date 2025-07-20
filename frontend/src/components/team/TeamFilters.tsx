import { Search, Filter, Plus } from 'lucide-react';

interface TeamFiltersProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  roleFilter: string;
  setRoleFilter: (role: string) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  onInviteClick: () => void;
}

export const TeamFilters: React.FC<TeamFiltersProps> = ({
  searchTerm,
  setSearchTerm,
  roleFilter,
  setRoleFilter,
  statusFilter,
  setStatusFilter,
  onInviteClick
}) => {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0 lg:space-x-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search team members..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent\n            style={{ '--tw-ring-color': '#82a365' } as React.CSSProperties}"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent\n            style={{ '--tw-ring-color': '#82a365' } as React.CSSProperties} text-sm"
            >
              <option value="">All Roles</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="sales_rep">Sales Rep</option>
            </select>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent\n            style={{ '--tw-ring-color': '#82a365' } as React.CSSProperties} text-sm"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <button
            onClick={onInviteClick}
            className="inline-flex items-center px-4 py-2 text-white text-sm font-medium rounded-lg transition-all duration-300 shadow-lg hover:opacity-90"
            style={{ background: 'linear-gradient(to right, #82a365, #6b8950)', boxShadow: '0 10px 15px -3px rgba(56, 64, 49, 0.25)' }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Invite Member
          </button>
        </div>
      </div>
    </div>
  );
};