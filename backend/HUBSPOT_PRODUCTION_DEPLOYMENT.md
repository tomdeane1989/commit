# HubSpot Integration - Production Deployment Guide

## 🚨 CRITICAL: Production Requirements

This guide covers the essential steps required to deploy the HubSpot integration to production for a multi-tenant SaaS application.

## 📋 Pre-Deployment Checklist

### 1. Environment Variables (Required)

```bash
# Core HubSpot Configuration
HUBSPOT_CLIENT_ID=<your-client-id>              # From HubSpot app settings
HUBSPOT_CLIENT_SECRET=<your-client-secret>      # From HubSpot app settings
HUBSPOT_REDIRECT_URI=https://yourdomain.com/api/integrations/hubspot/callback
HUBSPOT_WEBHOOK_SECRET=<generate-secure-secret> # For webhook signature validation

# Token Encryption (CRITICAL FOR SECURITY)
TOKEN_ENCRYPTION_KEY=<generate-with-openssl>    # Generate: openssl rand -base64 32

# Redis Configuration (Required for Production)
REDIS_URL=redis://user:password@host:port       # For OAuth state storage

# Sync Configuration
HUBSPOT_SYNC_SCHEDULE="*/30 * * * *"           # Cron schedule (default: every 30 min)
HUBSPOT_SYNC_ON_STARTUP=false                  # Whether to sync on server start

# Optional Regional Configuration
HUBSPOT_REGION=US                              # US or EU (default: US)
```

### 2. Generate Secure Keys

```bash
# Generate webhook secret (32 bytes)
openssl rand -hex 32

# Generate token encryption key (32 bytes base64)
openssl rand -base64 32
```

### 3. Database Migration

Run the following migrations in production:

```sql
-- Apply schema changes from DATABASE_SCHEMA_AUDIT.md
BEGIN;

-- Create webhook_events table for deduplication
CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE NOT NULL,
  processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_expires_at ON webhook_events(expires_at);

-- Add new columns to crm_integrations
ALTER TABLE crm_integrations 
ADD COLUMN IF NOT EXISTS sync_config JSONB,
ADD COLUMN IF NOT EXISTS last_sync_created INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_sync_updated INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_modified_sync TIMESTAMP,
ADD COLUMN IF NOT EXISTS sync_cursor TEXT,
ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'idle',
ADD COLUMN IF NOT EXISTS last_error_message TEXT,
ADD COLUMN IF NOT EXISTS error_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS property_mappings JSONB;

-- Add check constraint for sync_status
ALTER TABLE crm_integrations 
ADD CONSTRAINT chk_sync_status 
CHECK (sync_status IN ('idle', 'syncing', 'error', 'disabled'));

COMMIT;
```

### 4. Token Encryption Migration

After deploying the new code, migrate existing tokens to encrypted format:

```bash
cd backend
node utils/migrateTokens.js
```

## 🔐 Security Configuration

### 1. HubSpot App Settings

In your HubSpot app settings (app.hubspot.com/developers):

1. **OAuth Settings**:
   - Redirect URL: `https://yourdomain.com/api/integrations/hubspot/callback`
   - Required Scopes:
     - `crm.objects.companies.read`
     - `crm.objects.contacts.read`
     - `crm.objects.deals.read`
     - `crm.objects.deals.write`
     - `crm.objects.owners.read`
     - `oauth`

2. **Webhook Settings**:
   - Webhook URL: `https://yourdomain.com/api/integrations/hubspot/webhook`
   - Subscriptions:
     - `deal.creation`
     - `deal.propertyChange`
     - `deal.deletion`

### 2. Redis Configuration

Redis is REQUIRED for production to handle OAuth state across multiple server instances:

```javascript
// Example Redis connection for production
REDIS_URL=redis://default:password@redis-host.com:6379
```

Options for Redis hosting:
- **Render**: Redis instance in same region as backend
- **AWS ElastiCache**: For AWS deployments
- **Redis Cloud**: Managed Redis service
- **Upstash**: Serverless Redis (good for low traffic)

### 3. Token Security

Tokens are encrypted at rest using AES-256-GCM. Ensure:
1. `TOKEN_ENCRYPTION_KEY` is set in production
2. Key is stored securely (use environment variables, not code)
3. Key is backed up securely (loss means re-authentication for all users)
4. Rotate keys periodically (implement key versioning for smooth rotation)

## 🚀 Deployment Steps

### 1. Render Deployment

Add these environment variables to your Render service:

```bash
# In Render Dashboard > Environment
HUBSPOT_CLIENT_ID=xxx
HUBSPOT_CLIENT_SECRET=xxx
HUBSPOT_REDIRECT_URI=https://your-backend.onrender.com/api/integrations/hubspot/callback
HUBSPOT_WEBHOOK_SECRET=xxx
TOKEN_ENCRYPTION_KEY=xxx
REDIS_URL=redis://red-xxx.render.com:6379
```

### 2. Vercel Frontend Update

Update frontend environment:

```bash
# In Vercel Dashboard > Settings > Environment Variables
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
```

### 3. Post-Deployment Verification

```bash
# 1. Test OAuth flow
curl https://your-backend.onrender.com/api/integrations/hubspot/status

# 2. Verify webhook endpoint
curl -X POST https://your-backend.onrender.com/api/integrations/hubspot/webhook \
  -H "Content-Type: application/json" \
  -d '[]'

# 3. Check sync job status
curl https://your-backend.onrender.com/api/integrations/hubspot/sync/status \
  -H "Authorization: Bearer <admin-token>"

# 4. Monitor logs for sync execution
# Should see: "📅 Scheduling HubSpot sync with cron: */30 * * * *"
```

## 📊 Monitoring

### 1. Key Metrics to Monitor

- **Sync Status**: Check `sync_status` field in `crm_integrations` table
- **Error Rate**: Monitor `error_count` field
- **Token Refreshes**: Track successful vs failed refreshes
- **Webhook Processing**: Monitor `webhook_events` table size
- **API Rate Limits**: HubSpot allows 100 requests per 10 seconds

### 2. Monitoring Queries

```sql
-- Check integration health
SELECT 
  company_id,
  sync_status,
  last_sync,
  error_count,
  last_error_message
FROM crm_integrations
WHERE crm_type = 'hubspot'
ORDER BY error_count DESC;

-- Monitor webhook processing
SELECT 
  DATE(processed_at) as date,
  COUNT(*) as events_processed
FROM webhook_events
WHERE processed_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(processed_at)
ORDER BY date DESC;

-- Find stuck syncs
SELECT * FROM crm_integrations
WHERE sync_status = 'syncing'
AND updated_at < NOW() - INTERVAL '1 hour';
```

### 3. Cleanup Jobs

Set up a daily cleanup job for expired webhook events:

```sql
-- Run daily
DELETE FROM webhook_events WHERE expires_at < NOW();
```

## 🔄 Rollback Plan

If issues occur, follow this rollback procedure:

1. **Disable sync job**: Set `HUBSPOT_SYNC_ON_STARTUP=false`
2. **Deactivate integrations**: 
   ```sql
   UPDATE crm_integrations 
   SET is_active = false, sync_status = 'disabled'
   WHERE crm_type = 'hubspot';
   ```
3. **Clear webhook events**: 
   ```sql
   TRUNCATE webhook_events;
   ```
4. **Restore previous deployment**

## ⚠️ Known Limitations

1. **Single OAuth App**: Currently uses one HubSpot app for all tenants
   - **Impact**: All tenants share rate limits
   - **Solution**: Implement OAuth app per tenant (future enhancement)

2. **Rate Limiting**: HubSpot API limits: 100 requests per 10 seconds
   - **Impact**: Large syncs may be throttled
   - **Solution**: Batch processing and incremental syncs implemented

3. **Webhook Delivery**: No guaranteed delivery from HubSpot
   - **Impact**: Missed events possible
   - **Solution**: Regular incremental syncs as backup

## 📞 Support Contacts

- **HubSpot Developer Support**: developers.hubspot.com/support
- **Internal Team**: Update with your team contacts
- **Escalation**: Update with escalation procedures

## 📝 Post-Deployment Tasks

1. [ ] Verify all environment variables are set
2. [ ] Run token encryption migration
3. [ ] Test OAuth flow with a test account
4. [ ] Verify webhook signature validation
5. [ ] Confirm sync job is running on schedule
6. [ ] Set up monitoring alerts
7. [ ] Document customer onboarding process
8. [ ] Train support team on troubleshooting

## 🔒 Security Notes

- **Never** commit tokens or secrets to version control
- **Always** use HTTPS for callbacks and webhooks
- **Rotate** encryption keys periodically
- **Monitor** for suspicious activity
- **Implement** rate limiting on your endpoints
- **Use** webhook signature validation in production

---

**Last Updated**: 2025-09-22
**Version**: 1.0.0
**Status**: Ready for Production Deployment