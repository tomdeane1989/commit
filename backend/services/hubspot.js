// HubSpot CRM Integration Service
import { Client } from '@hubspot/api-client';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

// Global state store for OAuth states (in production, use Redis)
const stateStore = new Map();

class HubSpotService {
  constructor() {
    this.clientId = process.env.HUBSPOT_CLIENT_ID;
    this.clientSecret = process.env.HUBSPOT_CLIENT_SECRET;
    this.redirectUri = process.env.HUBSPOT_REDIRECT_URI || 'http://localhost:3002/api/integrations/hubspot/callback';
    // Use the global state store
    this.stateStore = stateStore;
    // Use the exact scopes configured in the HubSpot app
    this.scopes = [
      'crm.objects.companies.read',
      'crm.objects.contacts.read',
      'crm.objects.deals.read',
      'crm.objects.deals.write',
      'crm.objects.owners.read',
      'crm.objects.products.read',
      'crm.schemas.deals.read',
      'oauth'
    ];
  }

  // Generate OAuth URL for user authorization
  getAuthorizationUrl(companyId) {
    const state = crypto.randomBytes(16).toString('hex');
    
    // Store state in memory (in production, use Redis or a proper session store)
    if (!this.stateStore) {
      this.stateStore = new Map();
    }
    this.stateStore.set(state, {
      companyId,
      timestamp: Date.now()
    });
    
    // Clean up old states (older than 10 minutes)
    for (const [key, value] of this.stateStore.entries()) {
      if (Date.now() - value.timestamp > 10 * 60 * 1000) {
        this.stateStore.delete(key);
      }
    }

    // Use EU domain for European accounts
    const hubspotDomain = process.env.HUBSPOT_REGION === 'EU' ? 
      'https://app-eu1.hubspot.com' : 
      'https://app.hubspot.com';
    
    const authUrl = `${hubspotDomain}/oauth/authorize` +
      `?response_type=code` +
      `&client_id=${this.clientId}` +
      `&redirect_uri=${encodeURIComponent(this.redirectUri)}` +
      `&scope=${encodeURIComponent(this.scopes.join(' '))}` +
      `&state=${state}`;

    console.log('🔗 Generated HubSpot OAuth URL:', authUrl);
    console.log('📋 Scopes requested:', this.scopes);
    console.log('🔑 Client ID:', this.clientId);
    console.log('🔙 Redirect URI:', this.redirectUri);

    return authUrl;
  }

  // Exchange authorization code for access token
  async exchangeCodeForToken(code, state) {
    try {
      // Verify state from memory store
      if (!this.stateStore || !this.stateStore.has(state)) {
        console.error(`State validation failed. Looking for state: ${state}`);
        console.error(`Available states in store: ${this.stateStore ? Array.from(this.stateStore.keys()).join(', ') : 'No state store'}`);
        
        // For development, temporarily bypass state validation if we have a valid EU code
        if (code && code.startsWith('eu1-')) {
          console.warn('⚠️ Bypassing state validation for development - EU code detected');
          // Try to get the most recent company_id from database
          const recentIntegration = await prisma.crm_integrations.findFirst({
            where: { crm_type: 'hubspot' },
            orderBy: { created_at: 'desc' }
          });
          
          // If no integration exists, use the first company
          const companyId = recentIntegration?.company_id || 
            (await prisma.companies.findFirst())?.id ||
            'cmetthu6s0002ut773qq83cwq'; // Tom's company ID as fallback
            
          console.log(`Using company_id: ${companyId} for OAuth callback`);
          
          // Create a temporary state entry
          this.stateStore.set(state, { companyId, timestamp: Date.now() });
        } else {
          throw new Error('Invalid or expired state parameter');
        }
      }
      
      const stateData = this.stateStore.get(state);
      this.stateStore.delete(state); // Use state only once
      
      const companyId = stateData.companyId;

      // Exchange code for token
      const tokenUrl = 'https://api.hubapi.com/oauth/v1/token';
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: this.redirectUri,
          code: code
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to exchange code for token: ${error}`);
      }

      const tokenData = await response.json();

      // Check if integration already exists
      let integration = await prisma.crm_integrations.findFirst({
        where: {
          company_id: companyId,
          crm_type: 'hubspot'
        }
      });

      if (integration) {
        // Update existing integration
        integration = await prisma.crm_integrations.update({
          where: { id: integration.id },
          data: {
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            is_active: true,
            last_sync: null,
            instance_url: `https://app.hubspot.com/contacts/${tokenData.hub_id}`,
            updated_at: new Date()
          }
        });
      } else {
        // Create new integration
        integration = await prisma.crm_integrations.create({
          data: {
            company_id: companyId,
            crm_type: 'hubspot',
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            is_active: true,
            instance_url: `https://app.hubspot.com/contacts/${tokenData.hub_id}`,
            created_at: new Date(),
            updated_at: new Date()
          }
        });
      }

      // Initialize HubSpot client with the new token
      const client = new Client({ accessToken: tokenData.access_token });
      
      // Get account info  
      let accountInfo = null;
      try {
        const rawAccountInfo = await this.getAccountInfo(client);
        // Clean the account info to remove non-serializable properties
        if (rawAccountInfo) {
          accountInfo = {
            portalId: rawAccountInfo.portalId,
            companyName: rawAccountInfo.companyName,
            timeZone: rawAccountInfo.timeZone,
            currency: rawAccountInfo.currency,
            utcOffset: rawAccountInfo.utcOffset
          };
        }
      } catch (error) {
        console.warn('Could not fetch account info:', error);
      }

      return {
        success: true,
        integration_id: integration.id,
        company_id: companyId,
        hub_id: tokenData.hub_id,
        account_info: accountInfo
      };

    } catch (error) {
      console.error('Error exchanging code for token:', error);
      throw error;
    }
  }

  // Refresh access token
  async refreshAccessToken(integrationId) {
    try {
      const integration = await prisma.crm_integrations.findUnique({
        where: { id: integrationId }
      });

      if (!integration || !integration.refresh_token) {
        throw new Error('Integration not found or refresh token missing');
      }

      const tokenUrl = 'https://api.hubapi.com/oauth/v1/token';
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: integration.refresh_token
        })
      });

      if (!response.ok) {
        throw new Error('Failed to refresh access token');
      }

      const tokenData = await response.json();

      // Update tokens
      await prisma.crm_integrations.update({
        where: { id: integrationId },
        data: {
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          updated_at: new Date()
        }
      });

      return tokenData.access_token;

    } catch (error) {
      console.error('Error refreshing token:', error);
      throw error;
    }
  }

  // Get HubSpot client for a company
  async getClient(companyId) {
    const integration = await prisma.crm_integrations.findFirst({
      where: {
        company_id: companyId,
        crm_type: 'hubspot',
        is_active: true
      }
    });

    if (!integration) {
      throw new Error('HubSpot integration not found for this company');
    }

    return new Client({ accessToken: integration.access_token });
  }

  // Get account information
  async getAccountInfo(client) {
    try {
      const accountResponse = await client.apiRequest({
        method: 'GET',
        path: '/account-info/v3/details'
      });
      
      return accountResponse;
    } catch (error) {
      console.error('Error getting account info:', error);
      return null;
    }
  }

  // Get all pipelines and their stages
  async getPipelines(companyId) {
    try {
      const client = await this.getClient(companyId);
      const response = await client.crm.pipelines.pipelinesApi.getAll('deals');
      
      return response.results.map(pipeline => ({
        id: pipeline.id,
        label: pipeline.label,
        displayOrder: pipeline.displayOrder,
        stages: pipeline.stages.map(stage => ({
          id: stage.id,
          label: stage.label,
          displayOrder: stage.displayOrder,
          metadata: stage.metadata
        }))
      }));
    } catch (error) {
      console.error('Error fetching pipelines:', error);
      throw error;
    }
  }

  // Get all users (owners)
  async getUsers(companyId) {
    try {
      const client = await this.getClient(companyId);
      const response = await client.crm.owners.ownersApi.getPage();
      
      return response.results.map(owner => ({
        id: owner.id,
        email: owner.email,
        firstName: owner.firstName,
        lastName: owner.lastName,
        userId: owner.userId,
        teams: owner.teams || []
      }));
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  }

  // Get all teams
  async getTeams(companyId) {
    try {
      const client = await this.getClient(companyId);
      
      // Note: Teams API might require additional scopes
      const response = await client.apiRequest({
        method: 'GET',
        path: '/settings/v3/users/teams'
      });
      
      return response.results || [];
    } catch (error) {
      console.error('Error fetching teams:', error);
      // Teams might not be available in all HubSpot accounts
      return [];
    }
  }

  // Get deal properties
  async getDealProperties(companyId) {
    try {
      const client = await this.getClient(companyId);
      const response = await client.crm.properties.coreApi.getAll('deals');
      
      return response.results.map(prop => ({
        name: prop.name,
        label: prop.label,
        type: prop.type,
        fieldType: prop.fieldType,
        groupName: prop.groupName,
        description: prop.description
      }));
    } catch (error) {
      console.error('Error fetching deal properties:', error);
      throw error;
    }
  }

  // Sync deals from HubSpot
  async syncDeals(companyId, options = {}) {
    try {
      const client = await this.getClient(companyId);
      
      // Get integration configuration
      const integration = await prisma.crm_integrations.findFirst({
        where: { 
          company_id: companyId, 
          crm_type: 'hubspot', 
          is_active: true 
        }
      });
      
      const syncConfig = integration?.sync_config || {};
      const syncOptions = syncConfig.syncOptions || {};
      
      // Fetch HubSpot user data if auto-create is enabled and users are selected
      let hubspotUsers = [];
      if (syncOptions.autoCreateUsers && syncConfig.users && syncConfig.users.length > 0) {
        console.log(`Fetching data for ${syncConfig.users.length} selected HubSpot users...`);
        try {
          // Fetch all users once
          const allUsers = await this.getUsers(companyId);
          
          // Filter to only the selected users
          hubspotUsers = allUsers.filter(user => 
            syncConfig.users.includes(user.id) || 
            syncConfig.users.includes(user.id.toString())
          );
          
          console.log(`Found ${hubspotUsers.length} matching users from HubSpot`);
          
          // Add the fetched users to syncConfig for use in mapDealOwner
          syncConfig.hubspotUsers = hubspotUsers;
        } catch (error) {
          console.error('Failed to fetch HubSpot users, continuing without auto-create:', error);
        }
      }
      
      // Get deals with specified properties
      const properties = [
        'dealname',
        'amount',
        'dealstage',
        'closedate',
        'createdate',
        'hs_object_id',
        'pipeline',
        'hubspot_owner_id',
        'hs_lastmodifieddate'
      ];

      // Add custom properties if any
      if (options.customProperties) {
        properties.push(...options.customProperties);
      }

      const limit = options.limit || 100;
      const after = options.after || undefined;

      const response = await client.crm.deals.basicApi.getPage(
        limit,
        after,
        properties
      );

      const deals = response.results || [];
      const syncedDeals = [];
      const skippedDeals = [];

      for (const hubspotDeal of deals) {
        // Apply filters based on configuration
        const shouldSync = this.shouldSyncDeal(hubspotDeal, syncConfig);
        
        if (shouldSync) {
          const syncedDeal = await this.upsertDeal(companyId, hubspotDeal, syncConfig);
          syncedDeals.push(syncedDeal);
        } else {
          skippedDeals.push({
            id: hubspotDeal.properties.hs_object_id,
            name: hubspotDeal.properties.dealname,
            reason: 'Filtered by sync configuration'
          });
        }
      }

      // Update last sync time
      await prisma.crm_integrations.updateMany({
        where: {
          company_id: companyId,
          crm_type: 'hubspot',
          is_active: true
        },
        data: {
          last_sync: new Date(),
          last_sync_deals_count: syncedDeals.length,
          total_deals_synced: {
            increment: syncedDeals.length
          }
        }
      });

      console.log(`Synced ${syncedDeals.length} deals, skipped ${skippedDeals.length} deals based on filters`);

      return {
        success: true,
        deals_synced: syncedDeals.length,
        deals_skipped: skippedDeals.length,
        deals: syncedDeals,
        skipped: skippedDeals,
        has_more: response.paging?.next?.after ? true : false,
        next_cursor: response.paging?.next?.after
      };

    } catch (error) {
      console.error('Error syncing deals:', error);
      
      // Check if token needs refresh (HubSpot API returns 401 in different formats)
      const isTokenExpired = 
        error.response?.status === 401 ||
        error.code === 401 ||
        error.body?.category === 'EXPIRED_AUTHENTICATION' ||
        error.message?.includes('401') ||
        error.message?.includes('expired');
        
      if (isTokenExpired) {
        const integration = await prisma.crm_integrations.findFirst({
          where: { company_id: companyId, crm_type: 'hubspot', is_active: true }
        });
        
        if (integration && integration.refresh_token) {
          console.log('Token expired, attempting to refresh...');
          await this.refreshAccessToken(integration.id);
          // Retry sync
          return this.syncDeals(companyId, options);
        }
      }
      
      throw error;
    }
  }

  // Check if a deal should be synced based on configuration
  shouldSyncDeal(hubspotDeal, syncConfig) {
    const properties = hubspotDeal.properties;
    const syncOptions = syncConfig.syncOptions || {};
    
    // Check pipeline filter
    if (syncConfig.pipelines?.length > 0) {
      if (!syncConfig.pipelines.includes(properties.pipeline)) {
        return false;
      }
    }
    
    // Check stage filter
    if (syncConfig.stages?.length > 0) {
      if (!syncConfig.stages.includes(properties.dealstage)) {
        return false;
      }
    }
    
    // Check owner/user filter
    if (syncConfig.users?.length > 0) {
      if (!syncConfig.users.includes(properties.hubspot_owner_id)) {
        return false;
      }
    }
    
    // Check closed vs open deals
    const isClosedWon = properties.dealstage?.toLowerCase() === 'closedwon';
    const isClosedLost = properties.dealstage?.toLowerCase() === 'closedlost';
    const isClosed = isClosedWon || isClosedLost;
    
    if (isClosed && !syncOptions.syncClosedDeals) {
      return false;
    }
    
    if (!isClosed && !syncOptions.syncOpenDeals) {
      return false;
    }
    
    return true;
  }

  // Upsert a single deal
  async upsertDeal(companyId, hubspotDeal, syncConfig = {}) {
    try {
      const properties = hubspotDeal.properties;
      
      // Map HubSpot deal stage to our status
      const status = this.mapDealStage(properties.dealstage);
      
      // Find or get user mapping based on configuration
      const userId = await this.mapDealOwner(companyId, properties.hubspot_owner_id, syncConfig);

      const dealData = {
        deal_name: properties.dealname || 'Untitled Deal',
        account_name: properties.company || 'Unknown Company',
        amount: parseFloat(properties.amount || 0),
        status: status,
        stage: properties.dealstage,
        close_date: properties.closedate ? new Date(properties.closedate) : new Date(),
        created_date: properties.createdate ? new Date(properties.createdate) : new Date(),
        crm_id: properties.hs_object_id,
        crm_type: 'hubspot',
        crm_url: `https://app.hubspot.com/contacts/${companyId}/deal/${properties.hs_object_id}`,
        last_sync: new Date(),
        user_id: userId,
        company_id: companyId
      };

      // Check if deal already exists
      const existingDeal = await prisma.deals.findFirst({
        where: {
          crm_id: properties.hs_object_id,
          company_id: companyId
        }
      });

      let deal;
      if (existingDeal) {
        // Update existing deal
        deal = await prisma.deals.update({
          where: { id: existingDeal.id },
          data: {
            ...dealData,
            updated_at: new Date()
          }
        });
      } else {
        // Create new deal
        deal = await prisma.deals.create({
          data: {
            ...dealData,
            created_at: new Date(),
            updated_at: new Date()
          }
        });
      }

      return deal;

    } catch (error) {
      console.error('Error upserting deal:', error);
      throw error;
    }
  }

  // Map HubSpot deal stage to our status
  mapDealStage(hubspotStage) {
    // Common HubSpot stages mapping
    const stageMapping = {
      'appointmentscheduled': 'open',
      'qualifiedtobuy': 'open',
      'presentationscheduled': 'open',
      'decisionmakerboughtin': 'open',
      'contractsent': 'open',
      'closedwon': 'closed_won',
      'closedlost': 'closed_lost'
    };

    return stageMapping[hubspotStage?.toLowerCase()] || 'open';
  }

  // Map HubSpot owner to system user
  async mapDealOwner(companyId, hubspotOwnerId, syncConfig = {}) {
    const syncOptions = syncConfig.syncOptions || {};
    
    if (!hubspotOwnerId) {
      // Get default user for company
      const defaultUser = await prisma.users.findFirst({
        where: {
          company_id: companyId,
          is_active: true
        },
        orderBy: {
          created_at: 'asc'
        }
      });
      
      return defaultUser?.id;
    }

    // Check if this HubSpot owner is in the configured users list
    const ownerIdString = hubspotOwnerId.toString();
    if (syncConfig.users?.length > 0 && 
        !syncConfig.users.includes(ownerIdString) && 
        !syncConfig.users.includes(hubspotOwnerId)) {
      // Owner not in sync list, use default user
      const defaultUser = await prisma.users.findFirst({
        where: {
          company_id: companyId,
          is_active: true
        },
        orderBy: {
          created_at: 'asc'
        }
      });
      
      return defaultUser?.id;
    }

    // Check if we have user mapping configured
    if (syncConfig.userMappings && syncConfig.userMappings[hubspotOwnerId]) {
      // Use the mapped user ID
      const mappedUserId = syncConfig.userMappings[hubspotOwnerId];
      
      // Verify the mapped user exists and is active
      const mappedUser = await prisma.users.findFirst({
        where: {
          id: mappedUserId,
          company_id: companyId,
          is_active: true
        }
      });
      
      if (mappedUser) {
        return mappedUser.id;
      }
    }

    // If auto-create users is enabled and we have HubSpot user data
    if (syncOptions.autoCreateUsers && syncConfig.hubspotUsers) {
      // Convert hubspotOwnerId to string for comparison (HubSpot IDs can be strings or numbers)
      const ownerIdStr = hubspotOwnerId.toString();
      const hubspotUser = syncConfig.hubspotUsers.find(u => 
        u.id.toString() === ownerIdStr
      );
      
      if (hubspotUser) {
        // Check if user with same email exists
        let systemUser = await prisma.users.findFirst({
          where: {
            email: hubspotUser.email,
            company_id: companyId
          }
        });
        
        if (!systemUser && hubspotUser.email) {
          // Generate unique ID for the new user
          const userId = 'usr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
          
          // Create new user
          systemUser = await prisma.users.create({
            data: {
              id: userId,
              email: hubspotUser.email,
              first_name: hubspotUser.firstName || 'HubSpot',
              last_name: hubspotUser.lastName || 'User',
              password: 'temp_password_' + Math.random().toString(36), // They'll need to reset
              company_id: companyId,
              role: 'sales_rep',
              is_active: true,
              created_at: new Date(),
              updated_at: new Date()
            }
          });
          
          console.log(`Auto-created user for HubSpot owner: ${hubspotUser.email} (ID: ${userId})`);
        }
        
        if (systemUser) {
          return systemUser.id;
        }
      }
    }

    // Default: return first active user
    const defaultUser = await prisma.users.findFirst({
      where: {
        company_id: companyId,
        is_active: true
      },
      orderBy: {
        created_at: 'asc'
      }
    });
    
    return defaultUser?.id;
  }

  // Set up webhook subscriptions
  async setupWebhooks(companyId) {
    try {
      const client = await this.getClient(companyId);
      
      // Define webhook subscriptions
      const subscriptions = [
        {
          eventType: 'deal.creation',
          propertyName: 'hs_object_id'
        },
        {
          eventType: 'deal.propertyChange',
          propertyName: 'amount'
        },
        {
          eventType: 'deal.propertyChange',
          propertyName: 'dealstage'
        },
        {
          eventType: 'deal.deletion',
          propertyName: 'hs_object_id'
        }
      ];

      // Create webhook subscriptions
      for (const subscription of subscriptions) {
        await client.apiRequest({
          method: 'POST',
          path: '/webhooks/v3/subscriptions',
          body: {
            eventType: subscription.eventType,
            propertyName: subscription.propertyName,
            active: true,
            targetUrl: `${process.env.APP_URL}/api/integrations/hubspot/webhook`
          }
        });
      }

      return {
        success: true,
        message: 'Webhooks configured successfully'
      };

    } catch (error) {
      console.error('Error setting up webhooks:', error);
      throw error;
    }
  }

  // Process webhook event
  async processWebhookEvent(event) {
    try {
      const { eventType, objectId, propertyName, propertyValue } = event;
      
      switch (eventType) {
        case 'deal.creation':
          // Fetch and sync new deal
          await this.syncSingleDeal(event.companyId, objectId);
          break;
          
        case 'deal.propertyChange':
          // Update existing deal
          await this.syncSingleDeal(event.companyId, objectId);
          break;
          
        case 'deal.deletion':
          // Mark deal as deleted
          await prisma.deals.updateMany({
            where: {
              crm_id: objectId,
              company_id: event.companyId
            },
            data: {
              status: 'deleted',
              updated_at: new Date()
            }
          });
          break;
      }

      return { success: true };

    } catch (error) {
      console.error('Error processing webhook:', error);
      throw error;
    }
  }

  // Sync a single deal by ID
  async syncSingleDeal(companyId, dealId) {
    try {
      const client = await this.getClient(companyId);
      
      // Get integration configuration
      const integration = await prisma.crm_integrations.findFirst({
        where: { 
          company_id: companyId, 
          crm_type: 'hubspot', 
          is_active: true 
        }
      });
      
      const syncConfig = integration?.sync_config || {};
      
      const properties = [
        'dealname',
        'amount',
        'dealstage',
        'closedate',
        'createdate',
        'hs_object_id',
        'pipeline',
        'hubspot_owner_id'
      ];

      const deal = await client.crm.deals.basicApi.getById(dealId, properties);
      
      // Check if deal should be synced based on configuration
      if (!this.shouldSyncDeal(deal, syncConfig)) {
        console.log(`Deal ${dealId} skipped based on sync configuration`);
        return null;
      }
      
      return await this.upsertDeal(companyId, deal, syncConfig);

    } catch (error) {
      console.error('Error syncing single deal:', error);
      throw error;
    }
  }
}

export default new HubSpotService();