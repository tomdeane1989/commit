// routes/auth.js - Secure authentication routes
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import Joi from 'joi';
import { 
  authRateLimit,
  authCheckRateLimit,
  generateSecureToken,
  generateRefreshToken,
  setSecureTokenCookie,
  setRefreshTokenCookie,
  clearAuthCookies,
  authenticateToken
} from '../middleware/secureAuth.js';

const router = express.Router();
const prisma = new PrismaClient();

// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  first_name: Joi.string().required(),
  last_name: Joi.string().required(),
  company_name: Joi.string().required(),
  company_domain: Joi.string().allow('').optional()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

// Register
router.post('/register', async (req, res) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        error: error.details[0].message,
        code: 'VALIDATION_ERROR'
      });
    }

    const { email, password, first_name, last_name, company_name, company_domain } = value;

    // Check if user already exists (normalize email for lookup)
    const existingUser = await prisma.users.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Create company
    const company = await prisma.companies.create({
      data: {
        name: company_name,
        domain: company_domain || null // Convert empty string to null for unique constraint
      }
    });

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user - First user in company gets manager role with admin privileges
    const user = await prisma.users.create({
      data: {
        email: email.toLowerCase(), // Normalize email to lowercase
        password: passwordHash,
        first_name,
        last_name,
        company_id: company.id,
        role: 'manager',  // Manager role for team/integrations access
        is_admin: true,   // Admin privileges for full control
        is_active: true
      }
    });

    // Generate JWT token for localStorage
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email,
        role: user.role,
        is_admin: user.is_admin,
        company_id: user.company_id
      }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        is_admin: user.is_admin,
        company_id: user.company_id
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        error: error.details[0].message,
        code: 'VALIDATION_ERROR'
      });
    }

    const { email, password } = value;

    // Find user (normalize email for lookup)
    const user = await prisma.users.findUnique({
      where: { email: email.toLowerCase() },
      include: { company: true }
    });

    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token for localStorage
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email,
        role: user.role,
        is_admin: user.is_admin,
        company_id: user.company_id
      }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        is_admin: user.is_admin,
        company_id: user.company_id,
        company_name: user.company.name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user - using JWT from Authorization header
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await prisma.users.findUnique({
      where: { id: decoded.id },
      include: { company: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        is_admin: user.is_admin,
        company_id: user.company_id,
        company_name: user.company.name
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Logout endpoint
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // Clear cookies
    clearAuthCookies(res);

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    clearAuthCookies(res);
    res.status(500).json({ 
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

export default router;