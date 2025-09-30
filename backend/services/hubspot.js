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
        const errorBody = await response.text();
        console.error('Token refresh failed:', response.status, errorBody);
        throw new Error(`Failed to refresh access token: ${response.status} - ${errorBody}`);
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

  // Process sync results - common logic for both full and incremental sync
  async processSyncResults(companyId, deals, integration) {
    const syncConfig = integration?.sync_config || {};
    const syncedDeals = [];
    const skippedDeals = [];
    let dealsCreated = 0;
    let dealsUpdated = 0;
    
    // Pre-fetch company associations if needed
    const dealCompanyMap = await this.batchFetchCompanyAssociations(deals);
    
    // Process each deal
    for (const hubspotDeal of deals) {
      // Apply filters based on configuration
      const shouldSync = this.shouldSyncDeal(hubspotDeal, syncConfig);
      
      if (shouldSync) {
        // Pass the pre-fetched company name if available
        const preloadedCompanyName = dealCompanyMap.get(hubspotDeal.id);
        const syncedDeal = await this.upsertDeal(companyId, hubspotDeal, syncConfig, preloadedCompanyName);
        
        // Track creates vs updates
        if (syncedDeal._isNew) {
          dealsCreated++;
        } else {
          dealsUpdated++;
        }
        
        // Remove the temporary flag before adding to results
        delete syncedDeal._isNew;
        syncedDeals.push(syncedDeal);
      } else {
        skippedDeals.push({
          id: hubspotDeal.properties.hs_object_id,
          name: hubspotDeal.properties.dealname,
          reason: 'Filtered by sync configuration'
        });
      }
    }
    
    return {
      success: true,
      deals_synced: syncedDeals.length,
      deals_created: dealsCreated,
      deals_updated: dealsUpdated,
      deals_skipped: skippedDeals.length,
      deals: syncedDeals,
      skipped: skippedDeals
    };
  }
  
  // Batch fetch company associations for performance
  async batchFetchCompanyAssociations(deals) {
    const dealCompanyMap = new Map();
    
    if (deals.length === 0) return dealCompanyMap;
    
    try {
      const client = await this.getClient(deals[0].companyId);
      const dealIds = deals
        .filter(deal => deal.id || deal.properties?.hs_object_id)
        .map(deal => ({ id: String(deal.id || deal.properties.hs_object_id) }));
      
      if (dealIds.length === 0) return dealCompanyMap;
      
      // Batch fetch associations
      const batchSize = 100;
      for (let i = 0; i < dealIds.length; i += batchSize) {
        const batch = dealIds.slice(i, i + batchSize);
        
        try {
          const associations = await client.crm.associations.batchApi.read(
            'deals',
            'companies', 
            { inputs: batch }
          );
          
          // Process association results
          for (const result of associations.results || []) {
            const fromObj = result._from || result.from;
            if (result && fromObj && result.to && result.to.length > 0) {
              dealCompanyMap.set(fromObj.id, result.to[0].id);
            }
          }
        } catch (batchError) {
          console.error(`Failed to fetch associations batch:`, batchError.message);
        }
      }
      
      // Fetch company details
      const companyIds = Array.from(dealCompanyMap.values());
      if (companyIds.length > 0) {
        const companyDetailsMap = new Map();
        
        for (let i = 0; i < companyIds.length; i += batchSize) {
          const batch = companyIds.slice(i, i + batchSize);
          
          try {
            const companiesResponse = await client.crm.companies.batchApi.read({
              inputs: batch.map(id => ({ id })),
              properties: ['name']
            });
            
            for (const company of companiesResponse.results || []) {
              companyDetailsMap.set(company.id, company.properties.name || 'Unknown Company');
            }
          } catch (batchError) {
            console.error(`Failed to fetch companies batch:`, batchError.message);
          }
        }
        
        // Map deal IDs to company names
        for (const [dealId, companyId] of dealCompanyMap.entries()) {
          const companyName = companyDetailsMap.get(companyId);
          if (companyName) {
            dealCompanyMap.set(dealId, companyName);
          }
        }
      }
    } catch (error) {
      console.error('Error batch fetching company associations:', error);
    }
    
    return dealCompanyMap;
  }

  // Sync deals incrementally based on last modified date
  async syncDealsIncremental(companyId, options = {}) {
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
      
      if (!integration) {
        throw new Error('HubSpot integration not found');
      }
      
      // Determine the starting point for incremental sync
      const lastModifiedSync = options.since || integration.last_modified_sync || 
        new Date(Date.now() - 24 * 60 * 60 * 1000); // Default to 24 hours ago
      
      // Build search request for modified deals
      const searchRequest = {
        filterGroups: [{
          filters: [{
            propertyName: 'hs_lastmodifieddate',
            operator: 'GTE',
            value: lastModifiedSync.getTime().toString()
          }]
        }],
        properties: [
          'dealname',
          'amount',
          'dealstage',
          'closedate',
          'createdate',
          'hs_object_id',
          'pipeline',
          'hubspot_owner_id',
          'hs_lastmodifieddate'
        ],
        sorts: [{ propertyName: 'hs_lastmodifieddate', direction: 'ASCENDING' }],
        limit: options.limit || 100,
        after: options.after || integration.sync_cursor || '0'
      };
      
      // Add custom properties if configured
      if (integration.property_mappings) {
        const customProps = Object.keys(integration.property_mappings);
        searchRequest.properties.push(...customProps);
      }
      
      console.log(`🔄 Incremental sync: fetching deals modified since ${lastModifiedSync.toISOString()}`);
      
      // Search for modified deals
      const response = await client.crm.deals.searchApi.doSearch(searchRequest);
      
      // Process results using existing sync logic
      const syncResult = await this.processSyncResults(
        companyId, 
        response.results || [], 
        integration
      );
      
      // Update sync tracking
      let newLastModified = lastModifiedSync;
      if (response.results && response.results.length > 0) {
        const lastDeal = response.results[response.results.length - 1];
        if (lastDeal.properties.hs_lastmodifieddate) {
          newLastModified = new Date(parseInt(lastDeal.properties.hs_lastmodifieddate));
        }
      }
      
      // Update integration record
      await prisma.crm_integrations.update({
        where: { id: integration.id },
        data: {
          last_sync: new Date(),
          last_modified_sync: newLastModified,
          sync_cursor: response.paging?.next?.after || null,
          last_sync_deals_count: syncResult.deals_synced,
          last_sync_created: syncResult.deals_created,
          last_sync_updated: syncResult.deals_updated,
          total_deals_synced: {
            increment: syncResult.deals_created
          },
          sync_status: 'idle',
          error_count: 0
        }
      });
      
      console.log(`✅ Incremental sync complete: ${syncResult.deals_synced} deals processed`);
      
      return {
        ...syncResult,
        has_more: response.paging?.next?.after ? true : false,
        next_cursor: response.paging?.next?.after,
        last_modified: newLastModified
      };
      
    } catch (error) {
      console.error('Error in incremental sync:', error);
      
      // Update error status
      await prisma.crm_integrations.updateMany({
        where: {
          company_id: companyId,
          crm_type: 'hubspot'
        },
        data: {
          sync_status: 'error',
          last_error_message: error.message,
          error_count: { increment: 1 }
        }
      });
      
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
      
      // Fetch HubSpot user data if auto-create is enabled
      let hubspotUsers = [];
      if (syncOptions.autoCreateUsers) {
        try {
          // Fetch all users from HubSpot
          const allUsers = await this.getUsers(companyId);
          
          // If specific users are selected, filter to only those users
          if (syncConfig.users && syncConfig.users.length > 0) {
            console.log(`Filtering to ${syncConfig.users.length} selected HubSpot users...`);
            hubspotUsers = allUsers.filter(user => 
              syncConfig.users.includes(user.id) || 
              syncConfig.users.includes(user.id.toString())
            );
            console.log(`Found ${hubspotUsers.length} matching users from HubSpot`);
          } else {
            // No specific users selected - use all HubSpot users for auto-creation
            console.log(`Auto-creating users: fetched ${allUsers.length} users from HubSpot`);
            hubspotUsers = allUsers;
          }
          
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
      let dealsCreated = 0;
      let dealsUpdated = 0;

      // Pre-fetch all company associations in batch to avoid rate limiting
      const dealCompanyMap = new Map();
      
      // Filter deals that should be synced first
      const dealsToSync = deals.filter(deal => this.shouldSyncDeal(deal, syncConfig));
      
      if (dealsToSync.length > 0) {
        console.log(`Pre-fetching company associations for ${dealsToSync.length} deals...`);
        
        try {
          // Batch fetch associations for all deals at once
          // Filter out any deals without valid IDs and ensure IDs are strings
          const dealIds = dealsToSync
            .filter(deal => deal.id || deal.properties?.hs_object_id)
            .map(deal => ({ id: String(deal.id || deal.properties.hs_object_id) }));
          
          if (dealIds.length === 0) {
            console.log('Warning: No valid deal IDs found for association fetching');
          }
          
          // HubSpot batch API can handle up to 100 items at once
          const batchSize = 100;
          for (let i = 0; i < dealIds.length; i += batchSize) {
            const batch = dealIds.slice(i, i + batchSize);
            
            try {
              console.log(`  Fetching associations for batch of ${batch.length} deals...`);
              // HubSpot batch associations API expects fromObjectType, toObjectType, and batch
              const associations = await client.crm.associations.batchApi.read(
                'deals',
                'companies', 
                { inputs: batch }
              );
              
              // Log what we got back
              if (associations.results) {
                console.log(`  Got ${associations.results.length} association results`);
              }
              if (associations.errors && associations.errors.length > 0) {
                // Filter out "no association" errors which are expected
                const realErrors = associations.errors.filter(e => 
                  !e.message?.includes('No company is associated')
                );
                const noAssocCount = associations.errors.length - realErrors.length;
                if (noAssocCount > 0) {
                  console.log(`  ${noAssocCount} deals have no company associations`);
                }
                if (realErrors.length > 0) {
                  console.log(`  ${realErrors.length} actual errors in batch`);
                }
              }
              
              // Process association results
              for (const result of associations.results || []) {
                // HubSpot returns _from with underscore
                const fromObj = result._from || result.from;
                if (result && fromObj && result.to && result.to.length > 0) {
                  // Store the first associated company ID
                  dealCompanyMap.set(fromObj.id, result.to[0].id);
                  console.log(`    Mapped deal ${fromObj.id} to company ${result.to[0].id}`);
                }
              }
            } catch (batchError) {
              console.error(`Failed to fetch associations for batch ${i / batchSize + 1}:`, batchError.message);
              console.error('Error stack:', batchError.stack);
              // Skip batch fetching on error and fall back to individual fetching
            }
          }
          
          // Now fetch all company details in batch
          const companyIds = Array.from(dealCompanyMap.values());
          if (companyIds.length > 0) {
            console.log(`Fetching details for ${companyIds.length} companies...`);
            
            const companyDetailsMap = new Map();
            
            // Fetch companies in batches
            for (let i = 0; i < companyIds.length; i += batchSize) {
              const batch = companyIds.slice(i, i + batchSize);
              
              try {
                const companiesResponse = await client.crm.companies.batchApi.read({
                  inputs: batch.map(id => ({ id })),
                  properties: ['name']
                });
                
                for (const company of companiesResponse.results || []) {
                  companyDetailsMap.set(company.id, company.properties.name || 'Unknown Company');
                }
              } catch (batchError) {
                console.error(`Failed to fetch companies for batch ${i / batchSize + 1}:`, batchError.message);
              }
            }
            
            // Map deal IDs to company names
            for (const [dealId, companyId] of dealCompanyMap.entries()) {
              const companyName = companyDetailsMap.get(companyId);
              if (companyName) {
                dealCompanyMap.set(dealId, companyName);
              }
            }
          }
          
          console.log(`Successfully pre-fetched ${dealCompanyMap.size} company associations`);
        } catch (error) {
          console.error('Error pre-fetching company associations:', error.message);
          // Continue with sync even if pre-fetch fails
        }
      }

      // Process all deals
      for (const hubspotDeal of deals) {
        // Apply filters based on configuration
        const shouldSync = this.shouldSyncDeal(hubspotDeal, syncConfig);
        
        if (shouldSync) {
          // Pass the pre-fetched company name if available
          const preloadedCompanyName = dealCompanyMap.get(hubspotDeal.id);
          const syncedDeal = await this.upsertDeal(companyId, hubspotDeal, syncConfig, preloadedCompanyName);
          
          // Track creates vs updates
          if (syncedDeal._isNew) {
            dealsCreated++;
          } else {
            dealsUpdated++;
          }
          
          // Remove the temporary flag before adding to results
          delete syncedDeal._isNew;
          syncedDeals.push(syncedDeal);
        } else {
          skippedDeals.push({
            id: hubspotDeal.properties.hs_object_id,
            name: hubspotDeal.properties.dealname,
            reason: 'Filtered by sync configuration'
          });
        }
      }

      // Update last sync time with detailed tracking
      await prisma.crm_integrations.updateMany({
        where: {
          company_id: companyId,
          crm_type: 'hubspot',
          is_active: true
        },
        data: {
          last_sync: new Date(),
          last_sync_deals_count: syncedDeals.length,
          last_sync_created: dealsCreated,
          last_sync_updated: dealsUpdated,
          total_deals_synced: {
            increment: dealsCreated  // Only increment total by NEW deals
          }
        }
      });

      console.log(`Synced ${syncedDeals.length} deals (${dealsCreated} created, ${dealsUpdated} updated), skipped ${skippedDeals.length} deals based on filters`);

      return {
        success: true,
        deals_synced: syncedDeals.length,
        deals_created: dealsCreated,
        deals_updated: dealsUpdated,
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
  async upsertDeal(companyId, hubspotDeal, syncConfig = {}, preloadedCompanyName = null) {
    try {
      const properties = hubspotDeal.properties;
      
      // Map HubSpot deal stage to our status
      const status = this.mapDealStage(properties.dealstage);
      
      // Find or get user mapping based on configuration
      const userId = await this.mapDealOwner(companyId, properties.hubspot_owner_id, syncConfig);

      // Try to get company name from various sources
      let companyName = 'Unknown Company';
      
      // First priority: Use preloaded company name from batch fetch
      if (preloadedCompanyName) {
        companyName = preloadedCompanyName;
      }
      // Second priority: Check if we have a company property directly (some deals might have it)
      else if (properties.company && properties.company.trim() !== '') {
        companyName = properties.company;
      } 
      // Last resort: Try to fetch from associations (only if not preloaded)
      else if (hubspotDeal.id && !preloadedCompanyName) {
        try {
          const client = await this.getClient(companyId);
          // Get associated companies
          const associations = await client.crm.associations.batchApi.read('deals', 'companies', {
            inputs: [{ id: hubspotDeal.id }]
          });
          
          // Check for errors in the response
          if (associations.errors && associations.errors.length > 0) {
            // No association found is not an error for our purposes
            const realErrors = associations.errors.filter(e => 
              !e.message?.includes('No company is associated')
            );
            if (realErrors.length > 0) {
              console.error(`Association errors for deal ${hubspotDeal.id}:`, realErrors);
            }
          }
          
          if (associations.results?.[0]?.to?.length > 0) {
            const associatedCompanyId = associations.results[0].to[0].id;
            try {
              // Fetch company details with retry on rate limit
              const company = await client.crm.companies.basicApi.getById(associatedCompanyId, ['name']);
              companyName = company.properties.name || 'Unknown Company';
              console.log(`✅ Fetched company "${companyName}" for deal "${properties.dealname}"`);
            } catch (companyError) {
              console.error(`Failed to fetch company ${associatedCompanyId}:`, companyError.message);
              // Don't fail the whole sync for one company fetch error
            }
          } else {
            // No company association - this is expected for some deals
            console.log(`ℹ️ No company association for deal "${properties.dealname}"`);
          }
        } catch (assocError) {
          console.error(`Could not fetch associations for deal ${hubspotDeal.id}:`, assocError.message);
          // Continue with Unknown Company rather than failing
        }
      }

      const dealData = {
        deal_name: properties.dealname || 'Untitled Deal',
        // Use the company name we determined above
        account_name: companyName,
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
      let isNew = false;
      
      if (existingDeal) {
        // Update existing deal - preserve user_id unless we have a reason to change it
        // Don't change the owner just because sync config changed
        const updateData = {
          ...dealData,
          updated_at: new Date()
        };
        
        // Only update user_id if it's actually different in HubSpot
        // For now, preserve existing user_id during updates
        delete updateData.user_id;
        
        // We could optionally update if the HubSpot owner actually changed:
        // if (properties.hubspot_owner_id && properties.hubspot_owner_id !== existingDeal.last_known_owner_id) {
        //   updateData.user_id = userId;
        // }
        
        deal = await prisma.deals.update({
          where: { id: existingDeal.id },
          data: updateData
        });
        isNew = false;
      } else {
        // Create new deal
        deal = await prisma.deals.create({
          data: {
            ...dealData,
            created_at: new Date(),
            updated_at: new Date()
          }
        });
        isNew = true;
      }

      // Add metadata about whether this was a create or update
      deal._isNew = isNew;
      
      // Check if deal is closed_won and calculate commission if needed
      const normalizedStage = deal.stage?.toLowerCase().replace(/[\s_-]/g, '');
      if (normalizedStage === 'closedwon') {
        // Calculate commission if not already calculated
        if (!deal.commission_amount && deal.amount > 0) {
          const dealCommissionCalculator = (await import('./dealCommissionCalculator.js')).default;
          deal = await dealCommissionCalculator.calculateDealCommission(deal.id);
          console.log(`💰 Calculated commission for ${deal.deal_name}: £${deal.commission_amount}`);
        }
        
        // Now create commission record if we have a commission amount
        if (deal.commission_amount) {
          // Check if commission record already exists
          const existingCommission = await prisma.commissions.findUnique({
            where: { deal_id: deal.id }
          });
          
          if (!existingCommission) {
          // Find the active target for this deal's period
          const target = await prisma.targets.findFirst({
            where: {
              user_id: deal.user_id,
              is_active: true,
              period_start: { lte: deal.close_date },
              period_end: { gte: deal.close_date }
            }
          });
          
          // Create commission audit record
          try {
            await prisma.commissions.create({
              data: {
                deal_id: deal.id,
                user_id: deal.user_id,
                company_id: deal.company_id,
                
                // Snapshot data
                deal_amount: deal.amount,
                commission_rate: deal.commission_rate || 0,
                commission_amount: deal.commission_amount,
                target_id: target?.id,
                target_name: target ? `${target.period_type} Target` : 'No Target',
                period_start: target?.period_start || deal.close_date,
                period_end: target?.period_end || deal.close_date,
                
                // Workflow fields
                status: 'calculated',
                calculated_at: deal.commission_calculated_at || new Date(),
                calculated_by: deal.user_id,
                
                // Notes
                notes: `Auto-created from HubSpot sync for closed deal`
              }
            });
            console.log(`✅ Created commission record for closed deal: ${deal.deal_name}`);
          } catch (error) {
            console.error(`Failed to create commission record for deal ${deal.id}:`, error);
            // Don't fail the sync if commission record creation fails
          }
          }
        }
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
              password: 'test1234', // Default password for testing
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