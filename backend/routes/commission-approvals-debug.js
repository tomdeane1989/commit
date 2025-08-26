// Debug version to test ES module loading in production
console.log('[DEBUG] Starting to load commission-approvals-debug.js');

import express from 'express';
console.log('[DEBUG] Express imported successfully');

import { PrismaClient } from '@prisma/client';
console.log('[DEBUG] PrismaClient imported successfully');

import Joi from 'joi';
console.log('[DEBUG] Joi imported successfully');

import { attachPermissions, requireManager, requireAdmin } from '../middleware/permissions.js';
console.log('[DEBUG] Permissions imported successfully');

// Try importing Decimal.js first since it's simpler
import { Decimal } from 'decimal.js';
console.log('[DEBUG] Decimal imported successfully');

// Now try the problematic imports one by one
console.log('[DEBUG] About to import CommissionEngine...');
try {
  const CommissionEngine = await import('../services/CommissionEngine.js');
  console.log('[DEBUG] CommissionEngine imported successfully:', !!CommissionEngine);
} catch (error) {
  console.log('[DEBUG] CommissionEngine import failed:', error.message);
}

console.log('[DEBUG] About to import enhancedCommissionCalculator...');
try {
  const enhancedCommissionCalculator = await import('../services/enhancedCommissionCalculator.js');
  console.log('[DEBUG] enhancedCommissionCalculator imported successfully:', !!enhancedCommissionCalculator);
} catch (error) {
  console.log('[DEBUG] enhancedCommissionCalculator import failed:', error.message);
}

const router = express.Router();
const prisma = new PrismaClient();

// Minimal routes for testing
router.get('/test', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Debug route working',
    timestamp: new Date().toISOString()
  });
});

console.log('[DEBUG] Router created and test route added');

export default router;
console.log('[DEBUG] Router exported successfully');