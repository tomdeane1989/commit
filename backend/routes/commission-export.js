import express from 'express';
import { PrismaClient } from '@prisma/client';
import XeroExportService from '../services/xeroExport.js';
import { requireManager, attachPermissions } from '../middleware/permissions.js';
import Joi from 'joi';

const router = express.Router();
const prisma = new PrismaClient();

// All export routes require manager/admin access
router.use(attachPermissions);
router.use(requireManager);

// Validation schemas
const exportSchema = Joi.object({
  commission_ids: Joi.array().items(Joi.string()).min(1).required(),
  format: Joi.string().valid('xero_bills', 'xero_payroll', 'detailed_csv', 'simple_csv').required(),
  options: Joi.object({
    tax_rate: Joi.number().min(0).max(1),
    account_code: Joi.string(),
    due_date: Joi.date(),
    pay_period_end: Joi.date(),
    earnings_type: Joi.string(),
    includeApproved: Joi.boolean(),
    includePending: Joi.boolean(),
    includePaid: Joi.boolean(),
    includeRejected: Joi.boolean()
  }).optional()
});

// POST /api/commissions/export - Export commissions in various formats
router.post('/export', async (req, res) => {
  try {
    const { error, value } = exportSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const { commission_ids, format, options = {} } = value;

    // Verify commissions exist and belong to user's company
    const commissions = await prisma.commissions.findMany({
      where: {
        id: { in: commission_ids },
        company_id: req.user.company_id
      },
      select: { id: true, status: true }
    });

    if (commissions.length !== commission_ids.length) {
      return res.status(404).json({
        success: false,
        error: 'Some commissions not found or unauthorized'
      });
    }

    // Check if commissions are in valid status for export
    const invalidStatuses = commissions.filter(c => 
      !['calculated', 'pending_review', 'approved', 'pending_payment', 'paid'].includes(c.status)
    );

    if (invalidStatuses.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Some commissions are not approved for export',
        invalid_count: invalidStatuses.length
      });
    }

    let result;
    let filename;
    let contentType = 'text/csv';

    switch (format) {
      case 'xero_bills':
        result = await XeroExportService.exportAsBills(commission_ids, options);
        filename = `xero-bills-${new Date().toISOString().split('T')[0]}.csv`;
        break;

      case 'xero_payroll':
        result = await XeroExportService.exportAsPayroll(commission_ids, options);
        filename = `xero-payroll-${new Date().toISOString().split('T')[0]}.csv`;
        break;

      case 'detailed_csv':
        result = await XeroExportService.exportDetailedReport(commission_ids);
        filename = `commission-report-${new Date().toISOString().split('T')[0]}.csv`;
        break;

      case 'simple_csv':
        result = await exportSimpleCSV(commission_ids);
        filename = `commissions-${new Date().toISOString().split('T')[0]}.csv`;
        break;

      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid export format'
        });
    }

    // Mark as exported
    const exportRef = `EXP-${Date.now().toString(36).toUpperCase()}`;
    await XeroExportService.markAsExported(commission_ids, format, exportRef, req.user.id);

    // Log activity
    await prisma.activity_log.create({
      data: {
        user_id: req.user.id,
        company_id: req.user.company_id,
        action: 'commissions_exported',
        entity_type: 'commission_export',
        entity_id: exportRef,
        context: {
          format,
          commission_count: commission_ids.length,
          total_amount: result.summary.total,
          filename
        },
        success: true
      }
    });

    // Send CSV file
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Export-Reference', exportRef);
    res.setHeader('X-Export-Summary', JSON.stringify(result.summary));
    res.send(result.csv);

  } catch (error) {
    console.error('Commission export error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export commissions'
    });
  }
});

// GET /api/commissions/export/formats - Get available export formats
router.get('/export/formats', async (req, res) => {
  res.json({
    success: true,
    formats: [
      {
        id: 'xero_bills',
        name: 'Xero Bills (Accounts Payable)',
        description: 'Import as supplier bills in Xero UK',
        file_type: 'CSV',
        options: ['tax_rate', 'account_code', 'due_date']
      },
      {
        id: 'xero_payroll', 
        name: 'Xero Payroll',
        description: 'Import as additional earnings in Xero UK Payroll',
        file_type: 'CSV',
        options: ['pay_period_end', 'earnings_type']
      },
      {
        id: 'detailed_csv',
        name: 'Detailed Report',
        description: 'Full commission details for internal records',
        file_type: 'CSV',
        options: []
      },
      {
        id: 'simple_csv',
        name: 'Simple CSV',
        description: 'Basic commission data in CSV format',
        file_type: 'CSV',
        options: []
      }
    ]
  });
});

// GET /api/commissions/export/history - Get export history
router.get('/export/history', async (req, res) => {
  try {
    const history = await prisma.activity_log.findMany({
      where: {
        company_id: req.user.company_id,
        action: 'commissions_exported'
      },
      include: {
        user: {
          select: {
            first_name: true,
            last_name: true,
            email: true
          }
        }
      },
      orderBy: { created_at: 'desc' },
      take: 50
    });

    const formattedHistory = history.map(entry => ({
      id: entry.id,
      export_reference: entry.entity_id,
      exported_by: `${entry.user.first_name} ${entry.user.last_name}`,
      exported_at: entry.created_at,
      format: entry.context.format,
      commission_count: entry.context.commission_count,
      total_amount: entry.context.total_amount,
      filename: entry.context.filename
    }));

    res.json({
      success: true,
      history: formattedHistory
    });
  } catch (error) {
    console.error('Export history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve export history'
    });
  }
});

// Helper function for simple CSV export
async function exportSimpleCSV(commissionIds) {
  const { Parser } = await import('json2csv');
  
  const commissions = await prisma.commissions.findMany({
    where: {
      id: { in: commissionIds }
    },
    include: {
      user: true,
      deal: true
    }
  });

  const rows = commissions.map(c => ({
    'Employee': `${c.user.first_name} ${c.user.last_name}`,
    'Email': c.user.email,
    'Deal': c.deal.deal_name,
    'Deal Amount': Number(c.deal_amount).toFixed(2),
    'Commission Rate': `${(Number(c.commission_rate) * 100).toFixed(1)}%`,
    'Commission Amount': Number(c.commission_amount).toFixed(2),
    'Period': c.target_name || 'No Target',
    'Status': c.status
  }));

  const fields = Object.keys(rows[0] || {});
  const parser = new Parser({ fields });
  const csv = parser.parse(rows);

  return {
    csv,
    summary: {
      records: rows.length,
      total: rows.reduce((sum, row) => sum + parseFloat(row['Commission Amount']), 0)
    }
  };
}

export default router;