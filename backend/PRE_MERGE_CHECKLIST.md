# Pre-Merge Checklist: HubSpot Integration to Main Branch

## 🚨 CRITICAL: Breaking Changes & Requirements

This document outlines all breaking changes and required steps before merging `feature/hubspot-integration` to `main` and deploying to production.

## 📊 Database Changes

### 1. **NEW TABLE: webhook_events**
```sql
CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE NOT NULL,
  processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_expires_at ON webhook_events(expires_at);
```

### 2. **MODIFIED TABLE: crm_integrations**
New columns added:
- `sync_config` (JSONB)
- `last_sync_created` (INTEGER)
- `last_sync_updated` (INTEGER)
- `last_modified_sync` (TIMESTAMP)
- `sync_cursor` (TEXT)
- `sync_status` (TEXT)
- `last_error_message` (TEXT)
- `error_count` (INTEGER)
- `property_mappings` (JSONB)

**Migration Required**: YES - Run migrations before deploying code

## 🔧 New Dependencies

### NPM Packages Added:
1. **@hubspot/api-client** (^13.1.0) - HubSpot API SDK
2. **ioredis** (^5.7.0) - Redis client for state storage

**Action Required**: These will auto-install on Render deployment

## 🔑 Required Environment Variables

### CRITICAL - Application Won't Start Without These:

```bash
# HubSpot OAuth (REQUIRED)
HUBSPOT_CLIENT_ID=<your-client-id>
HUBSPOT_CLIENT_SECRET=<your-client-secret>
HUBSPOT_REDIRECT_URI=https://sales-commission-backend-latest.onrender.com/api/integrations/hubspot/callback

# Security (REQUIRED for production)
TOKEN_ENCRYPTION_KEY=<generate-with: openssl rand -base64 32>
HUBSPOT_WEBHOOK_SECRET=<generate-with: openssl rand -hex 32>

# Redis (REQUIRED for production, optional for dev)
REDIS_URL=<redis://...>

# Sync Configuration (OPTIONAL)
HUBSPOT_SYNC_SCHEDULE="*/30 * * * *"  # Default: every 30 minutes
HUBSPOT_SYNC_ON_STARTUP=false         # Default: false
```

### ⚠️ BREAKING: Missing TOKEN_ENCRYPTION_KEY will cause:
- New integrations won't save tokens properly
- Existing integrations may fail to authenticate

### ⚠️ BREAKING: Missing REDIS_URL will cause:
- OAuth state stored in memory (lost on restart)
- Multi-instance deployments will fail OAuth flows
- CSRF protection will be weakened

## 📝 Deployment Steps (In Order)

### Step 1: Set Environment Variables on Render

1. Go to Render Dashboard > Your Backend Service > Environment
2. Add ALL required environment variables listed above
3. Generate secure keys:
   ```bash
   # Generate TOKEN_ENCRYPTION_KEY
   openssl rand -base64 32
   
   # Generate HUBSPOT_WEBHOOK_SECRET
   openssl rand -hex 32
   ```
4. Save and wait for environment to update

### Step 2: Deploy Redis Instance (if not already done)

Options:
1. **Render Redis**: Create Redis instance in same region
2. **Upstash**: Use serverless Redis (good for low traffic)
3. **Redis Cloud**: Managed Redis service

Get connection string and add as `REDIS_URL`

### Step 3: Run Database Migrations

```bash
# SSH into Render instance or run via Render shell
cd /opt/render/project/src/backend
npx prisma migrate deploy
```

### Step 4: Merge and Deploy Code

```bash
# Local
git checkout main
git merge feature/hubspot-integration
git push origin main

# Render will auto-deploy
```

### Step 5: Migrate Existing Tokens (if any exist)

```bash
# After deployment, run on Render:
node utils/migrateTokens.js
```

### Step 6: Configure HubSpot App

1. Go to app.hubspot.com/developers
2. Update OAuth Redirect URL to production URL
3. Configure webhook URL: `https://sales-commission-backend-latest.onrender.com/api/integrations/hubspot/webhook`
4. Copy webhook secret to `HUBSPOT_WEBHOOK_SECRET` env var

## ✅ Post-Deployment Verification

### 1. Check Server Health
```bash
curl https://sales-commission-backend-latest.onrender.com/health
```

### 2. Verify HubSpot Routes
```bash
curl https://sales-commission-backend-latest.onrender.com/api/integrations/hubspot/status
# Should return: {"connected": false, "message": "HubSpot integration not configured"}
```

### 3. Check Redis Connection
Monitor logs for:
- `✅ Redis connected for state storage`
- Or: `⚠️ Redis not available, using in-memory state store`

### 4. Verify Cron Job Started
Look for in logs:
- `📅 Scheduling HubSpot sync with cron: */30 * * * *`
- `✅ HubSpot sync cron job started`

### 5. Test OAuth Flow
1. Login as admin user
2. Go to Integrations page
3. Click "Connect HubSpot"
4. Complete OAuth flow
5. Verify redirect back to app

## 🔄 Rollback Plan

If issues occur after deployment:

### Quick Rollback:
1. Revert to previous Render deployment (instant)
2. Or manually revert:
   ```bash
   git revert HEAD
   git push origin main
   ```

### Database Rollback (if needed):
```sql
-- Remove new columns (data loss warning)
ALTER TABLE crm_integrations 
DROP COLUMN IF EXISTS sync_config,
DROP COLUMN IF EXISTS last_sync_created,
DROP COLUMN IF EXISTS last_sync_updated,
DROP COLUMN IF EXISTS last_modified_sync,
DROP COLUMN IF EXISTS sync_cursor,
DROP COLUMN IF EXISTS sync_status,
DROP COLUMN IF EXISTS last_error_message,
DROP COLUMN IF EXISTS error_count,
DROP COLUMN IF EXISTS property_mappings;

-- Drop webhook events table
DROP TABLE IF EXISTS webhook_events;
```

## ⚠️ Known Issues & Mitigations

### 1. **Token Encryption**
- **Issue**: Existing tokens are unencrypted
- **Fix**: Run `node utils/migrateTokens.js` after deployment

### 2. **Redis Not Available**
- **Issue**: Falls back to in-memory storage
- **Impact**: OAuth may fail after server restart
- **Fix**: Ensure Redis is configured before heavy usage

### 3. **Rate Limiting**
- **Issue**: HubSpot limits to 100 requests/10 seconds
- **Impact**: Large syncs may be throttled
- **Mitigation**: Incremental syncs and batching implemented

### 4. **Multi-Tenant OAuth**
- **Issue**: Single OAuth app for all tenants
- **Impact**: Shared rate limits
- **Future Fix**: Implement per-tenant OAuth apps

## 📈 Monitoring After Deployment

### Key Metrics to Watch:
1. **Error Rate**: Check Render logs for errors
2. **Sync Status**: Monitor `crm_integrations.sync_status`
3. **Token Refreshes**: Track successful vs failed refreshes
4. **Webhook Events**: Monitor `webhook_events` table growth

### SQL Monitoring Queries:
```sql
-- Check integration health
SELECT company_id, sync_status, error_count, last_error_message 
FROM crm_integrations 
WHERE crm_type = 'hubspot';

-- Check webhook processing
SELECT DATE(processed_at) as date, COUNT(*) as events 
FROM webhook_events 
WHERE processed_at > NOW() - INTERVAL '1 day'
GROUP BY date;

-- Find stuck syncs
SELECT * FROM crm_integrations
WHERE sync_status = 'syncing' 
AND updated_at < NOW() - INTERVAL '1 hour';
```

## 🚀 Go/No-Go Checklist

Before merging, confirm:
- [ ] All environment variables set on Render
- [ ] Redis instance created and REDIS_URL configured
- [ ] TOKEN_ENCRYPTION_KEY generated and set
- [ ] HUBSPOT_WEBHOOK_SECRET generated and set
- [ ] HubSpot app OAuth redirect URL updated
- [ ] Database backup taken
- [ ] Rollback plan reviewed with team
- [ ] Monitoring alerts configured
- [ ] Support team briefed on new features

## 📞 Escalation

If issues arise:
1. Check Render logs immediately
2. Run monitoring queries
3. If critical: Rollback via Render dashboard
4. Contact: [Your escalation contacts]

---

**Document Version**: 1.0
**Last Updated**: 2025-10-01
**Branch**: feature/hubspot-integration → main
**Risk Level**: MEDIUM (database changes, new dependencies)