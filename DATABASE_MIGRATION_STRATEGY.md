# Database Migration Strategy for Sales Commission SaaS

## 🎯 **Problem Statement**
Current development workflow causes production breakage when database schema changes are deployed. We need a scalable process that:
- Preserves existing production data
- Allows safe schema updates without downtime
- Provides rollback capabilities for failed migrations
- Enables testing database changes before production deployment

## 🏗️ **Migration Workflow Architecture**

### **1. Environment Setup**
```
Development → Staging → Production
     ↓           ↓          ↓
Local DB → Staging DB → Production DB
```

### **2. Prisma Migration Process**
```bash
# Development Phase
1. Make schema changes in prisma/schema.prisma
2. Generate migration: npx prisma migrate dev --name descriptive_name
3. Test locally with existing data
4. Commit migration files to git

# Staging Phase  
5. Deploy to staging environment
6. Run migration on staging: npx prisma migrate deploy
7. Test full application functionality
8. Validate data integrity

# Production Phase
9. Create automated backup
10. Deploy migration: npx prisma migrate deploy
11. Verify application health
12. Monitor for errors
```

## 📋 **Implementation Steps**

### **Step 1: Set Up Proper Migration Files**
```bash
# Initialize Prisma migrations (one-time setup)
cd backend
npx prisma migrate dev --name initial_schema

# For future changes
npx prisma migrate dev --name add_parent_target_relationship
```

### **Step 2: Create Production Migration Script**
```bash
#!/bin/bash
# scripts/deploy-migration.sh

set -e

echo "🔄 Starting production database migration..."

# 1. Create backup
echo "📦 Creating database backup..."
pg_dump $DATABASE_URL > "backup_$(date +%Y%m%d_%H%M%S).sql"

# 2. Run migration
echo "🚀 Deploying migration..."
npx prisma migrate deploy

# 3. Verify schema
echo "✅ Verifying schema..."
npx prisma db pull --force

# 4. Health check
echo "🏥 Running health check..."
curl -f $BACKEND_URL/health || exit 1

echo "✅ Migration completed successfully"
```

### **Step 3: Update Environment Variables**
```bash
# Production .env additions
MIGRATION_BACKUP_ENABLED=true
MIGRATION_ROLLBACK_ENABLED=true
DATABASE_BACKUP_RETENTION_DAYS=30
```

### **Step 4: Create Staging Environment**
```yaml
# staging-docker-compose.yml
version: '3.8'
services:
  postgres-staging:
    image: postgres:14
    environment:
      POSTGRES_DB: sales_commission_staging
      POSTGRES_USER: staging_user
      POSTGRES_PASSWORD: staging_password
    ports:
      - "5433:5432"
    volumes:
      - staging_db_data:/var/lib/postgresql/data

  backend-staging:
    build: ./backend
    environment:
      DATABASE_URL: postgresql://staging_user:staging_password@postgres-staging:5432/sales_commission_staging
      NODE_ENV: staging
    depends_on:
      - postgres-staging
```

## 🔒 **Data Preservation Strategy**

### **Backward Compatibility Pattern**
```javascript
// Always implement graceful field access
const getUserTarget = async (userId) => {
  const target = await prisma.targets.findFirst({
    where: { user_id: userId }
  });
  
  return {
    id: target.id,
    amount: target.amount,
    // Safe access to new fields
    parent_target_id: target.parent_target_id || null,
    team_target: target.team_target ?? false,
    distribution_method: target.distribution_method || 'even'
  };
};
```

### **Migration Safety Checks**
```sql
-- Add columns with safe defaults
ALTER TABLE targets ADD COLUMN parent_target_id TEXT DEFAULT NULL;
ALTER TABLE targets ADD COLUMN team_target BOOLEAN DEFAULT FALSE;
ALTER TABLE targets ADD COLUMN distribution_method TEXT DEFAULT 'even';

-- Create indexes after data population
CREATE INDEX CONCURRENTLY idx_targets_parent_id ON targets(parent_target_id);
```

## 🚀 **Production Deployment Process**

### **Pre-Deployment Checklist**
- [ ] All migrations tested locally
- [ ] Staging environment validates migration
- [ ] Database backup created and verified
- [ ] Rollback plan documented
- [ ] Team notified of deployment window
- [ ] Health monitoring enabled

### **Deployment Commands**
```bash
# 1. Backup current production database
./scripts/backup-production-db.sh

# 2. Deploy application code (triggers auto-deploy)
git checkout main
git merge develop
git push origin main

# 3. Run migration on production
render-cli exec --service backend -- npx prisma migrate deploy

# 4. Verify deployment
./scripts/verify-production-health.sh
```

### **Rollback Procedure**
```bash
# If migration fails or causes issues
# 1. Revert application code
git revert HEAD
git push origin main

# 2. Restore database from backup
./scripts/restore-production-db.sh backup_20250128_143000.sql

# 3. Verify rollback success  
./scripts/verify-production-health.sh
```

## 📊 **Migration Monitoring**

### **Health Check Endpoints**
```javascript
// Add to server-working.js
app.get('/health', async (req, res) => {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    
    // Test critical queries
    const userCount = await prisma.users.count();
    const targetCount = await prisma.targets.count();
    
    res.json({
      status: 'healthy',
      database: 'connected',
      users: userCount,
      targets: targetCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});
```

### **Migration Logging**
```javascript
// Enhanced logging for migrations
const logMigration = (action, details) => {
  console.log(`🔄 MIGRATION: ${action} - ${JSON.stringify(details)}`);
};
```

## 🔧 **Required Script Files**

### **scripts/backup-production-db.sh**
```bash
#!/bin/bash
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/production_backup_$TIMESTAMP.sql"

mkdir -p $BACKUP_DIR
pg_dump $DATABASE_URL > $BACKUP_FILE
echo "✅ Backup created: $BACKUP_FILE"
```

### **scripts/verify-production-health.sh**
```bash
#!/bin/bash
HEALTH_URL="https://sales-commission-backend-latest.onrender.com/health"

response=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)
if [ $response -eq 200 ]; then
  echo "✅ Production health check passed"
  exit 0
else
  echo "❌ Production health check failed (HTTP $response)"
  exit 1
fi
```

## 📝 **Next Steps for Implementation**

1. **Immediate Actions**:
   - Initialize Prisma migrations in current project
   - Create migration files for recent schema changes
   - Set up backup scripts

2. **Short Term** (Next 2 weeks):
   - Create staging environment
   - Implement health check endpoints
   - Test migration workflow on staging

3. **Long Term** (Next month):
   - Set up automated backup retention
   - Create monitoring dashboards
   - Document team migration procedures

## ⚠️ **Current Production Fix**
The backward compatibility fixes implemented prevent immediate breakage, but proper migrations should still be set up for future schema changes.

---
**Created**: 2025-07-28  
**Status**: Ready for implementation  
**Priority**: High - prevents production outages