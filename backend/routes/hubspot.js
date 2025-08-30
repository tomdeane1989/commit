// HubSpot Integration Routes
import express from 'express';
import { PrismaClient } from '@prisma/client';
import Joi from 'joi';
import HubSpotService from '../services/hubspot.js';
import { attachPermissions, requireAdmin } from '../middleware/permissions.js';
import { authenticateToken } from '../middleware/secureAuth.js';

const router = express.Router();
const prisma = new PrismaClient();

// Validation schemas
const syncOptionsSchema = Joi.object({
  limit: Joi.number().min(1).max(100).optional(),
  after: Joi.string().optional(),
  customProperties: Joi.array().items(Joi.string()).optional()
});

/**
 * GET /api/integrations/hubspot/status
 * Check HubSpot integration status
 */
router.get('/status', authenticateToken, attachPermissions, async (req, res) => {
  try {
    const integration = await prisma.crm_integrations.findFirst({
      where: {
        company_id: req.user.company_id,
        crm_type: 'hubspot'
      }
    });

    if (!integration) {
      return res.json({
        connected: false,
        message: 'HubSpot integration not configured'
      });
    }

    res.json({
      connected: integration.is_active,
      last_sync: integration.last_sync,
      total_deals_synced: integration.total_deals_synced,
      last_sync_deals_count: integration.last_sync_deals_count,
      instance_url: integration.instance_url
    });

  } catch (error) {
    console.error('Error checking HubSpot status:', error);
    res.status(500).json({ error: 'Failed to check integration status' });
  }
});

/**
 * POST /api/integrations/hubspot/connect
 * Initialize HubSpot OAuth connection
 */
router.post('/connect', authenticateToken, attachPermissions, requireAdmin, async (req, res) => {
  try {
    // Check if HubSpot credentials are configured
    if (!process.env.HUBSPOT_CLIENT_ID || !process.env.HUBSPOT_CLIENT_SECRET) {
      return res.status(400).json({ 
        error: 'HubSpot API credentials not configured. Please contact support.' 
      });
    }

    // Check if already connected
    const existingIntegration = await prisma.crm_integrations.findFirst({
      where: {
        company_id: req.user.company_id,
        crm_type: 'hubspot',
        is_active: true
      }
    });

    if (existingIntegration) {
      return res.status(400).json({ 
        error: 'HubSpot is already connected. Please disconnect first.' 
      });
    }

    // Generate authorization URL
    const authUrl = HubSpotService.getAuthorizationUrl(req.user.company_id);

    res.json({
      success: true,
      auth_url: authUrl,
      message: 'Redirect user to auth_url to complete HubSpot authorization'
    });

  } catch (error) {
    console.error('Error initiating HubSpot connection:', error);
    res.status(500).json({ error: 'Failed to initiate HubSpot connection' });
  }
});

/**
 * GET /api/integrations/hubspot/callback
 * OAuth callback from HubSpot
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.status(400).json({ error: 'Missing authorization code or state' });
    }

    // Exchange code for tokens
    const result = await HubSpotService.exchangeCodeForToken(code, state);

    // Log successful connection (skip if no valid user)
    // Note: Activity logging disabled for OAuth callbacks since there's no authenticated user context
    console.log('HubSpot connected successfully:', {
      company_id: result.company_id,
      integration_id: result.integration_id,
      hub_id: result.hub_id
    });

    // Redirect to frontend success page (check actual port)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    res.redirect(`${frontendUrl}/integrations?hubspot=connected`);

  } catch (error) {
    console.error('HubSpot OAuth callback error:', error);
    
    // Redirect to frontend error page (check actual port)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    res.redirect(`${frontendUrl}/integrations?hubspot=error&message=${encodeURIComponent(error.message)}`);
  }
});

/**
 * POST /api/integrations/hubspot/sync
 * Manually trigger deal synchronization
 */
router.post('/sync', authenticateToken, attachPermissions, requireAdmin, async (req, res) => {
  try {
    const { error, value } = syncOptionsSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Check if integration exists
    const integration = await prisma.crm_integrations.findFirst({
      where: {
        company_id: req.user.company_id,
        crm_type: 'hubspot',
        is_active: true
      }
    });

    if (!integration) {
      return res.status(400).json({ error: 'HubSpot integration not configured' });
    }

    // Perform sync
    const result = await HubSpotService.syncDeals(req.user.company_id, value);

    // Log sync activity
    await prisma.activity_log.create({
      data: {
        user_id: req.user.id,
        company_id: req.user.company_id,
        action: 'hubspot_sync',
        entity_type: 'integration',
        entity_id: integration.id,
        success: result.success,
        context: {
          deals_synced: result.deals_synced,
          has_more: result.has_more
        }
      }
    });

    res.json(result);

  } catch (error) {
    console.error('HubSpot sync error:', error);
    res.status(500).json({ error: 'Failed to sync HubSpot deals' });
  }
});

/**
 * POST /api/integrations/hubspot/webhook
 * Receive webhook events from HubSpot
 */
router.post('/webhook', async (req, res) => {
  try {
    // Verify webhook signature (if configured)
    const signature = req.headers['x-hubspot-signature'];
    const sourceId = req.headers['x-hubspot-source'];
    
    // TODO: Implement signature verification
    
    // Process webhook events
    const events = Array.isArray(req.body) ? req.body : [req.body];
    
    for (const event of events) {
      // Find company based on portal ID
      const integration = await prisma.crm_integrations.findFirst({
        where: {
          crm_type: 'hubspot',
          is_active: true,
          instance_url: {
            contains: event.portalId
          }
        }
      });

      if (integration) {
        event.companyId = integration.company_id;
        await HubSpotService.processWebhookEvent(event);
      }
    }

    res.status(200).send('OK');

  } catch (error) {
    console.error('HubSpot webhook error:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

/**
 * DELETE /api/integrations/hubspot/disconnect
 * Disconnect HubSpot integration
 */
router.delete('/disconnect', authenticateToken, attachPermissions, requireAdmin, async (req, res) => {
  try {
    const integration = await prisma.crm_integrations.findFirst({
      where: {
        company_id: req.user.company_id,
        crm_type: 'hubspot',
        is_active: true
      }
    });

    if (!integration) {
      return res.status(404).json({ error: 'HubSpot integration not found' });
    }

    // Mark integration as inactive
    await prisma.crm_integrations.update({
      where: { id: integration.id },
      data: {
        is_active: false,
        access_token: null,
        refresh_token: null,
        updated_at: new Date()
      }
    });

    // Mark all HubSpot deals as unsynced
    await prisma.deals.updateMany({
      where: {
        company_id: req.user.company_id,
        crm_type: 'hubspot'
      },
      data: {
        last_sync: null
      }
    });

    // Log disconnection
    await prisma.activity_log.create({
      data: {
        user_id: req.user.id,
        company_id: req.user.company_id,
        action: 'hubspot_disconnected',
        entity_type: 'integration',
        entity_id: integration.id,
        success: true
      }
    });

    res.json({
      success: true,
      message: 'HubSpot integration disconnected successfully'
    });

  } catch (error) {
    console.error('Error disconnecting HubSpot:', error);
    res.status(500).json({ error: 'Failed to disconnect HubSpot integration' });
  }
});

/**
 * GET /api/integrations/hubspot/metadata
 * Get HubSpot metadata (pipelines, stages, users, teams)
 */
router.get('/metadata', authenticateToken, attachPermissions, requireAdmin, async (req, res) => {
  try {
    // Check if integration exists
    const integration = await prisma.crm_integrations.findFirst({
      where: {
        company_id: req.user.company_id,
        crm_type: 'hubspot',
        is_active: true
      }
    });

    if (!integration) {
      return res.status(400).json({ error: 'HubSpot integration not configured' });
    }

    // Fetch all metadata in parallel
    const [pipelines, users, teams, dealProperties] = await Promise.all([
      HubSpotService.getPipelines(req.user.company_id).catch(err => {
        console.error('Failed to fetch pipelines:', err);
        return [];
      }),
      HubSpotService.getUsers(req.user.company_id).catch(err => {
        console.error('Failed to fetch users:', err);
        return [];
      }),
      HubSpotService.getTeams(req.user.company_id).catch(err => {
        console.error('Failed to fetch teams:', err);
        return [];
      }),
      HubSpotService.getDealProperties(req.user.company_id).catch(err => {
        console.error('Failed to fetch deal properties:', err);
        return [];
      })
    ]);

    res.json({
      success: true,
      metadata: {
        pipelines,
        users,
        teams,
        dealProperties,
        currentConfig: integration.sync_config || {}
      }
    });

  } catch (error) {
    console.error('Error fetching HubSpot metadata:', error);
    res.status(500).json({ error: 'Failed to fetch HubSpot metadata' });
  }
});

/**
 * PUT /api/integrations/hubspot/config
 * Update sync configuration
 */
router.put('/config', authenticateToken, attachPermissions, requireAdmin, async (req, res) => {
  try {
    const { pipelines, stages, users, teams, dealTypes, syncOptions } = req.body;

    const integration = await prisma.crm_integrations.findFirst({
      where: {
        company_id: req.user.company_id,
        crm_type: 'hubspot',
        is_active: true
      }
    });

    if (!integration) {
      return res.status(404).json({ error: 'HubSpot integration not found' });
    }

    // Update sync configuration
    await prisma.crm_integrations.update({
      where: { id: integration.id },
      data: {
        sync_config: {
          pipelines: pipelines || [],
          stages: stages || [],
          users: users || [],
          teams: teams || [],
          dealTypes: dealTypes || [],
          syncOptions: syncOptions || {
            syncClosedDeals: true,
            syncOpenDeals: true,
            autoCreateUsers: false,
            mapTeamsToGroups: true
          }
        },
        updated_at: new Date()
      }
    });

    // Log configuration update
    await prisma.activity_log.create({
      data: {
        user_id: req.user.id,
        company_id: req.user.company_id,
        action: 'hubspot_config_updated',
        entity_type: 'integration',
        entity_id: integration.id,
        success: true,
        context: {
          pipelines: pipelines?.length || 0,
          users: users?.length || 0,
          teams: teams?.length || 0
        }
      }
    });

    res.json({
      success: true,
      message: 'HubSpot sync configuration updated successfully'
    });

  } catch (error) {
    console.error('Error updating HubSpot config:', error);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

/**
 * GET /api/integrations/hubspot/field-mapping
 * Get current field mapping configuration
 */
router.get('/field-mapping', authenticateToken, attachPermissions, async (req, res) => {
  try {
    const integration = await prisma.crm_integrations.findFirst({
      where: {
        company_id: req.user.company_id,
        crm_type: 'hubspot',
        is_active: true
      }
    });

    if (!integration) {
      return res.status(404).json({ error: 'HubSpot integration not found' });
    }

    // Default field mapping
    const defaultMapping = {
      deal_name: 'dealname',
      amount: 'amount',
      stage: 'dealstage',
      close_date: 'closedate',
      owner: 'hubspot_owner_id',
      company: 'associatedcompanyid'
    };

    // Get custom mapping if exists
    const customMapping = integration.column_mapping || {};

    res.json({
      default_mapping: defaultMapping,
      custom_mapping: customMapping,
      merged_mapping: { ...defaultMapping, ...customMapping }
    });

  } catch (error) {
    console.error('Error getting field mapping:', error);
    res.status(500).json({ error: 'Failed to get field mapping' });
  }
});

/**
 * PUT /api/integrations/hubspot/field-mapping
 * Update field mapping configuration
 */
router.put('/field-mapping', authenticateToken, attachPermissions, requireAdmin, async (req, res) => {
  try {
    const integration = await prisma.crm_integrations.findFirst({
      where: {
        company_id: req.user.company_id,
        crm_type: 'hubspot',
        is_active: true
      }
    });

    if (!integration) {
      return res.status(404).json({ error: 'HubSpot integration not found' });
    }

    // Update field mapping
    await prisma.crm_integrations.update({
      where: { id: integration.id },
      data: {
        column_mapping: req.body,
        updated_at: new Date()
      }
    });

    res.json({
      success: true,
      message: 'Field mapping updated successfully'
    });

  } catch (error) {
    console.error('Error updating field mapping:', error);
    res.status(500).json({ error: 'Failed to update field mapping' });
  }
});

export default router;