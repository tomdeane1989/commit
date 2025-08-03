// routes/allocation-patterns.js - Allocation Pattern Management API
import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Helper function to validate allocation percentages
const validateAllocationPercentages = (periods) => {
  const total = periods.reduce((sum, period) => sum + Number(period.allocation_percentage), 0);
  const tolerance = 0.01; // Allow for small rounding differences
  return Math.abs(total - 100) <= tolerance;
};

// Helper function to check date overlaps
const validatePeriodDates = (periods) => {
  for (let i = 0; i < periods.length; i++) {
    for (let j = i + 1; j < periods.length; j++) {
      const period1 = periods[i];
      const period2 = periods[j];
      
      const start1 = new Date(period1.start_date);
      const end1 = new Date(period1.end_date);
      const start2 = new Date(period2.start_date);
      const end2 = new Date(period2.end_date);
      
      // Check for overlap
      if ((start1 <= end2) && (end1 >= start2)) {
        return {
          valid: false,
          error: `Period "${period1.period_name}" overlaps with "${period2.period_name}"`
        };
      }
    }
  }
  return { valid: true };
};

// GET /api/allocation-patterns - List company allocation patterns
router.get('/', async (req, res) => {
  try {
    console.log(`📋 Getting allocation patterns for company ${req.user.company_id}`);
    
    const { include_inactive = 'false' } = req.query;
    
    const patterns = await prisma.allocation_patterns.findMany({
      where: {
        company_id: req.user.company_id,
        ...(include_inactive === 'false' && { is_active: true })
      },
      include: {
        allocation_periods: {
          orderBy: { sort_order: 'asc' }
        },
        created_by: {
          select: {
            first_name: true,
            last_name: true,
            email: true
          }
        },
        _count: {
          select: {
            targets: true // Count how many targets use this pattern
          }
        }
      },
      orderBy: [
        { is_active: 'desc' },
        { created_at: 'desc' }
      ]
    });

    console.log(`✅ Found ${patterns.length} allocation patterns`);

    res.json({
      success: true,
      patterns: patterns
    });

  } catch (error) {
    console.error('Error fetching allocation patterns:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/allocation-patterns - Create new allocation pattern
router.post('/', async (req, res) => {
  try {
    console.log('📝 Creating new allocation pattern:', req.body);
    
    // Only admins can create allocation patterns
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { pattern_name, description, base_period_type, periods } = req.body;

    // Validate required fields
    if (!pattern_name || !base_period_type || !periods || !Array.isArray(periods)) {
      return res.status(400).json({ 
        error: 'Missing required fields: pattern_name, base_period_type, periods' 
      });
    }

    if (periods.length === 0) {
      return res.status(400).json({ error: 'At least one period is required' });
    }

    // Validate allocation percentages total 100%
    if (!validateAllocationPercentages(periods)) {
      return res.status(400).json({ 
        error: 'Allocation percentages must total 100%' 
      });
    }

    // Validate no date overlaps
    const dateValidation = validatePeriodDates(periods);
    if (!dateValidation.valid) {
      return res.status(400).json({ error: dateValidation.error });
    }

    // Check for duplicate pattern name in company
    const existingPattern = await prisma.allocation_patterns.findFirst({
      where: {
        company_id: req.user.company_id,
        pattern_name: pattern_name,
        is_active: true
      }
    });

    if (existingPattern) {
      return res.status(400).json({ 
        error: 'An allocation pattern with this name already exists' 
      });
    }

    // Create the allocation pattern with periods in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the pattern
      const pattern = await tx.allocation_patterns.create({
        data: {
          company_id: req.user.company_id,
          created_by_id: req.user.id,
          pattern_name: pattern_name,
          description: description || null,
          base_period_type: base_period_type
        }
      });

      // Create the periods
      const createdPeriods = await tx.allocation_periods.createMany({
        data: periods.map((period, index) => ({
          allocation_pattern_id: pattern.id,
          period_name: period.period_name,
          start_date: new Date(period.start_date),
          end_date: new Date(period.end_date),
          allocation_percentage: Number(period.allocation_percentage),
          notes: period.notes || null,
          sort_order: period.sort_order || index
        }))
      });

      return pattern;
    });

    // Fetch the complete pattern with periods for response
    const completePattern = await prisma.allocation_patterns.findUnique({
      where: { id: result.id },
      include: {
        allocation_periods: {
          orderBy: { sort_order: 'asc' }
        },
        created_by: {
          select: {
            first_name: true,
            last_name: true,
            email: true
          }
        }
      }
    });

    console.log(`✅ Allocation pattern created: ${result.id}`);

    // Log activity
    await prisma.activity_log.create({
      data: {
        user_id: req.user.id,
        company_id: req.user.company_id,
        action: 'allocation_pattern_created',
        entity_type: 'allocation_pattern',
        entity_id: result.id,
        context: {
          pattern_name: pattern_name,
          base_period_type: base_period_type,
          periods_count: periods.length
        },
        success: true
      }
    });

    res.status(201).json({
      success: true,
      message: 'Allocation pattern created successfully',
      pattern: completePattern
    });

  } catch (error) {
    console.error('Error creating allocation pattern:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/allocation-patterns/:id - Update allocation pattern
router.put('/:id', async (req, res) => {
  try {
    console.log(`📝 Updating allocation pattern ${req.params.id}:`, req.body);
    
    // Only admins can update allocation patterns
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { pattern_name, description, base_period_type, periods } = req.body;
    const patternId = req.params.id;

    // Verify pattern exists and belongs to company
    const existingPattern = await prisma.allocation_patterns.findFirst({
      where: {
        id: patternId,
        company_id: req.user.company_id
      },
      include: {
        _count: {
          select: { targets: true }
        }
      }
    });

    if (!existingPattern) {
      return res.status(404).json({ error: 'Allocation pattern not found' });
    }

    // Check for past periods if pattern is in use and periods are being modified
    if (existingPattern._count.targets > 0 && periods) {
      const now = new Date();
      const existingPeriods = await prisma.allocation_periods.findMany({
        where: { allocation_pattern_id: patternId }
      });
      
      // Check if any existing periods that have already passed are being modified
      const pastPeriods = existingPeriods.filter(period => new Date(period.end_date) < now);
      
      if (pastPeriods.length > 0) {
        // Find which past periods are being changed
        const changedPastPeriods = pastPeriods.filter(pastPeriod => {
          const newPeriod = periods.find(p => 
            p.start_date === pastPeriod.start_date.toISOString().split('T')[0] &&
            p.end_date === pastPeriod.end_date.toISOString().split('T')[0]
          );
          
          if (!newPeriod) return true; // Period being removed
          
          // Check if allocation percentage changed
          return Math.abs(newPeriod.allocation_percentage - Number(pastPeriod.allocation_percentage)) > 0.01;
        });
        
        if (changedPastPeriods.length > 0) {
          const periodNames = changedPastPeriods.map(p => p.period_name).join(', ');
          return res.status(400).json({ 
            error: `Cannot modify past periods: ${periodNames}. You can only adjust current and future periods.`,
            past_periods: changedPastPeriods.map(p => ({
              period_name: p.period_name,
              end_date: p.end_date
            }))
          });
        }
      }
    }

    // Validate periods if provided
    if (periods) {
      if (!Array.isArray(periods) || periods.length === 0) {
        return res.status(400).json({ error: 'At least one period is required' });
      }

      if (!validateAllocationPercentages(periods)) {
        return res.status(400).json({ 
          error: 'Allocation percentages must total 100%' 
        });
      }

      const dateValidation = validatePeriodDates(periods);
      if (!dateValidation.valid) {
        return res.status(400).json({ error: dateValidation.error });
      }
    }

    // Check for duplicate pattern name (excluding current pattern)
    if (pattern_name && pattern_name !== existingPattern.pattern_name) {
      const duplicateName = await prisma.allocation_patterns.findFirst({
        where: {
          company_id: req.user.company_id,
          pattern_name: pattern_name,
          is_active: true,
          id: { not: patternId }
        }
      });

      if (duplicateName) {
        return res.status(400).json({ 
          error: 'An allocation pattern with this name already exists' 
        });
      }
    }

    // Update in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update the pattern
      const updatedPattern = await tx.allocation_patterns.update({
        where: { id: patternId },
        data: {
          ...(pattern_name && { pattern_name }),
          ...(description !== undefined && { description }),
          ...(base_period_type && { base_period_type }),
          updated_at: new Date()
        }
      });

      // If periods are provided, replace all periods
      if (periods) {
        // Delete existing periods
        await tx.allocation_periods.deleteMany({
          where: { allocation_pattern_id: patternId }
        });

        // Create new periods
        await tx.allocation_periods.createMany({
          data: periods.map((period, index) => ({
            allocation_pattern_id: patternId,
            period_name: period.period_name,
            start_date: new Date(period.start_date),
            end_date: new Date(period.end_date),
            allocation_percentage: Number(period.allocation_percentage),
            notes: period.notes || null,
            sort_order: period.sort_order || index
          }))
        });
      }

      return updatedPattern;
    });

    // Fetch complete updated pattern
    const completePattern = await prisma.allocation_patterns.findUnique({
      where: { id: patternId },
      include: {
        allocation_periods: {
          orderBy: { sort_order: 'asc' }
        },
        created_by: {
          select: {
            first_name: true,
            last_name: true,
            email: true
          }
        }
      }
    });

    console.log(`✅ Allocation pattern updated: ${patternId}`);

    // Log activity
    await prisma.activity_log.create({
      data: {
        user_id: req.user.id,
        company_id: req.user.company_id,
        action: 'allocation_pattern_updated',
        entity_type: 'allocation_pattern',
        entity_id: patternId,
        context: {
          pattern_name: completePattern.pattern_name,
          changes: req.body
        },
        success: true
      }
    });

    res.json({
      success: true,
      message: 'Allocation pattern updated successfully',
      pattern: completePattern
    });

  } catch (error) {
    console.error('Error updating allocation pattern:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/allocation-patterns/:id - Deactivate allocation pattern
router.delete('/:id', async (req, res) => {
  try {
    console.log(`🗑️ Deactivating allocation pattern ${req.params.id}`);
    
    // Only admins can delete allocation patterns
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const patternId = req.params.id;

    // Verify pattern exists and belongs to company
    const existingPattern = await prisma.allocation_patterns.findFirst({
      where: {
        id: patternId,
        company_id: req.user.company_id
      },
      include: {
        _count: {
          select: { targets: true }
        }
      }
    });

    if (!existingPattern) {
      return res.status(404).json({ error: 'Allocation pattern not found' });
    }

    // Check if pattern has past periods that would affect historical data
    if (existingPattern._count.targets > 0) {
      const now = new Date();
      const pastPeriods = await prisma.allocation_periods.findMany({
        where: {
          allocation_pattern_id: patternId,
          end_date: { lt: now }
        }
      });
      
      if (pastPeriods.length > 0) {
        return res.status(400).json({ 
          error: `Cannot delete allocation pattern - it has past periods that affect historical data. Deactivate it instead.`,
          past_periods_count: pastPeriods.length
        });
      }
    }

    // Soft delete by deactivating
    const deactivatedPattern = await prisma.allocation_patterns.update({
      where: { id: patternId },
      data: {
        is_active: false,
        updated_at: new Date()
      }
    });

    console.log(`✅ Allocation pattern deactivated: ${patternId}`);

    // Log activity
    await prisma.activity_log.create({
      data: {
        user_id: req.user.id,
        company_id: req.user.company_id,
        action: 'allocation_pattern_deactivated',
        entity_type: 'allocation_pattern',
        entity_id: patternId,
        context: {
          pattern_name: existingPattern.pattern_name
        },
        success: true
      }
    });

    res.json({
      success: true,
      message: 'Allocation pattern deactivated successfully'
    });

  } catch (error) {
    console.error('Error deactivating allocation pattern:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/allocation-patterns/:id/periods - Get periods for a specific pattern
router.get('/:id/periods', async (req, res) => {
  try {
    const patternId = req.params.id;
    const { year } = req.query;

    // Verify pattern exists and belongs to company
    const pattern = await prisma.allocation_patterns.findFirst({
      where: {
        id: patternId,
        company_id: req.user.company_id
      }
    });

    if (!pattern) {
      return res.status(404).json({ error: 'Allocation pattern not found' });
    }

    let periodsQuery = {
      where: { allocation_pattern_id: patternId },
      orderBy: { sort_order: 'asc' }
    };

    // Filter by year if specified
    if (year) {
      const yearNum = parseInt(year);
      periodsQuery.where = {
        ...periodsQuery.where,
        AND: [
          { start_date: { gte: new Date(`${yearNum}-01-01`) } },
          { end_date: { lte: new Date(`${yearNum}-12-31`) } }
        ]
      };
    }

    const periods = await prisma.allocation_periods.findMany(periodsQuery);

    res.json({
      success: true,
      periods: periods
    });

  } catch (error) {
    console.error('Error fetching allocation periods:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;