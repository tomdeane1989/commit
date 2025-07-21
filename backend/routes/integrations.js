// Integration Management Routes
import express from 'express';
import { PrismaClient } from '@prisma/client';
import GoogleSheetsService from '../services/googleSheets.js';
import Joi from 'joi';

const router = express.Router();
const prisma = new PrismaClient();
const sheetsService = new GoogleSheetsService();

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
        total_deals: integration.total_deals_synced,
        last_sync: integration.last_sync,
        last_sync_count: integration.last_sync_deals_count,
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

    const columnMapping = integration.column_mapping;
    const deals = [];
    const errors = [];

    // Transform each row to a deal
    for (const row of sheetData.data) {
      try {
        const deal = await sheetsService.transformRowToDeal(
          row, 
          columnMapping, 
          user.company_id, 
          user.id
        );
        
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
        // Check if deal already exists by CRM ID
        const existingDeal = await prisma.deals.findFirst({
          where: {
            crm_id: deal.crm_id,
            company_id: user.company_id
          }
        });

        if (existingDeal) {
          // Update existing deal
          await prisma.deals.update({
            where: { id: existingDeal.id },
            data: {
              ...deal,
              updated_at: new Date()
            }
          });
          updatedCount++;
        } else {
          // Create new deal
          await prisma.deals.create({
            data: deal
          });
          createdCount++;
        }
      } catch (error) {
        dealErrors.push({
          deal: deal.deal_name,
          error: error.message
        });
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

export default router;