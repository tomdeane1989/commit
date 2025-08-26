#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Use production database URL
const productionDatabaseUrl = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL;

if (!productionDatabaseUrl || !productionDatabaseUrl.includes('render.com')) {
  console.error('❌ Production database URL not found or not a Render database');
  console.log('Please set PRODUCTION_DATABASE_URL in your .env file');
  process.exit(1);
}

console.log('🔧 Connecting to production database...');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: productionDatabaseUrl
    }
  }
});

async function createCommissionsTables() {
  try {
    // Check if commissions table already exists
    const tableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'commissions'
      );
    `;

    if (tableExists[0].exists) {
      console.log('✅ commissions table already exists');
    } else {
      console.log('📦 Creating commissions table...');

      // Create the commissions table matching the Prisma schema
      await prisma.$executeRaw`
        CREATE TABLE "commissions" (
          "id" TEXT NOT NULL,
          "deal_id" TEXT NOT NULL,
          "user_id" TEXT NOT NULL,
          "company_id" TEXT NOT NULL,
          
          -- Snapshot data at time of calculation
          "deal_amount" DECIMAL(12,2) NOT NULL,
          "commission_rate" DECIMAL(5,4) NOT NULL,
          "commission_amount" DECIMAL(12,2) NOT NULL,
          "target_id" TEXT,
          "target_name" TEXT,
          "period_start" TIMESTAMP(3) NOT NULL,
          "period_end" TIMESTAMP(3) NOT NULL,
          
          -- Workflow fields
          "status" TEXT NOT NULL DEFAULT 'calculated',
          "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "calculated_by" TEXT,
          "reviewed_at" TIMESTAMP(3),
          "reviewed_by" TEXT,
          "approved_at" TIMESTAMP(3),
          "approved_by" TEXT,
          "paid_at" TIMESTAMP(3),
          "payment_reference" TEXT,
          
          -- Audit fields
          "notes" TEXT,
          "rejection_reason" TEXT,
          "adjustment_amount" DECIMAL(12,2),
          "adjustment_reason" TEXT,
          "original_amount" DECIMAL(12,2),
          "adjusted_by" TEXT,
          "adjusted_at" TIMESTAMP(3),
          
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

          CONSTRAINT "commissions_pkey" PRIMARY KEY ("id"),
          CONSTRAINT "commissions_deal_id_key" UNIQUE ("deal_id")
        );
      `;

      console.log('✅ commissions table created');

      // Create indexes
      console.log('📇 Creating indexes for commissions table...');
      
      await prisma.$executeRaw`CREATE INDEX "commissions_user_id_idx" ON "commissions"("user_id");`;
      await prisma.$executeRaw`CREATE INDEX "commissions_company_id_idx" ON "commissions"("company_id");`;
      await prisma.$executeRaw`CREATE INDEX "commissions_status_idx" ON "commissions"("status");`;
      await prisma.$executeRaw`CREATE INDEX "commissions_period_start_period_end_idx" ON "commissions"("period_start", "period_end");`;
      await prisma.$executeRaw`CREATE INDEX "commissions_calculated_at_idx" ON "commissions"("calculated_at");`;
      await prisma.$executeRaw`CREATE INDEX "commissions_approved_at_idx" ON "commissions"("approved_at");`;
      await prisma.$executeRaw`CREATE INDEX "commissions_deal_id_idx" ON "commissions"("deal_id");`;

      console.log('✅ Indexes created');

      // Add foreign key constraints
      console.log('🔗 Adding foreign key constraints...');
      
      await prisma.$executeRaw`
        ALTER TABLE "commissions" 
        ADD CONSTRAINT "commissions_deal_id_fkey" 
        FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      `;
      
      await prisma.$executeRaw`
        ALTER TABLE "commissions" 
        ADD CONSTRAINT "commissions_user_id_fkey" 
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      `;
      
      await prisma.$executeRaw`
        ALTER TABLE "commissions" 
        ADD CONSTRAINT "commissions_company_id_fkey" 
        FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      `;
      
      await prisma.$executeRaw`
        ALTER TABLE "commissions" 
        ADD CONSTRAINT "commissions_target_id_fkey" 
        FOREIGN KEY ("target_id") REFERENCES "targets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      `;
      
      await prisma.$executeRaw`
        ALTER TABLE "commissions" 
        ADD CONSTRAINT "commissions_calculated_by_fkey" 
        FOREIGN KEY ("calculated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      `;
      
      await prisma.$executeRaw`
        ALTER TABLE "commissions" 
        ADD CONSTRAINT "commissions_reviewed_by_fkey" 
        FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      `;
      
      await prisma.$executeRaw`
        ALTER TABLE "commissions" 
        ADD CONSTRAINT "commissions_approved_by_fkey" 
        FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      `;

      console.log('✅ Foreign key constraints added');
    }

    // Check if commission_approvals table already exists
    const approvalsTableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'commission_approvals'
      );
    `;

    if (approvalsTableExists[0].exists) {
      console.log('✅ commission_approvals table already exists');
    } else {
      console.log('📦 Creating commission_approvals table...');

      // Create the commission_approvals table
      await prisma.$executeRaw`
        CREATE TABLE "commission_approvals" (
          "id" TEXT NOT NULL,
          "commission_id" TEXT NOT NULL,
          "action" TEXT NOT NULL,
          "performed_by" TEXT NOT NULL,
          "performed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "notes" TEXT,
          "previous_status" TEXT,
          "new_status" TEXT,
          "metadata" JSONB,
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

          CONSTRAINT "commission_approvals_pkey" PRIMARY KEY ("id")
        );
      `;

      console.log('✅ commission_approvals table created');

      // Create indexes
      console.log('📇 Creating indexes for commission_approvals table...');
      
      await prisma.$executeRaw`CREATE INDEX "commission_approvals_commission_id_idx" ON "commission_approvals"("commission_id");`;
      await prisma.$executeRaw`CREATE INDEX "commission_approvals_performed_by_idx" ON "commission_approvals"("performed_by");`;
      await prisma.$executeRaw`CREATE INDEX "commission_approvals_performed_at_idx" ON "commission_approvals"("performed_at");`;
      await prisma.$executeRaw`CREATE INDEX "commission_approvals_action_idx" ON "commission_approvals"("action");`;

      console.log('✅ Indexes created');

      // Add foreign key constraints
      console.log('🔗 Adding foreign key constraints...');
      
      await prisma.$executeRaw`
        ALTER TABLE "commission_approvals" 
        ADD CONSTRAINT "commission_approvals_commission_id_fkey" 
        FOREIGN KEY ("commission_id") REFERENCES "commissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      `;
      
      await prisma.$executeRaw`
        ALTER TABLE "commission_approvals" 
        ADD CONSTRAINT "commission_approvals_performed_by_fkey" 
        FOREIGN KEY ("performed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      `;

      console.log('✅ Foreign key constraints added');
    }

    // Verify the tables were created
    const verification = await prisma.$queryRaw`
      SELECT table_name, column_count 
      FROM (
        SELECT 'commissions' as table_name, COUNT(*) as column_count 
        FROM information_schema.columns 
        WHERE table_name = 'commissions'
        UNION ALL
        SELECT 'commission_approvals' as table_name, COUNT(*) as column_count 
        FROM information_schema.columns 
        WHERE table_name = 'commission_approvals'
      ) as tables
      ORDER BY table_name;
    `;

    console.log('\n📋 Table verification:');
    verification.forEach(table => {
      console.log(`  - ${table.table_name}: ${table.column_count} columns`);
    });

    console.log('\n✅ Commission tables created successfully!');
    console.log('\n⚠️  Note: The commission-approvals route is still stubbed and returns empty data.');
    console.log('The tables now exist but the feature needs to be fully implemented.');

  } catch (error) {
    console.error('❌ Error creating commission tables:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
createCommissionsTables()
  .then(() => {
    console.log('\n🎉 Migration completed successfully!');
    console.log('The commission tables now exist in production.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  });