// Commission Rules Management Routes
import express from 'express';
import { PrismaClient } from '@prisma/client';
import Joi from 'joi';
import { requireAdmin, attachPermissions } from '../middleware/permissions.js';
import CommissionEngine from '../services/CommissionEngine.js';

const router = express.Router();
const prisma = new PrismaClient();

// All rule management requires admin access
router.use(attachPermissions);
router.use(requireAdmin);

// Validation schemas
const createRuleSchema = Joi.object({
  name: Joi.string().min(3).max(100).required(),
  description: Joi.string().max(500).optional(),
  rule_type: Joi.string().valid(
    'base_rate', 
    'tiered', 
    'bonus', 
    'accelerator', 
    'product_rate',
    'spiff',
    'override',
    'clawback'
  ).required(),
  priority: Joi.number().min(1).max(1000).default(100),
  config: Joi.object().required(),
  conditions: Joi.object().optional(),
  calculation_type: Joi.string().valid('percentage', 'fixed', 'cumulative', 'graduated', 'replace', 'max').default('cumulative'),
  calculation_config: Joi.object().default({}),
  effective_from: Joi.date().required(),
  effective_to: Joi.date().min(Joi.ref('effective_from')).optional(),
  is_active: Joi.boolean().default(true),
  tiers: Joi.array().items(
    Joi.object({
      tier_number: Joi.number().required(),
      threshold_min: Joi.number().required(),
      threshold_max: Joi.number().optional(),
      rate: Joi.number().min(0).max(1).required(),
      type: Joi.string().valid('graduated', 'cliff', 'cumulative').default('graduated')
    })
  ).when('rule_type', {
    is: 'tiered',
    then: Joi.required(),
    otherwise: Joi.optional()
  })
});

const updateRuleSchema = createRuleSchema.keys({
  name: Joi.string().min(3).max(100).optional(),
  effective_from: Joi.date().optional()
});

/**
 * GET /api/commission-rules
 * Get all commission rules for the company
 */
router.get('/', async (req, res) => {
  try {
    const { 
      rule_type, 
      is_active, 
      include_expired = false 
    } = req.query;

    let where = {
      company_id: req.user.company_id
    };

    if (rule_type) {
      where.rule_type = rule_type;
    }

    if (is_active !== undefined) {
      where.is_active = is_active === 'true';
    }

    if (!include_expired) {
      where.OR = [
        { effective_to: null },
        { effective_to: { gte: new Date() } }
      ];
    }

    const rules = await prisma.commission_rules.findMany({
      where,
      include: {
        tiers: {
          orderBy: { tier_number: 'asc' }
        }
      },
      orderBy: [
        { priority: 'asc' },
        { created_at: 'desc' }
      ]
    });

    // Group rules by type for easier frontend consumption
    const rulesByType = {};
    rules.forEach(rule => {
      if (!rulesByType[rule.rule_type]) {
        rulesByType[rule.rule_type] = [];
      }
      rulesByType[rule.rule_type].push(rule);
    });

    res.json({
      rules,
      rules_by_type: rulesByType,
      total: rules.length,
      available_types: [
        { value: 'base_rate', label: 'Base Rate', description: 'Simple percentage of deal amount' },
        { value: 'tiered', label: 'Tiered', description: 'Different rates at different thresholds' },
        { value: 'bonus', label: 'Bonus/SPIFF', description: 'Fixed amount bonuses' },
        { value: 'accelerator', label: 'Accelerator', description: 'Multiplier based on achievement' },
        { value: 'product_rate', label: 'Product Specific', description: 'Different rates for different products' }
      ]
    });

  } catch (error) {
    console.error('Get commission rules error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/commission-rules/:id
 * Get single rule with full details
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const rule = await prisma.commission_rules.findUnique({
      where: { id },
      include: {
        tiers: {
          orderBy: { tier_number: 'asc' }
        }
      }
    });

    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    if (rule.company_id !== req.user.company_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get usage statistics
    const usageStats = await prisma.commissions.count({
      where: {
        company_id: req.user.company_id,
        notes: {
          contains: rule.id
        }
      }
    });

    res.json({
      rule,
      usage: {
        times_applied: usageStats,
        last_applied: null // Could track this separately if needed
      }
    });

  } catch (error) {
    console.error('Get rule details error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/commission-rules
 * Create a new commission rule
 */
router.post('/', async (req, res) => {
  try {
    const { error, value } = createRuleSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { tiers, ...ruleData } = value;

    // Validate rule configuration with plugin
    const plugin = CommissionEngine.plugins.get(ruleData.rule_type);
    if (plugin && plugin.validate) {
      const isValid = plugin.validate(ruleData.config);
      if (!isValid) {
        return res.status(400).json({ 
          error: `Invalid configuration for ${ruleData.rule_type} rule` 
        });
      }
    }

    // Create rule with tiers if applicable
    const rule = await prisma.commission_rules.create({
      data: {
        ...ruleData,
        company_id: req.user.company_id,
        tiers: tiers ? {
          create: tiers
        } : undefined
      },
      include: {
        tiers: true
      }
    });

    // Log activity
    await prisma.activity_log.create({
      data: {
        user_id: req.user.id,
        company_id: req.user.company_id,
        action: 'commission_rule_created',
        entity_type: 'commission_rule',
        entity_id: rule.id,
        after_state: rule,
        success: true
      }
    });

    res.status(201).json({
      success: true,
      rule,
      message: 'Commission rule created successfully'
    });

  } catch (error) {
    console.error('Create rule error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/commission-rules/:id
 * Update an existing rule
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = updateRuleSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const existingRule = await prisma.commission_rules.findUnique({
      where: { id },
      include: { tiers: true }
    });

    if (!existingRule) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    if (existingRule.company_id !== req.user.company_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { tiers, ...updateData } = value;

    // Update rule
    const updatedRule = await prisma.commission_rules.update({
      where: { id },
      data: updateData
    });

    // Update tiers if provided
    if (tiers && value.rule_type === 'tiered') {
      // Delete existing tiers
      await prisma.commission_tiers.deleteMany({
        where: { rule_id: id }
      });

      // Create new tiers
      await prisma.commission_tiers.createMany({
        data: tiers.map(tier => ({
          ...tier,
          rule_id: id
        }))
      });
    }

    // Get updated rule with tiers
    const finalRule = await prisma.commission_rules.findUnique({
      where: { id },
      include: { tiers: true }
    });

    // Log activity
    await prisma.activity_log.create({
      data: {
        user_id: req.user.id,
        company_id: req.user.company_id,
        action: 'commission_rule_updated',
        entity_type: 'commission_rule',
        entity_id: id,
        before_state: existingRule,
        after_state: finalRule,
        success: true
      }
    });

    res.json({
      success: true,
      rule: finalRule,
      message: 'Commission rule updated successfully'
    });

  } catch (error) {
    console.error('Update rule error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/commission-rules/:id
 * Soft delete a rule (deactivate)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { hard_delete = false } = req.query;

    const rule = await prisma.commission_rules.findUnique({
      where: { id }
    });

    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    if (rule.company_id !== req.user.company_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (hard_delete === 'true') {
      // Hard delete (remove from database)
      await prisma.commission_rules.delete({
        where: { id }
      });

      res.json({
        success: true,
        message: 'Commission rule permanently deleted'
      });
    } else {
      // Soft delete (deactivate)
      const updatedRule = await prisma.commission_rules.update({
        where: { id },
        data: {
          is_active: false,
          effective_to: new Date()
        }
      });

      res.json({
        success: true,
        rule: updatedRule,
        message: 'Commission rule deactivated'
      });
    }

    // Log activity
    await prisma.activity_log.create({
      data: {
        user_id: req.user.id,
        company_id: req.user.company_id,
        action: hard_delete === 'true' ? 'commission_rule_deleted' : 'commission_rule_deactivated',
        entity_type: 'commission_rule',
        entity_id: id,
        before_state: rule,
        success: true
      }
    });

  } catch (error) {
    console.error('Delete rule error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/commission-rules/test
 * Test rules against a sample deal
 */
router.post('/test', async (req, res) => {
  try {
    const { deal, rule_ids } = req.body;

    if (!deal || !deal.amount) {
      return res.status(400).json({ error: 'Deal data required for testing' });
    }

    let rules;
    if (rule_ids && rule_ids.length > 0) {
      // Test specific rules
      rules = await prisma.commission_rules.findMany({
        where: {
          id: { in: rule_ids },
          company_id: req.user.company_id
        },
        include: { tiers: true }
      });
    } else {
      // Test all active rules
      rules = await prisma.commission_rules.findMany({
        where: {
          company_id: req.user.company_id,
          is_active: true
        },
        include: { tiers: true }
      });
    }

    // Create test context
    const context = {
      user: req.user,
      company: { id: req.user.company_id },
      userSalesTotal: deal.user_sales_total || 0,
      attainmentPercentage: deal.attainment_percentage || 0
    };

    // Test calculation
    const result = await CommissionEngine.calculateCommission(
      deal,
      rules,
      context
    );

    res.json({
      success: true,
      test_deal: deal,
      rules_tested: rules.length,
      result,
      breakdown: result.applied_rules.map(r => {
        const rule = rules.find(ru => ru.id === r.rule_id);
        return {
          rule_name: r.rule_name,
          rule_type: rule?.rule_type,
          priority: rule?.priority,
          commission: r.commission_amount
        };
      })
    });

  } catch (error) {
    console.error('Test rules error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/commission-rules/bulk-create
 * Create multiple rules from templates
 */
router.post('/bulk-create', async (req, res) => {
  try {
    const { template_type } = req.body;

    let templates = [];

    switch (template_type) {
      case 'standard_tiered':
        templates = [
          {
            name: 'Standard Tiered Commission',
            description: 'Progressive commission rates based on achievement',
            rule_type: 'tiered',
            priority: 100,
            config: {
              type: 'graduated'
            },
            calculation_type: 'cumulative',
            calculation_config: {},
            effective_from: new Date(),
            is_active: true,
            tiers: [
              { tier_number: 1, threshold_min: 0, threshold_max: 50000, rate: 0.03, type: 'graduated' },
              { tier_number: 2, threshold_min: 50000, threshold_max: 100000, rate: 0.05, type: 'graduated' },
              { tier_number: 3, threshold_min: 100000, threshold_max: 200000, rate: 0.07, type: 'graduated' },
              { tier_number: 4, threshold_min: 200000, threshold_max: null, rate: 0.10, type: 'graduated' }
            ]
          }
        ];
        break;

      case 'accelerator_package':
        templates = [
          {
            name: 'Quarterly Accelerator',
            description: 'Bonus multiplier for exceeding quota',
            rule_type: 'accelerator',
            priority: 200,
            config: {
              threshold: 100,
              multiplier: 1.5
            },
            conditions: {
              all: [
                {
                  fact: 'attainmentPercentage',
                  operator: 'greaterThanInclusive',
                  value: 100
                }
              ]
            },
            calculation_type: 'replace',
            calculation_config: {},
            effective_from: new Date(),
            is_active: true
          },
          {
            name: 'New Business Bonus',
            description: 'Extra commission for new accounts',
            rule_type: 'bonus',
            priority: 150,
            config: {
              amount: 500
            },
            conditions: {
              all: [
                {
                  fact: 'deal',
                  path: '$.is_new_business',
                  operator: 'equal',
                  value: true
                }
              ]
            },
            calculation_type: 'cumulative',
            calculation_config: {},
            effective_from: new Date(),
            is_active: true
          }
        ];
        break;

      default:
        return res.status(400).json({ error: 'Invalid template type' });
    }

    // Create all templates
    const createdRules = [];
    for (const template of templates) {
      const { tiers, ...ruleData } = template;
      
      const rule = await prisma.commission_rules.create({
        data: {
          ...ruleData,
          company_id: req.user.company_id,
          tiers: tiers ? {
            create: tiers
          } : undefined
        },
        include: {
          tiers: true
        }
      });
      
      createdRules.push(rule);
    }

    res.json({
      success: true,
      rules: createdRules,
      message: `Created ${createdRules.length} commission rules from template`
    });

  } catch (error) {
    console.error('Bulk create error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/commission-rules/templates
 * Get available rule templates
 */
router.get('/templates', async (req, res) => {
  const templates = [
    {
      id: 'standard_tiered',
      name: 'Standard Tiered Commission',
      description: 'Progressive rates: 3% (0-50k), 5% (50-100k), 7% (100-200k), 10% (200k+)',
      preview: {
        tiers: [
          { range: '£0 - £50,000', rate: '3%' },
          { range: '£50,000 - £100,000', rate: '5%' },
          { range: '£100,000 - £200,000', rate: '7%' },
          { range: '£200,000+', rate: '10%' }
        ]
      }
    },
    {
      id: 'accelerator_package',
      name: 'Accelerator Package',
      description: 'Includes quarterly accelerator (1.5x at 100% attainment) and new business bonus (£500)',
      preview: {
        rules: [
          { name: 'Quarterly Accelerator', type: 'Multiplier', value: '1.5x at 100%+ attainment' },
          { name: 'New Business Bonus', type: 'Fixed', value: '£500 per new account' }
        ]
      }
    },
    {
      id: 'enterprise_sales',
      name: 'Enterprise Sales Package',
      description: 'Higher rates for large deals with accelerators',
      preview: {
        base_rate: '8%',
        large_deal_bonus: '£2,000 for deals over £100k',
        accelerator: '2x commission at 120% attainment'
      }
    },
    {
      id: 'product_specific',
      name: 'Product-Based Commission',
      description: 'Different rates for different product categories',
      preview: {
        products: [
          { category: 'Software', rate: '10%' },
          { category: 'Services', rate: '15%' },
          { category: 'Hardware', rate: '5%' }
        ]
      }
    }
  ];

  res.json({
    templates,
    total: templates.length
  });
});

export default router;