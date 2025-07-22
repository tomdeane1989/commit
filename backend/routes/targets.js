// routes/targets.js
import express from 'express';
import { PrismaClient } from '@prisma/client';
import Joi from 'joi';
import { isAdmin, isManager, canManageTeam } from '../middleware/roleHelpers.js';

const router = express.Router();
const prisma = new PrismaClient();

// Helper function to calculate pro-rated quota for mid-year hires
const calculateProRatedQuota = (baseQuota, hireDate, periodStart, periodEnd) => {
  const hireDateObj = new Date(hireDate);
  const periodStartObj = new Date(periodStart);
  const periodEndObj = new Date(periodEnd);
  
  // If hired before the period starts, use full quota
  if (hireDateObj <= periodStartObj) {
    return baseQuota;
  }
  
  // If hired after the period ends, no quota
  if (hireDateObj > periodEndObj) {
    return 0;
  }
  
  // Calculate pro-rated quota based on remaining time in period
  const totalPeriodDays = (periodEndObj - periodStartObj) / (1000 * 60 * 60 * 24);
  const remainingPeriodDays = (periodEndObj - hireDateObj) / (1000 * 60 * 60 * 24);
  
  const proRatedQuota = baseQuota * (remainingPeriodDays / totalPeriodDays);
  
  return Math.round(proRatedQuota);
};

const targetSchema = Joi.object({
  user_id: Joi.string().optional(),
  period_type: Joi.string().valid('monthly', 'quarterly', 'annual').required(),
  period_start: Joi.date().required(),
  period_end: Joi.date().required(),
  quota_amount: Joi.number().positive().required(),
  commission_rate: Joi.number().min(0).max(1).required()
});

// Get all targets
router.get('/', async (req, res) => {
  try {
    const { user_id, active_only = 'false' } = req.query;
    
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const where = {
      // Admin/Manager can see all targets in their company if no user_id specified
      ...(user_id ? { user_id } : (req.user.role === 'admin' || req.user.role === 'manager') ? { 
        user: { company_id: req.user.company_id } 
      } : { user_id: req.user.id }),
      ...(active_only === 'true' && { is_active: true })
    };

    // Check permissions
    if (user_id && user_id !== req.user.id && !canManageTeam(req.user)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const targets = await prisma.targets.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    console.log(`GET targets: Found ${targets.length} targets for user ${req.user.email}`);

    res.json({
      targets,
      success: true
    });
  } catch (error) {
    console.error('Get targets error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create target
router.post('/', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Only managers (including admins) can create targets
    if (!canManageTeam(req.user)) {
      return res.status(403).json({ error: 'Only managers can create targets' });
    }

    const { target_type, user_id, role, period_type, period_start, period_end, quota_amount, commission_rate, commission_payment_schedule, distribution_method, wizard_data } = req.body;

    console.log('Create target request data:', JSON.stringify(req.body, null, 2));
    console.log('User making request:', req.user.email, req.user.role, req.user.is_admin ? '(ADMIN)' : '');

    // Validate required fields
    if (!target_type || !period_type || !period_start || !period_end || !quota_amount || !commission_rate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (target_type === 'individual' && !user_id) {
      return res.status(400).json({ error: 'User ID required for individual targets' });
    }

    if (target_type === 'role' && !role) {
      return res.status(400).json({ error: 'Role required for role-based targets' });
    }

    let targetUsers = [];

    if (target_type === 'individual') {
      // Validate user exists and is in same company
      const user = await prisma.users.findUnique({
        where: { 
          id: user_id,
          company_id: req.user.company_id
        }
      });

      if (!user) {
        return res.status(400).json({ error: 'User not found' });
      }

      targetUsers = [user];
    } else {
      // Get all users with the specified role
      targetUsers = await prisma.users.findMany({
        where: {
          company_id: req.user.company_id,
          role: role,
          is_active: true
        }
      });

      if (targetUsers.length === 0) {
        return res.status(400).json({ error: `No active users found with role: ${role}` });
      }
    }

    const createdTargets = [];
    const skippedUsers = [];

    console.log(`Starting target creation for ${targetUsers.length} users`);

    // Create targets for each user
    for (const targetUser of targetUsers) {
      // Check for overlapping periods
      const overlapping = await prisma.targets.findFirst({
        where: {
          user_id: targetUser.id,
          is_active: true,
          OR: [
            {
              period_start: { lte: new Date(period_end) },
              period_end: { gte: new Date(period_start) }
            }
          ]
        }
      });

      if (overlapping) {
        console.log(`Skipping overlapping target for user ${targetUser.first_name} ${targetUser.last_name}`);
        skippedUsers.push({
          user_id: targetUser.id,
          name: `${targetUser.first_name} ${targetUser.last_name}`,
          email: targetUser.email,
          role: targetUser.role,
          existing_target: {
            id: overlapping.id,
            period_start: overlapping.period_start.toISOString().split('T')[0],
            period_end: overlapping.period_end.toISOString().split('T')[0],
            quota_amount: overlapping.quota_amount,
            commission_rate: overlapping.commission_rate,
            period_type: overlapping.period_type
          },
          proposed_target: {
            period_start: period_start,
            period_end: period_end,
            quota_amount: quota_amount,
            commission_rate: commission_rate,
            period_type: period_type,
            role: target_type === 'role' ? role : null
          }
        });
        console.log(`Added to skippedUsers array. Total skipped: ${skippedUsers.length}`);
        continue;
      }

      // Deactivate any existing active targets for this user (no conflicts found)
      await prisma.targets.updateMany({
        where: {
          user_id: targetUser.id,
          is_active: true
        },
        data: {
          is_active: false
        }
      });

      // Calculate pro-rated quota if user was hired mid-period
      let finalQuotaAmount = quota_amount;
      let proRatedInfo = null;
      
      if (targetUser.hire_date) {
        const proRatedQuota = calculateProRatedQuota(
          quota_amount, 
          targetUser.hire_date, 
          period_start, 
          period_end
        );
        
        if (proRatedQuota !== quota_amount) {
          finalQuotaAmount = proRatedQuota;
          proRatedInfo = {
            original_quota: quota_amount,
            pro_rated_quota: proRatedQuota,
            hire_date: targetUser.hire_date,
            reason: 'Mid-year hire pro-rating applied'
          };
        }
      }

      // Create new target
      const target = await prisma.targets.create({
        data: {
          user_id: targetUser.id,
          company_id: req.user.company_id,
          period_type,
          period_start: new Date(period_start),
          period_end: new Date(period_end),
          quota_amount: finalQuotaAmount,
          commission_rate,
          commission_payment_schedule: commission_payment_schedule || 'monthly',
          is_active: true,
          role: target_type === 'role' ? role : null
        }
      });

      createdTargets.push(target);

      // Log activity
      await prisma.activity_log.create({
        data: {
          user_id: req.user.id,
          company_id: req.user.company_id,
          action: 'target_created',
          entity_type: 'target',
          entity_id: target.id,
          context: { 
            target_type,
            target_user: `${targetUser.first_name} ${targetUser.last_name}`,
            quota_amount: target.quota_amount,
            original_quota: quota_amount,
            period_start: target.period_start,
            period_end: target.period_end,
            ...(proRatedInfo && { pro_rated: true, pro_rated_info: proRatedInfo }),
            ...(distribution_method && { distribution_method }),
            ...(wizard_data && { created_via_wizard: true })
          },
          success: true
        }
      });
    }

    console.log(`Loop completed. Created ${createdTargets.length} targets, skipped ${skippedUsers.length} users`);
    
    if (createdTargets.length === 0) {
      console.log('No targets created, returning 400 error with conflict data');
      return res.status(400).json({
        error: 'No targets created. All users already have overlapping active targets for the specified period.',
        skipped_users: skippedUsers,
        message: 'Try selecting a different time period that doesn\'t overlap with existing targets.'
      });
    }

    // Check if any targets were pro-rated
    const proRatedTargets = createdTargets.filter(target => target.pro_rated_info);
    
    res.status(201).json({
      targets: createdTargets,
      message: `Created ${createdTargets.length} target${createdTargets.length !== 1 ? 's' : ''} successfully`,
      ...(skippedUsers.length > 0 && {
        warning: `${skippedUsers.length} user${skippedUsers.length !== 1 ? 's' : ''} skipped due to overlapping targets`,
        skipped_users: skippedUsers
      }),
      ...(proRatedTargets.length > 0 && {
        pro_rated_count: proRatedTargets.length,
        pro_rated_info: `${proRatedTargets.length} target${proRatedTargets.length !== 1 ? 's' : ''} pro-rated for mid-year hires`
      })
    });
  } catch (error) {
    console.error('Create target error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update target
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = targetSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const existingTarget = await prisma.targets.findUnique({
      where: { id }
    });

    if (!existingTarget) {
      return res.status(404).json({ error: 'Target not found' });
    }

    if (existingTarget.user_id !== req.user.id && !canManageTeam(req.user)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const target = await prisma.targets.update({
      where: { id },
      data: value
    });

    // Log activity
    await prisma.activity_log.create({
      data: {
        user_id: req.user.id,
        company_id: req.user.company_id,
        action: 'target_updated',
        entity_type: 'target',
        entity_id: target.id,
        context: { quota_amount: target.quota_amount },
        success: true
      }
    });

    res.json(target);
  } catch (error) {
    console.error('Update target error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Deactivate target
router.patch('/:id/deactivate', async (req, res) => {
  try {
    const { id } = req.params;

    const existingTarget = await prisma.targets.findUnique({
      where: { id }
    });

    if (!existingTarget) {
      return res.status(404).json({ error: 'Target not found' });
    }

    if (existingTarget.user_id !== req.user.id && !canManageTeam(req.user)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const target = await prisma.targets.update({
      where: { id },
      data: { is_active: false }
    });

    // Log activity
    await prisma.activity_log.create({
      data: {
        user_id: req.user.id,
        company_id: req.user.company_id,
        action: 'target_deactivated',
        entity_type: 'target',
        entity_id: target.id,
        context: {},
        success: true
      }
    });

    res.json(target);
  } catch (error) {
    console.error('Deactivate target error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Resolve conflicts by replacing existing targets
router.post('/resolve-conflicts', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Only managers (including admins) can resolve conflicts
    if (!canManageTeam(req.user)) {
      return res.status(403).json({ error: 'Only managers can resolve conflicts' });
    }

    const { conflicts, wizard_data } = req.body;
    
    console.log('Resolve conflicts called with:', JSON.stringify(req.body, null, 2));
    
    if (!conflicts || !Array.isArray(conflicts)) {
      return res.status(400).json({ error: 'Conflicts array is required' });
    }

    const resolvedTargets = [];
    const errors = [];

    console.log(`Starting conflict resolution for ${conflicts.length} conflicts`);

    for (const conflict of conflicts) {
      const { user_id, action, existing_target_id, proposed_target } = conflict;
      
      console.log(`Processing conflict for user ${user_id}, action: ${action}`);
      
      if (action === 'replace') {
        try {
          console.log(`  - Deactivating existing target: ${existing_target_id}`);
          // Deactivate existing target
          await prisma.targets.update({
            where: { id: existing_target_id },
            data: { is_active: false }
          });

          console.log(`  - Fetching user data for: ${user_id}`);
          // Calculate pro-rated quota if needed
          const targetUser = await prisma.users.findUnique({
            where: { id: user_id }
          });

          let finalQuotaAmount = proposed_target.quota_amount;
          let proRatedInfo = null;
          
          if (targetUser?.hire_date) {
            const proRatedQuota = calculateProRatedQuota(
              proposed_target.quota_amount,
              targetUser.hire_date,
              proposed_target.period_start,
              proposed_target.period_end
            );
            
            if (proRatedQuota !== proposed_target.quota_amount) {
              finalQuotaAmount = proRatedQuota;
              proRatedInfo = {
                original_quota: proposed_target.quota_amount,
                pro_rated_quota: proRatedQuota,
                hire_date: targetUser.hire_date,
                reason: 'Mid-year hire pro-rating applied'
              };
            }
          }

          console.log(`  - Creating new target for user ${user_id} with quota ${finalQuotaAmount}`);
          // Create new target
          const newTarget = await prisma.targets.create({
            data: {
              user_id: user_id,
              company_id: req.user.company_id,
              period_type: proposed_target.period_type,
              period_start: new Date(proposed_target.period_start),
              period_end: new Date(proposed_target.period_end),
              quota_amount: finalQuotaAmount,
              commission_rate: proposed_target.commission_rate,
              commission_payment_schedule: proposed_target.commission_payment_schedule || 'monthly',
              is_active: true,
              role: proposed_target.role || null
            }
          });

          console.log(`  - Successfully created target: ${newTarget.id}`);
          resolvedTargets.push(newTarget);

          // Log activity
          await prisma.activity_log.create({
            data: {
              user_id: req.user.id,
              company_id: req.user.company_id,
              action: 'target_conflict_resolved',
              entity_type: 'target',
              entity_id: newTarget.id,
              context: {
                action: 'replace',
                replaced_target_id: existing_target_id,
                user_name: targetUser ? `${targetUser.first_name} ${targetUser.last_name}` : 'Unknown',
                quota_amount: newTarget.quota_amount,
                original_quota: proposed_target.quota_amount,
                ...(proRatedInfo && { pro_rated: true, pro_rated_info: proRatedInfo })
              },
              success: true
            }
          });

        } catch (error) {
          console.error(`Error resolving conflict for user ${user_id}:`, error);
          errors.push({
            user_id,
            error: 'Failed to resolve conflict',
            details: error.message
          });
        }
      } else if (action === 'keep') {
        // Just log that we kept the existing target
        await prisma.activity_log.create({
          data: {
            user_id: req.user.id,
            company_id: req.user.company_id,
            action: 'target_conflict_resolved',
            entity_type: 'target',
            entity_id: existing_target_id,
            context: {
              action: 'keep',
              user_id: user_id,
              message: 'Kept existing target, rejected proposed target'
            },
            success: true
          }
        });
      }
    }

    const proRatedTargets = resolvedTargets.filter(target => target.pro_rated_info);

    console.log(`Conflict resolution completed: ${resolvedTargets.length} targets created, ${errors.length} errors`);

    res.status(201).json({
      message: `Resolved ${conflicts.length} conflict${conflicts.length !== 1 ? 's' : ''} successfully`,
      resolved_targets: resolvedTargets,
      created_count: resolvedTargets.length,
      errors: errors,
      ...(proRatedTargets.length > 0 && {
        pro_rated_count: proRatedTargets.length,
        pro_rated_info: `${proRatedTargets.length} target${proRatedTargets.length !== 1 ? 's' : ''} pro-rated for mid-year hires`
      })
    });

  } catch (error) {
    console.error('Resolve conflicts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;