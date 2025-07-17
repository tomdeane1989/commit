import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dealsApi } from '../lib/api';
import type { Deal, DealsFilter } from '../types';

export const useDeals = (filters?: DealsFilter) => {
  return useQuery({
    queryKey: ['deals', filters],
    queryFn: () => dealsApi.getDeals(filters),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

export const useCreateDeal = () => {
  const queryClient = useQueryClient();

  return useMutation<Deal, Error, Partial<Deal>>({
    mutationFn: (dealData) => dealsApi.createDeal(dealData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};

export const useUpdateDeal = () => {
  const queryClient = useQueryClient();

  return useMutation<Deal, Error, { dealId: string; dealData: Partial<Deal> }>({
    mutationFn: ({ dealId, dealData }) => dealsApi.updateDeal(dealId, dealData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};

export const useDeleteDeal = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (dealId) => dealsApi.deleteDeal(dealId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};