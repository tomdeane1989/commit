// middleware/secureAuth.js - Secure authentication middleware
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import rateLimit from 'express-rate-limit';
import csrf from 'csrf';

const prisma = new PrismaClient();
const csrfProtection = csrf();

// Rate limiting for authentication endpoints (login/register only)
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 login attempts per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

// Separate rate limiting for /auth/me endpoint (more permissive)
export const authCheckRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 auth checks per windowMs
  message: {
    error: 'Too many authentication checks, please try again later',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

// General rate limiting for API endpoints
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests, please try again later',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// CSRF protection middleware
export const csrfProtectionMiddleware = (req, res, next) => {
  // Skip CSRF for login/register endpoints (they need to generate tokens)
  if (req.path === '/auth/login' || req.path === '/auth/register') {
    return next();
  }
  
  const token = csrfProtection.create(req.session?.secret || 'default-secret');
  const receivedToken = req.get('X-CSRF-Token');
  
  if (!receivedToken || !csrfProtection.verify(req.session?.secret || 'default-secret', receivedToken)) {
    return res.status(403).json({
      error: 'Invalid CSRF token',
      code: 'CSRF_INVALID'
    });
  }
  
  next();
};

// JWT authentication middleware for development with localStorage
export const authenticateToken = async (req, res, next) => {
  try {
    console.log('Auth middleware called for:', req.method, req.path);
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('No auth header or bearer token');
      return res.status(401).json({ 
        error: 'Access denied. No authentication token provided.',
        code: 'NO_TOKEN'
      });
    }

    const token = authHeader.split(' ')[1];

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch user from database to ensure they still exist and are active
    const user = await prisma.users.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role: true,
        is_admin: true,
        company_id: true,
        is_active: true
      }
    });

    if (!user || !user.is_active) {
      return res.status(401).json({ 
        error: 'User not found or inactive',
        code: 'USER_INACTIVE'
      });
    }

    // Attach user to request
    req.user = user;
    console.log('Auth middleware: User attached to request:', user.email, user.role, user.is_admin ? '(ADMIN)' : '');
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    return res.status(500).json({ 
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

// Generate secure token with short expiry
export const generateSecureToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email,
      role: user.role,
      company_id: user.company_id
    }, 
    process.env.JWT_SECRET, 
    { expiresIn: '15m' } // Short-lived token
  );
};

// Generate refresh token (longer expiry, stored in database)
export const generateRefreshToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      type: 'refresh'
    }, 
    process.env.JWT_SECRET, 
    { expiresIn: '7d' }
  );
};

// Set secure cookie with token
export const setSecureTokenCookie = (res, token) => {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000, // 15 minutes
    path: '/'
  });
};

// Set refresh token cookie
export const setRefreshTokenCookie = (res, refreshToken) => {
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/auth/refresh'
  });
};

// Clear all auth cookies
export const clearAuthCookies = (res) => {
  res.clearCookie('token');
  res.clearCookie('refreshToken');
};