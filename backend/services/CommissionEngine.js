import { Engine } from 'json-rules-engine';
import { Decimal } from 'decimal.js';
import { PrismaClient } from '@prisma/client';
import { generateTargetName } from '../utils/targetNaming.js';

const prisma = new PrismaClient();

/**
 * CommissionEngine - Modular commission calculation system
 * Uses json-rules-engine for flexible rule evaluation
 * Supports plugins for different commission types
 */
class CommissionEngine {
  constructor() {
    this.plugins = new Map();
    this.engine = new Engine();
    this.initializeBasePlugins();
  }

  /**
   * Initialize built-in commission plugins
   */
  initializeBasePlugins() {
    // Base rate plugin (simple percentage)
    this.registerPlugin('base_rate', {
      name: 'Base Rate Commission',
      calculate: async (context) => {
        const { deal, config } = context;
        const rate = new Decimal(config.rate || 0.05);
        const amount = new Decimal(deal.amount);
        return amount.mul(rate).toFixed(2);
      },
      validate: (config) => {
        return config.rate >= 0 && config.rate <= 1;
      }
    });

    // Tiered commission plugin
    this.registerPlugin('tiered', {
      name: 'Tiered Commission',
      calculate: async (context) => {
        const { deal, config, userSalesTotal } = context;
        const amount = new Decimal(deal.amount);
        const totalSales = new Decimal(userSalesTotal || 0).plus(amount);
        
        let commission = new Decimal(0);
        let previousThreshold = new Decimal(0);
        
        for (const tier of config.tiers) {
          const tierMin = new Decimal(tier.threshold_min);
          const tierMax = tier.threshold_max ? new Decimal(tier.threshold_max) : totalSales;
          const tierRate = new Decimal(tier.rate);
          
          if (totalSales.gt(tierMin)) {
            const tierAmount = Decimal.min(totalSales, tierMax).minus(Decimal.max(previousThreshold, tierMin));
            
            if (config.type === 'graduated') {
              // Graduated: each tier applies to its portion
              commission = commission.plus(tierAmount.mul(tierRate));
            } else if (config.type === 'cliff') {
              // Cliff: entire amount at highest tier rate
              commission = amount.mul(tierRate);
            }
          }
          
          previousThreshold = tierMax;
        }
        
        return commission.toFixed(2);
      },
      validate: (config) => {
        return config.tiers && config.tiers.length > 0;
      }
    });

    // Bonus/SPIFF plugin (fixed amount bonuses)
    this.registerPlugin('bonus', {
      name: 'Bonus/SPIFF',
      calculate: async (context) => {
        const { deal, config } = context;
        
        // Check if deal meets bonus criteria
        if (config.conditions) {
          const meetsConditions = await this.evaluateConditions(config.conditions, deal);
          if (!meetsConditions) return '0';
        }
        
        return new Decimal(config.amount || 0).toFixed(2);
      },
      validate: (config) => {
        return config.amount >= 0;
      }
    });

    // Accelerator plugin (multiplier based on achievement)
    this.registerPlugin('accelerator', {
      name: 'Accelerator',
      calculate: async (context) => {
        const { deal, config, attainmentPercentage, userSalesTotal } = context;
        const dealAmount = new Decimal(deal.amount);
        const baseRate = new Decimal(config.base_rate || config.rate || 0.05);

        // Find applicable accelerator tier
        let applicableMultiplier = new Decimal(1);

        if (config.accelerators && Array.isArray(config.accelerators)) {
          // Sort accelerators by threshold descending
          const sortedAccelerators = config.accelerators
            .sort((a, b) => b.threshold - a.threshold);

          // Find highest tier met
          for (const acc of sortedAccelerators) {
            if (attainmentPercentage >= acc.threshold) {
              applicableMultiplier = new Decimal(acc.multiplier);
              console.log(`📈 Accelerator applied: ${attainmentPercentage}% attainment >= ${acc.threshold}% threshold = ${acc.multiplier}x multiplier`);
              break;
            }
          }
        } else if (config.threshold && config.multiplier) {
          // Legacy format support
          if (attainmentPercentage >= config.threshold) {
            applicableMultiplier = new Decimal(config.multiplier);
          }
        }

        // Calculate commission with accelerator
        const baseCommission = dealAmount.mul(baseRate);
        const acceleratedCommission = baseCommission.mul(applicableMultiplier);

        return acceleratedCommission.toFixed(2);
      },
      validate: (config) => {
        if (config.accelerators) {
          return Array.isArray(config.accelerators) && config.accelerators.every(a =>
            a.threshold >= 0 && a.multiplier >= 1
          );
        }
        return config.threshold >= 0 && config.multiplier >= 1;
      }
    });

    // Product-specific rate plugin
    this.registerPlugin('product_rate', {
      name: 'Product Specific Rate',
      calculate: async (context) => {
        const { deal, config } = context;

        // Find matching product configuration
        const productConfig = config.products.find(p =>
          deal.product_type === p.product_type ||
          deal.product_category === p.category ||
          deal.product_category_id === p.product_category_id
        );

        if (productConfig) {
          const rate = new Decimal(productConfig.rate);
          const amount = new Decimal(deal.amount);
          console.log(`🏷️ Product rate applied: ${productConfig.rate * 100}% for product category`);
          return amount.mul(rate).toFixed(2);
        }

        // Fall back to default rate
        const defaultRate = new Decimal(config.default_rate || 0.05);
        return new Decimal(deal.amount).mul(defaultRate).toFixed(2);
      },
      validate: (config) => {
        return config.products && Array.isArray(config.products);
      }
    });

    // Decelerator plugin (reduce commission for underperformance)
    this.registerPlugin('decelerator', {
      name: 'Decelerator',
      calculate: async (context) => {
        const { deal, config, attainmentPercentage } = context;
        const dealAmount = new Decimal(deal.amount);
        const baseRate = new Decimal(config.base_rate || config.rate || 0.05);

        // Find applicable decelerator tier
        let applicableMultiplier = new Decimal(1);

        if (config.decelerators && Array.isArray(config.decelerators)) {
          // Sort decelerators by threshold ascending
          const sortedDecelerators = config.decelerators
            .sort((a, b) => a.threshold - b.threshold);

          // Find lowest tier met (highest penalty)
          for (const dec of sortedDecelerators) {
            if (attainmentPercentage < dec.threshold) {
              applicableMultiplier = new Decimal(dec.multiplier);
              console.log(`📉 Decelerator applied: ${attainmentPercentage}% attainment < ${dec.threshold}% threshold = ${dec.multiplier}x multiplier`);
            }
          }
        } else if (config.threshold && config.multiplier) {
          // Legacy format support
          if (attainmentPercentage < config.threshold) {
            applicableMultiplier = new Decimal(config.multiplier);
          }
        }

        // Calculate commission with decelerator
        const baseCommission = dealAmount.mul(baseRate);
        const deceleratedCommission = baseCommission.mul(applicableMultiplier);

        return deceleratedCommission.toFixed(2);
      },
      validate: (config) => {
        if (config.decelerators) {
          return Array.isArray(config.decelerators) && config.decelerators.every(d =>
            d.threshold >= 0 && d.multiplier > 0 && d.multiplier <= 1
          );
        }
        return config.threshold >= 0 && config.multiplier > 0 && config.multiplier <= 1;
      }
    });

    // Performance gate plugin (minimum thresholds)
    this.registerPlugin('performance_gate', {
      name: 'Performance Gate',
      calculate: async (context) => {
        const { deal, config, attainmentPercentage, userSalesTotal, baseCommission } = context;

        if (!config.gates || !Array.isArray(config.gates)) {
          return baseCommission || '0';
        }

        let passedGates = [];
        let failedGates = [];
        let totalPenalty = new Decimal(0);
        let penaltyMultiplier = new Decimal(1);

        for (const gate of config.gates) {
          let passed = false;
          let actualValue = 0;

          // Evaluate gate metric
          switch (gate.metric) {
            case 'quota_attainment':
              actualValue = attainmentPercentage;
              break;
            case 'total_sales':
              actualValue = userSalesTotal;
              break;
            case 'deal_count':
              actualValue = context.dealCount || 0;
              break;
            case 'average_deal_size':
              actualValue = context.averageDealSize || 0;
              break;
            default:
              console.warn(`Unknown gate metric: ${gate.metric}`);
              continue;
          }

          // Evaluate gate condition
          switch (gate.operator) {
            case '>=':
              passed = actualValue >= gate.value;
              break;
            case '>':
              passed = actualValue > gate.value;
              break;
            case '<=':
              passed = actualValue <= gate.value;
              break;
            case '<':
              passed = actualValue < gate.value;
              break;
            case '==':
              passed = actualValue === gate.value;
              break;
            default:
              console.warn(`Unknown gate operator: ${gate.operator}`);
              continue;
          }

          if (passed) {
            passedGates.push(gate);
          } else {
            failedGates.push(gate);

            // Apply penalty based on enforcement
            if (gate.enforcement === 'hard') {
              if (gate.penalty_type === 'zero_commission') {
                console.log(`🚫 Performance gate failed (HARD): ${gate.name} - Zero commission`);
                return '0';  // Immediate zero commission
              } else if (gate.penalty_type === 'percentage_reduction') {
                const reductionPercent = new Decimal(gate.penalty_value || 0).div(100);
                penaltyMultiplier = penaltyMultiplier.minus(reductionPercent);
                console.log(`⚠️ Performance gate failed (HARD): ${gate.name} - ${gate.penalty_value}% reduction`);
              }
            } else if (gate.enforcement === 'soft') {
              console.log(`⚠️ Performance gate failed (SOFT): ${gate.name} - Warning only`);
              // Soft gates only warn, don't affect commission
            }
          }
        }

        // Apply penalty multiplier to base commission
        const commission = new Decimal(baseCommission || 0).mul(Decimal.max(penaltyMultiplier, 0));

        return commission.toFixed(2);
      },
      validate: (config) => {
        return config.gates && Array.isArray(config.gates) && config.gates.every(g =>
          g.metric && g.operator && g.value !== undefined
        );
      }
    });

    // Team split plugin
    this.registerPlugin('team_split', {
      name: 'Team Split',
      calculate: async (context) => {
        const { deal, config, baseCommission } = context;
        const totalCommission = new Decimal(baseCommission || 0);

        if (!config.splits || !Array.isArray(config.splits)) {
          return totalCommission.toFixed(2);
        }

        // Validate splits total 100%
        const totalPercentage = config.splits.reduce((sum, split) => sum + (split.percentage || 0), 0);
        if (Math.abs(totalPercentage - 100) > 0.01) {
          console.warn(`Team split percentages don't total 100%: ${totalPercentage}%`);
        }

        // Calculate splits
        const splits = config.splits.map(split => {
          const splitAmount = totalCommission.mul(new Decimal(split.percentage).div(100));
          return {
            user_id: split.user_id,
            role: split.role,
            percentage: split.percentage,
            amount: splitAmount.toFixed(2),
            description: split.description
          };
        });

        console.log(`🤝 Team split calculated: ${splits.length} recipients`);

        // Return the primary split amount (first in array)
        // Full split details should be stored in commission metadata
        return splits[0]?.amount || '0';
      },
      validate: (config) => {
        return config.splits && Array.isArray(config.splits) && config.splits.every(s =>
          s.user_id && s.percentage >= 0 && s.percentage <= 100
        );
      }
    });
  }

  /**
   * Register a custom plugin
   */
  registerPlugin(type, plugin) {
    if (!plugin.calculate || typeof plugin.calculate !== 'function') {
      throw new Error(`Plugin ${type} must have a calculate function`);
    }
    
    if (!plugin.validate || typeof plugin.validate !== 'function') {
      throw new Error(`Plugin ${type} must have a validate function`);
    }
    
    this.plugins.set(type, plugin);
    console.log(`✅ Registered commission plugin: ${type}`);
  }

  /**
   * Calculate commission for a deal using applicable rules
   */
  async calculateCommission(deal, rules, context = {}) {
    // Sort rules by priority
    const sortedRules = rules.sort((a, b) => a.priority - b.priority);
    
    // Build context for calculation
    const calculationContext = {
      deal,
      user: context.user || deal.user,
      company: context.company,
      period: context.period,
      userSalesTotal: context.userSalesTotal || 0,
      attainmentPercentage: context.attainmentPercentage || 0,
      ...context
    };
    
    let totalCommission = new Decimal(0);
    let appliedRules = [];
    
    for (const rule of sortedRules) {
      // Check if rule is active and within date range
      if (!this.isRuleActive(rule, deal.close_date)) {
        continue;
      }
      
      // Check rule conditions
      if (rule.conditions) {
        const meetsConditions = await this.evaluateRuleConditions(rule, calculationContext);
        if (!meetsConditions) {
          continue;
        }
      }
      
      // Get plugin for this rule type
      const plugin = this.plugins.get(rule.rule_type);
      if (!plugin) {
        console.warn(`No plugin found for rule type: ${rule.rule_type}`);
        continue;
      }
      
      // Calculate commission using plugin
      const ruleContext = {
        ...calculationContext,
        config: rule.config,
        baseCommission: totalCommission.toString()
      };
      
      const commission = await plugin.calculate(ruleContext);
      const commissionAmount = new Decimal(commission);
      
      // Apply calculation type
      switch (rule.calculation_type) {
        case 'cumulative':
          totalCommission = totalCommission.plus(commissionAmount);
          break;
        case 'replace':
          totalCommission = commissionAmount;
          break;
        case 'max':
          totalCommission = Decimal.max(totalCommission, commissionAmount);
          break;
        default:
          totalCommission = totalCommission.plus(commissionAmount);
      }
      
      appliedRules.push({
        rule_id: rule.id,
        rule_name: rule.name,
        rule_type: rule.rule_type,
        commission_amount: commissionAmount.toString()
      });
      
      // Check if rule stops processing
      if (rule.stops_processing) {
        break;
      }
    }
    
    return {
      total_commission: totalCommission.toFixed(2),
      applied_rules: appliedRules,
      calculation_timestamp: new Date()
    };
  }

  /**
   * Check if a rule is active for a given date
   */
  isRuleActive(rule, date) {
    if (!rule.is_active) return false;
    
    const checkDate = new Date(date);
    const effectiveFrom = new Date(rule.effective_from);
    const effectiveTo = rule.effective_to ? new Date(rule.effective_to) : null;
    
    if (checkDate < effectiveFrom) return false;
    if (effectiveTo && checkDate > effectiveTo) return false;
    
    return true;
  }

  /**
   * Evaluate rule conditions using json-rules-engine
   */
  async evaluateRuleConditions(rule, context) {
    if (!rule.conditions) return true;
    
    // Create a temporary engine for this evaluation
    const tempEngine = new Engine();
    
    // Add rule with conditions
    tempEngine.addRule({
      conditions: rule.conditions,
      event: { type: 'rule-matches' }
    });
    
    // Run engine with context as facts
    const { events } = await tempEngine.run(context);
    
    // Check if rule matched
    return events.some(e => e.type === 'rule-matches');
  }

  /**
   * Evaluate simple conditions (for backward compatibility)
   */
  async evaluateConditions(conditions, deal) {
    // Simple condition evaluation for basic checks
    // This can be expanded to support more complex conditions
    
    if (conditions.min_amount && deal.amount < conditions.min_amount) {
      return false;
    }
    
    if (conditions.product_types && !conditions.product_types.includes(deal.product_type)) {
      return false;
    }
    
    if (conditions.stages && !conditions.stages.includes(deal.stage)) {
      return false;
    }
    
    return true;
  }

  /**
   * Create a commission record for audit trail
   */
  async createCommissionRecord(deal, calculationResult, target) {
    try {
      // Use target's name if available, otherwise generate one
      let targetName = null;
      if (target) {
        // Use the target's name field if it exists
        if (target.name) {
          targetName = target.name;
        } else {
          // Fall back to generating a name
          const user = deal.user || await prisma.users.findUnique({
            where: { id: deal.user_id },
            select: { first_name: true, last_name: true }
          });
          
          targetName = generateTargetName(user, target.period_type, target.period_start, target.period_end);
        }
      }
      
      const commission = await prisma.commissions.create({
        data: {
          deal_id: deal.id,
          user_id: deal.user_id,
          company_id: deal.company_id,
          deal_amount: deal.amount,
          commission_rate: target?.commission_rate || 0,
          commission_amount: calculationResult.total_commission,
          target_id: target?.id,
          target_name: targetName,
          period_start: target?.period_start || deal.close_date,
          period_end: target?.period_end || deal.close_date,
          status: 'calculated',
          calculated_at: new Date(),
          calculated_by: deal.user_id,
          notes: JSON.stringify({
            applied_rules: calculationResult.applied_rules,
            calculation_timestamp: calculationResult.calculation_timestamp
          })
        }
      });
      
      // Create initial approval record
      await prisma.commission_approvals.create({
        data: {
          commission_id: commission.id,
          action: 'calculated',
          performed_by: deal.user_id,
          previous_status: 'new',
          new_status: 'calculated',
          metadata: {
            applied_rules: calculationResult.applied_rules
          }
        }
      });
      
      return commission;
    } catch (error) {
      console.error('Error creating commission record:', error);
      throw error;
    }
  }

  /**
   * Process commission approval workflow
   */
  async processApproval(commissionId, action, userId, notes = null) {
    const commission = await prisma.commissions.findUnique({
      where: { id: commissionId }
    });
    
    if (!commission) {
      throw new Error('Commission not found');
    }
    
    const previousStatus = commission.status;
    let newStatus = previousStatus;
    let updateData = {};
    
    switch (action) {
      case 'review':
        if (previousStatus !== 'calculated') {
          throw new Error('Can only review calculated commissions');
        }
        newStatus = 'pending_review';
        updateData = {
          reviewed_at: new Date(),
          reviewed_by: userId
        };
        break;
        
      case 'approve':
        if (previousStatus !== 'pending_review' && previousStatus !== 'calculated') {
          throw new Error('Can only approve reviewed or calculated commissions');
        }
        newStatus = 'approved';
        updateData = {
          approved_at: new Date(),
          approved_by: userId
        };
        break;
        
      case 'reject':
        newStatus = 'rejected';
        updateData = {
          rejection_reason: notes
        };
        break;
        
      case 'pay':
        if (previousStatus !== 'approved') {
          throw new Error('Can only pay approved commissions');
        }
        newStatus = 'paid';
        updateData = {
          paid_at: new Date(),
          payment_reference: notes
        };
        break;
        
      default:
        throw new Error(`Invalid action: ${action}`);
    }
    
    // Update commission
    const updatedCommission = await prisma.commissions.update({
      where: { id: commissionId },
      data: {
        status: newStatus,
        ...updateData
      }
    });
    
    // Create approval record
    await prisma.commission_approvals.create({
      data: {
        commission_id: commissionId,
        action,
        performed_by: userId,
        notes,
        previous_status: previousStatus,
        new_status: newStatus
      }
    });
    
    return updatedCommission;
  }

  /**
   * Get commission history for audit trail
   */
  async getCommissionHistory(commissionId) {
    const approvals = await prisma.commission_approvals.findMany({
      where: { commission_id: commissionId },
      include: {
        performed_by_user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        }
      },
      orderBy: { performed_at: 'asc' }
    });
    
    return approvals;
  }
}

export default new CommissionEngine();