// server.js
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Route imports
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import dealRoutes from './routes/deals.js';
import targetRoutes from './routes/targets.js';
import commissionRoutes from './routes/commissions.js';
import crmRoutes from './routes/crm.js';
import dashboardRoutes from './routes/dashboard.js';

// Middleware imports
import authMiddleware from './middleware/auth.js';
import errorHandler from './middleware/errorHandler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/deals', authMiddleware, dealRoutes);
app.use('/api/targets', authMiddleware, targetRoutes);
app.use('/api/commissions', authMiddleware, commissionRoutes);
app.use('/api/crm', authMiddleware, crmRoutes);
app.use('/api/dashboard', authMiddleware, dashboardRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});