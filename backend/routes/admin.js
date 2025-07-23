import express from 'express';
import { PrismaClient } from '@prisma/client';
import '../seed-data.js'; // or wherever your seeding logic lives

const router = express.Router();
const prisma = new PrismaClient();

router.post('/init', async (req, res) => {
  try {
    console.log('Running DB push...');
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`); // just in case
    await prisma.$connect();
    await prisma.$disconnect();
    await prisma.$connect(); // reconnect after any disconnects

    // This assumes schema.prisma is already deployed and you’re calling db push externally
    // Replace this with direct logic if needed

    console.log('Running seed...');
    await seed();

    res.json({ success: true, message: 'Database initialized and seeded.' });
  } catch (error) {
    console.error('Admin init error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;