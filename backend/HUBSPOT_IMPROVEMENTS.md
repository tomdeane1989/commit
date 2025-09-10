# HubSpot Integration Improvements

## Priority 1: Critical Enhancements (Week 1)

### 1. Incremental Sync Implementation
```javascript
// Add to hubspot.js
async syncDealsIncremental(companyId, lastSyncTime) {
  const filter = {
    propertyName: 'hs_lastmodifieddate',
    operator: 'GT',
    value: lastSyncTime.toISOString()
  };
  
  const searchRequest = {
    filterGroups: [{ filters: [filter] }],
    properties: [...],
    limit: 100
  };
  
  return await client.crm.deals.searchApi.doSearch(searchRequest);
}
```

### 2. Webhook Security
```javascript
// Add webhook signature validation
function validateWebhookSignature(req) {
  const signature = req.headers['x-hubspot-signature-v3'];
  const sourceString = req.method + req.url + req.rawBody;
  const hash = crypto.createHmac('sha256', WEBHOOK_SECRET)
    .update(sourceString)
    .digest('hex');
  return signature === hash;
}
```

### 3. Automated Background Sync
```javascript
// Add to jobs/hubspotSyncJob.js
import cron from 'node-cron';

// Run every 30 minutes
cron.schedule('*/30 * * * *', async () => {
  const activeIntegrations = await getActiveHubSpotIntegrations();
  
  for (const integration of activeIntegrations) {
    try {
      await HubSpotService.syncDealsIncremental(
        integration.company_id,
        integration.last_sync || new Date(Date.now() - 24*60*60*1000)
      );
    } catch (error) {
      await logSyncError(integration.id, error);
    }
  }
});
```

## Priority 2: Feature Enhancements (Week 2)

### 1. Bi-directional Sync
```javascript
// Push commission data back to HubSpot
async updateHubSpotDealCommission(dealId, commissionData) {
  const properties = {
    commission_amount: commissionData.amount,
    commission_status: commissionData.status,
    commission_approved_date: commissionData.approvedDate,
    commission_paid: commissionData.paid
  };
  
  await client.crm.deals.basicApi.update(dealId, { properties });
}
```

### 2. Custom Property Mapping
```javascript
// Enhanced configuration schema
{
  propertyMappings: {
    'hs_custom_field_1': 'our_field_name',
    'hs_arr': 'annual_recurring_revenue',
    'hs_mrr': 'monthly_recurring_revenue'
  },
  calculatedFields: {
    'total_contract_value': 'amount * contract_length_months'
  }
}
```

### 3. Pagination Support
```javascript
async syncAllDeals(companyId) {
  let after = undefined;
  let allDeals = [];
  
  do {
    const response = await this.syncDeals(companyId, { 
      limit: 100, 
      after 
    });
    
    allDeals.push(...response.deals);
    after = response.next_cursor;
    
    // Rate limit protection
    await sleep(100);
  } while (after);
  
  return allDeals;
}
```

## Priority 3: Advanced Features (Week 3)

### 1. Deal Products/Line Items
```javascript
async syncDealLineItems(dealId) {
  const lineItems = await client.crm.lineItems.associationsApi
    .getAll(dealId, 'deals', 'line_items');
  
  for (const item of lineItems.results) {
    await prisma.deal_line_items.upsert({
      where: { crm_id: item.id },
      update: { ...itemData },
      create: { ...itemData }
    });
  }
}
```

### 2. Activity Timeline Sync
```javascript
async syncDealActivities(dealId) {
  const engagements = await client.crm.timeline.eventsApi
    .getAll('deal', dealId);
  
  // Store emails, notes, calls, meetings
  for (const engagement of engagements.results) {
    await prisma.deal_activities.create({
      deal_id: dealId,
      type: engagement.type,
      content: engagement.properties,
      created_at: engagement.createdAt
    });
  }
}
```

### 3. Multi-Currency Support
```javascript
async convertCurrency(amount, fromCurrency, toCurrency) {
  const rates = await getExchangeRates();
  const baseAmount = amount / rates[fromCurrency];
  return baseAmount * rates[toCurrency];
}
```

## Priority 4: Monitoring & Analytics (Week 4)

### 1. Sync Dashboard
- Real-time sync status
- Error tracking and alerts
- Performance metrics
- Data quality scores

### 2. Webhook Management
```javascript
// Webhook retry with exponential backoff
async processWebhookWithRetry(event, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await processWebhook(event);
    } catch (error) {
      const delay = Math.pow(2, i) * 1000;
      await sleep(delay);
      
      if (i === retries - 1) {
        await saveToDeadLetterQueue(event, error);
      }
    }
  }
}
```

### 3. Health Monitoring
```javascript
// Health check endpoint
router.get('/health', async (req, res) => {
  const checks = {
    api: await checkHubSpotAPI(),
    token: await checkTokenExpiry(),
    syncStatus: await getLastSyncStatus(),
    errorRate: await calculateErrorRate()
  };
  
  const healthy = Object.values(checks).every(c => c.healthy);
  res.status(healthy ? 200 : 503).json(checks);
});
```

## Implementation Checklist

### Week 1
- [ ] Implement incremental sync
- [ ] Add webhook signature validation
- [ ] Create automated sync job
- [ ] Add comprehensive error logging

### Week 2
- [ ] Build bi-directional sync
- [ ] Add custom property mapping UI
- [ ] Implement full pagination
- [ ] Add rate limit handling

### Week 3
- [ ] Sync line items/products
- [ ] Add activity timeline
- [ ] Implement multi-currency
- [ ] Create sync queue system

### Week 4
- [ ] Build monitoring dashboard
- [ ] Add webhook retry logic
- [ ] Create health checks
- [ ] Document all features

## Database Schema Updates

```sql
-- Add sync tracking
ALTER TABLE crm_integrations ADD COLUMN sync_cursor TEXT;
ALTER TABLE crm_integrations ADD COLUMN sync_status ENUM('idle', 'syncing', 'error');
ALTER TABLE crm_integrations ADD COLUMN last_error_message TEXT;
ALTER TABLE crm_integrations ADD COLUMN error_count INTEGER DEFAULT 0;

-- Add line items table
CREATE TABLE deal_line_items (
  id UUID PRIMARY KEY,
  deal_id UUID REFERENCES deals(id),
  product_name VARCHAR(255),
  quantity DECIMAL(10,2),
  price DECIMAL(15,2),
  total DECIMAL(15,2),
  crm_id VARCHAR(100)
);

-- Add activities table
CREATE TABLE deal_activities (
  id UUID PRIMARY KEY,
  deal_id UUID REFERENCES deals(id),
  type VARCHAR(50),
  content JSONB,
  created_at TIMESTAMP
);
```

## Environment Variables

```env
# Add these to .env
HUBSPOT_WEBHOOK_SECRET=your_webhook_secret
REDIS_URL=redis://localhost:6379
EXCHANGE_RATE_API_KEY=your_api_key
SENTRY_DSN=your_sentry_dsn
SYNC_INTERVAL_MINUTES=30
MAX_SYNC_RETRIES=3
```

## Testing Checklist

- [ ] Test incremental sync with 1000+ deals
- [ ] Verify webhook signature validation
- [ ] Test rate limit handling
- [ ] Validate currency conversion
- [ ] Test error recovery
- [ ] Load test sync performance
- [ ] Test bi-directional updates
- [ ] Verify data consistency

## Success Metrics

1. **Performance**
   - Sync time < 30 seconds for 1000 deals
   - API calls reduced by 70% with caching
   - Zero data loss during sync

2. **Reliability**
   - 99.9% webhook delivery rate
   - Automatic recovery from errors
   - Token refresh without interruption

3. **Completeness**
   - 100% of deal fields mapped
   - All activities captured
   - Full audit trail maintained

## Notes

- Consider using HubSpot's Batch API for bulk operations
- Implement circuit breaker pattern for API failures
- Add feature flags for gradual rollout
- Create migration plan for existing data
- Document all custom properties in HubSpot