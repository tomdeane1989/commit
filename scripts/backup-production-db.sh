#!/bin/bash

# Production Database Backup Script
# Usage: ./scripts/backup-production-db.sh

set -e

# Configuration
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/production_backup_$TIMESTAMP.sql"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable not set"
    echo "Please set your production database URL:"
    echo "export DATABASE_URL='your_production_database_url'"
    exit 1
fi

echo "🔄 Starting database backup..."
echo "📦 Creating backup: $BACKUP_FILE"

# Create backup
if pg_dump "$DATABASE_URL" > "$BACKUP_FILE"; then
    # Get backup file size
    FILESIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    
    echo "✅ Backup completed successfully"
    echo "📁 File: $BACKUP_FILE"
    echo "📏 Size: $FILESIZE"
    
    # List last 5 backups
    echo ""
    echo "📋 Recent backups:"
    ls -lt "$BACKUP_DIR"/*.sql 2>/dev/null | head -5 || echo "   No previous backups found"
    
else
    echo "❌ Backup failed"
    rm -f "$BACKUP_FILE" 2>/dev/null
    exit 1
fi

# Cleanup old backups (keep last 10)
echo ""
echo "🧹 Cleaning up old backups (keeping 10 most recent)..."
ls -t "$BACKUP_DIR"/*.sql 2>/dev/null | tail -n +11 | xargs rm -f
echo "✅ Cleanup completed"