import { PrismaClient } from '@prisma/client';
import pg from 'pg';
const { Client } = pg;

const prisma = new PrismaClient();

async function checkSchemaDrift() {
  console.log('🔍 Checking for schema drift between Prisma schema and database...\n');

  const pgClient = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await pgClient.connect();

    // Check for missing unique constraints
    console.log('1️⃣ Checking unique constraints...');
    
    // Get all unique constraints from database
    const dbConstraints = await pgClient.query(`
      SELECT 
        tc.table_name,
        tc.constraint_name,
        string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
        AND tc.table_name = kcu.table_name
      WHERE tc.constraint_type = 'UNIQUE'
        AND tc.table_schema = 'public'
      GROUP BY tc.table_name, tc.constraint_name
      ORDER BY tc.table_name, tc.constraint_name;
    `);

    console.log('\nDatabase unique constraints:');
    dbConstraints.rows.forEach(row => {
      console.log(`  ${row.table_name}.${row.constraint_name}: [${row.columns}]`);
    });

    // Check for missing columns
    console.log('\n2️⃣ Checking table columns...');
    
    // Check specific tables we know have had issues
    const tablesToCheck = ['users', 'deals', 'targets', 'teams', 'team_members'];
    
    for (const table of tablesToCheck) {
      const dbColumns = await pgClient.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `, [table]);
      
      console.log(`\n${table} table columns:`);
      dbColumns.rows.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
      });
    }

    // Check for missing indexes
    console.log('\n3️⃣ Checking indexes...');
    
    const dbIndexes = await pgClient.query(`
      SELECT 
        t.relname as table_name,
        i.relname as index_name,
        array_to_string(array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)), ', ') as columns
      FROM pg_class t
      JOIN pg_index ix ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
      WHERE t.relkind = 'r'
        AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
        AND NOT ix.indisprimary
        AND NOT ix.indisunique
      GROUP BY t.relname, i.relname
      ORDER BY t.relname, i.relname;
    `);

    console.log('\nDatabase indexes:');
    let currentTable = '';
    dbIndexes.rows.forEach(row => {
      if (row.table_name !== currentTable) {
        currentTable = row.table_name;
        console.log(`\n${currentTable}:`);
      }
      console.log(`  - ${row.index_name}: [${row.columns}]`);
    });

    // Specific checks based on known schema
    console.log('\n4️⃣ Specific schema checks...');
    
    // Check if deals table has unique constraint on crm_id, company_id
    const dealUniqueCheck = dbConstraints.rows.find(
      row => row.table_name === 'deals' && 
             row.constraint_name === 'unique_crm_deal_per_company'
    );
    console.log(`✅ deals.unique_crm_deal_per_company: ${dealUniqueCheck ? 'EXISTS' : 'MISSING'}`);

    // Check if users table has is_manager column
    const userColumns = await pgClient.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'is_manager';
    `);
    console.log(`✅ users.is_manager column: ${userColumns.rows.length > 0 ? 'EXISTS' : 'MISSING'}`);

  } catch (error) {
    console.error('Error checking schema:', error);
  } finally {
    await pgClient.end();
    await prisma.$disconnect();
  }
}

checkSchemaDrift();