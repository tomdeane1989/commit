import { useState } from 'react';
import { User, Mail, Building, Calendar, MoreVertical, Edit, Trash2, UserCheck, UserX } from 'lucide-react';

interface TeamMember {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  hire_date: string | null;
  territory: string | null;
  created_at: string;
  manager: {
    first_name: string;
    last_name: string;
    email: string;
  } | null;
  reports_count: number;
  performance: {
    open_deals_amount: number;
    current_quota: number;
    total_commissions: number;
    open_deals_count: number;
  };
}

interface TeamMemberCardProps {
  member: TeamMember;
  onEdit: (member: TeamMember) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, active: boolean) => void;
}

export const TeamMemberCard: React.FC<TeamMemberCardProps> = ({
  member,
  onEdit,
  onDelete,
  onToggleActive
}) => {
  const [showActions, setShowActions] = useState(false);

  const quotaProgress = member.performance.current_quota > 0
    ? (member.performance.open_deals_amount / member.performance.current_quota) * 100
    : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow relative">
      {/* Actions Menu */}
      <div className="absolute top-4 right-4">
        <button
          onClick={() => setShowActions(!showActions)}
          className="p-1 text-gray-400 hover:text-gray-600 rounded-md"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
        
        {showActions && (
          <div className="absolute right-0 top-8 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 min-w-40">
            <button
              onClick={() => {
                onEdit(member);
                setShowActions(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center"
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit Member
            </button>
            <button
              onClick={() => {
                onToggleActive(member.id, !member.is_active);
                setShowActions(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center"
            >
              {member.is_active ? (
                <>
                  <UserX className="w-4 h-4 mr-2" />
                  Deactivate
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4 mr-2" />
                  Activate
                </>
              )}
            </button>
            <button
              onClick={() => {
                onDelete(member.id);
                setShowActions(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Member Info */}
      <div className="flex items-start space-x-4">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
          member.is_active ? 'bg-indigo-100' : 'bg-gray-100'
        }`}>
          <User className={`w-6 h-6 ${member.is_active ? 'text-indigo-600' : 'text-gray-400'}`} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {member.first_name} {member.last_name}
            </h3>
            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
              member.is_active
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800'
            }`}>
              {member.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          
          <div className="mt-1 space-y-1">
            <div className="flex items-center text-sm text-gray-600">
              <Mail className="w-4 h-4 mr-2" />
              {member.email}
            </div>
            
            <div className="flex items-center text-sm text-gray-600">
              <Building className="w-4 h-4 mr-2" />
              <span className="capitalize">{member.role}</span>
              {member.territory && (
                <span className="ml-2 px-2 py-1 bg-gray-100 text-xs rounded">
                  {member.territory}
                </span>
              )}
            </div>
            
            {member.hire_date && (
              <div className="flex items-center text-sm text-gray-600">
                <Calendar className="w-4 h-4 mr-2" />
                Hired {new Date(member.hire_date).toLocaleDateString('en-GB')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="mt-4 space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500">Open Deals</p>
            <p className="text-sm font-semibold text-gray-900">
              {new Intl.NumberFormat('en-GB', {
                style: 'currency',
                currency: 'GBP',
                minimumFractionDigits: 0
              }).format(member.performance.open_deals_amount)}
            </p>
          </div>
          
          <div>
            <p className="text-xs text-gray-500">Commissions</p>
            <p className="text-sm font-semibold text-gray-900">
              {new Intl.NumberFormat('en-GB', {
                style: 'currency',
                currency: 'GBP',
                minimumFractionDigits: 0
              }).format(member.performance.total_commissions)}
            </p>
          </div>
        </div>

        {/* Quota Progress */}
        {member.performance.current_quota > 0 && (
          <div>
            <div className="flex justify-between items-center mb-1">
              <p className="text-xs text-gray-500">Quota Progress</p>
              <p className="text-xs text-gray-600">{quotaProgress.toFixed(1)}%</p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  quotaProgress >= 100
                    ? 'bg-green-500'
                    : quotaProgress >= 75
                    ? 'bg-yellow-500'
                    : 'bg-indigo-500'
                }`}
                style={{ width: `${Math.min(quotaProgress, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Manager Info */}
        {member.manager && (
          <div>
            <p className="text-xs text-gray-500">Reports to</p>
            <p className="text-sm text-gray-700">
              {member.manager.first_name} {member.manager.last_name}
            </p>
          </div>
        )}

        {/* Reports Count */}
        {member.reports_count > 0 && (
          <div>
            <p className="text-xs text-gray-500">Direct Reports</p>
            <p className="text-sm text-gray-700">{member.reports_count} team members</p>
          </div>
        )}
      </div>
    </div>
  );
};