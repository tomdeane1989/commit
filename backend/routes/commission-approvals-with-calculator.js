// Test importing enhancedCommissionCalculator only
import express from 'express';
import { PrismaClient } from '@prisma/client';
import Joi from 'joi';
import { attachPermissions, requireManager, requireAdmin } from '../middleware/permissions.js';
import { Decimal } from 'decimal.js';

console.log('[DEBUG] Basic imports successful, attempting enhancedCommissionCalculator import...');

// Don't import CommissionEngine
// import CommissionEngine from '../services/CommissionEngine.js';

// Try importing enhancedCommissionCalculator
import enhancedCommissionCalculator from '../services/enhancedCommissionCalculator.js';
console.log('[DEBUG] enhancedCommissionCalculator imported successfully');

const router = express.Router();
const prisma = new PrismaClient();

router.get('/test', (req, res) => {
  res.json({ 
    status: 'With enhancedCommissionCalculator import',
    hasCalculator: !!enhancedCommissionCalculator
  });
});

export default router;