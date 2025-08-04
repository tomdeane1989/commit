// Integration Management Routes
import express from 'express';
import { PrismaClient } from '@prisma/client';
import GoogleSheetsService from '../services/googleSheets.js';
import Joi from 'joi';
import { requireIntegrationManagement, attachPermissions } from '../middleware/permissions.js';

const router = express.Router();
const prisma = new PrismaClient();
const sheetsService = new GoogleSheetsService();

// All integration routes require admin access
router.use(requireIntegrationManagement);

// Validation schemas
const createIntegrationSchema = Joi.object({
  crm_type: Joi.string().valid('sheets', 'salesforce', 'hubspot', 'pipedrive').required(),
  name: Joi.string().min(1).max(100).required(),
  spreadsheet_url: Joi.string().when('crm_type', {
    is: 'sheets',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  sheet_name: Joi.string().default('Sheet1'),
  column_mapping: Joi.object().when('crm_type', {
    is: 'sheets', 
    then: Joi.required(),
    otherwise: Joi.optional()
  })
});

// GET /api/integrations - List all integrations for the user's company
router.get('/', async (req, res) => {
  try {
    const integrations = await prisma.crm_integrations.findMany({
      where: {
        company_id: req.user.company_id
      },
      orderBy: { created_at: 'desc' }
    });

    // Format response to include status and summary info
    const formattedIntegrations = integrations.map(integration => ({
      ...integration,
      status: integration.is_active ? 'active' : 'inactive',
      summary: {
        total_deals: integration.total_deals_synced || 0,
        last_sync: integration.last_sync,
        last_sync_count: integration.last_sync_deals_count || 0,
        has_errors: integration.sync_errors ? Object.keys(integration.sync_errors).length > 0 : false
      }
    }));

    res.json({
      success: true,
      integrations: formattedIntegrations
    });
  } catch (error) {
    console.error('Get integrations error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve integrations'
    });
  }
});

// POST /api/integrations/test-connection - Test connection to external system
router.post('/test-connection', async (req, res) => {
  try {
    const { crm_type, spreadsheet_url } = req.body;

    if (!crm_type) {
      return res.status(400).json({
        success: false,
        error: 'CRM type is required'
      });
    }

    let testResult = {};

    switch (crm_type) {
      case 'sheets':
        if (!spreadsheet_url) {
          return res.status(400).json({
            success: false,
            error: 'Spreadsheet URL is required for Google Sheets integration'
          });
        }
        testResult = await sheetsService.testConnection(spreadsheet_url);
        break;
      
      default:
        return res.status(400).json({
          success: false,
          error: `CRM type '${crm_type}' is not yet supported`
        });
    }

    res.json({
      success: true,
      ...testResult
    });
  } catch (error) {
    console.error('Connection test error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/integrations/preview-data - Preview data from external system
router.post('/preview-data', async (req, res) => {
  try {
    const { crm_type, spreadsheet_url, sheet_name = 'Sheet1' } = req.body;

    if (crm_type !== 'sheets') {
      return res.status(400).json({
        success: false,
        error: 'Preview is currently only supported for Google Sheets'
      });
    }

    // Extract spreadsheet ID and read data
    const spreadsheetId = sheetsService.extractSpreadsheetId(spreadsheet_url);
    const sheetData = await sheetsService.readSheetData(spreadsheetId, sheet_name);

    // Return preview of first 5 rows
    const preview = {
      ...sheetData,
      data: sheetData.data.slice(0, 5), // Only show first 5 rows for preview
      totalAvailable: sheetData.data.length
    };

    res.json({
      success: true,
      preview
    });
  } catch (error) {
    console.error('Data preview error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/integrations - Create new integration
router.post('/', async (req, res) => {
  try {
    // Validate input
    const { error, value } = createIntegrationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const { crm_type, name, spreadsheet_url, sheet_name, column_mapping } = value;

    // For sheets, extract spreadsheet ID and validate structure
    let integrationData = {
      company_id: req.user.company_id,
      crm_type,
      is_active: true
    };

    if (crm_type === 'sheets') {
      // Extract and validate spreadsheet
      const spreadsheetId = sheetsService.extractSpreadsheetId(spreadsheet_url);
      const sheetData = await sheetsService.readSheetData(spreadsheetId, sheet_name);
      
      // Validate column mapping
      const validation = sheetsService.validateSheetStructure(sheetData.headers, column_mapping);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          error: `Sheet validation failed: ${validation.message}`,
          details: {
            missingFields: validation.missingFields,
            availableColumns: validation.availableColumns
          }
        });
      }

      integrationData = {
        ...integrationData,
        spreadsheet_id: spreadsheetId,
        sheet_name,
        column_mapping
      };
    }

    // Create integration record
    const integration = await prisma.crm_integrations.create({
      data: integrationData
    });

    // Log activity
    await prisma.activity_log.create({
      data: {
        user_id: req.user.id,
        company_id: req.user.company_id,
        action: 'integration_created',
        entity_type: 'integration',
        entity_id: integration.id,
        context: {
          crm_type,
          name
        },
        success: true
      }
    });

    res.status(201).json({
      success: true,
      integration,
      message: `${crm_type} integration created successfully`
    });
  } catch (error) {
    console.error('Create integration error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create integration'
    });
  }
});

// POST /api/integrations/:id/sync - Manually trigger sync
router.post('/:id/sync', async (req, res) => {
  try {
    const integrationId = req.params.id;

    // Get integration
    const integration = await prisma.crm_integrations.findFirst({
      where: {
        id: integrationId,
        company_id: req.user.company_id
      }
    });

    if (!integration) {
      return res.status(404).json({
        success: false,
        error: 'Integration not found'
      });
    }

    if (!integration.is_active) {
      return res.status(400).json({
        success: false,
        error: 'Integration is not active'
      });
    }

    // Perform sync based on integration type
    let syncResult = {};

    switch (integration.crm_type) {
      case 'sheets':
        syncResult = await syncGoogleSheets(integration, req.user);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: `Sync not implemented for ${integration.crm_type}`
        });
    }

    res.json({
      success: true,
      ...syncResult
    });
  } catch (error) {
    console.error('Manual sync error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Sync function for Google Sheets
async function syncGoogleSheets(integration, user) {
  try {
    console.log(`Starting Google Sheets sync for integration ${integration.id}`);
    
    // Read current sheet data
    const sheetData = await sheetsService.readSheetData(
      integration.spreadsheet_id, 
      integration.sheet_name
    );

    let columnMapping = integration.column_mapping;
    
    // MIGRATION LOGIC: Handle existing integrations without Deal ID
    const hasNewDealIdColumn = sheetData.headers[0] === 'Deal ID';
    const hasDealIdMapping = columnMapping.deal_id;
    
    if (hasNewDealIdColumn && !hasDealIdMapping) {
      // User added Deal ID column but integration wasn't updated
      console.log('🔄 MIGRATION: Detected new Deal ID column, updating column mapping...');
      
      // Auto-migrate existing column mapping by shifting positions
      const newColumnMapping = {
        deal_id: 'Deal ID', // Map to new first column
        ...columnMapping    // Existing mappings remain the same (columns shifted right)
      };
      
      // Update integration with new mapping
      await prisma.crm_integrations.update({
        where: { id: integration.id },
        data: { column_mapping: newColumnMapping }
      });
      
      columnMapping = newColumnMapping;
      console.log('✅ MIGRATION: Column mapping updated automatically');
    }
    
    // Handle deals without Deal ID (legacy row-based crm_id)
    const useLegacyMatching = !hasNewDealIdColumn || !hasDealIdMapping;
    const deals = [];
    const errors = [];

    // Transform each row to a deal
    for (const row of sheetData.data) {
      try {
        let deal;
        
        if (useLegacyMatching) {
          // Legacy mode: use row number for crm_id (backward compatibility)
          deal = await sheetsService.transformRowToDealLegacy(
            row, 
            columnMapping, 
            user.company_id, 
            user.id
          );
        } else {
          // New mode: use Deal ID for crm_id
          deal = await sheetsService.transformRowToDeal(
            row, 
            columnMapping, 
            user.company_id, 
            user.id
          );
        }
        
        // If deal has an owner email, look up the user
        if (deal._owner_email) {
          const owner = await prisma.users.findFirst({
            where: {
              email: deal._owner_email,
              company_id: user.company_id
            }
          });
          
          if (owner) {
            deal.user_id = owner.id;
          }
          // Remove the temporary field
          delete deal._owner_email;
        }
        
        deals.push(deal);
      } catch (error) {
        errors.push({
          row: row._rowNumber,
          error: error.message,
          data: row
        });
      }
    }

    console.log(`Transformed ${deals.length} deals, ${errors.length} errors`);

    // Upsert deals to database
    let createdCount = 0;
    let updatedCount = 0;
    const dealErrors = [];

    for (const deal of deals) {
      try {
        // Use upsert for atomic create-or-update based on unique constraint
        const result = await prisma.deals.upsert({
          where: {
            unique_crm_deal_per_company: {
              crm_id: deal.crm_id,
              company_id: deal.company_id
            }
          },
          update: {
            ...deal,
            updated_at: new Date()
          },
          create: deal
        });

        // Determine if this was a create or update operation
        const existingDeal = await prisma.deals.findFirst({
          where: {
            id: result.id,
            created_at: { lt: new Date(Date.now() - 1000) } // Created more than 1 second ago
          }
        });
        
        if (existingDeal) {
          updatedCount++;
        } else {
          createdCount++;
        }
      } catch (error) {
        // Handle unique constraint violations gracefully
        if (error.code === 'P2002' && error.meta?.target?.includes('crm_id')) {
          console.log(`Skipping duplicate deal: ${deal.deal_name} (CRM ID: ${deal.crm_id})`);
          // Try to update instead
          try {
            await prisma.deals.updateMany({
              where: {
                crm_id: deal.crm_id,
                company_id: deal.company_id
              },
              data: {
                ...deal,
                updated_at: new Date()
              }
            });
            updatedCount++;
          } catch (updateError) {
            dealErrors.push({
              deal: deal.deal_name,
              error: `Duplicate prevention: ${updateError.message}`
            });
          }
        } else {
          dealErrors.push({
            deal: deal.deal_name,
            error: error.message
          });
        }
      }
    }

    // Update integration statistics
    await prisma.crm_integrations.update({
      where: { id: integration.id },
      data: {
        last_sync: new Date(),
        last_sync_deals_count: createdCount + updatedCount,
        total_deals_synced: integration.total_deals_synced + createdCount,
        sync_errors: errors.length > 0 || dealErrors.length > 0 ? {
          transformation_errors: errors,
          database_errors: dealErrors,
          last_sync_at: new Date().toISOString()
        } : null
      }
    });

    // Log sync activity
    await prisma.activity_log.create({
      data: {
        user_id: user.id,
        company_id: user.company_id,
        action: 'integration_synced',
        entity_type: 'integration',
        entity_id: integration.id,
        context: {
          created: createdCount,
          updated: updatedCount,
          errors: errors.length + dealErrors.length
        },
        success: true
      }
    });

    return {
      message: 'Sync completed successfully',
      summary: {
        total_processed: deals.length,
        created: createdCount,
        updated: updatedCount,
        errors: errors.length + dealErrors.length
      },
      details: {
        transformation_errors: errors,
        database_errors: dealErrors
      }
    };
  } catch (error) {
    console.error('Google Sheets sync error:', error);
    
    // Update integration with error
    await prisma.crm_integrations.update({
      where: { id: integration.id },
      data: {
        sync_errors: {
          sync_error: error.message,
          last_error_at: new Date().toISOString()
        }
      }
    });

    throw error;
  }
}

// DELETE /api/integrations/:id - Delete integration
router.delete('/:id', async (req, res) => {
  try {
    const integrationId = req.params.id;

    const integration = await prisma.crm_integrations.findFirst({
      where: {
        id: integrationId,
        company_id: req.user.company_id
      }
    });

    if (!integration) {
      return res.status(404).json({
        success: false,
        error: 'Integration not found'
      });
    }

    // Soft delete by deactivating
    await prisma.crm_integrations.update({
      where: { id: integrationId },
      data: { is_active: false }
    });

    // Log activity
    await prisma.activity_log.create({
      data: {
        user_id: req.user.id,
        company_id: req.user.company_id,
        action: 'integration_deleted',
        entity_type: 'integration',
        entity_id: integration.id,
        context: {
          crm_type: integration.crm_type
        },
        success: true
      }
    });

    res.json({
      success: true,
      message: 'Integration deactivated successfully'
    });
  } catch (error) {
    console.error('Delete integration error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete integration'
    });
  }
});

// GET /api/integrations/template/:type - Download template file
router.get('/template/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { format } = req.query;

    if (type !== 'sheets') {
      return res.status(400).json({
        success: false,
        error: 'Template only available for Google Sheets'
      });
    }

    // CSV template data
    const csvData = [
      'Deal ID,Deal Name,Account Name,Amount,Probability,Status,Stage,Close Date,Created Date,Owned By',
      'DEAL-2025-001,Enterprise Software License,TechCorp Industries,45000,75,Open,Proposal Submitted,2025-08-15,2025-06-01,john.smith@company.com',
      'DEAL-2025-002,Annual Support Contract,DataFlow Solutions,28000,90,Open,Contract Review,2025-07-30,2025-05-15,sarah.jones@company.com',
      'DEAL-2025-003,Cloud Migration Services,RetailPlus Ltd,67000,100,Closed Won,Closed Won,2025-07-12,2025-04-20,test@company.com'
    ].join('\n');

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="sales-pipeline-template.csv"');
      res.send(csvData);
    } else {
      res.json({
        success: true,
        template: csvData,
        filename: 'sales-pipeline-template.csv'
      });
    }
  } catch (error) {
    console.error('Template download error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate template'
    });
  }
});

export default router;