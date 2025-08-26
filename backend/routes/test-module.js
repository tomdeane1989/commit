// Ultra-simple test module
import express from 'express';

const router = express.Router();

router.get('/test', (req, res) => {
  res.json({ status: 'Test module working!' });
});

export default router;