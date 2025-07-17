// routes/crm.js
import express from 'express';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const router = express.Router();
const prisma = new PrismaClient();

// Get CRM integrations
router.get('/integrations', async (req, res) => {
  try {
    const integrations = await prisma.crm_integrations.findMany({
      where: { company_id: req.user.company_id },
      select: {
        id: true,
        crm_type: true,
        is_active: true,
        last_sync: true,
        created_at: true
      }
    });

    res.json(integrations);
  } catch (error) {
    console.error('Get integrations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create CRM integration
router.post('/integrations', async (req, res) => {
  try {
    const { crm_type, access_token, refresh_token, instance_url } = req.body;

    // Only admins can create integrations
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const integration = await prisma.crm_integrations.create({
      data: {
        company_id: req.user.company_id,
        crm_type,
        access_token,
        refresh_token,
        instance_url
      }
    });

    // Log activity
    await prisma.activity_log.create({
      data: {
        user_id: req.user.id,
        action: 'crm_integration_created',
        entity_type: 'crm_integration',
        entity_id: integration.id,
        details: { crm_type }
      }
    });

    res.status(201).json({
      id: integration.id,
      crm_type: integration.crm_type,
      is_active: integration.is_active,
      created_at: integration.created_at
    });
  } catch (error) {
    console.error('Create integration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Sync deals from CRM
router.post('/sync/:integrationId', async (req, res) => {
  try {
    const { integrationId } = req.params;

    const integration = await prisma.crm_integrations.findUnique({
      where: { id: integrationId }
    });

    if (!integration || integration.company_id !== req.user.company_id) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    if (!integration.is_active) {
      return res.status(400).json({ error: 'Integration is not active' });
    }

    let syncedDeals = [];

    // Basic sync logic - would need to be expanded for each CRM
    switch (integration.crm_type) {
      case 'salesforce':
        syncedDeals = await syncSalesforceDeals(integration, req.user.company_id);
        break;
      case 'hubspot':
        syncedDeals = await syncHubspotDeals(integration, req.user.company_id);
        break;
      case 'pipedrive':
        syncedDeals = await syncPipedriveDeals(integration, req.user.company_id);
        break;
      default:
        return res.status(400).json({ error: 'Unsupported CRM type' });
    }

    // Update last sync time
    await prisma.crm_integrations.update({
      where: { id: integrationId },
      data: { last_sync: new Date() }
    });

    // Log activity
    await prisma.activity_log.create({
      data: {
        user_id: req.user.id,
        action: 'crm_sync_completed',
        entity_type: 'crm_integration',
        entity_id: integrationId,
        details: { 
          crm_type: integration.crm_type,
          synced_deals_count: syncedDeals.length
        }
      }
    });

    res.json({
      message: 'Sync completed successfully',
      synced_deals_count: syncedDeals.length,
      deals: syncedDeals
    });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Placeholder sync functions - would need to be implemented for each CRM
async function syncSalesforceDeals(integration, companyId) {
  // Implement Salesforce API integration
  return [];
}

async function syncHubspotDeals(integration, companyId) {
  // Implement HubSpot API integration
  return [];
}

async function syncPipedriveDeals(integration, companyId) {
  // Implement Pipedrive API integration
  return [];
}

export default router;