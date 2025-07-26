// Staging Debug Server - Enhanced error handling and diagnostics
import express from 'express';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Load environment variables
dotenv.config();

console.log('🔍 STAGING STARTUP DIAGNOSTICS:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('DATABASE_URL present:', !!process.env.DATABASE_URL);
console.log('DATABASE_URL length:', process.env.DATABASE_URL?.length || 0);
console.log('JWT_SECRET present:', !!process.env.JWT_SECRET);

const app = express();
const PORT = process.env.PORT || 3002;

// Basic middleware for health check
app.use(express.json());

// Health check that doesn't depend on database
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
    port: PORT,
    dbConfigured: !!process.env.DATABASE_URL
  });
});

// Database health check
app.get('/health/db', async (req, res) => {
  try {
    const prisma = new PrismaClient();
    await prisma.$connect();
    
    // Test query
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    await prisma.$disconnect();
    
    res.json({ 
      status: 'OK', 
      database: 'connected',
      testQuery: result
    });
  } catch (error) {
    console.error('Database health check failed:', error);
    res.status(500).json({ 
      status: 'ERROR', 
      database: 'failed',
      error: error.message,
      details: error.toString()
    });
  }
});

// Simple auth test
app.post('/debug/auth', express.json(), (req, res) => {
  console.log('Debug auth request:', req.body);
  res.json({ 
    received: req.body,
    timestamp: new Date().toISOString()
  });
});

// Simple login test (mimics the real login endpoint)
app.post('/api/auth/login', express.json(), async (req, res) => {
  try {
    console.log('Debug login attempt:', req.body);
    const { email, password } = req.body;
    
    if (email === 'test@company.com' && password === 'password123') {
      // Return a test token for frontend testing
      res.json({
        success: true,
        message: 'Debug login successful',
        token: 'debug-token-for-staging-test',
        user: {
          id: 'debug-user-id',
          email: 'test@company.com',
          first_name: 'Debug',
          last_name: 'User',
          role: 'admin',
          is_admin: true,
          company_id: 'debug-company-id',
          company_name: 'Debug Company'
        }
      });
    } else {
      res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }
  } catch (error) {
    console.error('Debug login error:', error);
    res.status(500).json({
      success: false,
      error: 'Debug login failed'
    });
  }
});

// Start server with error handling
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Staging debug server running on 0.0.0.0:${PORT}`);
}).on('error', (error) => {
  console.error('❌ Server startup failed:', error);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

console.log('✅ Debug server setup complete');