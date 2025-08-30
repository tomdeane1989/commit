import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Download, Search, Filter, ChevronUp, ChevronDown } from 'lucide-react';
import api from '../lib/api';

interface Deal {
  id: string;
  crm_id: string;
  deal_name: string;
  account_name?: string;
  amount: number;
  status: string;
  stage?: string;
  probability?: number;
  close_date?: string;
  created_date?: string;
  owned_by?: string;
  user?: {
    first_name?: string;
    last_name?: string;
    email: string;
  };
  commission_amount?: number;
  commission_rate?: number;
  created_at: string;
  updated_at: string;
}

interface DealsViewerModalProps {
  integrationId: string;
  integrationName: string;
  onClose: () => void;
}

const DealsViewerModal: React.FC<DealsViewerModalProps> = ({ 
  integrationId, 
  integrationName,
  onClose 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof Deal>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedDeals, setSelectedDeals] = useState<Set<string>>(new Set());

  // Fetch deals for this integration
  const { data: dealsData, isLoading, error } = useQuery({
    queryKey: ['integration-deals', integrationId],
    queryFn: async () => {
      // Get deals for this specific integration
      const response = await api.get(`/integrations/${integrationId}/deals`);
      return response.data;
    }
  });

  const deals = dealsData?.deals || [];

  // Filter deals based on search term
  const filteredDeals = deals.filter((deal: Deal) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      deal.deal_name?.toLowerCase().includes(searchLower) ||
      deal.account_name?.toLowerCase().includes(searchLower) ||
      deal.crm_id?.toLowerCase().includes(searchLower) ||
      deal.owned_by?.toLowerCase().includes(searchLower) ||
      deal.stage?.toLowerCase().includes(searchLower)
    );
  });

  // Sort deals
  const sortedDeals = [...filteredDeals].sort((a: Deal, b: Deal) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;
    
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDirection === 'asc' 
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }
    
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    }
    
    return 0;
  });

  const handleSort = (field: keyof Deal) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const toggleSelectAll = () => {
    if (selectedDeals.size === sortedDeals.length) {
      setSelectedDeals(new Set());
    } else {
      setSelectedDeals(new Set(sortedDeals.map(d => d.id)));
    }
  };

  const toggleSelectDeal = (dealId: string) => {
    const newSelected = new Set(selectedDeals);
    if (newSelected.has(dealId)) {
      newSelected.delete(dealId);
    } else {
      newSelected.add(dealId);
    }
    setSelectedDeals(newSelected);
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return '£0';
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatPercentage = (value?: number) => {
    if (!value) return '-';
    return `${value}%`;
  };

  const exportToCSV = () => {
    const headers = [
      'Deal ID',
      'Deal Name',
      'Account',
      'Amount',
      'Status',
      'Stage',
      'Probability',
      'Close Date',
      'Owner',
      'Commission',
      'Created'
    ];

    const rows = sortedDeals.map(deal => [
      deal.crm_id || deal.id,
      deal.deal_name,
      deal.account_name || '-',
      deal.amount,
      deal.status,
      deal.stage || '-',
      deal.probability || '-',
      deal.close_date ? formatDate(deal.close_date) : '-',
      deal.owned_by || '-',
      deal.commission_amount || '-',
      formatDate(deal.created_at)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${integrationName.toLowerCase()}-deals-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const SortIcon = ({ field }: { field: keyof Deal }) => {
    if (sortField !== field) {
      return <div className="w-4 h-4" />;
    }
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {integrationName} Deals
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {sortedDeals.length} deals synced
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={exportToCSV}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="px-6 py-3 border-b border-gray-200 flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search deals..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="text-sm text-gray-600">
            {selectedDeals.size > 0 && (
              <span>{selectedDeals.size} selected</span>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-red-600">Error loading deals</p>
            </div>
          ) : sortedDeals.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-gray-500">No deals found</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedDeals.size === sortedDeals.length}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('crm_id')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Deal ID</span>
                      <SortIcon field="crm_id" />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('deal_name')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Deal Name</span>
                      <SortIcon field="deal_name" />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('account_name')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Account</span>
                      <SortIcon field="account_name" />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('amount')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Amount</span>
                      <SortIcon field="amount" />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('stage')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Stage</span>
                      <SortIcon field="stage" />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('probability')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Prob</span>
                      <SortIcon field="probability" />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('close_date')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Close Date</span>
                      <SortIcon field="close_date" />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('owned_by')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Owner</span>
                      <SortIcon field="owned_by" />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('commission_amount')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Commission</span>
                      <SortIcon field="commission_amount" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedDeals.map((deal) => (
                  <tr 
                    key={deal.id}
                    className={`hover:bg-gray-50 ${selectedDeals.has(deal.id) ? 'bg-blue-50' : ''}`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedDeals.has(deal.id)}
                        onChange={() => toggleSelectDeal(deal.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-600">
                      {deal.crm_id || deal.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      {deal.deal_name}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                      {deal.account_name || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatCurrency(deal.amount)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        deal.stage === 'closed_won' || deal.stage === 'Closed Won' 
                          ? 'bg-green-100 text-green-800'
                          : deal.stage?.toLowerCase().includes('closed') 
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {deal.stage || 'Open'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                      {formatPercentage(deal.probability)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                      {formatDate(deal.close_date)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                      {deal.owned_by || deal.user?.email || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      {deal.commission_amount ? formatCurrency(deal.commission_amount) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing {sortedDeals.length} of {deals.length} deals
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default DealsViewerModal;