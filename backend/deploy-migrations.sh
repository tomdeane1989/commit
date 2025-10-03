#!/bin/bash

# Script to deploy migrations to production database
# Usage: ./deploy-migrations.sh "your-production-database-url"

if [ -z "$1" ]; then
    echo "Error: Please provide the production DATABASE_URL as an argument"
    echo "Usage: ./deploy-migrations.sh \"postgresql://...\""
    exit 1
fi

echo "🚀 Deploying migrations to production database..."
echo ""

# Export the DATABASE_URL for this session only
export DATABASE_URL="$1"

# Run migrations
echo "Running prisma migrate deploy..."
npx prisma migrate deploy

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migrations deployed successfully!"
else
    echo ""
    echo "❌ Migration deployment failed. Please check the error above."
    exit 1
fi

# Unset the DATABASE_URL to avoid accidents
unset DATABASE_URL

echo ""
echo "📝 Migration deployment complete. Your production database is now up to date."