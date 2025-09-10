# HubSpot Integration Implementation Checklist

## 🔴 Priority 1: Critical Improvements (Security & Performance)

### 1. Incremental Sync Implementation
- [ ] Add `last_modified_sync` field to crm_integrations table
- [ ] Implement `syncDealsIncremental()` method using hs_lastmodifieddate filter
- [ ] Store sync cursor for pagination continuation
- [ ] Update sync endpoint to use incremental by default
- [ ] Add full sync option as override parameter
- [ ] Test with 1000+ deal updates

### 2. Webhook Security
- [ ] Add HUBSPOT_WEBHOOK_SECRET to environment variables
- [ ] Implement signature validation middleware
- [ ] Add request body raw capture for signature verification
- [ ] Create webhook validation function
- [ ] Add webhook event deduplication (check event ID)
- [ ] Log all webhook attempts for audit trail

### 3. Automated Background Sync
- [ ] Install node-cron package
- [ ] Create `jobs/hubspotSyncJob.js` file
- [ ] Implement 30-minute sync schedule
- [ ] Add sync status tracking (idle/syncing/error)
- [ ] Create error recovery mechanism
- [ ] Add sync metrics logging
- [ ] Prevent concurrent sync runs
- [ ] Add manual trigger endpoint

### 4. Full Pagination Support
- [ ] Update syncDeals to handle cursor-based pagination
- [ ] Implement recursive pagination with rate limiting
- [ ] Add progress tracking for large syncs
- [ ] Store pagination state for resume capability
- [ ] Add batch size configuration
- [ ] Test with 5000+ deals

## 🟡 Priority 2: High-Value Features

### 5. Custom Property Mapping
- [ ] Add `property_mappings` JSON field to crm_integrations
- [ ] Create UI for mapping configuration
- [ ] Fetch all HubSpot deal properties endpoint
- [ ] Build property transformation engine
- [ ] Support calculated fields (e.g., ARR from amount)
- [ ] Add validation for property types
- [ ] Create default mapping templates

### 6. Activity Timeline Sync
- [ ] Create `deal_activities` table in schema
- [ ] Add activities sync permission to HubSpot app
- [ ] Implement timeline API integration
- [ ] Sync emails, notes, calls, meetings
- [ ] Add activity filtering options
- [ ] Create activity display component
- [ ] Index activities for search

### 7. Multi-Currency Support
- [ ] Add currency field to deals table
- [ ] Integrate exchange rate API
- [ ] Create currency conversion service
- [ ] Update commission calculations for currency
- [ ] Add base currency configuration
- [ ] Display original and converted amounts
- [ ] Cache exchange rates daily

### 8. Deal Products Foundation
- [ ] Design deal_line_items table schema
- [ ] Create Prisma migration for products
- [ ] Add products relationship to deals model
- [ ] Create products API endpoints
- [ ] Build products UI component
- [ ] Note: Full sync implementation after table creation

## 📊 Implementation Timeline

### Week 1 Sprint
**Goal: Security & Core Performance**
- [ ] Day 1-2: Incremental sync
- [ ] Day 3: Webhook security
- [ ] Day 4-5: Automated sync job
- [ ] Testing & deployment

### Week 2 Sprint
**Goal: Enhanced Data Coverage**
- [ ] Day 1-2: Pagination support
- [ ] Day 3-4: Custom property mapping
- [ ] Day 5: Testing & bug fixes

### Week 3 Sprint
**Goal: Advanced Features**
- [ ] Day 1-2: Activity timeline
- [ ] Day 3-4: Multi-currency
- [ ] Day 5: Integration testing

### Week 4 Sprint
**Goal: Products & Polish**
- [ ] Day 1-2: Deal products schema
- [ ] Day 3-4: Products sync (when ready)
- [ ] Day 5: Documentation & cleanup

## 🧪 Testing Requirements

### Performance Tests
- [ ] Sync 5000 deals in under 60 seconds
- [ ] Handle rate limiting gracefully
- [ ] Resume interrupted syncs
- [ ] Memory usage under 512MB

### Security Tests
- [ ] Reject invalid webhook signatures
- [ ] Handle token expiry during sync
- [ ] Validate all user inputs
- [ ] Test SQL injection prevention

### Data Integrity Tests
- [ ] No duplicate deals created
- [ ] Commission calculations accurate
- [ ] Currency conversions correct
- [ ] Activities properly linked

## 📝 Code Snippets to Implement

### Incremental Sync
```javascript
// backend/services/hubspot.js
async syncDealsIncremental(companyId, since = null) {
  const integration = await this.getIntegration(companyId);
  const lastSync = since || integration.last_modified_sync || 
    new Date(Date.now() - 24*60*60*1000);
  
  const filter = {
    propertyName: 'hs_lastmodifieddate',
    operator: 'GTE',
    value: lastSync.getTime()
  };
  
  const searchRequest = {
    filterGroups: [{ filters: [filter] }],
    properties: this.dealProperties,
    sorts: [{ propertyName: 'hs_lastmodifieddate', direction: 'ASCENDING' }],
    limit: 100
  };
  
  // Continue with pagination...
}
```

### Webhook Validation
```javascript
// backend/middleware/hubspotWebhook.js
const crypto = require('crypto');

function validateHubSpotSignature(req, res, next) {
  const signature = req.headers['x-hubspot-signature-v3'];
  const timestamp = req.headers['x-hubspot-request-timestamp'];
  
  // Check timestamp is within 5 minutes
  const currentTime = Date.now();
  if (Math.abs(currentTime - parseInt(timestamp)) > 300000) {
    return res.status(401).json({ error: 'Request timestamp too old' });
  }
  
  const sourceString = req.method + req.originalUrl + req.rawBody + timestamp;
  const hash = crypto.createHmac('sha256', process.env.HUBSPOT_WEBHOOK_SECRET)
    .update(sourceString)
    .digest('hex');
  
  if (signature !== `v3=${hash}`) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  next();
}
```

### Automated Sync Job
```javascript
// backend/jobs/hubspotSyncJob.js
import cron from 'node-cron';
import HubSpotService from '../services/hubspot.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Run every 30 minutes
cron.schedule('*/30 * * * *', async () => {
  console.log('🔄 Starting HubSpot sync job...');
  
  const integrations = await prisma.crm_integrations.findMany({
    where: {
      crm_type: 'hubspot',
      is_active: true,
      sync_status: { not: 'syncing' }
    }
  });
  
  for (const integration of integrations) {
    try {
      // Mark as syncing
      await prisma.crm_integrations.update({
        where: { id: integration.id },
        data: { sync_status: 'syncing' }
      });
      
      // Run incremental sync
      const result = await HubSpotService.syncDealsIncremental(
        integration.company_id
      );
      
      // Update status
      await prisma.crm_integrations.update({
        where: { id: integration.id },
        data: {
          sync_status: 'idle',
          last_sync: new Date(),
          error_count: 0
        }
      });
      
      console.log(`✅ Synced ${result.deals_synced} deals for ${integration.company_id}`);
      
    } catch (error) {
      console.error(`❌ Sync failed for ${integration.company_id}:`, error);
      
      await prisma.crm_integrations.update({
        where: { id: integration.id },
        data: {
          sync_status: 'error',
          last_error_message: error.message,
          error_count: { increment: 1 }
        }
      });
    }
  }
});
```

## 🚀 Deployment Checklist

### Environment Setup
- [ ] Add new environment variables
- [ ] Update .env.example
- [ ] Configure production secrets
- [ ] Set up Redis for caching (optional)

### Database Migrations
- [ ] Create migration for new fields
- [ ] Test migration on staging
- [ ] Backup production database
- [ ] Run production migration

### Monitoring
- [ ] Set up error alerting
- [ ] Configure sync metrics dashboard
- [ ] Add health check endpoint
- [ ] Create runbook for issues

## 📈 Success Metrics

- **Performance**: 80% reduction in sync time
- **Reliability**: 99.9% webhook success rate
- **Coverage**: 100% of deals synced accurately
- **Security**: Zero unauthorized webhook processing
- **Automation**: Zero manual interventions required