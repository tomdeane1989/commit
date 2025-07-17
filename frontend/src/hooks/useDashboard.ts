import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dashboardApi } from '../lib/api';
import type { DashboardData, Deal } from '../types';

export const useDashboard = (userId?: string) => {
  return useQuery<DashboardData>({
    queryKey: ['dashboard', userId],
    queryFn: () => dashboardApi.getDashboardData(userId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10 * 60 * 1000, // Refetch every 10 minutes
  });
};

export const useUpdateDealCategory = () => {
  const queryClient = useQueryClient();

  return useMutation<Deal, Error, { dealId: string; category: string }>({
    mutationFn: ({ dealId, category }) => dashboardApi.updateDealCategory(dealId, category),
    onSuccess: (updatedDeal) => {
      // Update the dashboard cache
      queryClient.setQueryData(['dashboard'], (oldData: DashboardData | undefined) => {
        if (!oldData) return oldData;

        // Remove deal from old category
        const newDeals = { ...oldData.deals };
        Object.keys(newDeals).forEach(category => {
          newDeals[category as keyof typeof newDeals] = newDeals[category as keyof typeof newDeals].filter(
            deal => deal.id !== updatedDeal.id
          );
        });

        // Add deal to new category
        const newCategory = updatedDeal.current_category || 'pipeline';
        if (newDeals[newCategory as keyof typeof newDeals]) {
          newDeals[newCategory as keyof typeof newDeals].push(updatedDeal);
        }

        return {
          ...oldData,
          deals: newDeals,
        };
      });

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    },
    onError: (error) => {
      console.error('Failed to update deal category:', error);
    },
  });
};