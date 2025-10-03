import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/authenticateToken.js';
import { attachPermissions, requireAdmin, requireManager } from '../middleware/permissions.js';

const router = express.Router();
const prisma = new PrismaClient();

// Get all product categories for a company
router.get('/', authenticateToken, attachPermissions, async (req, res) => {
  try {
    const { include_inactive = false, parent_id } = req.query;
    
    const where = {
      company_id: req.user.company_id,
      ...(include_inactive !== 'true' && { is_active: true }),
      ...(parent_id && { parent_id })
    };

    const categories = await prisma.product_categories.findMany({
      where,
      orderBy: [
        { parent_id: 'asc' },
        { name: 'asc' }
      ]
    });

    // Build hierarchical structure if no specific parent requested
    if (!parent_id) {
      const categoriesMap = new Map();
      const rootCategories = [];

      // First pass: create map
      categories.forEach(cat => {
        categoriesMap.set(cat.id, { ...cat, children: [] });
      });

      // Second pass: build hierarchy
      categories.forEach(cat => {
        if (cat.parent_id) {
          const parent = categoriesMap.get(cat.parent_id);
          if (parent) {
            parent.children.push(categoriesMap.get(cat.id));
          }
        } else {
          rootCategories.push(categoriesMap.get(cat.id));
        }
      });

      return res.json({
        success: true,
        categories: rootCategories,
        total: categories.length
      });
    }

    res.json({
      success: true,
      categories,
      total: categories.length
    });

  } catch (error) {
    console.error('Error fetching product categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch product categories'
    });
  }
});

// Get single product category
router.get('/:id', authenticateToken, attachPermissions, async (req, res) => {
  try {
    const category = await prisma.product_categories.findFirst({
      where: {
        id: req.params.id,
        company_id: req.user.company_id
      },
      include: {
        targets: {
          where: { is_active: true },
          select: {
            id: true,
            name: true,
            user_id: true,
            quota_amount: true,
            commission_rate: true,
            period_start: true,
            period_end: true
          }
        },
        deals: {
          where: { status: { not: 'lost' } },
          select: {
            id: true,
            deal_name: true,
            amount: true,
            status: true,
            close_date: true
          }
        }
      }
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Product category not found'
      });
    }

    res.json({
      success: true,
      category
    });

  } catch (error) {
    console.error('Error fetching product category:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch product category'
    });
  }
});

// Create product category
router.post('/', authenticateToken, attachPermissions, requireManager, async (req, res) => {
  try {
    const { name, code, description, parent_id, metadata } = req.body;

    // Validate required fields
    if (!name || !code) {
      return res.status(400).json({
        success: false,
        error: 'Name and code are required'
      });
    }

    // Check for duplicate code
    const existing = await prisma.product_categories.findFirst({
      where: {
        company_id: req.user.company_id,
        code: code
      }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'A category with this code already exists'
      });
    }

    // Validate parent_id if provided
    if (parent_id) {
      const parent = await prisma.product_categories.findFirst({
        where: {
          id: parent_id,
          company_id: req.user.company_id
        }
      });

      if (!parent) {
        return res.status(400).json({
          success: false,
          error: 'Parent category not found'
        });
      }
    }

    const category = await prisma.product_categories.create({
      data: {
        name,
        code,
        description,
        parent_id,
        metadata,
        company_id: req.user.company_id
      }
    });

    // Log activity
    await prisma.activity_log.create({
      data: {
        action: 'create_product_category',
        entity_type: 'product_category',
        entity_id: category.id,
        after_state: category,
        user_id: req.user.id,
        company_id: req.user.company_id
      }
    });

    res.status(201).json({
      success: true,
      category,
      message: 'Product category created successfully'
    });

  } catch (error) {
    console.error('Error creating product category:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create product category'
    });
  }
});

// Update product category
router.put('/:id', authenticateToken, attachPermissions, requireManager, async (req, res) => {
  try {
    const { name, code, description, parent_id, is_active, metadata } = req.body;

    // Fetch existing category
    const existing = await prisma.product_categories.findFirst({
      where: {
        id: req.params.id,
        company_id: req.user.company_id
      }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Product category not found'
      });
    }

    // Check for duplicate code if changing
    if (code && code !== existing.code) {
      const duplicate = await prisma.product_categories.findFirst({
        where: {
          company_id: req.user.company_id,
          code: code,
          id: { not: req.params.id }
        }
      });

      if (duplicate) {
        return res.status(400).json({
          success: false,
          error: 'A category with this code already exists'
        });
      }
    }

    // Validate parent_id if provided
    if (parent_id && parent_id !== existing.parent_id) {
      // Prevent setting parent to self
      if (parent_id === req.params.id) {
        return res.status(400).json({
          success: false,
          error: 'A category cannot be its own parent'
        });
      }

      // Check parent exists
      const parent = await prisma.product_categories.findFirst({
        where: {
          id: parent_id,
          company_id: req.user.company_id
        }
      });

      if (!parent) {
        return res.status(400).json({
          success: false,
          error: 'Parent category not found'
        });
      }

      // Prevent circular references
      let currentParent = parent;
      while (currentParent.parent_id) {
        if (currentParent.parent_id === req.params.id) {
          return res.status(400).json({
            success: false,
            error: 'This would create a circular reference'
          });
        }
        currentParent = await prisma.product_categories.findUnique({
          where: { id: currentParent.parent_id }
        });
      }
    }

    const category = await prisma.product_categories.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code }),
        ...(description !== undefined && { description }),
        ...(parent_id !== undefined && { parent_id }),
        ...(is_active !== undefined && { is_active }),
        ...(metadata !== undefined && { metadata })
      }
    });

    // Log activity
    await prisma.activity_log.create({
      data: {
        action: 'update_product_category',
        entity_type: 'product_category',
        entity_id: category.id,
        before_state: existing,
        after_state: category,
        user_id: req.user.id,
        company_id: req.user.company_id
      }
    });

    res.json({
      success: true,
      category,
      message: 'Product category updated successfully'
    });

  } catch (error) {
    console.error('Error updating product category:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update product category'
    });
  }
});

// Delete product category
router.delete('/:id', authenticateToken, attachPermissions, requireAdmin, async (req, res) => {
  try {
    const category = await prisma.product_categories.findFirst({
      where: {
        id: req.params.id,
        company_id: req.user.company_id
      },
      include: {
        _count: {
          select: {
            targets: true,
            deals: true
          }
        }
      }
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Product category not found'
      });
    }

    // Check if category has children
    const hasChildren = await prisma.product_categories.count({
      where: {
        parent_id: req.params.id,
        company_id: req.user.company_id
      }
    });

    if (hasChildren > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete category with subcategories'
      });
    }

    // Check if category is in use
    if (category._count.targets > 0 || category._count.deals > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete category in use by ${category._count.targets} targets and ${category._count.deals} deals`
      });
    }

    await prisma.product_categories.delete({
      where: { id: req.params.id }
    });

    // Log activity
    await prisma.activity_log.create({
      data: {
        action: 'delete_product_category',
        entity_type: 'product_category',
        entity_id: req.params.id,
        before_state: category,
        user_id: req.user.id,
        company_id: req.user.company_id
      }
    });

    res.json({
      success: true,
      message: 'Product category deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting product category:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete product category'
    });
  }
});

// Get category statistics
router.get('/:id/stats', authenticateToken, attachPermissions, async (req, res) => {
  try {
    const category = await prisma.product_categories.findFirst({
      where: {
        id: req.params.id,
        company_id: req.user.company_id
      }
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Product category not found'
      });
    }

    // Get deals statistics
    const dealsStats = await prisma.deals.aggregate({
      where: {
        product_category_id: req.params.id,
        company_id: req.user.company_id
      },
      _sum: {
        amount: true,
        commission_amount: true
      },
      _count: {
        id: true
      }
    });

    // Get closed won deals
    const closedWonStats = await prisma.deals.aggregate({
      where: {
        product_category_id: req.params.id,
        company_id: req.user.company_id,
        status: 'closed_won'
      },
      _sum: {
        amount: true,
        commission_amount: true
      },
      _count: {
        id: true
      }
    });

    // Get active targets
    const activeTargets = await prisma.targets.count({
      where: {
        product_category_id: req.params.id,
        company_id: req.user.company_id,
        is_active: true
      }
    });

    res.json({
      success: true,
      stats: {
        total_deals: dealsStats._count.id,
        total_deal_value: dealsStats._sum.amount || 0,
        total_commission_value: dealsStats._sum.commission_amount || 0,
        closed_won_deals: closedWonStats._count.id,
        closed_won_value: closedWonStats._sum.amount || 0,
        closed_won_commission: closedWonStats._sum.commission_amount || 0,
        active_targets: activeTargets
      }
    });

  } catch (error) {
    console.error('Error fetching category statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch category statistics'
    });
  }
});

export default router;