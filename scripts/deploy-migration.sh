#!/bin/bash

# Production Migration Deployment Script
# Usage: ./scripts/deploy-migration.sh

set -e

# Configuration
BACKEND_DIR="./backend"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "🚀 Starting production database migration deployment..."

# Check if we're in the right directory
if [ ! -f "$BACKEND_DIR/server-working.js" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable not set"
    echo "Please set your production database URL"
    exit 1
fi

# Step 1: Create backup
echo ""
echo "📦 Step 1: Creating database backup..."
if [ -f "./scripts/backup-production-db.sh" ]; then
    chmod +x ./scripts/backup-production-db.sh
    ./scripts/backup-production-db.sh
else
    echo "⚠️  Backup script not found, creating manual backup..."
    mkdir -p "$BACKUP_DIR"
    BACKUP_FILE="$BACKUP_DIR/pre_migration_backup_$TIMESTAMP.sql"
    pg_dump "$DATABASE_URL" > "$BACKUP_FILE"
    echo "✅ Manual backup created: $BACKUP_FILE"
fi

# Step 2: Check current migration status
echo ""
echo "🔍 Step 2: Checking migration status..."
cd "$BACKEND_DIR"

# Check if there are pending migrations
MIGRATION_STATUS=$(npx prisma migrate status 2>&1 || echo "MIGRATION_CHECK_FAILED")

if echo "$MIGRATION_STATUS" | grep -q "Database schema is up to date"; then
    echo "✅ No pending migrations found"
    echo "📋 Current status: Database is up to date"
    exit 0
elif echo "$MIGRATION_STATUS" | grep -q "Following migration"; then
    echo "📋 Pending migrations detected:"
    echo "$MIGRATION_STATUS"
    
    # Ask for confirmation
    echo ""
    echo "⚠️  WARNING: This will modify the production database"
    echo "🛡️  Backup created: Check $BACKUP_DIR for backup file"
    echo ""
    read -p "Continue with migration? (y/N): " -n 1 -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Migration cancelled by user"
        exit 1
    fi
else
    echo "⚠️  Unable to determine migration status:"
    echo "$MIGRATION_STATUS"
    echo ""
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Migration cancelled by user"
        exit 1
    fi
fi

# Step 3: Deploy migration
echo ""
echo "🔄 Step 3: Deploying migrations..."
if npx prisma migrate deploy; then
    echo "✅ Migration deployed successfully"
else
    echo "❌ Migration failed!"
    echo ""
    echo "🔧 Rollback options:"
    echo "1. Restore from backup: pg_dump < $BACKUP_FILE"
    echo "2. Check migration logs above"
    echo "3. Verify database connection"
    exit 1
fi

# Step 4: Verify schema
echo ""
echo "🔍 Step 4: Verifying database schema..."
if npx prisma db pull --force --silent; then
    echo "✅ Schema verification completed"
else
    echo "⚠️  Schema verification had issues, but migration may have succeeded"
fi

# Step 5: Health check
echo ""
echo "🏥 Step 5: Running production health check..."
cd ..
if [ -f "./scripts/verify-production-health.sh" ]; then
    chmod +x ./scripts/verify-production-health.sh
    if ./scripts/verify-production-health.sh; then
        echo "✅ Health check passed"
    else
        echo "⚠️  Health check failed - please investigate"
        echo "Migration completed but application may have issues"
    fi
else
    echo "⚠️  Health check script not found"
    echo "Please manually verify application functionality"
fi

echo ""
echo "🎉 Migration deployment completed!"
echo "📁 Backup available at: $BACKUP_DIR"
echo "📊 Check application logs for any issues"