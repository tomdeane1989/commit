// Minimal Commission Approval Routes for debugging
import express from 'express';
import { attachPermissions } from '../middleware/permissions.js';

const router = express.Router();

// Attach permissions to all routes
router.use(attachPermissions);

// Minimal stub implementation
router.get('/', async (req, res) => {
  res.json({
    commissions: [],
    pagination: {
      page: 1,
      limit: 20,
      total: 0,
      pages: 0
    },
    summary: {
      total_count: 0,
      total_amount: 0,
      status_breakdown: []
    }
  });
});

router.get('/pending-count', async (req, res) => {
  res.json({ count: 0, requires_action: false });
});

router.get('/:id', async (req, res) => {
  res.status(404).json({ error: 'Commission approval feature not yet implemented' });
});

router.post('/:id/action', async (req, res) => {
  res.json({
    success: true,
    message: 'Commission approval feature not yet implemented'
  });
});

export default router;