import React, { useState } from 'react';
import { QuotaWizard } from './QuotaWizard';

interface Team {
  team_id: string;
  team_name: string;
  team_description?: string;
  members: Array<{
    id: string;
    first_name: string;
    last_name: string;
    role: string;
    sub_role?: string;
    team_role_override?: string;
    team_sub_role_override?: string;
    team_name: string;
    is_active: boolean;
    hire_date?: string;
    joined_date?: string;
  }>;
}

interface TeamQuotaWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  onResolveConflicts: (data: any) => void;
  teams: Team[];
  loading: boolean;
  onConflictDetected?: (conflicts: any[]) => void;
  mutationError?: any;
  mutationData?: any;
}

export const TeamQuotaWizard: React.FC<TeamQuotaWizardProps> = ({
  isOpen,
  onClose,
  onSubmit,
  onResolveConflicts,
  teams,
  loading,
  onConflictDetected,
  mutationError,
  mutationData
}) => {
  // Transform teams data for the quota wizard
  const enhancedTeamMembers = teams.flatMap(team => 
    team.members.map(member => ({
      id: member.id,
      first_name: member.first_name,
      last_name: member.last_name,
      role: `${member.team_role_override || member.role} (${team.team_name})`, // Add team context to role
      sub_role: member.team_sub_role_override || member.sub_role,
      team_name: team.team_name,
      team_id: team.team_id,
      is_active: member.is_active,
      hire_date: member.hire_date || member.joined_date
    }))
  );

  // Enhanced onSubmit that includes team context
  const handleSubmit = (data: any) => {
    // Add team context to the submission data
    const enhancedData = {
      ...data,
      teams: teams.map(team => ({
        team_id: team.team_id,
        team_name: team.team_name,
        member_count: team.members.length
      })),
      is_team_based: true
    };
    
    console.log('Team-based quota wizard data:', enhancedData);
    onSubmit(enhancedData);
  };

  return (
    <QuotaWizard
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      onResolveConflicts={onResolveConflicts}
      teamMembers={enhancedTeamMembers}
      loading={loading}
      onConflictDetected={onConflictDetected}
      mutationError={mutationError}
      mutationData={mutationData}
    />
  );
};