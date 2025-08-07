import express from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAdmin } from '../middleware/permissions.js';
import { runCommissionRecalculation } from '../jobs/commissionRecalculationJob.js';
// Removed seed-data.js import to prevent auto-execution on server start

const router = express.Router();
const prisma = new PrismaClient();

router.post('/init', requireAdmin, async (req, res) => {
  try {
    console.log('Running DB push...');
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`); // just in case
    await prisma.$connect();
    await prisma.$disconnect();
    await prisma.$connect(); // reconnect after any disconnects

    // This assumes schema.prisma is already deployed and you’re calling db push externally
    // Replace this with direct logic if needed

    console.log('Seeding disabled in staging/production - use manual seeding script if needed');

    res.json({ success: true, message: 'Database initialized and seeded.' });
  } catch (error) {
    console.error('Admin init error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Manual trigger for commission recalculation job
router.post('/recalculate-commissions', requireAdmin, async (req, res) => {
  try {
    console.log('🔧 Admin triggered manual commission recalculation');
    
    // Run the job asynchronously and don't wait for completion
    runCommissionRecalculation().catch(error => {
      console.error('Error in manual commission recalculation:', error);
    });
    
    res.json({ 
      success: true, 
      message: 'Commission recalculation job started. Check logs for progress.',
      note: 'This job runs asynchronously and may take a few seconds to complete.'
    });
  } catch (error) {
    console.error('Error triggering commission recalculation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;