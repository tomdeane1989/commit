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
import {
  generateAccessToken,
  generateRefreshToken as generateEnhancedRefreshToken,
  handleTokenRefresh
} from '../middleware/auth-enhanced.js';
import { refreshTokenRateLimit } from '../middleware/rate-limiter.js';
import { emailService } from '../services/email/emailService.js';

const router = express.Router();
const prisma = new PrismaClient();

// Utility function to capitalize names properly
const capitalizeName = (name) => {
  if (!name) return name;
  return name
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

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
        first_name: capitalizeName(first_name),
        last_name: capitalizeName(last_name),
        company_id: company.id,
        role: 'manager',  // Manager role for team/integrations access
        is_admin: true,   // Admin privileges for full control
        is_manager: true, // Manager privileges for team management
        is_active: true
      }
    });

    // Generate tokens - use enhanced auth if configured
    let token, refreshToken;
    
    if (process.env.JWT_ACCESS_TOKEN_EXPIRES_IN) {
      // Use enhanced auth with refresh tokens
      try {
        token = generateAccessToken(user);
        refreshToken = await generateEnhancedRefreshToken(user);
      } catch (err) {
        console.error('Error generating enhanced tokens:', err);
        // Fallback to simple token
        token = jwt.sign(
          { 
            id: user.id, 
            email: user.email,
            role: user.role,
            is_admin: user.is_admin,
            is_manager: user.is_manager,
            company_id: user.company_id
          }, 
          process.env.JWT_SECRET, 
          { expiresIn: '7d' }
        );
      }
    } else {
      // Use simple token
      token = jwt.sign(
        { 
          id: user.id, 
          email: user.email,
          role: user.role,
          is_admin: user.is_admin,
          is_manager: user.is_manager,
          company_id: user.company_id
        }, 
        process.env.JWT_SECRET, 
        { expiresIn: '7d' }
      );
    }

    // Send welcome email (don't block response on email sending)
    emailService.sendWelcomeEmail({
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        company_id: user.company_id
      },
      companyName: company.name
    }).catch(err => {
      console.error('Failed to send welcome email:', err);
      // Continue even if email fails
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      token,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        is_admin: user.is_admin,
        is_manager: user.is_manager,
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
    // Generate tokens - use enhanced auth if configured
    let token, refreshToken;
    
    if (process.env.JWT_ACCESS_TOKEN_EXPIRES_IN) {
      // Use enhanced auth with refresh tokens
      try {
        token = generateAccessToken(user);
        refreshToken = await generateEnhancedRefreshToken(user);
      } catch (err) {
        console.error('Error generating enhanced tokens:', err);
        // Fallback to simple token
        token = jwt.sign(
          { 
            id: user.id, 
            email: user.email,
            role: user.role,
            is_admin: user.is_admin,
            is_manager: user.is_manager,
            company_id: user.company_id
          }, 
          process.env.JWT_SECRET, 
          { expiresIn: '7d' }
        );
      }
    } else {
      // Use simple token
      token = jwt.sign(
        { 
          id: user.id, 
          email: user.email,
          role: user.role,
          is_admin: user.is_admin,
          is_manager: user.is_manager,
          company_id: user.company_id
        }, 
        process.env.JWT_SECRET, 
        { expiresIn: '7d' }
      );
    }

    res.json({
      success: true,
      message: 'Login successful',
      token,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        is_admin: user.is_admin,
        is_manager: user.is_manager,
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
        is_manager: user.is_manager,
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

// Token refresh endpoint
router.post('/refresh', refreshTokenRateLimit, handleTokenRefresh);

// Password reset request
router.post('/forgot-password', authRateLimit, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find user
    const user = await prisma.users.findUnique({
      where: { email: email.toLowerCase() },
      include: { company: true }
    });

    // Always return success to prevent email enumeration attacks
    if (!user || !user.is_active) {
      return res.json({
        success: true,
        message: 'If an account exists with that email, a password reset link has been sent.'
      });
    }

    // Generate reset token (32 random bytes)
    const resetToken = generateSecureToken();
    const resetExpires = new Date(Date.now() + 3600000); // 1 hour from now

    // Save token to database
    await prisma.users.update({
      where: { id: user.id },
      data: {
        password_reset_token: resetToken,
        password_reset_expires: resetExpires
      }
    });

    // Send password reset email (don't block response)
    emailService.sendPasswordResetEmail({
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        company_id: user.company_id
      },
      resetToken
    }).catch(err => {
      console.error('Failed to send password reset email:', err);
    });

    res.json({
      success: true,
      message: 'If an account exists with that email, a password reset link has been sent.'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset password with token
router.post('/reset-password', authRateLimit, async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    // Find user with valid token
    const user = await prisma.users.findFirst({
      where: {
        password_reset_token: token,
        password_reset_expires: {
          gte: new Date() // Token not expired
        },
        is_active: true
      }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password and clear reset token
    await prisma.users.update({
      where: { id: user.id },
      data: {
        password: passwordHash,
        password_reset_token: null,
        password_reset_expires: null
      }
    });

    res.json({
      success: true,
      message: 'Password has been reset successfully'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;