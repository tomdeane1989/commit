import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { apiRateLimit, authenticateToken } from './middleware/secureAuth.js';
import { csrfProtection, csrfTokenHandler } from './middleware/csrfProtection.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import adminRoutes from './routes/admin.js';
import authRoutes from './routes/auth.js';
import teamsRoutes from './routes/teams.js';
import targetsRoutes from './routes/targets.js';
import dealsRoutes from './routes/deals.js';
import commissionsRoutes from './routes/commissions.js';
import integrationsRoutes from './routes/integrations.js';

// Load environment variables
dotenv.config();

// Debug environment variables in staging
console.log('🔍 Environment Check:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DATABASE_URL present:', !!process.env.DATABASE_URL);
console.log('DATABASE_URL length:', process.env.DATABASE_URL?.length || 0);
console.log('PORT:', process.env.PORT);

const app = express();
const PORT = process.env.PORT || 3002;

// Initialize Prisma with better error handling
let prisma;
try {
  prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'staging' ? ['query', 'info', 'warn', 'error'] : ['error'],
  });
  console.log('✅ Prisma client initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize Prisma client:', error);
  process.exit(1);
}

// Test database connection on startup
async function testDatabaseConnection() {
  try {
    await prisma.$connect();
    console.log('✅ Database connection successful');
    
    // Test a simple query
    const companyCount = await prisma.companies.count();
    console.log(`✅ Database query test successful. Companies count: ${companyCount}`);
    
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    console.error('DATABASE_URL:', process.env.DATABASE_URL ? 'Set but may be invalid' : 'Not set');
    throw error;
  }
}

// Continue with the rest of your server-working.js content...
// (This is just the startup portion - the full file would be too long)

// Health check with database status
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'ERROR', 
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error.message
    });
  }
});

// Initialize server
async function startServer() {
  try {
    await testDatabaseConnection();
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on 0.0.0.0:${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Add all the middleware and routes from server-working.js here
// For now, let's just test the basic startup

startServer();