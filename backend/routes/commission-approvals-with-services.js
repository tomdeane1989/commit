// Test importing services one at a time
import express from 'express';
import { PrismaClient } from '@prisma/client';
import Joi from 'joi';
import { attachPermissions, requireManager, requireAdmin } from '../middleware/permissions.js';
import { Decimal } from 'decimal.js';

console.log('[DEBUG] Basic imports successful, attempting CommissionEngine import...');

// Try importing CommissionEngine
import CommissionEngine from '../services/CommissionEngine.js';
console.log('[DEBUG] CommissionEngine imported successfully');

// Don't import enhancedCommissionCalculator yet
// import enhancedCommissionCalculator from '../services/enhancedCommissionCalculator.js';

const router = express.Router();
const prisma = new PrismaClient();

router.get('/test', (req, res) => {
  res.json({ 
    status: 'With CommissionEngine import',
    hasCommissionEngine: !!CommissionEngine
  });
});

export default router;