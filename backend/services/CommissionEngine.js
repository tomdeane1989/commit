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
        const { baseCommission, config, attainmentPercentage } = context;
        
        if (attainmentPercentage >= config.threshold) {
          const multiplier = new Decimal(config.multiplier || 1.5);
          return new Decimal(baseCommission).mul(multiplier).toFixed(2);
        }
        
        return baseCommission;
      },
      validate: (config) => {
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
          deal.product_category === p.category
        );
        
        if (productConfig) {
          const rate = new Decimal(productConfig.rate);
          const amount = new Decimal(deal.amount);
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